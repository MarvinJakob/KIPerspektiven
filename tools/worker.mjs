import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { api, pages, repository, command, issueLabels } from './github.mjs';
import { reconcile, followUps } from './reconcile.mjs';

// Anweisung, die der Agent für diese Aufgabe zusätzlich zu AGENTS.md liest.
const guides = { spec: 'AGENTS_ANALYST.md', verify: 'AGENTS_TESTER.md', fix: 'AGENTS_FIXER.md', maint: 'AGENTS.md' };

export function candidates(issues, pulls, board) {
  const statuses = new Map(board.filter((i) => i.repository?.nameWithOwner === repository).map((i) => [i.number, i.status]));
  const waiting = followUps(issues);
  return issues.filter((i) => !i.pull_request && i.state === 'open').flatMap((issue) => {
    const labels = issueLabels(issue);
    const status = statuses.get(issue.number) ?? '';
    const answered = ['In Progress', 'In progress', 'In Arbeit'].includes(status);
    if (labels.has('in-progress') || labels.has('waiting-for-test') || (labels.has('blocked') && !answered)) return [];
    const pr = pulls.find((p) => p.state === 'open' && new RegExp(`^(spec|verify|fix)/${issue.number}$|^codex/maint-${issue.number}$`).test(p.head.ref));
    let team, stage;
    if (labels.has('release-blocker') && labels.has('bug')) { team = 'fix'; stage = 0; }
    else if (labels.has('maintenance') && labels.has('maintenance-approved')) { team = 'maint'; stage = 1; }
    else if (labels.has('test-defect')) { team = 'spec'; stage = 2; }
    else if (labels.has('requirement') && labels.has('specified')) { team = 'verify'; stage = 3; }
    else if (labels.has('bug')) { team = 'fix'; stage = 4; }
    else if (labels.has('requirement') && labels.has('needs-analysis')) { team = 'spec'; stage = 5; }
    else return [];
    if (status === 'Blocked') return [];
    if (pr && ['Review', 'In review', 'Merge Gate', 'In Progress', 'In progress', 'In Arbeit'].includes(status)) {
      team = pr.head.ref.startsWith('codex/maint-') ? 'maint' : pr.head.ref.split('/')[0];
    }
    const phase = ['Review', 'In review', 'Merge Gate'].includes(status) ? 0
      : ['In Progress', 'In progress', 'In Arbeit'].includes(status) ? 1 : 2;
    // Neuer Test einer Anforderung erst, wenn ihre Bug- und Testdefekt-Tickets geschlossen sind.
    if (team === 'verify' && phase === 2 && waiting.has(issue.number)) return [];
    // Review (phase 0) und Release-Nacharbeit gehören zur Rolle Reviewer. Baseline-PRs von Team 2
    // brauchen kein Review: Ein dort wartender PR wird von einem Tester fortgesetzt.
    const guide = (phase === 0 && team !== 'verify') || labels.has('release-failure') ? 'AGENTS_REVIEWER.md' : guides[team];
    return [{ number: issue.number, team, guide, stage, phase, status, pr: pr?.number,
      updated: issue.updated_at, title: issue.title }];
  }).sort((a, b) => Number(b.stage === 0) - Number(a.stage === 0) || a.phase - b.phase || a.stage - b.stage || a.number - b.number);
}

export function snapshot() {
  const issues = pages(`repos/${repository}/issues?state=open&per_page=100`);
  const pulls = pages(`repos/${repository}/pulls?state=open&per_page=100`);
  const board = JSON.parse(command(process.execPath, ['tools/board.mjs', 'list']));
  const runs = api(`repos/${repository}/actions/workflows/fidelity-run.yml/runs?branch=main&per_page=5`).workflow_runs;
  const queue = candidates(issues, pulls, board);
  const signal = createHash('sha256').update(JSON.stringify({
    issues: issues.map((i) => [i.number, i.updated_at, i.labels.map((l) => l.name)]),
    pulls: pulls.map((p) => [p.number, p.updated_at, p.head.sha]), board,
    runs: runs.map((r) => [r.id, r.status, r.conclusion]),
  })).digest('hex');
  return { queue, signal };
}

async function main() {
  const watch = process.argv.includes('--watch'), once = process.argv.includes('--once');
  const interval = Number(process.env.WORK_POLL_SECONDS ?? 60);
  if (!Number.isFinite(interval) || interval < 15 || interval > 3600) throw new Error('WORK_POLL_SECONDS muss zwischen 15 und 3600 liegen.');
  if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN fehlt im Prozess; Terminal mit aktualisierten Benutzervariablen starten.');
  command('git', ['--version']); command('gh', ['--version']); command('go', ['version']);
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24 oder neuer erforderlich.');
  api(`repos/${repository}`);
  const common = command('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const root = dirname(common);
  const runtime = join(common, 'worker-runtime'); mkdirSync(runtime, { recursive: true });
  if (!watch && !once) {
    console.log(JSON.stringify({ process: process.env.WORK_PROCESS_COMMIT ?? command('git', ['rev-parse', 'HEAD']), ...snapshot() }, null, 2));
    return;
  }
  const lock = join(runtime, 'supervisor.lock');
  const nonce = `${process.pid}:${Date.now()}`;
  try { writeFileSync(lock, nonce, { flag: 'wx' }); }
  catch { throw new Error('Betriebssteuerung bereits aktiv oder verwaist; PID in .git/worker-runtime/supervisor.lock prüfen. Keine automatische Übernahme.'); }
  let stopping = false, child;
  const stop = () => { stopping = true; }; // Let an active worker finish its handoff safely.
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const signalFile = join(runtime, 'last-signal');
  let last = existsSync(signalFile) ? readFileSync(signalFile, 'utf8') : '';
  try {
    do {
      const latest = command('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
      if (process.env.WORK_PROCESS_COMMIT && latest !== process.env.WORK_PROCESS_COMMIT) {
        console.log('Neuer Prozessstand verfügbar; Bootstrap erneut starten.');
        process.exitCode = 75; break;
      }
      reconcile({ apply: true, board: true });
      const state = snapshot();
      if (state.queue.length && state.signal !== last) {
        console.log(`Starte work für ${state.queue.length} mögliche Aufgaben.`);
        const program = process.env.WORK_AGENT_COMMAND || 'codex';
        const args = process.env.WORK_AGENT_ARGS ? JSON.parse(process.env.WORK_AGENT_ARGS)
          : ['exec', '--approve-for-me', '--add-dir', root, '-'];
        if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) throw new Error('WORK_AGENT_ARGS muss ein JSON-Array von Argumenten sein.');
        const childEnv = { ...process.env };
        delete childEnv.AGENT_ID; delete childEnv.CODEX_THREAD_ID; delete childEnv.CODEX_SESSION_ID;
        const result = await new Promise((resolve, reject) => {
          child = spawn(program, args, { cwd: process.cwd(), env: childEnv, windowsHide: true, stdio: ['pipe', 'inherit', 'inherit'] });
          child.on('error', reject); child.on('exit', (code) => resolve(code));
          child.stdin.end('work\n\nVerwende die AGENTS.md dieses aktuellen, unveränderlichen Prozess-Checkouts und die dort genannte Datei deiner Rolle (AGENTS_ANALYST.md, AGENTS_TESTER.md, AGENTS_FIXER.md oder AGENTS_REVIEWER.md). Bearbeite genau eine passende Aufgabe einschließlich Übergabe bzw. Abschluss und ende danach. Verwende einen eigenen Aufgaben-Worktree; ändere diesen Prozess-Checkout nicht. Ein Reviewer muss eine andere Sitzung sein. GitHub-Secrets bleiben ausschließlich in Actions.\n');
        });
        if (result !== 0) throw new Error(`Worker endete mit ${result}; Diagnose erforderlich, kein automatisches Überspringen.`);
        // Retry only on new evidence, not in a busy loop when every claim is occupied.
        last = state.signal; writeFileSync(signalFile, last);
      }
      if (!watch || stopping) break;
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    } while (!stopping);
  } finally { if (existsSync(lock) && readFileSync(lock, 'utf8') === nonce) unlinkSync(lock); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

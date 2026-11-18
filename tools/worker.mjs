import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { api, pages, repository, command, issueLabels } from './github.mjs';

const availableStatuses = new Set(['Backlog', 'Spezifiziert', 'Bug offen']);

export function candidates(issues, pulls, board) {
  const statuses = new Map(board.filter(i => i.repository?.nameWithOwner === repository && i.issueState === 'OPEN')
    .map(i => [i.number, i.status]));
  return issues.filter(issue => {
    const labels = issueLabels(issue);
    if (issue.pull_request || issue.state !== 'open' || issue.assignees?.length || !availableStatuses.has(statuses.get(issue.number))) return false;
    if (['in-progress','blocked','waiting-for-test'].some(label => labels.has(label))) return false;
    if (labels.has('maintenance') && !labels.has('maintenance-approved')) return false;
    const branch = new RegExp('^(?:codex/(?:maint-)?' + issue.number + '(?:-|$)|(?:spec|verify|fix)/' + issue.number + '$)');
    return !pulls.some(pr => branch.test(pr.head.ref));
  }).map(issue => ({
    number: issue.number, title: issue.title, status: statuses.get(issue.number),
    blocker: issueLabels(issue).has('release-blocker'), updated: issue.updated_at,
  })).sort((a,b) => Number(b.blocker) - Number(a.blocker) || a.number - b.number);
}

export function snapshot() {
  const issues = pages('repos/' + repository + '/issues?state=open&per_page=100');
  const pulls = pages('repos/' + repository + '/pulls?state=open&per_page=100');
  const board = JSON.parse(command(process.execPath, ['tools/board.mjs', 'list']));
  const queue = candidates(issues, pulls, board);
  const signal = createHash('sha256').update(JSON.stringify(queue)).digest('hex');
  return {queue, signal};
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
          child.stdin.end(`Bearbeite Ticket #${state.queue[0].number} nach AGENTS.md. Prüfe die Belegung, verwende einen eigenen Worktree und begleite Umsetzung und zugehörige Fehlerbehebung bis zum erfolgreichen Produktionsnachweis.\n`);
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

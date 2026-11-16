// Reconcile GitHub metadata from committed evidence. Never edits another worker's files or locks.
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { api, pages, repository, issueLabels, command } from './github.mjs';

export function dependencies(body = '') {
  return [...body.matchAll(/^Test-Defect-Dependency: #([1-9]\d*)\s*$/gm)].map((m) => Number(m[1]));
}
export function planIssue(issue, { specs, baseline, issues, pulls }) {
  const labels = issueLabels(issue), add = [], remove = [];
  let status, close = false;
  const ids = specs.get(issue.number);
  const activePR = pulls.some((p) => p.state === 'open' &&
    new RegExp(`^(spec|verify|fix)/${issue.number}$|^codex/maint-${issue.number}$`).test(p.head.ref));
  const mergedSpec = pulls.some((p) => p.merged_at && p.head.ref === `spec/${issue.number}`);
  if (labels.has('requirement') && ids?.length && mergedSpec && !activePR) {
    if (!labels.has('specified')) add.push('specified');
    if (labels.has('needs-analysis')) remove.push('needs-analysis');
    // A completed specification is handed to Team 2; local cleanup remains with its owner.
    if (labels.has('needs-analysis') && labels.has('in-progress')) remove.push('in-progress');
    if (!labels.has('in-progress') || labels.has('needs-analysis')) status = 'Spezifiziert';
    if (ids.every((id) => baseline.has(id))) {
      if (!labels.has('done')) add.push('done');
      close = issue.state === 'open';
      status = 'Funktioniert';
    }
  }
  const deps = dependencies(issue.body);
  if (labels.has('waiting-for-test') && deps.length && deps.every((id) => {
    const dep = issues.get(id);
    return dep?.state === 'closed' && dep.state_reason === 'completed';
  })) {
    remove.push('waiting-for-test');
    if (!labels.has('blocked')) status = 'Ready';
  }
  // A maintainer may have moved a blocked issue to In Progress after answering.
  // Never overwrite that handoff; only board.sh block sets the Blocked column.
  if (labels.has('blocked')) status = undefined;
  return { number: issue.number, add, remove, close, status };
}

export function reconcile({ apply = false, board = false } = {}) {
  const all = pages(`repos/${repository}/issues?state=all&per_page=100`).filter((i) => !i.pull_request);
  const issues = new Map(all.map((i) => [i.number, i]));
  const pulls = pages(`repos/${repository}/pulls?state=all&per_page=100`);
  const baseline = new Set(readFileSync('fidelity/baseline.txt', 'utf8').match(/REQ-\d+-AC\d+/g));
  const specs = new Map(readdirSync('fidelity/specs').filter((name) => /^REQ-\d+\.md$/.test(name)).map((name) => {
    const text = readFileSync(`fidelity/specs/${name}`, 'utf8');
    return [Number(name.match(/\d+/)[0]), [...new Set(text.match(/REQ-\d+-AC\d+/g))]];
  }));
  // Completed issues remain in the reconciliation set so a failed board write can be retried.
  const plans = all.filter((i) => i.state === 'open' || i.state_reason === 'completed').map((i) => planIssue(i, { specs, baseline, issues, pulls }));
  for (const plan of plans) {
    if (plan.add.length || plan.remove.length || plan.close) console.log(JSON.stringify(plan));
    if (!apply) continue;
    // Separate label operations preserve labels added concurrently by another actor.
    if (plan.add.length) api(`repos/${repository}/issues/${plan.number}/labels`, { method: 'POST', body: { labels: plan.add } });
    for (const label of plan.remove) api(`repos/${repository}/issues/${plan.number}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
    if (plan.close) api(`repos/${repository}/issues/${plan.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
    if (board && plan.status) command(process.execPath, ['tools/board.mjs', String(plan.number), plan.status]);
  }
  return plans;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { reconcile({ apply: process.argv.includes('--apply'), board: process.argv.includes('--board') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

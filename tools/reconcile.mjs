// Reconcile GitHub metadata from committed evidence. Never edits another worker's files or locks.
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { api, pages, repository, issueLabels, command } from './github.mjs';

export function dependencies(body = '') {
  return [...body.matchAll(/^Test-Defect-Dependency: #([1-9]\d*)\s*$/gm)].map((m) => Number(m[1]));
}
// Offene Folgetickets je Anforderung (feature, bug, test-defect; Titel nennt REQ-<n>). Team 2 testet eine
// Anforderung erst wieder, wenn keines mehr offen ist (AGENTS_TESTER.md); bis dahin wartet sie in Merge Gate.
export function followUpTickets(issues) {
  const result = new Map();
  for (const issue of issues) {
    const names = (issue.labels ?? []).map((label) => label.name);
    if (issue.pull_request || issue.state !== 'open' || !['feature', 'bug', 'test-defect'].some((name) => names.includes(name))) continue;
    for (const number of new Set([...(issue.title ?? '').matchAll(/\bREQ-(\d+)\b/g)].map((m) => Number(m[1])))) {
      result.set(number, [...(result.get(number) ?? []), issue]);
    }
  }
  return result;
}
export function followUps(issues) { return new Set(followUpTickets(issues).keys()); }
// Offener Implementierungs-PR eines Folgetickets (Branch fix/<n>).
export function followUpPR(ticket, pulls) {
  return pulls.find((p) => p.state === 'open' && p.head?.ref === `fix/${ticket.number}`);
}
// Merker nach abgeschlossenem Anforderungs-Review (AGENTS_REVIEWER.md). Er gilt nur, solange Folgetickets
// offen sind und jedes einen offenen PR hat; sonst entfernt ihn der Prozessabgleich.
export const reviewedLabel = 'requirement-reviewed';
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
    // Mit offenen Folgetickets wartet die Anforderung in Merge Gate auf deren PRs und das Anforderungs-Review.
    if (!labels.has('in-progress') || labels.has('needs-analysis')) {
      status = followUps(issues.values()).has(issue.number) ? 'Merge Gate' : 'Spezifiziert';
    }
    if (ids.every((id) => baseline.has(id)) && !followUps(issues.values()).has(issue.number) && !labels.has('in-progress')) {
      if (!labels.has('done')) add.push('done');
      close = issue.state === 'open';
      status = 'Funktioniert';
    }
  }
  if (labels.has(reviewedLabel)) {
    const tickets = followUpTickets(issues.values()).get(issue.number) ?? [];
    if (!tickets.length || tickets.some((ticket) => !followUpPR(ticket, pulls))) remove.push(reviewedLabel);
  }
  const deps = dependencies(issue.body);
  if (labels.has('waiting-for-test') && deps.length && deps.every((id) => {
    const dep = issues.get(id);
    return dep?.state === 'closed' && dep.state_reason === 'completed';
  })) {
    remove.push('waiting-for-test');
    if (!labels.has('blocked')) status = 'Ready';
  }
  if (!activePR && !labels.has('in-progress') && issue.state === 'open') {
    if (['bug', 'feature', 'test-defect'].some((label) => labels.has(label))) status = 'Bug offen';
    else if (labels.has('maintenance') || labels.has('needs-analysis')) status = 'Ready';
  }
  // An open PR may have been returned to implementation after review findings. Preserve its handoff.
  // A maintainer may have moved a blocked issue to In Progress after answering.
  // Never overwrite that handoff; only board.sh block sets the Blocked column.
  if (labels.has('blocked')) status = undefined;
  if (issue.state === 'closed' && issue.state_reason === 'completed') {
    status = 'Funktioniert';
    for (const label of ['in-progress', 'blocked', 'waiting-for-test']) {
      if (labels.has(label) && !remove.includes(label)) remove.push(label);
    }
  }
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

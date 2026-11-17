// Runs trusted default-branch code on issue events; never executes issue text or PR code.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { api, pages, repository } from './github.mjs';
import { featureFixes } from './feature-links.mjs';

export function affectedPulls(event, issues, pulls) {
  if (!event.issue || event.issue.pull_request) return [];
  const before = event.changes?.body?.from;
  const previous = before === undefined ? issues : issues.map((issue) => issue.number === event.issue.number ? { ...issue, body: before } : issue);
  return pulls.filter((pr) => {
    const match = /^fix\/([1-9]\d*)$/.exec(pr.head.ref);
    if (pr.state !== 'open' || pr.base.ref !== 'main' || !match) return false;
    const number = Number(match[1]);
    // Refresh even ambiguous affected relationships so their gates fail closed;
    // malformed unrelated relationships must not abort updates for other PRs.
    return number === event.issue.number || [issues, previous].some((state) => featureFixes(number, state, { strict: false }).some((i) => i.number === event.issue.number));
  });
}

export function latestGate(pr, runs) {
  return runs.filter((run) => run.head_sha === pr.head.sha && run.event === 'pull_request'
    && run.pull_requests?.some((p) => p.number === pr.number)).sort((a, b) => b.id - a.id)[0];
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const issues = pages(`repos/${repository}/issues?state=all&per_page=100`);
  // Deleted issues remain in the event so their former root is invalidated as well.
  if (!issues.some((i) => i.number === event.issue.number)) issues.push(event.issue);
  for (const pr of affectedPulls(event, issues, pages(`repos/${repository}/pulls?state=open&per_page=100`))) {
    const runs = [];
    for (let page = 1; ; page++) {
      const batch = api(`repos/${repository}/actions/workflows/merge-gate.yml/runs?head_sha=${pr.head.sha}&per_page=100&page=${page}`).workflow_runs;
      runs.push(...batch);
      if (batch.length < 100) break;
    }
    const run = latestGate(pr, runs);
    if (!run) throw new Error(`Kein aktueller Merge-Gate-Lauf für PR #${pr.number}; Gate manuell anstoßen.`);
    if (run.status !== 'completed') {
      console.log(`PR #${pr.number}: laufendes Gate prüft die Abhängigkeiten vor Abschluss erneut.`);
      continue;
    }
    api(`repos/${repository}/actions/runs/${run.id}/rerun`, { method: 'POST' });
    console.log(`PR #${pr.number}: Merge Gate nach Änderung an #${event.issue.number} erneut gestartet.`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

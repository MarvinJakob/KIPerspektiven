// Ticketübergabe nach dem Merge (Anforderung #55, REQ-55-AC3). Läuft im Release Gate auf main:
// Sucht den gemergten PR des Commits und kommentiert jedes mit Refs/Closes/Fixes/Resolves #<n> referenzierte Ticket
// mit PR, geprüftem PR-Head, Commit auf main und Release-Gate-Lauf. Den Boardstatus setzt der verantwortliche Agent.
import { pathToFileURL } from 'node:url';

export function referencedIssues(body) {
  const numbers = [...String(body ?? '').matchAll(/\b(?:refs|closes|fixes|resolves)\s+((?:#\d+(?:\s*,\s*|\s+und\s+|\s+and\s+)?)+)/gi)]
    .flatMap((m) => [...m[1].matchAll(/#(\d+)/g)].map((n) => Number(n[1])));
  return [...new Set(numbers)];
}

export function mergedPull(pulls, commit) {
  return pulls.find((p) => p.merged_at && p.merge_commit_sha === commit);
}

export function handoverComment({ pull, commit, runUrl }) {
  return [
    '**Release Gate gestartet**',
    '',
    `- PR: #${pull.number} (geprüfter PR-Head \`${pull.head.sha}\`)`,
    `- Commit auf \`main\`: \`${commit}\``,
    `- Release-Gate-Lauf: ${runUrl}`,
    '',
    'Das Release Gate prüft die vollständige Suite und installiert anschließend genau das geprüfte Image. Status: **Release Gate** bis zum Produktionsnachweis.',
  ].join('\n');
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: commit, GH_TOKEN: token, GITHUB_SERVER_URL: server = 'https://github.com', GITHUB_RUN_ID: runId } = process.env;
  const api = async (path, init = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`GitHub-Abfrage ${path}: HTTP ${response.status}`);
    return response.json();
  };
  const pull = mergedPull(await api(`commits/${commit}/pulls`), commit);
  if (!pull) {
    console.log(`Kein gemergter PR für ${commit}; keine Ticketübergabe.`);
    return;
  }
  const runUrl = `${server}/${repository}/actions/runs/${runId}`;
  const issues = referencedIssues(pull.body);
  if (!issues.length) console.log(`PR #${pull.number} referenziert kein Ticket.`);
  for (const number of issues) {
    const issue = await api(`issues/${number}`);
    if (issue.pull_request) continue;
    const comments = await api(`issues/${number}/comments?per_page=100`);
    if (comments.some((c) => c.body?.includes(runUrl))) continue;
    await api(`issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body: handoverComment({ pull, commit, runUrl }) }) });
    console.log(`Ticketübergabe an #${number} kommentiert (PR #${pull.number}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

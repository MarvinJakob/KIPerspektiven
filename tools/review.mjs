// Run only in the independent reviewer session after inspecting the exact commit.
import { readFileSync } from 'node:fs';
import { api, repository } from './github.mjs';

try {
  const [number, head, reportFile] = process.argv.slice(2);
  const session = process.env.AGENT_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID;
  if (!/^[1-9]\d*$/.test(number ?? '') || !/^[a-f0-9]{40}$/.test(head ?? '') || !reportFile
    || !/^\/?[A-Za-z0-9][A-Za-z0-9._:/-]+$/.test(session ?? '')) {
    throw new Error('Aufruf aus unabhängiger Sitzung: node tools/review.mjs <PR> <geprüfter SHA> <Review-Bericht>; AGENT_ID erforderlich.');
  }
  const pr = api(`repos/${repository}/pulls/${number}`);
  if (pr.head.sha !== head) throw new Error('PR hat sich seit der Prüfung geändert.');
  const implementers = /^Implementer-Agents: (.+)$/m.exec(pr.body ?? '')?.[1].split(/[\s,]+/);
  if (!implementers?.length || implementers.includes(session)) throw new Error('Unabhängige Reviewer-Sitzung erforderlich.');
  const report = readFileSync(reportFile, 'utf8').trim();
  if (report.length < 40) throw new Error('Konkreter Review-Bericht zu Korrektheit, Sicherheit und Wartbarkeit fehlt.');
  const review = api(`repos/${repository}/pulls/${number}/reviews`, { method: 'POST', body: {
    commit_id: head, event: 'COMMENT', body: `Reviewer-Agent: ${session}\nReviewed-Commit: ${head}\nReview-Result: accepted\n\n${report}`,
  } });
  // The implementer cannot satisfy the gate merely by inventing a second ID in the PR body.
  // Shared GitHub credentials still require honest session identities; see AGENTS.md.
  let body = pr.body;
  for (const [field, value] of [['Reviewer-Agent', session], ['Reviewed-Commit', head], ['Review-ID', String(review.id)]]) {
    const pattern = new RegExp(`^${field}:.*$`, 'gm');
    body = pattern.test(body) ? body.replace(pattern, `${field}: ${value}`) : `${body}\n${field}: ${value}\n`;
  }
  body = body.replace(/^(\s*- )\[ \]( .*Review.*)$/gm, '$1[x]$2');
  if (api(`repos/${repository}/pulls/${number}`).head.sha !== head) throw new Error('Neuer Commit während der Abnahme; Review ist veraltet, PR-Text bleibt unverändert.');
  api(`repos/${repository}/pulls/${number}`, { method: 'PATCH', body: { body } });
  console.log(`Review ${review.id} für ${head} dokumentiert.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

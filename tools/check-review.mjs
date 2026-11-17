import { pathToFileURL } from 'node:url';
import { api, repository } from './github.mjs';

// Ein Baseline-PR von Team 2 ändert nur fidelity/baseline.txt (Job „Team-Grenzen“), und der Job „Fidelity“
// weist nach, dass die ergänzten IDs bestehen. Ein zusätzliches Agenten-Review prüft dort nichts Weiteres.
export function reviewRequired(branch) { return !/^verify\/\d+$/.test(branch); }

export function checkReview(body, head, evidence) {
  const field = (name) => {
    const values = [...body.matchAll(new RegExp(`^${name}:[ \\t]*(.*)$`, 'gm'))];
    if (values.length !== 1) throw new Error(`${name}: genau einmal im PR-Text angeben.`);
    return values[0][1].trim();
  };
  const validId = (id) => /^\/?[A-Za-z0-9][A-Za-z0-9._:/-]+$/.test(id) && !/^(TODO|TBD|pending)$/i.test(id);
  const implementers = field('Implementer-Agents').split(/[\s,]+/);
  const reviewer = field('Reviewer-Agent');
  if (!implementers.length || !implementers.every(validId) || !validId(reviewer)) {
    throw new Error('Eindeutige Implementierer- und Reviewer-Sitzungs-IDs fehlen.');
  }
  if (implementers.includes(reviewer)) throw new Error('Ein Implementierer darf sein Ticket nicht selbst reviewen.');
  const commit = field('Reviewed-Commit');
  if (!/^[a-f0-9]{40}$/.test(commit) || commit !== head) throw new Error('Unabhängiges Review des aktuellen Head-Commits fehlt.');
  if (!/^\s*- \[[xX]\] .*Review/m.test(body) || /^\s*- \[ \]/m.test(body)) {
    throw new Error('Merge-Gate-Checkliste einschließlich unabhängigem Review ist nicht vollständig.');
  }
  if (evidence !== undefined) {
    const reviewId = field('Review-ID');
    if (!/^[1-9]\d*$/.test(reviewId) || String(evidence.id) !== reviewId || evidence.commit_id !== head
      || !['COMMENTED', 'APPROVED'].includes(evidence.state) || !evidence.submitted_at) {
      throw new Error('GitHub-Review-Nachweis für den aktuellen Commit fehlt oder wurde verworfen.');
    }
    const expected = `Reviewer-Agent: ${reviewer}\nReviewed-Commit: ${head}\nReview-Result: accepted`;
    if (!evidence.body?.replaceAll('\r\n', '\n').includes(expected)) throw new Error('Reviewer-Sitzung und Abnahme stimmen nicht mit dem GitHub-Review überein.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!reviewRequired(process.env.BRANCH ?? '')) {
      console.log('Baseline-PR von Team 2: Team-Grenzen und Fidelity-Job weisen die Änderung nach, kein Agenten-Review nötig.');
      process.exit(0);
    }
    const body = process.env.PR_BODY ?? '';
    const reviewId = /^Review-ID: (\d+)\s*$/m.exec(body)?.[1];
    const pr = process.env.PR_NUMBER;
    if (!/^\d+$/.test(pr ?? '') || !reviewId) throw new Error('PR_NUMBER oder Review-ID fehlt.');
    const evidence = api(`repos/${repository}/pulls/${pr}/reviews/${reviewId}`);
    const permission = api(`repos/${repository}/collaborators/${encodeURIComponent(evidence.user.login)}/permission`).permission;
    if (!['admin', 'maintain', 'write'].includes(permission)) throw new Error('Review stammt nicht von einem berechtigten Repository-Mitwirkenden.');
    checkReview(body, process.env.HEAD_SHA ?? '', evidence);
    console.log('Unabhängiger Reviewer und aktueller Commit dokumentiert; Checkliste vollständig.');
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

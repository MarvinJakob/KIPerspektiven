// Recheck live dependencies immediately before the existing, head-pinned merge operation.
import { api, command, repository } from './github.mjs';
import { checkReview, reviewRequired } from './check-review.mjs';
import { liveFeatureEvidence } from './feature-links.mjs';

try {
  const [number, head] = process.argv.slice(2);
  if (!/^[1-9]\d*$/.test(number ?? '') || !/^[a-f0-9]{40}$/.test(head ?? '')) throw new Error('Aufruf: node tools/merge.mjs <PR> <geprüfter SHA>');
  command('gh', ['pr', 'checks', number, '-R', repository, '--watch'], { stdio: ['ignore', 'inherit', 'inherit'] });
  const pr = api(`repos/${repository}/pulls/${number}`);
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'main' || pr.head.sha !== head) throw new Error('PR ist nicht bereit oder Head seit dem Review geändert.');
  if (reviewRequired(pr.head.ref)) {
    const body = pr.body ?? '';
    const id = /^Review-ID: (\d+)\s*$/m.exec(body)?.[1];
    if (!id) throw new Error('Review-ID fehlt.');
    const reviewer = /^Reviewer-Agent: (.+)$/m.exec(body)?.[1].trim();
    checkReview(body, head, api(`repos/${repository}/pulls/${number}/reviews/${id}`), liveFeatureEvidence(pr.head.ref, head, reviewer));
  }
  command('gh', ['pr', 'merge', number, '-R', repository, '--squash', '--match-head-commit', head, '--delete-branch'], { stdio: ['ignore', 'inherit', 'inherit'] });
} catch (error) { console.error(error.message); process.exitCode = 1; }

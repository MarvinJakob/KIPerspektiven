import assert from 'node:assert/strict';
import test from 'node:test';
import { addBlocked, resolveStatus, openItems } from './board.mjs';
import { checkReview } from './check-review.mjs';

test('Blocked ergänzen erhält IDs und vorhandene Optionen unverändert', () => {
  const old = [{ id: 'ready', name: 'Ready', color: 'GREEN', description: 'Bereit' }];
  const result = addBlocked(old);
  assert.deepEqual(result[0], old[0]);
  assert.equal(result[1].name, 'Blocked');
  assert.equal(old.length, 1);
  assert.deepEqual(addBlocked(result), result);
});

test('alte Board-Namen bleiben unterstützt; neue Namen werden bevorzugt', () => {
  const options = ['In Arbeit', 'In Progress', 'Merge Gate', 'Review', 'Ready'].map((name) => ({ name }));
  assert.equal(resolveStatus('In Arbeit', options).name, 'In Progress');
  assert.equal(resolveStatus('Merge Gate', options).name, 'Review');
  assert.equal(resolveStatus('Review', [{ name: 'Merge Gate' }]).name, 'Merge Gate');
  assert.throws(() => resolveStatus('Blocked', options), /fehlt/);
});

test('Board-Warteschlange enthält offene Issues und PRs, keine geschlossenen oder Entwürfe ohne Issue', () => {
  const node = (content, status = 'Ready') => ({ content, fieldValueByName: { name: status } });
  const result = openItems([
    node({ number: 1, issueState: 'OPEN' }), node({ number: 2, prState: 'OPEN' }, 'Review'),
    node({ issueState: 'CLOSED' }), node({ prState: 'MERGED' }), node(null), node({ title: 'Draft item' }),
  ]);
  assert.deepEqual(result.map((i) => [i.number, i.status]), [[1, 'Ready'], [2, 'Review']]);
});

const head = 'a'.repeat(40);
const body = `Implementer-Agents: session-1, session-2
Reviewer-Agent: session-3
Reviewed-Commit: ${head}
- [x] Unabhängiges Review durchgeführt
- [x] Tests ausgeführt`;

test('anderer Reviewer darf aktuellen Commit abnehmen', () => checkReview(body, head));
test('kanonische Subagent-ID wird als unabhängiger Reviewer akzeptiert', () => {
  checkReview(body.replace('session-3', '/root/review_board_workflow'), head);
});
test('keiner der Implementierer darf selbst reviewen', () => {
  for (const id of ['session-1', 'session-2']) {
    assert.throws(() => checkReview(body.replace('Reviewer-Agent: session-3', `Reviewer-Agent: ${id}`), head), /selbst reviewen/);
  }
});
test('neuer Commit erfordert erneutes Review', () => assert.throws(() => checkReview(body, 'b'.repeat(40)), /Head-Commits/));

test('Gate verlangt echten GitHub-Review-Nachweis mit passender Sitzung und Commit', () => {
  const evidence = { id: 123, commit_id: head, state: 'COMMENTED', submitted_at: '2026-11-16',
    body: `Reviewer-Agent: session-3\nReviewed-Commit: ${head}\nReview-Result: accepted\n\nKeine offenen Befunde.` };
  const documented = `${body}\nReview-ID: 123`;
  checkReview(documented, head, evidence);
  for (const change of [{ id: 124 }, { commit_id: 'b'.repeat(40) }, { state: 'DISMISSED' },
    { body: evidence.body.replace('session-3', 'session-1') }, { submitted_at: null }]) {
    assert.throws(() => checkReview(documented, head, { ...evidence, ...change }));
  }
  assert.throws(() => checkReview(body, head, evidence), /Review-ID/);
});
test('fehlende, doppelte und Platzhalter-Nachweise werden zurückgewiesen', () => {
  for (const invalid of [body.replace('session-3', '<Reviewer>'), body.replace('session-3', 'pending'),
    body.replace('Reviewer-Agent: session-3\n', ''), `${body}\nReviewer-Agent: session-4`, body.replace('- [x] Tests', '- [ ] Tests')]) {
    assert.throws(() => checkReview(invalid, head));
  }
});

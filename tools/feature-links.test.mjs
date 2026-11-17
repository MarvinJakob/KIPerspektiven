import assert from 'node:assert/strict';
import test from 'node:test';
import { featureParent, featureFixes, pendingFixes, featureEvidence, evidenceDigest, checkFeatureEvidence, liveFeatureEvidence } from './feature-links.mjs';
import { affectedPulls, latestGate } from './refresh-feature-gates.mjs';
import { candidates } from './worker.mjs';
import { planIssue } from './reconcile.mjs';
import { checkReview } from './check-review.mjs';

const issue = (number, body = '', state = 'open', state_reason) => ({ number, title: `Ticket ${number}`, body, state, state_reason, labels: [{ name: 'bug' }] });
const pr = (number, ticket, merged = false) => ({ number, state: merged ? 'closed' : 'open',
  merged_at: merged ? '2026-11-17' : null, merge_commit_sha: 'b'.repeat(40), base: { ref: 'main' },
  head: { ref: `fix/${ticket}`, sha: 'a'.repeat(40) }, body: 'Implementer-Agents: fix-agent' });
const board = [{ number: 10, status: 'Merge Gate', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }];

test('feature relationship is explicit, unique, CRLF-safe, and independent of REQ titles', () => {
  assert.equal(featureParent('Feature-Ticket: #10\r\n\r\nTestbefund'), 10);
  assert.equal(featureParent('Siehe #10 und REQ-10-AC1'), undefined);
  assert.equal(featureParent(null), undefined);
  for (const body of ['Feature-Ticket: #0', 'Feature-Ticket: #x', 'Feature-Ticket: #10\nFeature-Ticket: #10']) assert.throws(() => featureParent(body));
});

test('all nested fixes block their original feature; unrelated features remain independent', () => {
  const issues = [issue(10), issue(11, 'Feature-Ticket: #10'), issue(12, 'Feature-Ticket: #11'), issue(13, 'Feature-Ticket: #99')];
  assert.deepEqual(featureFixes(10, issues).map((i) => i.number), [11, 12]);
  assert.equal(featureFixes(99, issues).length, 1);
  assert.throws(() => featureFixes(10, [issue(11, 'Feature-Ticket: #10'), issue(10, 'Feature-Ticket: #11')]), /Zyklische/);
});

test('only completed issues release the feature, never canceled issues', () => {
  const fixes = [issue(11, 'Feature-Ticket: #10', 'closed', 'completed'), issue(12, 'Feature-Ticket: #10', 'closed', 'not_planned')];
  assert.deepEqual(pendingFixes(10, fixes).map((i) => i.number), [12]);
});

test('last bug releases exactly the existing independent feature review, reopening blocks it again', () => {
  const root = issue(10), bug = issue(11, 'Feature-Ticket: #10');
  const pulls = [pr(100, 10)];
  let queue = candidates([root, bug], pulls, board);
  assert.ok(!queue.some((i) => i.number === 10));
  assert.equal(queue.find((i) => i.number === 11).guide, 'AGENTS_FIXER.md');
  bug.state = 'closed'; bug.state_reason = 'completed';
  assert.ok(!candidates([root, bug], pulls, board).some((i) => i.number === 10));
  pulls.push(pr(101, 11, true));
  queue = candidates([root, bug], pulls, board);
  assert.deepEqual(queue.map((i) => [i.number, i.guide]), [[10, 'AGENTS_REVIEWER.md']]);
  bug.state = 'open';
  assert.ok(!candidates([root, bug], pulls, board).some((i) => i.number === 10));
});

test('absent, open and closed unmerged fix PRs hold only their own feature', () => {
  const root = issue(10), bug = issue(11, 'Feature-Ticket: #10', 'closed', 'completed');
  const other = issue(20), rows = [...board, { ...board[0], number: 20 }];
  const open = pr(101, 11), unmerged = { ...open, state: 'closed' };
  for (const fixPulls of [[], [open], [unmerged]]) {
    const queue = candidates([root, bug, other], [pr(100, 10), pr(200, 20), ...fixPulls], rows);
    assert.deepEqual(queue.map((i) => i.number), [20]);
  }
  const queue = candidates([root, bug, other], [pr(100, 10), pr(200, 20), pr(101, 11, true)], rows);
  assert.deepEqual(queue.map((i) => i.number), [10, 20]);
});

test('nested bugs wait for the last actually merged fix, including explicit Fix-PR evidence', () => {
  const data = [issue(10), issue(11, 'Feature-Ticket: #10', 'closed', 'completed'),
    issue(12, 'Feature-Ticket: #11\nFix-PR: #102', 'closed', 'completed')];
  const pulls = [pr(100, 10), pr(101, 11, true)];
  assert.equal(candidates(data, pulls, board).length, 0);
  const last = pr(102, 99, true);
  assert.deepEqual(candidates(data, [...pulls, last], board).map((i) => i.number), [10]);
  last.merged_at = null;
  assert.equal(candidates(data, [...pulls, last], board).length, 0);
});

test('individual bug PRs remain reviewable while the original feature waits', () => {
  const rows = [...board, { ...board[0], number: 11 }];
  const queue = candidates([issue(10), issue(11, 'Feature-Ticket: #10')], [pr(100, 10), pr(101, 11)], rows);
  assert.deepEqual(queue.map((i) => [i.number, i.guide]), [[11, 'AGENTS_REVIEWER.md']]);
});

test('reconciliation preserves the feature gate while its bug is routed to Team 3', () => {
  const root = issue(10), bug = issue(11, 'Feature-Ticket: #10');
  const evidence = { specs: new Map(), baseline: new Set(), issues: new Map([[10, root], [11, bug]]), pulls: [pr(100, 10)] };
  assert.equal(planIssue(root, evidence).status, undefined);
  assert.equal(planIssue(bug, evidence).status, 'Bug offen');
});

test('closing a bug without a merged fix or as not planned is not sufficient evidence', () => {
  const fix = issue(11, 'Feature-Ticket: #10', 'closed', 'completed');
  assert.throws(() => featureEvidence(10, [fix], []), /Fix-Nachweis/);
  assert.throws(() => featureEvidence(10, [fix], [pr(101, 11)]), /Fix-Nachweis/);
  fix.state_reason = 'not_planned';
  assert.throws(() => featureEvidence(10, [fix], [pr(101, 11, true)]), /Offene Feature-Fixes/);
});

test('a bug already fixed by another merged PR can cite that exact proof', () => {
  const fix = issue(11, 'Feature-Ticket: #10\nFix-PR: #123', 'closed', 'completed');
  assert.equal(featureEvidence(10, [fix], [pr(123, 90, true)])[0].fixes[0].pr, 123);
});

test('the review fingerprint covers all fixes, exact commits and implementer identities', () => {
  const fix = issue(11, 'Feature-Ticket: #10', 'closed', 'completed');
  const pull = pr(101, 11, true);
  const evidence = featureEvidence(10, [fix], [pull]);
  const field = `Reviewed-Feature-Fixes: ${evidenceDigest(evidence)}`;
  checkFeatureEvidence(field, evidence);
  assert.throws(() => checkFeatureEvidence('', evidence), /Review aller/);
  assert.throws(() => checkFeatureEvidence(field, []), /Zuordnung/);
  for (const changed of [{ ...pull, merge_commit_sha: 'c'.repeat(40) }, { ...pull, body: 'Implementer-Agents: other-agent' }]) {
    assert.throws(() => checkFeatureEvidence(field, featureEvidence(10, [fix], [changed])), /Review aller/);
  }
  assert.throws(() => checkFeatureEvidence(`${field}\n${field}`, evidence));
  // Reopen/complete of the same bug requires a fresh assessment even if its fix PR is unchanged.
  fix.updated_at = '2026-11-17T19:00:00Z';
  assert.throws(() => checkFeatureEvidence(field, featureEvidence(10, [fix], [pull])), /Review aller/);
});

test('a PR-only fingerprint cannot forge the accepted GitHub review evidence', () => {
  const fixes = featureEvidence(10, [issue(11, 'Feature-Ticket: #10', 'closed', 'completed')], [pr(101, 11, true)]);
  const field = `Reviewed-Feature-Fixes: ${evidenceDigest(fixes)}`;
  const head = 'a'.repeat(40);
  const body = `Implementer-Agents: root-agent\nReviewer-Agent: review-agent\nReviewed-Commit: ${head}\nReview-ID: 123\n${field}\n- [x] Unabhängiges Review`;
  const review = { id: 123, commit_id: head, state: 'COMMENTED', submitted_at: '2026-11-17', body: `Reviewer-Agent: review-agent\nReviewed-Commit: ${head}\nReview-Result: accepted` };
  assert.throws(() => checkReview(body, head, review, fixes), /Review aller/);
  checkReview(body, head, { ...review, body: `${review.body}\n${field}` }, fixes);
});

test('live review rejects missing fixes, unknown implementers, and reviewers who implemented any fix', () => {
  const fixes = [issue(11, 'Feature-Ticket: #10', 'closed', 'completed')];
  const pull = pr(101, 11, true);
  const source = (comparison = 'ahead') => ({
    list: (path) => path.includes('/issues?') ? fixes : [pull], get: () => ({ status: comparison }),
  });
  assert.equal(liveFeatureEvidence('fix/10', 'a'.repeat(40), 'independent-agent', source()).length, 1);
  assert.throws(() => liveFeatureEvidence('fix/10', 'a'.repeat(40), 'fix-agent', source()), /selbst implementiert/);
  for (const status of ['behind', 'diverged']) {
    assert.throws(() => liveFeatureEvidence('fix/10', 'a'.repeat(40), 'independent-agent', source(status)), /fehlt im Feature-Head/);
  }
  pull.body = '';
  assert.throws(() => liveFeatureEvidence('fix/10', 'a'.repeat(40), 'independent-agent', source()), /Unvollständiger/);
});

test('issue changes refresh only affected feature gates, including old and new parents', () => {
  const issues = [issue(11, 'Feature-Ticket: #20')];
  const event = { issue: issues[0], changes: { body: { from: 'Feature-Ticket: #10' } } };
  assert.deepEqual(affectedPulls(event, issues, [pr(100, 10), pr(200, 20), pr(300, 30)]).map((p) => p.number), [100, 200]);
  assert.deepEqual(affectedPulls({ issue: { ...issues[0], pull_request: {} } }, issues, [pr(100, 10)]), []);
});

test('gate reruns use the newest matching PR head, never another branch or old head', () => {
  const pull = pr(100, 10);
  const run = { id: 1, head_sha: pull.head.sha, event: 'pull_request', pull_requests: [{ number: 100 }] };
  assert.equal(latestGate(pull, [run, { ...run, id: 2 }, { ...run, id: 3, head_sha: 'c'.repeat(40) }, { ...run, id: 4, pull_requests: [{ number: 101 }] }]).id, 2);
});

test('malformed and duplicate foreign relationships do not block independent reviews or valid fixes', () => {
  for (const body of ['Feature-Ticket: #x', 'Feature-Ticket: #90\nFeature-Ticket: #91']) {
    const root = issue(10), unrelated = issue(99, body, 'closed', 'completed');
    const diagnostics = [];
    assert.deepEqual(featureFixes(10, [root, unrelated], { diagnose: (message) => diagnostics.push(message) }), []);
    assert.ok(diagnostics.some((message) => message.includes('#99')));
    assert.deepEqual(candidates([root, unrelated], [pr(100, 10)], board).map((i) => i.number), [10]);
    assert.deepEqual(liveFeatureEvidence('fix/10', 'a'.repeat(40), 'review-agent', { list: () => [root, unrelated] }), []);
    const bug = issue(11, 'Feature-Ticket: #10', 'closed', 'completed'), pulls = [pr(100, 10), pr(101, 11, true)];
    assert.deepEqual(candidates([root, bug, unrelated], pulls, board).map((i) => i.number), [10]);
    const live = liveFeatureEvidence('fix/10', 'a'.repeat(40), 'review-agent', {
      list: (path) => path.includes('/issues?') ? [root, bug, unrelated] : pulls,
      get: () => ({ status: 'ahead' }),
    });
    assert.equal(live[0].issue, 11);
  }
});

test('ambiguous relationships still block their own issue and every recognizable affected parent', () => {
  const malformed = issue(99, 'Feature-Ticket: #10\nFeature-Ticket: #20');
  for (const number of [10, 20, 99]) assert.throws(() => featureFixes(number, [malformed]), /Ungültige Feature-Verknüpfung/);
  assert.deepEqual(featureFixes(30, [malformed]), []);
  assert.throws(() => featureFixes(10, [issue(99, 'Feature-Ticket: #10 falsch')]), /Ungültige/);
  assert.throws(() => featureFixes(99, [issue(99, 'Feature-Ticket: #x')]), /Ungültige/);
});

test('event refresh isolates unrelated errors and invalidates all ambiguous current or former parents', () => {
  const broken = issue(99, 'Feature-Ticket: #x'), bug = issue(11, 'Feature-Ticket: #10');
  const pulls = [pr(100, 10), pr(200, 20), pr(300, 30)];
  assert.deepEqual(affectedPulls({ issue: bug }, [bug, broken], pulls).map((p) => p.number), [100]);
  assert.deepEqual(affectedPulls({ issue: broken, changes: { body: { from: 'Feature-Ticket: #20' } } }, [bug, broken], pulls).map((p) => p.number), [200]);
  const ambiguous = issue(99, 'Feature-Ticket: #10\nFeature-Ticket: #20');
  assert.deepEqual(affectedPulls({ issue: ambiguous }, [ambiguous], pulls).map((p) => p.number), [100, 200]);
});

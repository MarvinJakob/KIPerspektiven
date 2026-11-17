import assert from 'node:assert/strict';
import test from 'node:test';
import { planIssue, dependencies } from './reconcile.mjs';
import { candidates } from './worker.mjs';

const issue = (labels, body = '') => ({ number: 7, state: 'open', labels: labels.map((name) => ({ name })), body });
const evidence = () => ({ specs: new Map([[7, ['REQ-7-AC1', 'REQ-7-AC2']]]), baseline: new Set(), issues: new Map(),
  pulls: [{ state: 'closed', merged_at: '2026-11-16', head: { ref: 'spec/7' } }] });
test('merge handoff repairs stale analysis labels without requiring the original worker', () => {
  const plan = planIssue(issue(['requirement', 'needs-analysis', 'in-progress']), evidence());
  assert.deepEqual(plan.add, ['specified']); assert.deepEqual(plan.remove, ['needs-analysis', 'in-progress']);
  assert.equal(plan.close, false);
  const next = planIssue(issue(['requirement', 'specified']), evidence());
  assert.deepEqual(next.add, []); assert.deepEqual(next.remove, []);
});
test('an open follow-up PR retains its ownership and analysis state', () => {
  const ev = evidence(); ev.pulls.push({ state: 'open', head: { ref: 'spec/7' } });
  const plan = planIssue(issue(['requirement', 'needs-analysis', 'in-progress']), ev);
  assert.deepEqual(plan.remove, []);
});
test('completion requires every acceptance criterion in the committed baseline', () => {
  const ev = evidence(); ev.baseline.add('REQ-7-AC1');
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).close, false);
  ev.baseline.add('REQ-7-AC2');
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).close, true);
  const closed = { ...issue(['requirement', 'specified', 'done']), state: 'closed', state_reason: 'completed' };
  assert.equal(planIssue(closed, ev).status, 'Funktioniert');
  assert.equal(planIssue(closed, ev).close, false);
});
test('test dependencies must all complete; unrelated human blockers survive', () => {
  const parent = issue(['bug', 'waiting-for-test', 'blocked'], 'Test-Defect-Dependency: #34\nTest-Defect-Dependency: #36');
  const ev = evidence(); ev.issues.set(34, { state: 'closed', state_reason: 'completed' });
  assert.deepEqual(planIssue(parent, ev).remove, []);
  ev.issues.set(36, { state: 'closed', state_reason: 'not_planned' });
  assert.deepEqual(planIssue(parent, ev).remove, []);
  ev.issues.set(36, { state: 'closed', state_reason: 'completed' });
  const result = planIssue(parent, ev);
  assert.deepEqual(result.remove, ['waiting-for-test']); assert.equal(result.status, undefined);
  assert.deepEqual(dependencies('Mention #12\nTest-Defect-Dependency: #34'), [34]);
});

test('maintainer answers remain available for a worker to inspect and unblock', () => {
  const waiting = issue(['maintenance', 'maintenance-approved', 'blocked']);
  const board = [{ number: 7, status: 'In Arbeit', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }];
  assert.equal(candidates([waiting], [], board).length, 1);
  board[0].status = 'Blocked';
  assert.equal(candidates([waiting], [], board).length, 0);
});

test('work selects authorized maintenance and reviews, excludes blocked and unauthorized tasks', () => {
  const data = [
    { ...issue(['maintenance']), number: 1 }, { ...issue(['maintenance', 'maintenance-approved']), number: 2 },
    { ...issue(['bug', 'waiting-for-test']), number: 3 }, { ...issue(['bug', 'in-progress']), number: 4 },
    { ...issue(['requirement', 'needs-analysis']), number: 5 }, { ...issue(['bug', 'release-blocker']), number: 6 },
  ];
  const board = [{ number: 5, status: 'Merge Gate', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }];
  const result = candidates(data, [{ number: 10, state: 'open', head: { ref: 'spec/5' } }], board);
  assert.deepEqual(result.map((i) => i.number), [6, 5, 2]);
  assert.equal(result[2].team, 'maint');
});

test('Team 2 tests a requirement only while no bug or test-defect ticket for it is open', () => {
  const requirement = (number) => ({ ...issue(['requirement', 'specified']), number });
  const followUp = (number, label, title, state = 'open') => ({ ...issue([label]), number, title, state });
  const data = [requirement(7), requirement(8), requirement(9), requirement(70),
    followUp(20, 'bug', '[REQ-7-AC2] Seite fehlt (AC2–AC4)'), followUp(21, 'test-defect', '[REQ-9] Tests robuster machen'),
    followUp(22, 'bug', '[REQ-8-AC1] bereits behoben', 'closed')];
  const result = candidates(data, [], []);
  assert.deepEqual(result.filter((i) => i.team === 'verify').map((i) => i.number), [8, 70]);
  assert.equal(result.find((i) => i.number === 8).guide, 'AGENTS_TESTER.md');
  assert.equal(result.find((i) => i.number === 20).guide, 'AGENTS_FIXER.md');
  // Ein freigegebener Zwischenstand von Team 2 bleibt trotz offener Bug-Tickets wiederaufnehmbar.
  const board = [{ number: 7, status: 'In Arbeit', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }];
  assert.ok(candidates(data, [], board).some((i) => i.number === 7 && i.team === 'verify'));
});

test('reviews and release follow-up belong to the reviewer role', () => {
  const data = [{ ...issue(['maintenance', 'maintenance-approved', 'release-failure']), number: 3 },
    { ...issue(['bug']), number: 4 }, { ...issue(['maintenance', 'maintenance-approved']), number: 5 }];
  const board = [{ number: 4, status: 'Merge Gate', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }];
  const result = candidates(data, [{ number: 10, state: 'open', head: { ref: 'fix/4' } }], board);
  assert.deepEqual(result.map((i) => [i.number, i.guide]),
    [[4, 'AGENTS_REVIEWER.md'], [3, 'AGENTS_REVIEWER.md'], [5, 'AGENTS.md']]);
  // Ein Baseline-PR braucht kein Review; in dieser Spalte wartend setzt ihn ein Tester fort.
  const baseline = candidates([{ ...issue(['requirement', 'specified']), number: 4 }],
    [{ number: 11, state: 'open', head: { ref: 'verify/4' } }], board);
  assert.deepEqual(baseline.map((i) => [i.team, i.guide]), [['verify', 'AGENTS_TESTER.md']]);
});

test('the board shows a specified requirement as open bug while follow-up tickets exist', () => {
  const ev = evidence();
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Spezifiziert');
  ev.issues.set(20, { number: 20, state: 'open', title: '[REQ-7-AC2] Seite fehlt', labels: [{ name: 'bug' }] });
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Bug offen');
  ev.issues.set(20, { ...ev.issues.get(20), state: 'closed' });
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Spezifiziert');
});

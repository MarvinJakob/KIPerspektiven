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

test('the board shows a specified requirement in Merge Gate while follow-up tickets exist', () => {
  const ev = evidence();
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Spezifiziert');
  ev.issues.set(20, { number: 20, state: 'open', title: '[REQ-7-AC2] Seite fehlt', labels: [{ name: 'bug' }] });
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Merge Gate');
  ev.issues.set(20, { ...ev.issues.get(20), state: 'closed' });
  assert.equal(planIssue(issue(['requirement', 'specified']), ev).status, 'Spezifiziert');
});

test('vier Teams: Testdefekte und offene Features gehen an Team 3, erfolgreiche Release-Auswertung an Team 4', () => {
  const data = [
    { ...issue(['test-defect', 'release-blocker']), number: 1 },
    { ...issue(['feature']), number: 2 },
    { ...issue(['maintenance', 'maintenance-approved', 'release-review']), number: 3 },
  ];
  const result = candidates(data, [], []);
  assert.equal(result[0].number, 1);
  assert.equal(result.find((i) => i.number === 1).guide, 'AGENTS_FIXER.md');
  assert.equal(result.find((i) => i.number === 2).guide, 'AGENTS_FIXER.md');
  assert.equal(result.find((i) => i.number === 3).guide, 'AGENTS_REVIEWER.md');
});

test('unbeschriftete Anforderungen in Neu werden gewählt, unautorisierte Wartung bleibt gesperrt', () => {
  const data = [{ ...issue([]), number: 1 }, { ...issue(['maintenance']), number: 2 }];
  const board = data.map((i) => ({ number: i.number, status: 'Neu', repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }));
  assert.deepEqual(candidates(data, [], board).map((i) => [i.number, i.team]), [[1, 'spec']]);
});

test('offenes Implementierungs-Feature verhindert Wiederprüfung und Abschluss der Anforderung', () => {
  const parent = { ...issue(['requirement', 'specified']), number: 7 };
  const feature = { ...issue(['feature']), number: 20, title: '[REQ-7-AC1] Funktion implementieren' };
  const ev = evidence();
  ev.baseline = new Set(['REQ-7-AC1', 'REQ-7-AC2']);
  ev.issues.set(20, feature);
  assert.equal(planIssue(parent, ev).close, false);
  assert.equal(planIssue(parent, ev).status, 'Merge Gate');
  assert.ok(!candidates([parent, feature], [], []).some((i) => i.team === 'verify'));
});

test('abgeschlossene Tickets verlieren veraltete Aktivlabels und gehen auf Funktioniert', () => {
  const closed = { ...issue(['bug', 'in-progress', 'blocked']), state: 'closed', state_reason: 'completed' };
  const plan = planIssue(closed, evidence());
  assert.equal(plan.status, 'Funktioniert');
  assert.deepEqual(plan.remove, ['in-progress', 'blocked']);
});
test('freie Bugs, Testdefekte und Wartung erhalten Wartestatus, aktive fremde Aufgaben bleiben erhalten', () => {
  assert.equal(planIssue(issue(['bug']), evidence()).status, 'Bug offen');
  assert.equal(planIssue(issue(['test-defect']), evidence()).status, 'Bug offen');
  assert.equal(planIssue(issue(['maintenance']), evidence()).status, 'Ready');
  assert.equal(planIssue(issue(['bug', 'in-progress']), evidence()).status, undefined);
  assert.equal(planIssue(issue(['bug', 'blocked']), evidence()).status, undefined);
});
test('offene PR-Aufgaben behalten aktive Arbeit und Rückgaben nach Review-Befunden', () => {
  const ev = evidence(); ev.pulls.push({ state: 'open', head: { ref: 'fix/7' } });
  assert.equal(planIssue(issue(['bug', 'in-progress']), ev).status, undefined);
  assert.equal(planIssue(issue(['bug']), ev).status, undefined);
});

const board = (entries) => entries.map(([number, status]) => ({ number, status, repository: { nameWithOwner: 'MarvinJakob/AIPerspectives' } }));
const requirementWith = (...extra) => ({ ...issue(['requirement', 'specified', ...extra]), number: 5 });
const followUpTicket = (number, title = `[REQ-5-AC${number}] Lücke`) => ({ ...issue(['bug']), number, title });
const fixPR = (number, pr) => ({ number: pr, state: 'open', head: { ref: `fix/${number}` } });

test('Anforderungs-Review: Folgeticket ohne PR im Review ergibt keinen Kandidaten und keinen Team-2-Worker', () => {
  const data = [requirementWith(), followUpTicket(50), followUpTicket(51)];
  // #51 ohne PR
  let result = candidates(data, [fixPR(50, 78)], board([[5, 'Merge Gate'], [50, 'Merge Gate'], [51, 'Bug offen']]));
  assert.ok(!result.some((i) => i.number === 5));
  // #51 mit PR, aber nach Review-Befund zurück bei Team 3
  result = candidates(data, [fixPR(50, 78), fixPR(51, 79)], board([[5, 'Merge Gate'], [50, 'Merge Gate'], [51, 'Bug offen']]));
  assert.ok(!result.some((i) => i.number === 5));
});

test('Anforderungs-Review: alle Folgetickets mit PR im Review machen die Anforderung zum Team-4-Kandidaten', () => {
  const data = [requirementWith(), followUpTicket(50)];
  const result = candidates(data, [fixPR(50, 78)], board([[5, 'Merge Gate'], [50, 'Merge Gate']]));
  const review = result.find((i) => i.number === 5);
  assert.deepEqual({ team: review.team, guide: review.guide, phase: review.phase, followUps: review.followUps, prs: review.prs },
    { team: 'review', guide: 'AGENTS_REVIEWER.md', phase: 0, followUps: [50], prs: [78] });
  // Das Anforderungs-Review wird vor dem PR-Review des Folgetickets angeboten.
  assert.deepEqual(result.map((i) => [i.number, i.guide]), [[5, 'AGENTS_REVIEWER.md'], [50, 'AGENTS_REVIEWER.md']]);
  // Auch vor dem ersten Prozessabgleich (Anforderung noch in Bug offen) gilt dieselbe Regel.
  assert.equal(candidates(data, [fixPR(50, 78)], board([[5, 'Bug offen'], [50, 'Review']]))[0].team, 'review');
  // Aktive Klärung (in-progress) oder blockierte Anforderung wird nicht erneut gestartet.
  assert.ok(!candidates([requirementWith('in-progress'), followUpTicket(50)], [fixPR(50, 78)], board([[5, 'In Arbeit'], [50, 'Merge Gate']]))
    .some((i) => i.number === 5));
  assert.ok(!candidates(data, [fixPR(50, 78)], board([[5, 'Blocked'], [50, 'Merge Gate']])).some((i) => i.number === 5));
});

test('Anforderungs-Review: der Merker verhindert einen zweiten Start', () => {
  const data = [requirementWith('requirement-reviewed'), followUpTicket(50)];
  const result = candidates(data, [fixPR(50, 78)], board([[5, 'Merge Gate'], [50, 'Merge Gate']]));
  assert.deepEqual(result.map((i) => i.number), [50]);
});

test('Anforderungs-Review: ohne offene Folgetickets prüft Team 2 die Anforderung', () => {
  const data = [requirementWith(), { ...followUpTicket(50), state: 'closed' }];
  const result = candidates(data, [], board([[5, 'Spezifiziert']]));
  assert.deepEqual(result.map((i) => [i.number, i.team, i.guide]), [[5, 'verify', 'AGENTS_TESTER.md']]);
});

test('Prozessabgleich: Merker bleibt nur, solange jedes offene Folgeticket einen offenen PR hat', () => {
  const ev = evidence();
  const ticket = (number) => ({ number, state: 'open', title: `[REQ-7-AC1] Lücke ${number}`, labels: [{ name: 'feature' }] });
  const requirement = issue(['requirement', 'specified', 'requirement-reviewed']);
  ev.issues.set(20, ticket(20));
  ev.pulls.push({ state: 'open', head: { ref: 'fix/20' } });
  let plan = planIssue(requirement, ev);
  assert.deepEqual(plan.remove, []); assert.equal(plan.status, 'Merge Gate');
  // Neues Folgeticket ohne PR (z. B. Lücke aus dem Anforderungs-Review) → Merker entfernen.
  ev.issues.set(21, ticket(21));
  plan = planIssue(requirement, ev);
  assert.deepEqual(plan.remove, ['requirement-reviewed']); assert.equal(plan.status, 'Merge Gate');
  // Keine offenen Folgetickets mehr → Merker entfernen, Anforderung an Team 2.
  ev.issues.set(20, { ...ticket(20), state: 'closed' }); ev.issues.set(21, { ...ticket(21), state: 'closed' });
  plan = planIssue(requirement, ev);
  assert.deepEqual(plan.remove, ['requirement-reviewed']); assert.equal(plan.status, 'Spezifiziert');
  // Geschlossene PRs zählen nicht.
  ev.issues.set(20, ticket(20)); ev.pulls = ev.pulls.map((p) => p.head.ref === 'fix/20' ? { ...p, state: 'closed' } : p);
  assert.deepEqual(planIssue(requirement, ev).remove, ['requirement-reviewed']);
});

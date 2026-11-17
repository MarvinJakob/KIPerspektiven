import assert from 'node:assert/strict';
import test from 'node:test';
import { followupRelease } from './release-followup.mjs';

const run = { head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success',
  head_sha: 'a'.repeat(40), html_url: 'https://example.test/run/10', run_attempt: 1 };
function exercise({ result = run, jobs = [], reviews = [], metadata } = {}) {
  const writes = [];
  followupRelease('10', (path, options) => {
    if (options) { writes.push({ path, ...options }); return {}; }
    return path.endsWith('/jobs?per_page=100') ? { jobs } : result;
  }, (path) => path.includes('labels=release-review') ? reviews : [{ number: 1, body: 'Existing release failure' }], metadata);
  return writes;
}
test('grüne Testdiagnose erzeugt Team-4-Auswertung, niemals Produktionsnachweis', () => {
  const writes = exercise();
  assert.equal(writes.length, 1);
  assert.ok(writes[0].body.labels.includes('release-review'));
  assert.match(writes[0].body.body, /kein Produktionsnachweis/);
  assert.ok(!writes.some((write) => write.path.endsWith('/comments')));
});
test('nur erfolgreicher Veröffentlichungsjob erlaubt Produktionsnachweis', () => {
  const writes = exercise({ jobs: [{ name: '5 Release-Stand und Veröffentlichung', conclusion: 'success' }] });
  assert.equal(writes.length, 2);
  assert.match(writes[1].body.body, /Produktionsnachweis/);
  assert.match(writes[0].body.body, /Deployment und Veröffentlichung bestanden/);
  assert.equal(exercise({ jobs: [{ name: '5 Release-Stand und Veröffentlichung', conclusion: 'skipped' }] }).length, 1);
});
test('wiederholte Ereignisse erzeugen keine doppelten Auswertungstickets', () => {
  assert.equal(exercise({ reviews: [{ body: 'Release-Review-Run: 10/1\nDone' }] }).length, 0);
});
test('unvertrauenswürdige oder laufende Läufe erzeugen keine Tickets', () => {
  assert.equal(exercise({ result: { ...run, head_branch: 'feature' } }).length, 0);
  assert.equal(exercise({ result: { ...run, status: 'in_progress' } }).length, 0);
});
test('historische Diagnose verwendet den tatsächlich getesteten Commit, nicht den Workflow-Commit', () => {
  const commit = 'b'.repeat(40);
  const writes = exercise({ result: { ...run, event: 'workflow_dispatch' }, metadata: { run: '10', commit, tests_only: true } });
  assert.match(writes[0].body.body, new RegExp(`Release-Commit: ${commit}`));
  assert.ok(!writes[0].body.body.includes(run.head_sha));
  assert.match(writes[0].body.body, /kein Produktionsnachweis/);
});
test('manueller Lauf ohne Metadaten behauptet keinen getesteten Commit', () => {
  const writes = exercise({ result: { ...run, event: 'workflow_dispatch' } });
  assert.match(writes[0].body.body, /Getesteter Commit: nicht ermittelt/);
  assert.ok(!writes[0].body.body.includes('Release-Commit:'));
  assert.throws(() => exercise({ metadata: { run: '999', commit: 'b'.repeat(40) } }), /gehören nicht zum Lauf/);
});

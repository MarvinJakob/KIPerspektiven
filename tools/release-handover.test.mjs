import test from 'node:test';
import assert from 'node:assert/strict';
import { referencedIssues, mergedPull, handoverComment } from './release-handover.mjs';

// Anforderung #55, REQ-55-AC3: Nach dem Merge ist im Ticket nachvollziehbar, welcher PR, welcher Commit und welcher Release-Gate-Lauf zusammengehören.

test('REQ-55-AC3: referenzierte Tickets aus der PR-Beschreibung', () => {
  const body = 'Ändert das Gate (#12 ist nur erwähnt).\n\nRefs #55\nCloses #7, Fixes #8 und resolves #9\nRefs #55';
  assert.deepEqual(referencedIssues(body), [55, 7, 8, 9]);
  assert.deepEqual(referencedIssues(null), []);
  assert.deepEqual(referencedIssues('Refs#3 Refsx #4'), []);
});

test('REQ-55-AC3: gemergter PR des Commits auf main', () => {
  const pulls = [
    { number: 70, merged_at: null, merge_commit_sha: 'abc' },
    { number: 71, merged_at: '2026-11-18T10:00:00Z', merge_commit_sha: 'abc' },
    { number: 72, merged_at: '2026-11-18T10:00:00Z', merge_commit_sha: 'def' },
  ];
  assert.equal(mergedPull(pulls, 'abc').number, 71);
  assert.equal(mergedPull(pulls, 'fff'), undefined);
});

test('REQ-55-AC3: Kommentar nennt PR, geprüften Head, Commit auf main und Lauf', () => {
  const text = handoverComment({
    pull: { number: 71, head: { sha: '1111111111111111111111111111111111111111' } },
    commit: '2222222222222222222222222222222222222222',
    runUrl: 'https://github.com/o/r/actions/runs/5',
  });
  assert.match(text, /Release Gate/);
  assert.match(text, /#71/);
  assert.match(text, /1111111111111111111111111111111111111111/);
  assert.match(text, /2222222222222222222222222222222222222222/);
  assert.match(text, /https:\/\/github\.com\/o\/r\/actions\/runs\/5/);
});

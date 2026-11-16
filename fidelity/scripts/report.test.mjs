import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReport } from './report.mjs';

const execution = (projectName) => ({ projectName, status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] });
const spec = (title = 'REQ-1-AC1 Beispiel') => ({ title, tests: ['desktop', 'mobil'].map(execution) });
const report = (...specs) => ({ errors: [], suites: [{ specs }], stats: { interrupted: 0 } });

test('bestanden nur bei regulärem Erfolg auf Desktop und Mobil', () => {
  const result = evaluateReport(report(spec()), report(spec()));
  assert.deepEqual(result.invalid, []);
  assert.equal(result.byId.get('REQ-1-AC1').passed, true);
});

test('fachlicher Fehlschlag bleibt gültiges Backlog-Ergebnis', () => {
  const item = spec();
  Object.assign(item.tests[1], { status: 'unexpected', results: [{ status: 'failed' }] });
  const result = evaluateReport(report(item));
  assert.deepEqual(result.invalid, []);
  assert.equal(result.byId.get('REQ-1-AC1').passed, false);
});

test('globale Fehler, leere und unvollständige Läufe sperren das Gate', () => {
  const missing = spec();
  missing.tests.pop();
  for (const source of [report(), { ...report(spec()), errors: [{ message: 'setup failed' }] },
    { ...report(spec()), stats: { interrupted: 1 } }, report(missing), report(spec(), spec())]) {
    assert.ok(evaluateReport(source).invalid.length);
  }
  assert.ok(evaluateReport(report(spec()), report(spec(), spec('REQ-2-AC1 Fehlend'))).invalid.length);
  assert.ok(evaluateReport(report(spec()), report()).invalid.length);
  assert.ok(evaluateReport(report(spec()), report(spec('REQ-2-AC1 Andere'))).invalid.length);
});

test('skip, expected failure, abgebrochene und instabile Tests gelten nie als funktionierend', () => {
  for (const update of [{ status: 'skipped', results: [] }, { expectedStatus: 'failed', results: [{ status: 'failed' }] },
    { status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] }, { results: [{ status: 'interrupted' }] }]) {
    const item = spec();
    Object.assign(item.tests[0], update);
    const result = evaluateReport(report(item));
    assert.equal(result.byId.get('REQ-1-AC1').passed, false);
  }
});

test('Titel und Projekt müssen zum Fidelity-Vertrag passen', () => {
  assert.ok(evaluateReport(report(spec('Ohne ID'))).invalid.length);
  const item = spec();
  item.tests[0].projectName = 'other';
  assert.ok(evaluateReport(report(item)).invalid.length);
});

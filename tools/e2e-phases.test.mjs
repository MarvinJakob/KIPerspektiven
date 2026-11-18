import test from 'node:test';
import assert from 'node:assert/strict';
import { planPhases, projectFiles } from './e2e-phases.mjs';

// Anforderung #55, REQ-55-AC1: Ausgewählte Specs laufen ohne unbetroffene Abhängigkeitsprojekte.

const projects = [
  { name: 'setup', files: ['../support/auth.setup.ts'] },
  { name: 'akzeptanz', files: ['06-passwort-maskieren.spec.ts', '54-footer.spec.ts'] },
  { name: 'statistik', files: ['26-statistik.spec.ts'] },
];

test('REQ-55-AC1: Statistik-Spec allein startet Setup, aber keine Akzeptanz-Specs', () => {
  assert.deepEqual(planPhases(projects, ['tests/26-statistik.spec.ts']), [
    { project: 'setup', files: [] },
    { project: 'statistik', files: ['tests/26-statistik.spec.ts'] },
  ]);
});

test('REQ-55-AC1: Phasen folgen der Projektreihenfolge, Statistik zuletzt', () => {
  assert.deepEqual(planPhases(projects, ['tests/26-statistik.spec.ts', 'tests/54-footer.spec.ts']), [
    { project: 'setup', files: [] },
    { project: 'akzeptanz', files: ['tests/54-footer.spec.ts'] },
    { project: 'statistik', files: ['tests/26-statistik.spec.ts'] },
  ]);
});

test('REQ-55-AC2: unbekannte Spec bricht die Ausführung ab', () => {
  assert.throws(() => planPhases(projects, ['tests/99-fehlt.spec.ts']), /99-fehlt/);
});

test('REQ-55-AC1: Projektdateien werden aus der JSON-Liste von Playwright gelesen', () => {
  const list = {
    config: { projects: [{ name: 'setup' }, { name: 'akzeptanz' }] },
    suites: [
      { file: '../support/auth.setup.ts', specs: [{ tests: [{ projectName: 'setup' }] }] },
      { file: '54-footer.spec.ts', specs: [], suites: [{ specs: [{ tests: [{ projectName: 'akzeptanz' }] }] }] },
    ],
  };
  assert.deepEqual(projectFiles(list), [
    { name: 'setup', files: ['../support/auth.setup.ts'] },
    { name: 'akzeptanz', files: ['54-footer.spec.ts'] },
  ]);
});

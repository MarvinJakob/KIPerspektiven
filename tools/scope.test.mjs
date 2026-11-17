import assert from 'node:assert/strict';
import test from 'node:test';
import { checkScope } from './check-scope.mjs';

test('Team-Grenzen erlauben nur die dokumentierten Pfade', () => {
  for (const [branch, allowed] of [['spec/1', ['fidelity/specs/REQ-1.md', 'fidelity/tests/REQ-1.spec.ts']],
    ['verify/1', ['fidelity/baseline.txt']], ['fix/1', ['app/backend/main.go']]]) {
    checkScope(branch, allowed, 'REQ-0-AC1\n', 'REQ-0-AC1\nREQ-1-AC1\n');
    for (const file of ['AGENTS.md', 'ARCHITECTURE.md', 'tools/task.sh', '.github/workflows/release.yml',
      'fidelity/package.json', 'fidelity/playwright.config.ts', 'fidelity/scripts/gate.mjs', 'README.md']) {
      assert.throws(() => checkScope(branch, [file], '', ''), /Team-Grenze/);
    }
  }
  assert.throws(() => checkScope('fix/1', ['fidelity/tests/test.ts'], '', ''), /Team-Grenze/);
  // Die Baseline gehört Team 2: Ein Fixer bescheinigt seine eigene Arbeit nicht.
  assert.throws(() => checkScope('fix/1', ['fidelity/baseline.txt'], 'REQ-0-AC1\n', 'REQ-0-AC1\nREQ-1-AC1\n'), /Team-Grenze/);
  assert.throws(() => checkScope('spec/1', ['app/main.go'], '', ''), /Team-Grenze/);
  assert.throws(() => checkScope('verify/1', ['app/main.go'], '', ''), /Team-Grenze/);
});

test('Baseline bleibt unverändert und erhält nur eindeutige IDs am Ende', () => {
  const before = '# Baseline\nREQ-0-AC1\n';
  for (const after of ['', 'REQ-0-AC1\n', '# Baseline\nREQ-0-AC2\n', `${before}REQ-0-AC1\n`, `${before}REQ-invalid\n`]) {
    assert.throws(() => checkScope('verify/1', ['fidelity/baseline.txt'], before, after), /Baseline/);
  }
  checkScope('verify/1', ['fidelity/baseline.txt'], before, `${before}REQ-1-AC1\n`);
  checkScope('verify/1', ['fidelity/baseline.txt'], before.replaceAll('\n', '\r\n'), `${before}REQ-1-AC1\n`);
});

test('Team 3 darf Fidelity-Dateien nur bei einem verknüpften Testdefekt korrigieren', () => {
  const files = ['fidelity/tests/REQ-1.spec.ts', 'fidelity/specs/REQ-1.md', 'app/frontend/main.ts'];
  checkScope('fix/4', files, '', '', { testDefect: true });
  assert.throws(() => checkScope('fix/4', files, '', ''), /Team-Grenze/);
  for (const file of ['fidelity/scripts/gate.mjs', 'fidelity/playwright.config.ts', 'AGENTS.md', '.github/workflows/merge-gate.yml', 'fidelity/baseline.txt']) {
    assert.throws(() => checkScope('fix/4', [file], '', '', { testDefect: true }), /Team-Grenze/);
  }
});

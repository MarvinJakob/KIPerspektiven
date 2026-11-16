import assert from 'node:assert/strict';
import test from 'node:test';
import { checkScope } from './check-scope.mjs';

test('Team-Grenzen erlauben nur die dokumentierten Pfade', () => {
  for (const [branch, allowed] of [['spec/1', ['fidelity/specs/REQ-1.md', 'fidelity/tests/REQ-1.spec.ts']],
    ['verify/1', ['fidelity/baseline.txt']], ['fix/1', ['app/backend/main.go', 'fidelity/baseline.txt']]]) {
    checkScope(branch, allowed, 'REQ-0-AC1\n', 'REQ-0-AC1\nREQ-1-AC1\n');
    for (const file of ['AGENTS.md', 'ARCHITECTURE.md', 'tools/task.sh', '.github/workflows/release.yml',
      'fidelity/package.json', 'fidelity/playwright.config.ts', 'fidelity/scripts/gate.mjs', 'README.md']) {
      assert.throws(() => checkScope(branch, [file], '', ''), /Team-Grenze/);
    }
  }
  assert.throws(() => checkScope('fix/1', ['fidelity/tests/test.ts'], '', ''), /Team-Grenze/);
  assert.throws(() => checkScope('spec/1', ['app/main.go'], '', ''), /Team-Grenze/);
  assert.throws(() => checkScope('verify/1', ['app/main.go'], '', ''), /Team-Grenze/);
});

test('Baseline bleibt unverändert und erhält nur eindeutige IDs am Ende', () => {
  const before = '# Baseline\nREQ-0-AC1\n';
  for (const after of ['', 'REQ-0-AC1\n', '# Baseline\nREQ-0-AC2\n', `${before}REQ-0-AC1\n`, `${before}REQ-invalid\n`]) {
    assert.throws(() => checkScope('fix/1', ['fidelity/baseline.txt'], before, after));
  }
  checkScope('verify/1', ['fidelity/baseline.txt'], before, `${before}REQ-1-AC1\n`);
  checkScope('verify/1', ['fidelity/baseline.txt'], before.replaceAll('\n', '\r\n'), `${before}REQ-1-AC1\n`);
});

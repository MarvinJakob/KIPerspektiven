import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('CLI sperrt defekte Läufe und fehlende Pflicht-IDs, erlaubt nachgewiesenes Backlog', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-gate-'));
  const spec = (id, failed = false) => ({ title: `${id} Beispiel`, tests: ['desktop', 'mobil'].map((projectName) => ({
    projectName, expectedStatus: 'passed', status: failed ? 'unexpected' : 'expected',
    results: [{ status: failed ? 'failed' : 'passed' }],
  })) });
  const good = { errors: [], suites: [{ specs: [spec('REQ-1-AC1'), spec('REQ-1-AC2', true)] }] };
  const results = join(dir, 'results.json');
  const inventory = join(dir, 'inventory.json');
  writeFileSync(inventory, JSON.stringify(good));
  const run = (report, required = 'REQ-1-AC1', selected = '') => {
    writeFileSync(results, JSON.stringify(report));
    const env = { ...process.env, REQUIRED_IDS: '', SELECTED_IDS: selected };
    delete env.GITHUB_OUTPUT;
    delete env.GITHUB_STEP_SUMMARY;
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./gate.mjs', import.meta.url)),
      '--no-baseline', '--require', required, '--results', results, '--inventory', inventory], { env, encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  };
  assert.equal(run(good).status, 0);
  assert.equal(run(good, '', 'REQ-1-AC1 REQ-1-AC2').status, 0);
  assert.equal(run(good, '', 'REQ-1-AC1 REQ-1-AC3').status, 1);
  assert.equal(run(good, 'REQ-1-AC2').status, 1);
  assert.equal(run({ ...good, errors: [{ message: 'global setup failed' }] }).status, 1);
  assert.equal(run({ suites: [{ specs: [spec('REQ-1-AC1')] }] }).status, 1);
  assert.equal(run({ suites: [] }).status, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFeatureTests } from './feature-tests.mjs';

const input = (extra = {}) => ({ branch: 'fix/80', body: 'Fidelity: REQ-12-AC1', changed: ['app/main.go'],
  baseline: { before: 'REQ-0-AC1\nREQ-12-AC2\n', after: 'REQ-0-AC1\nREQ-12-AC2\n' },
  sources: { 'REQ-12.spec.ts': "test('REQ-12-AC1 first'); test('REQ-12-AC2 second');",
    'REQ-120.spec.ts': "test('REQ-120-AC1 unrelated');" }, ...extra });

test('fix runs its entire feature and protects only its baseline IDs', () => {
  const selected = selectFeatureTests(input());
  assert.equal(selected.required, 'REQ-12-AC1 REQ-12-AC2');
  const filter = new RegExp(selected.grep);
  assert.ok(filter.test('desktop tests/REQ-12.spec.ts REQ-12-AC2 second'));
  for (const title of ['REQ-0-AC1 health', 'REQ-120-AC1 unrelated', 'REQ-1-AC1 other']) assert.ok(!filter.test(title));
});
test('new specs may be red but existing baseline IDs in that feature must pass', () => {
  const selected = selectFeatureTests(input({ branch: 'spec/12', body: '', changed: ['fidelity/tests/REQ-12.spec.ts'] }));
  assert.equal(selected.required, 'REQ-12-AC2');
  assert.equal(selected.selected, 'REQ-12-AC1 REQ-12-AC2');
});
test('baseline PR derives selection and required IDs from additions', () => {
  const selected = selectFeatureTests(input({ branch: 'verify/12', body: '',
    baseline: { before: 'REQ-0-AC1\n', after: 'REQ-0-AC1\nREQ-12-AC1\n' } }));
  assert.equal(selected.required, 'REQ-12-AC1');
  assert.ok(!new RegExp(selected.grep).test('REQ-0-AC1 health'));
});
test('empty maintenance selection stays empty; implementation without IDs fails', () => {
  assert.equal(selectFeatureTests(input({ branch: 'codex/maint-1', body: '' })).grep, '');
  assert.throws(() => selectFeatureTests(input({ body: '' })), /brauchen Fidelity/);
});
test('a test-defect correction can expose missing non-baseline functionality', () => {
  assert.equal(selectFeatureTests(input({ body: '', testDefect: true,
    changed: ['fidelity/tests/REQ-12.spec.ts'] })).required, 'REQ-12-AC2');
});
test('invalid or missing required IDs fail instead of silently running all tests', () => {
  for (const body of ['Fidelity: .*', 'Fidelity:', 'Fidelity: REQ-12-AC9', 'Fidelity: REQ-99-AC1']) {
    assert.throws(() => selectFeatureTests(input({ body })));
  }
});
test('removing a baseline test from a selected feature cannot evade its regression check', () => {
  assert.throws(() => selectFeatureTests(input({ sources: { 'REQ-12.spec.ts': "test('REQ-12-AC1 only');" } })), /REQ-12-AC2 fehlt/);
});
test('test helper changes select their feature; unknown helpers cannot silently skip Fidelity', () => {
  const selected = selectFeatureTests(input({ body: '', testDefect: true, changed: ['fidelity/tests/REQ-12.content.ts'] }));
  assert.equal(selected.required, 'REQ-12-AC2');
  assert.ok(new RegExp(selected.grep).test('REQ-12-AC1 example'));
  assert.throws(() => selectFeatureTests(input({ body: '', testDefect: true, changed: ['fidelity/tests/helpers.ts'] })), /ohne Feature-Zuordnung/);
});

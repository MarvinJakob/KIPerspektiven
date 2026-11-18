import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Anforderung #55: Struktur der Workflows Merge Gate und Release Gate sowie Konsistenz der Dokumentation.
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const mergeGate = read('.github/workflows/merge-gate.yml');
const releaseGate = read('.github/workflows/release-gate.yml');
const tests = read('.github/workflows/tests.yml');

/** Textblock eines Jobs bis zum nächsten Job auf derselben Einrückung. */
function job(workflow, id) {
  const start = workflow.search(new RegExp(`^  ${id}:\\s*$`, 'm'));
  assert.notEqual(start, -1, `Job ${id} fehlt`);
  const rest = workflow.slice(start + 3);
  const end = rest.search(/^  [\w-]+:\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

test('REQ-55-AC2: Merge Gate läuft nur für Pull Requests und installiert nichts', () => {
  const on = mergeGate.slice(mergeGate.indexOf('\non:'), mergeGate.indexOf('\npermissions:'));
  assert.match(on, /pull_request:/);
  assert.doesNotMatch(on, /push:|workflow_dispatch:/);
  assert.doesNotMatch(mergeGate, /production|deploy\.sh|HETZNER/);
});

test('REQ-55-AC1 REQ-55-AC2: Merge Gate wählt Tests aus und der Pflichtcheck wertet Auswahl und Tests aus', () => {
  assert.match(job(mergeGate, 'plan'), /node tools\/affected-tests\.mjs plan --base/);
  assert.match(job(mergeGate, 'tests'), /uses: \.\/\.github\/workflows\/tests\.yml/);
  const gate = job(mergeGate, 'gate');
  assert.match(gate, /name: Merge Gate$/m);
  assert.match(gate, /needs: \[plan, tests\]/);
  assert.match(gate, /if: always\(\)/);
  assert.equal((mergeGate.match(/name: Merge Gate$/gm) ?? []).length, 2, 'nur Workflow und Abschlussjob heißen Merge Gate');
});

test('REQ-55-AC4: Release Gate prüft nach dem Merge die vollständige Suite vor dem Deployment', () => {
  const on = releaseGate.slice(releaseGate.indexOf('\non:'), releaseGate.indexOf('\npermissions:'));
  assert.match(on, /push:\s*\n\s*branches: \[main\]/);
  assert.doesNotMatch(on, /pull_request/);
  assert.match(job(releaseGate, 'plan'), /node tools\/affected-tests\.mjs plan --all/);
  const deploy = job(releaseGate, 'deploy');
  assert.match(deploy, /needs: \[plan, tests\]/);
  assert.match(deploy, /name: production/);
  assert.match(job(releaseGate, 'tests'), /production-image: true/);
});

test('REQ-55-AC4 REQ-55-AC5: Blocker vor Installation, Rollback bei Installationsfehler', () => {
  const deploy = job(releaseGate, 'deploy');
  const check = deploy.indexOf('node tools/release-blockers.mjs');
  assert.ok(check > deploy.indexOf('id: previous') && check < deploy.indexOf('id: install'));
  assert.match(deploy, /deploy\.sh switch "\$PREVIOUS"/);
  assert.match(deploy, /Installierte Version/);
  assert.match(releaseGate, /group: release-production/);
});

test('REQ-55-AC1 REQ-55-AC4: Testjobs enthalten alle Suiten; der Image-Build startet keine Unit-Tests', () => {
  assert.match(job(tests, 'process'), /node --test "tools\/\*\.test\.mjs"/);
  assert.match(job(tests, 'backend'), /go test/);
  assert.match(job(tests, 'frontend'), /npm run test:unit/);
  assert.match(job(tests, 'fidelity'), /tools\/e2e-phases\.mjs/);
  const dockerfile = read('app/Dockerfile');
  assert.doesNotMatch(dockerfile, /test:unit|go test/);
});

test('REQ-55-AC3: Release Gate kommentiert die Ticketübergabe', () => {
  const handover = job(releaseGate, 'handover');
  assert.match(handover, /node tools\/release-handover\.mjs/);
  assert.match(handover, /issues: write/);
});

test('REQ-55-AC6: Dokumentation verweist auf beide Gates und den neuen Wiederholungsbefehl', () => {
  for (const path of ['AGENTS.md', 'ARCHITECTURE.md', 'app/docs/betrieb.md']) {
    const text = read(path);
    assert.match(text, /release-gate\.yml/, path);
    assert.doesNotMatch(text, /gh workflow run merge-gate\.yml/, path);
  }
  assert.match(read('AGENTS.md'), /\*\*Backlog → Spezifiziert → In Arbeit → Merge Gate → Release Gate → Funktioniert\*\*/);
  assert.match(read('AGENTS.md'), /^\| \*\*Release Gate\*\* \|/m);
  assert.match(read('app/docs/betrieb.md'), /gh workflow run release-gate\.yml --ref main/);
});

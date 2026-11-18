import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTests, selectGoPackages, parseGoList } from './affected-tests.mjs';

// Anforderung #55: Das Merge Gate führt nur die von einem PR betroffenen Tests aus (REQ-55-AC1, REQ-55-AC2).

const repo = {
  'app/frontend/package.json': '{"scripts":{"build":"vite build","test:unit":"vitest run"}}',
  'app/frontend/vite.config.ts': 'export default {};',
  'app/frontend/src/main.tsx': "import { routes } from './App';\nimport './styles.css';",
  'app/frontend/src/App.tsx': "import { Layout } from './components/Layout';\nimport { Home } from './pages/Home';\nimport {\n  Topic,\n} from './pages/Topic';",
  'app/frontend/src/styles.css': "@import './tokens.css';\nbody { background: url('./assets/bg.svg'); }",
  'app/frontend/src/tokens.css': ':root {}',
  'app/frontend/src/assets/bg.svg': '<svg/>',
  'app/frontend/src/components/Layout.tsx': "import { footer } from './footer';",
  'app/frontend/src/components/footer.ts': "import { de } from '../i18n/de';",
  'app/frontend/src/components/footer.test.ts': "import { footer } from './footer';",
  'app/frontend/src/i18n/de.ts': 'export const de = {};',
  'app/frontend/src/pages/Home.tsx': "import { Teaser } from '../components/Teaser';",
  'app/frontend/src/pages/Home.test.tsx': "import { Home } from './Home';\nimport css from '../styles.css?raw';",
  'app/frontend/src/components/Teaser.tsx': 'export const Teaser = 1;',
  'app/frontend/src/pages/Topic.tsx': "import { load } from '../lib/topicContent';\nimport diagram from '../../../../res/diagram.png';",
  'app/frontend/src/lib/topicContent.ts': "const docs = import.meta.glob<string>('../content/topics/*.md', { query: '?raw' });",
  'app/frontend/src/content/topics/vibe.de.md': '# Vibe',
  'app/frontend/src/lib/unused.ts': 'export const unused = 1;',
  'app/frontend-redaktion/package.json': '{"scripts":{"build":"vite build"}}',
  'app/frontend-redaktion/src/main.tsx': "import { App } from './App';",
  'app/frontend-redaktion/src/App.tsx': "import { Users } from './pages/Users';\nimport { Layout } from './components/Layout';",
  'app/frontend-redaktion/src/components/Layout.tsx': 'export const Layout = 1;',
  'app/frontend-redaktion/src/pages/Users.tsx': "import { PasswordInput } from '../components/PasswordInput';",
  'app/frontend-redaktion/src/components/PasswordInput.tsx': 'export const PasswordInput = 1;',
  'app/e2e/playwright.config.ts': 'export default {};',
  'app/e2e/support/fixtures.ts': 'export const test = 1;',
  'app/e2e/tests/25-home.spec.ts': '// Anforderung #25\n// Abdeckung: app/frontend/src/pages/Home.tsx\n',
  'app/e2e/tests/18-topic.spec.ts': '// Abdeckung: app/frontend/src/pages/Topic.tsx\n',
  'app/e2e/tests/28-users.spec.ts': '// Abdeckung: app/frontend-redaktion/src/pages/Users.tsx\n',
  'app/e2e/tests/24-lang.spec.ts': '// Ohne Abdeckungsangabe: läuft bei jeder Anwendungsänderung.\n',
  'app/backend/go.mod': 'module example.org/ki\n\ngo 1.27\n',
  'app/backend/internal/service/a.go': 'package service',
  'app/backend/migrations/embed.go': 'package migrations',
  'app/backend/migrations/001.sql': 'select 1;',
  'app/api/openapi.yaml': 'openapi: 3.1.0',
  'app/deploy/deploy.sh': '#!/bin/sh',
  'app/docs/betrieb.md': '# Betrieb',
  'tools/board.mjs': 'export {}',
  'tools/worker.test.mjs': "import './board.mjs';",
  'res/diagram.png': 'png',
  'res/other.png': 'png',
  'mock/footer/index.html': '<html></html>',
  'AGENTS.md': '# Prozess',
  '.github/workflows/merge-gate.yml': 'name: Merge Gate',
};

const ALL_SPECS = ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts', 'tests/25-home.spec.ts', 'tests/28-users.spec.ts'];

function select(changed, files = repo) {
  return selectTests({ changed, files: Object.keys(files), read: (path) => files[path] });
}

test('REQ-55-AC1: gemeinsam genutztes Footer-Modul wählt Footer-Unit-Test und alle Specs des öffentlichen Frontends, keine reinen Redaktions-Specs', () => {
  const plan = select(['app/frontend/src/components/footer.ts']);
  assert.deepEqual(plan.frontends, { 'app/frontend': ['src/components/footer.test.ts'] });
  assert.deepEqual(plan.e2e, ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts', 'tests/25-home.spec.ts']);
  assert.deepEqual(plan.backend, []);
  assert.equal(plan.process, false);
  assert.deepEqual(plan.unresolved, []);
});

test('REQ-55-AC1: Änderung einer einzelnen Seite wählt nur deren Specs und Unit-Tests', () => {
  const plan = select(['app/frontend/src/pages/Home.tsx']);
  assert.deepEqual(plan.frontends, { 'app/frontend': ['src/pages/Home.test.tsx'] });
  assert.deepEqual(plan.e2e, ['tests/24-lang.spec.ts', 'tests/25-home.spec.ts'], 'Themen- und Redaktions-Specs sind unbetroffen');
  assert.deepEqual(select(['app/frontend/src/components/Teaser.tsx']).e2e, ['tests/24-lang.spec.ts', 'tests/25-home.spec.ts']);
});

test('REQ-55-AC1: globales CSS ist gemeinsame Abhängigkeit aller öffentlichen Specs und der Unit-Tests, die es lesen', () => {
  const plan = select(['app/frontend/src/tokens.css']);
  assert.deepEqual(plan.frontends, { 'app/frontend': ['src/pages/Home.test.tsx'] });
  assert.deepEqual(plan.e2e, ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts', 'tests/25-home.spec.ts']);
  assert.deepEqual(select(['app/frontend/src/assets/bg.svg']).e2e, plan.e2e, 'CSS-url() gehört zum Importgraphen');
});

test('REQ-55-AC1: Inhalte aus import.meta.glob und Dateien außerhalb von src folgen dem Importgraphen', () => {
  assert.deepEqual(select(['app/frontend/src/content/topics/vibe.de.md']).e2e, ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts']);
  const graphic = select(['res/diagram.png']);
  assert.deepEqual(graphic.e2e, ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts']);
  assert.deepEqual(graphic.unresolved, []);
});

test('REQ-55-AC1: Redaktionsänderung wählt nur Specs mit Redaktionsabdeckung; ohne test:unit keine Unit-Suite', () => {
  const plan = select(['app/frontend-redaktion/src/components/PasswordInput.tsx']);
  assert.deepEqual(plan.e2e, ['tests/24-lang.spec.ts', 'tests/28-users.spec.ts']);
  assert.deepEqual(plan.frontends, {});
  assert.deepEqual(select(['app/frontend-redaktion/src/components/Layout.tsx']).e2e, ['tests/24-lang.spec.ts', 'tests/28-users.spec.ts'], 'Shell der Redaktion');
});

test('REQ-55-AC1: geänderte Spec läuft allein, geänderte Fixtures führen zu allen Specs', () => {
  const single = select(['app/e2e/tests/18-topic.spec.ts']);
  assert.deepEqual(single.e2e, ['tests/18-topic.spec.ts']);
  assert.deepEqual(single.frontends, {});
  assert.deepEqual(single.backend, []);
  assert.equal(single.process, false);
  assert.equal(select(['app/e2e/support/fixtures.ts']).e2e, 'all');
  assert.equal(select(['app/e2e/playwright.config.ts']).e2e, 'all');
});

test('REQ-55-AC1: Testdatei wählt nur sich selbst', () => {
  const plan = select(['app/frontend/src/components/footer.test.ts']);
  assert.deepEqual(plan.frontends, { 'app/frontend': ['src/components/footer.test.ts'] });
  assert.deepEqual(plan.e2e, []);
});

test('REQ-55-AC1: Backend wählt das Go-Paket der Datei und alle Specs', () => {
  const plan = select(['app/backend/internal/service/a.go', 'app/backend/migrations/001.sql']);
  assert.deepEqual(plan.backend, ['internal/service', 'migrations']);
  assert.equal(plan.e2e, 'all');
  assert.deepEqual(plan.frontends, {});
  assert.equal(select(['app/backend/go.mod']).backend, 'all');
});

test('REQ-55-AC1: OpenAPI-Vertrag betrifft Backend, Frontend-Unit-Tests und alle Specs', () => {
  const plan = select(['app/api/openapi.yaml']);
  assert.equal(plan.backend, 'all');
  assert.deepEqual(plan.frontends, { 'app/frontend': 'all' });
  assert.equal(plan.e2e, 'all');
});

test('REQ-55-AC1: Frontend-Konfiguration betrifft alle Unit-Tests und alle Specs dieses Frontends', () => {
  const plan = select(['app/frontend/vite.config.ts']);
  assert.deepEqual(plan.frontends, { 'app/frontend': 'all' });
  assert.deepEqual(plan.e2e, ['tests/18-topic.spec.ts', 'tests/24-lang.spec.ts', 'tests/25-home.spec.ts']);
});

test('REQ-55-AC1: Prozesswerkzeuge und Repository-Dokumente wählen nur die Prozesswerkzeug-Tests', () => {
  for (const file of ['tools/board.mjs', 'AGENTS.md']) {
    const plan = select([file]);
    assert.equal(plan.process, true, file);
    assert.deepEqual([plan.backend, plan.frontends, plan.e2e], [[], {}, []], file);
  }
});

test('REQ-55-AC1: jede geänderte Datei erhält eine nachvollziehbare Begründung', () => {
  const plan = select(['app/frontend/src/pages/Home.tsx', 'mock/footer/index.html']);
  const home = plan.reasons.find((r) => r.file === 'app/frontend/src/pages/Home.tsx');
  assert.match(home.rule, /Importgraph/);
  assert.ok(home.tests.includes('tests/25-home.spec.ts'));
  assert.ok(home.tests.includes('app/frontend/src/pages/Home.test.tsx'));
  const mock = plan.reasons.find((r) => r.file === 'mock/footer/index.html');
  assert.match(mock.rule, /testfrei/);
  assert.deepEqual(mock.tests, []);
});

test('REQ-55-AC1: nicht erreichbare Frontend-Datei ohne Spec-Abdeckung führt konservativ zu allen Specs', () => {
  const plan = select(['app/frontend/src/lib/unused.ts']);
  assert.equal(plan.e2e, 'all');
  assert.match(plan.reasons[0].rule, /keine Spec/);
});

test('REQ-55-AC2: Datei ohne Zuordnungsregel bleibt ungeklärt', () => {
  const plan = select(['scripts/neu.sh', 'mock/footer/index.html']);
  assert.deepEqual(plan.unresolved, ['scripts/neu.sh']);
});

test('REQ-55-AC2: Abdeckung auf eine fehlende Datei ist ungeklärt', () => {
  const files = { ...repo, 'app/e2e/tests/30-alt.spec.ts': '// Abdeckung: app/frontend/src/pages/Alt.tsx\n' };
  const plan = select(['app/frontend/src/pages/Home.tsx'], files);
  assert.deepEqual(plan.unresolved, ['app/e2e/tests/30-alt.spec.ts → app/frontend/src/pages/Alt.tsx']);
});

test('REQ-55-AC2: nachvollziehbar testfreie Änderung wählt keine Tests', () => {
  const plan = select(['mock/footer/index.html', 'res/other.png', 'app/docs/betrieb.md', 'app/deploy/deploy.sh']);
  assert.deepEqual([plan.process, plan.backend, plan.frontends, plan.e2e, plan.unresolved], [false, [], {}, [], []]);
  assert.equal(plan.reasons.length, 4);
});

test('Bug #80: Caddyfile und compose.yaml wählen die Prozesstests mit dem Caddy-Protokolltest', () => {
  const files = { ...repo, 'app/deploy/Caddyfile': ':80', 'app/compose.yaml': 'services: {}' };
  for (const file of ['app/deploy/Caddyfile', 'app/compose.yaml']) {
    const plan = select([file], files);
    assert.deepEqual([plan.process, plan.backend, plan.e2e, plan.unresolved], [true, [], [], []], file);
    assert.match(plan.reasons[0].rule, /Caddy-Konfiguration/);
  }
});

test('REQ-55-AC2: Änderung an Pipeline oder Testauswahl führt zur vollständigen Suite', () => {
  for (const file of ['.github/workflows/merge-gate.yml', 'tools/affected-tests.mjs', 'tools/e2e-phases.mjs']) {
    const plan = select([file], { ...repo, 'tools/affected-tests.mjs': '', 'tools/e2e-phases.mjs': '' });
    assert.equal(plan.full, true, file);
    assert.equal(plan.process, true);
    assert.equal(plan.backend, 'all');
    assert.deepEqual(plan.frontends, { 'app/frontend': 'all' });
    assert.equal(plan.e2e, 'all');
  }
});

test('REQ-55-AC1: Go-Auswahl umfasst geändertes Paket und alle direkt, transitiv oder über Tests importierenden Pakete', () => {
  const list = [
    { ImportPath: 'example.org/ki/a' },
    { ImportPath: 'example.org/ki/b', Imports: ['example.org/ki/a', 'fmt'] },
    { ImportPath: 'example.org/ki/c', XTestImports: ['example.org/ki/b'] },
    { ImportPath: 'example.org/ki/d', Imports: ['fmt'] },
    { ImportPath: 'example.org/ki', TestImports: ['example.org/ki/d'] },
  ];
  assert.deepEqual(selectGoPackages({ module: 'example.org/ki', packages: list, dirs: ['a'] }), ['example.org/ki/a', 'example.org/ki/b', 'example.org/ki/c']);
  assert.deepEqual(selectGoPackages({ module: 'example.org/ki', packages: list, dirs: ['d'] }), ['example.org/ki', 'example.org/ki/d']);
  assert.deepEqual(selectGoPackages({ module: 'example.org/ki', packages: list, dirs: ['entfernt'] }), []);
});

test('REQ-55-AC1: Ausgabe von go list -json wird als Folge von Objekten gelesen', () => {
  const text = '{\n\t"ImportPath": "x/a",\n\t"Doc": "Klammern } { im Text"\n}\n{\n\t"ImportPath": "x/b",\n\t"Imports": ["x/a"]\n}\n';
  assert.deepEqual(parseGoList(text).map((p) => p.ImportPath), ['x/a', 'x/b']);
});

// Fidelity: Kommandozeile gegen echtes Git und den tatsächlichen Repository-Stand.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'affected-tests.mjs');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('REQ-55-AC1 Fidelity: Footer-Änderung im Repository wählt Footer-Tests und lässt Redaktions-Specs aus', () => {
  const result = run(['plan', '--changed', 'app/frontend/src/components/footer.ts', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.ok(plan.e2e.includes('tests/54-footer.spec.ts'));
  assert.ok(plan.e2e.includes('tests/25-startseite.spec.ts'));
  // 27-beratung durchläuft die öffentliche Selbsteinschätzung (completeAssessment) und ist deshalb betroffen.
  for (const spec of ['06-passwort-maskieren', '21-redaktion-beitraege', '28-benutzer']) {
    assert.ok(!plan.e2e.includes(`tests/${spec}.spec.ts`), `${spec} ist unbetroffen`);
  }
  assert.ok(plan.frontends['app/frontend'].includes('src/components/footer.test.ts'));
  assert.deepEqual([plan.process, plan.backend], [false, []]);
});

test('REQ-55-AC1 Fidelity: Startseite im Repository wählt Startseiten-Specs, keine Themen-Specs', () => {
  const result = run(['plan', '--changed', 'app/frontend/src/pages/Home.tsx', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  for (const spec of ['25-startseite', '34-startseite-kurzcheck', '47-startseite-ohne-profilteaser']) assert.ok(plan.e2e.includes(`tests/${spec}.spec.ts`), spec);
  for (const spec of ['18-vibe-coding', '61-artikelkopf', '21-redaktion-beitraege']) assert.ok(!plan.e2e.includes(`tests/${spec}.spec.ts`), spec);
});

test('REQ-55-AC1 Fidelity: alle Specs im Repository haben gültige Abdeckungsangaben', () => {
  const result = run(['plan', '--changed', 'app/e2e/tests/54-footer.spec.ts', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.e2e, ['tests/54-footer.spec.ts']);
  assert.deepEqual(plan.unresolved, []);
  assert.deepEqual(plan.undeclared, [], 'jede Spec deklariert ihre Abdeckung');
});

function gitRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'affected-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.org', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q');
  const write = (entries) => {
    for (const [path, content] of Object.entries(entries)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'stand');
    return git('rev-parse', 'HEAD');
  };
  const base = write(files);
  return { dir, base, write };
}

test('REQ-55-AC2 Fidelity: unbekannte Datei im PR-Diff beendet die Testauswahl mit Fehler und nennt die Datei', () => {
  const { dir, base, write } = gitRepo({ 'mock/a.html': 'a' });
  try {
    const head = write({ 'scripts/neu.sh': 'echo', 'mock/a.html': 'b' });
    const result = run(['plan', '--base', base, '--head', head], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /scripts\/neu\.sh/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('REQ-55-AC2 Fidelity: testfreie Änderung schließt die Testauswahl erfolgreich ohne Tests ab', () => {
  const { dir, base, write } = gitRepo({ 'mock/a.html': 'a' });
  try {
    const head = write({ 'mock/a.html': 'b', 'content/notiz.md': 'n' });
    const output = join(dir, 'github-output.txt');
    const summary = join(dir, 'summary.md');
    const result = spawnSync(process.execPath, [cli, 'plan', '--base', base, '--head', head], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(result.status, 0, result.stderr);
    const outputs = readFileSync(output, 'utf8');
    assert.match(outputs, /^any=false$/m);
    assert.match(outputs, /^e2e=$/m);
    assert.match(outputs, /^backend=$/m);
    assert.match(readFileSync(summary, 'utf8'), /testfrei/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Testauswahl für Merge Gate und Release Gate (Anforderung #55, Zuordnungsregeln in AGENTS.md, Abschnitt 5).
//
//   node tools/affected-tests.mjs plan --base <rev> --head <rev>   betroffene Tests eines PR-Diffs
//   node tools/affected-tests.mjs plan --all                       vollständige Suite (Release Gate)
//   node tools/affected-tests.mjs plan --changed <datei>... [--json] Auswahl für Dateien im Arbeitsverzeichnis
//   node tools/affected-tests.mjs go-packages <go-list.json> <verzeichnis>...  betroffene Go-Pakete
//
// Mit GITHUB_OUTPUT schreibt `plan` die Ausgaben any, process, backend, frontends und e2e,
// mit GITHUB_STEP_SUMMARY die Begründung je Datei. Ungeklärte Dateien beenden `plan` mit Status 1.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const FRONTENDS = ['app/frontend', 'app/frontend-redaktion'];
const E2E = 'app/e2e';
const SPEC = /^app\/e2e\/tests\/[^/]+\.spec\.ts$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const CODE = /\.(?:[cm]?[jt]sx?|css)$/;
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

/** Änderungen an Pipeline oder Testauswahl prüfen die vollständige Suite. */
const FULL = [/^\.github\//, /^tools\/affected-tests\.mjs$/, /^tools\/e2e-phases\.mjs$/];
/** Nachvollziehbar testfreie Dateien, sofern sie nicht im Importgraphen eines Frontends liegen. */
const FREE = [
  [/^mock\//, 'Mock ohne Anwendungscode'],
  [/^content\//, 'Redaktionelle Arbeitsunterlage außerhalb der Anwendung'],
  [/^res\//, 'Originalgrafik ohne Verwendung in der Anwendung'],
  [/^app\/docs\//, 'Dokumentation'],
  [/^app\/README\.md$/, 'Dokumentation'],
  [/^app\/(?:deploy\/|compose[^/]*\.ya?ml$|Makefile$)/, 'Auslieferung; geprüft durch Installation und Healthcheck im Release Gate'],
  [/^app\/(?:renovate\.json|\.env\.example|\.gitignore)$/, 'Werkzeugkonfiguration ohne Laufzeitwirkung'],
];

const sorted = (set) => [...set].sort();
const toPosix = (path) => path.replaceAll('\\', '/');

/** Relative Importe einer Quelldatei (JS/TS und CSS), aufgelöst gegen die Dateiliste. */
function imports(path, text, fileSet, files) {
  const dir = posix.dirname(path);
  const found = new Set();
  const resolve = (spec) => {
    const clean = spec.split(/[?#]/)[0];
    if (!clean.startsWith('.')) return;
    const base = posix.normalize(posix.join(dir, clean));
    const hit = EXTENSIONS.map((ext) => base + ext).find((candidate) => fileSet.has(candidate));
    if (hit) found.add(hit);
  };
  const patterns = [
    /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g,
    /@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g,
    /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) resolve(match[1]);
  for (const match of text.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g)) {
    for (const [, glob] of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
      if (!glob.startsWith('.')) continue;
      const absolute = posix.normalize(posix.join(dir, glob));
      const regex = new RegExp('^' + absolute.split(/(\*\*\/|\*\*|\*)/).map((part) =>
        part === '**/' ? '(?:.*/)?' : part === '**' ? '.*' : part === '*' ? '[^/]*' : part.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('') + '$');
      for (const file of files) if (regex.test(file)) found.add(file);
    }
  }
  return found;
}

function closure(graph, starts, stop = () => false) {
  const seen = new Set();
  const queue = [...starts];
  while (queue.length) {
    const node = queue.pop();
    if (seen.has(node) || stop(node)) continue;
    seen.add(node);
    for (const next of graph.get(node) ?? []) queue.push(next);
  }
  return seen;
}

function scripts(read, frontend) {
  try {
    return JSON.parse(read(frontend + '/package.json') ?? '{}').scripts ?? {};
  } catch {
    return {};
  }
}

const frontendOf = (path) => FRONTENDS.find((dir) => path.startsWith(dir + '/'));

/**
 * Wählt die betroffenen Tests für geänderte Dateien.
 * @param {{changed: string[], files: string[], read: (path: string) => string | undefined, all?: boolean}} input
 */
export function selectTests({ changed, files, read, all = false }) {
  const fileSet = new Set(files);
  const units = FRONTENDS.filter((dir) => fileSet.has(dir + '/package.json') && scripts(read, dir)['test:unit']);
  const specs = files.filter((file) => SPEC.test(file)).sort();
  const specName = (file) => file.slice(E2E.length + 1);

  // Importgraph aller Frontend-Quellen; Kanten führen auch zu Dateien außerhalb von src (z. B. res/).
  const graph = new Map();
  const visit = (path) => {
    if (graph.has(path)) return;
    const text = CODE.test(path) ? read(path) ?? '' : '';
    const edges = text ? imports(path, text, fileSet, files) : new Set();
    graph.set(path, edges);
    for (const next of edges) visit(next);
  };
  for (const file of files) if (frontendOf(file) && CODE.test(file)) visit(file);

  // Shell: Importhülle von main.tsx ohne Abstieg in Seiten; gemeinsam genutzt von allen Seiten des Frontends.
  const shells = new Map(FRONTENDS.map((dir) => [dir,
    closure(graph, [dir + '/src/main.tsx'], (node) => node.startsWith(dir + '/src/pages/'))]));

  const unresolved = [];
  const undeclared = [];
  const coverage = new Map();
  for (const spec of specs) {
    const declared = [...(read(spec) ?? '').matchAll(/^\/\/\s*Abdeckung\b[^:\n]*:(.*)$/gm)].flatMap((m) => m[1].trim().split(/\s+/)).filter(Boolean);
    if (!declared.length) {
      undeclared.push(specName(spec));
      continue;
    }
    const missing = declared.filter((path) => !fileSet.has(path));
    for (const path of missing) unresolved.push(`${spec} → ${path}`);
    const touched = new Set(declared.map(frontendOf).filter(Boolean));
    const covered = closure(graph, declared.filter((path) => fileSet.has(path)));
    for (const dir of touched) for (const node of shells.get(dir)) covered.add(node);
    coverage.set(spec, { covered, touched });
  }

  const plan = { full: all, process: all, backend: all ? 'all' : new Set(), frontends: {}, e2e: all ? 'all' : new Set() };
  const unitSel = new Map(units.map((dir) => [dir, all ? 'all' : new Set()]));
  const reasons = [];
  const addE2e = (list) => {
    if (plan.e2e === 'all') return;
    if (list === 'all') plan.e2e = 'all';
    else for (const spec of list) plan.e2e.add(specName(spec));
  };
  const addUnits = (dir, list) => {
    if (!unitSel.has(dir) || unitSel.get(dir) === 'all') return;
    if (list === 'all') unitSel.set(dir, 'all');
    else for (const test of list) unitSel.get(dir).add(test.slice(dir.length + 1));
  };
  const addBackend = (list) => {
    if (plan.backend === 'all') return;
    if (list === 'all') plan.backend = 'all';
    else for (const dir of list) plan.backend.add(dir);
  };
  const specsTouching = (dir) => specs.filter((spec) => !coverage.has(spec) || coverage.get(spec).touched.has(dir));

  const fullReason = 'Pipeline oder Testauswahl geändert → vollständige Suite';
  for (const file of all ? [] : changed) {
    const tests = [];
    const rules = [];
    if (FULL.some((pattern) => pattern.test(file))) {
      plan.full = true;
      reasons.push({ file, rule: fullReason, tests: ['alle'] });
      continue;
    }

    // Regel 2: Datei im Importgraphen eines Frontends.
    if (graph.has(file)) {
      const dir = frontendOf(file);
      const isConfig = dir && !file.startsWith(dir + '/src/');
      if (isConfig) {
        // Regel 3: Konfiguration eines Frontends.
        rules.push('Frontend-Konfiguration');
        addUnits(dir, 'all');
        if (unitSel.has(dir)) tests.push(`${dir}: alle Unit-Tests`);
        const touching = specsTouching(dir);
        addE2e(touching);
        tests.push(...touching.map(specName));
      } else if (TEST_FILE.test(file)) {
        rules.push('Unit-Test');
        addUnits(dir, [file]);
        tests.push(file);
      } else {
        rules.push('Importgraph');
        for (const unitDir of units) {
          const related = files.filter((test) => test.startsWith(unitDir + '/src/') && TEST_FILE.test(test) && closure(graph, [test]).has(file));
          addUnits(unitDir, related);
          tests.push(...related);
        }
        const selected = specs.filter((spec) => !coverage.has(spec) || coverage.get(spec).covered.has(file));
        if (selected.every((spec) => !coverage.has(spec))) {
          rules.push('keine Spec deklariert Abdeckung → alle Specs');
          addE2e('all');
          tests.push('alle Specs');
        } else {
          addE2e(selected);
          tests.push(...selected.map(specName));
        }
      }
    }

    // Pfadregeln.
    if (frontendOf(file) && !graph.has(file)) {
      const dir = frontendOf(file);
      rules.push('Frontend-Konfiguration');
      addUnits(dir, 'all');
      if (unitSel.has(dir)) tests.push(`${dir}: alle Unit-Tests`);
      const touching = specsTouching(dir);
      addE2e(touching);
      tests.push(...touching.map(specName));
    } else if (file.startsWith('app/backend/')) {
      rules.push('Backend');
      const inner = file.slice('app/backend/'.length);
      if (inner === 'go.mod' || inner === 'go.sum') {
        addBackend('all');
        tests.push('Backend: alle Pakete');
      } else {
        let dir = posix.dirname(inner);
        const hasGo = (d) => files.some((f) => f.startsWith('app/backend/' + (d === '.' ? '' : d + '/')) && f.endsWith('.go') && !f.slice(('app/backend/' + (d === '.' ? '' : d + '/')).length).includes('/'));
        while (dir !== '.' && !hasGo(dir)) dir = posix.dirname(dir);
        addBackend([dir]);
        tests.push(`Backend: ${dir} und importierende Pakete`);
      }
      addE2e('all');
      tests.push('alle Specs (Backend)');
    } else if (/^app\/(?:api\/|Dockerfile$|\.dockerignore$)/.test(file)) {
      rules.push('Vertrag oder Image');
      addBackend('all');
      for (const dir of units) addUnits(dir, 'all');
      addE2e('all');
      tests.push('Backend, alle Frontend-Unit-Tests, alle Specs');
    } else if (SPEC.test(file)) {
      rules.push('Fidelity-Spec');
      if (fileSet.has(file)) {
        addE2e([file]);
        tests.push(specName(file));
      } else {
        tests.push('Spec entfernt');
      }
    } else if (file.startsWith(E2E + '/')) {
      rules.push('Fidelity-Infrastruktur');
      addE2e('all');
      tests.push('alle Specs');
    } else if (file.startsWith('tools/') || !file.includes('/')) {
      rules.push(file.startsWith('tools/') ? 'Prozesswerkzeug' : 'Repository-Dokument');
      plan.process = true;
      tests.push('tools/*.test.mjs');
    }

    if (rules.length) {
      reasons.push({ file, rule: rules.join(' · '), tests: [...new Set(tests)] });
      continue;
    }
    const free = FREE.find(([pattern]) => pattern.test(file));
    if (free) reasons.push({ file, rule: `testfrei: ${free[1]}`, tests: [] });
    else {
      unresolved.push(file);
      reasons.push({ file, rule: 'ungeklärt: keine Zuordnungsregel', tests: [] });
    }
  }

  if (plan.full) {
    plan.process = true;
    plan.backend = 'all';
    plan.e2e = 'all';
    for (const dir of units) unitSel.set(dir, 'all');
  }
  for (const [dir, selection] of unitSel) {
    if (selection === 'all') plan.frontends[dir] = 'all';
    else if (selection.size) plan.frontends[dir] = sorted(selection);
  }
  if (plan.backend !== 'all') plan.backend = sorted(plan.backend);
  if (plan.e2e !== 'all') plan.e2e = sorted(plan.e2e);
  return { ...plan, reasons, unresolved, undeclared };
}

/** Liest die Ausgabe von `go list -json` (Folge von JSON-Objekten). */
export function parseGoList(text) {
  const result = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') {
      if (depth++ === 0) start = i;
    } else if (c === '}' && --depth === 0) result.push(JSON.parse(text.slice(start, i + 1)));
  }
  return result;
}

/** Geänderte Paketverzeichnisse plus alle Pakete, die sie direkt, transitiv oder in Tests importieren. */
export function selectGoPackages({ module, packages, dirs }) {
  const known = new Set(packages.map((p) => p.ImportPath));
  const reverse = new Map();
  for (const p of packages) {
    for (const dep of [...(p.Imports ?? []), ...(p.TestImports ?? []), ...(p.XTestImports ?? [])]) {
      if (!reverse.has(dep)) reverse.set(dep, new Set());
      reverse.get(dep).add(p.ImportPath);
    }
  }
  const starts = dirs.map((dir) => (dir === '.' ? module : `${module}/${dir}`)).filter((path) => known.has(path));
  return sorted(closure(reverse, starts));
}

// ---------- Kommandozeile ----------

function gitTree(rev, cwd) {
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  const files = git('ls-tree', '-r', '-z', '--name-only', rev).split('\0').filter(Boolean);
  const wanted = files.filter((f) => (frontendOf(f) && (CODE.test(f) || f.endsWith('package.json'))) || SPEC.test(f));
  const contents = new Map();
  if (wanted.length) {
    const output = execFileSync('git', ['cat-file', '--batch'], { cwd, input: wanted.map((f) => `${rev}:${f}`).join('\n') + '\n', maxBuffer: 1 << 28 });
    let offset = 0;
    for (const file of wanted) {
      const headerEnd = output.indexOf(10, offset);
      const size = Number(output.subarray(offset, headerEnd).toString().split(' ')[2]);
      contents.set(file, output.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
      offset = headerEnd + 1 + size + 1;
    }
  }
  return { files, read: (path) => contents.get(path) };
}

function workingTree(cwd) {
  const files = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0').filter((f) => f && existsSync(join(cwd, f)));
  return { files, read: (path) => (existsSync(join(cwd, path)) ? readFileSync(join(cwd, path), 'utf8') : undefined) };
}

function option(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function summary(plan) {
  const show = (value) => (value === 'all' ? 'alle' : value.length ? value.join(', ') : '–');
  const lines = [
    '## Testauswahl',
    '',
    plan.full ? '**Vollständige Suite.**' : '',
    `- Prozesswerkzeuge: ${plan.process ? 'ja' : 'nein'}`,
    `- Backend: ${show(plan.backend)}`,
    ...Object.entries(plan.frontends).map(([dir, tests]) => `- Unit-Tests ${dir}: ${show(tests)}`),
    `- Fidelity-Specs: ${show(plan.e2e)}`,
    '',
  ];
  if (plan.reasons.length) {
    lines.push('| Datei | Regel | Ausgewählte Tests |', '|---|---|---|');
    for (const r of plan.reasons) lines.push(`| \`${r.file}\` | ${r.rule} | ${r.tests.length ? r.tests.join('<br>') : '–'} |`);
  }
  if (plan.unresolved.length) lines.push('', '**Ungeklärte Zuordnung:**', ...plan.unresolved.map((u) => `- \`${u}\``));
  return lines.filter((line, i) => line !== '' || lines[i - 1] !== '').join('\n') + '\n';
}

function main(args) {
  const cwd = process.cwd();
  if (args[0] === 'go-packages') {
    const packages = parseGoList(readFileSync(args[1], 'utf8'));
    const module = /^module\s+(\S+)/m.exec(readFileSync('go.mod', 'utf8'))[1];
    console.log(selectGoPackages({ module, packages, dirs: args.slice(2) }).join('\n'));
    return 0;
  }
  if (args[0] !== 'plan') {
    console.error('Aufruf: affected-tests.mjs plan (--base <rev> --head <rev> | --all | --changed <datei>...) [--json]');
    return 2;
  }
  const all = args.includes('--all');
  const base = option(args, '--base');
  const head = option(args, '--head');
  let changed = [];
  let tree;
  if (all) tree = workingTree(cwd);
  else if (args.includes('--changed')) {
    changed = args.slice(args.indexOf('--changed') + 1).filter((a) => !a.startsWith('--')).map(toPosix);
    tree = head ? gitTree(head, cwd) : workingTree(cwd);
  } else {
    if (!base || !head) {
      console.error('--base und --head sind erforderlich.');
      return 2;
    }
    changed = execFileSync('git', ['-c', 'core.quotepath=off', 'diff', '--name-only', '-z', '--no-renames', `${base}...${head}`], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
    tree = gitTree(head, cwd);
  }
  const plan = selectTests({ changed, all, ...tree });
  const text = summary(plan);
  if (args.includes('--json')) console.log(JSON.stringify(plan, null, 2));
  else console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (process.env.GITHUB_OUTPUT) {
    const frontends = Object.entries(plan.frontends).map(([dir, tests]) => ({ dir, tests: tests === 'all' ? 'all' : tests.join(' ') }));
    const join = (value) => (value === 'all' ? 'all' : value.join(' '));
    const any = plan.process || plan.backend.length > 0 || frontends.length > 0 || plan.e2e.length > 0;
    appendFileSync(process.env.GITHUB_OUTPUT, [
      `any=${any}`, `process=${plan.process}`, `backend=${join(plan.backend)}`,
      `frontends=${JSON.stringify(frontends)}`, `e2e=${join(plan.e2e)}`, '',
    ].join('\n'));
  }
  if (plan.unresolved.length) {
    console.error('Ungeklärte Zuordnung – betroffene Tests lassen sich nicht bestimmen:\n' + plan.unresolved.map((u) => '  ' + u).join('\n'));
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));

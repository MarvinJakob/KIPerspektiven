// Führt ausgewählte Playwright-Specs aus (Anforderung #55, REQ-55-AC1). Aufruf aus app/e2e:
//
//   node ../../tools/e2e-phases.mjs all                      alle Projekte wie konfiguriert
//   node ../../tools/e2e-phases.mjs tests/54-footer.spec.ts  nur diese Specs
//
// Bei einer Auswahl läuft jedes Playwright-Projekt in Konfigurationsreihenfolge als eigene Phase mit --no-deps:
// Setup-Projekte (Tests außerhalb von tests/) vollständig, Spec-Projekte nur mit ihren ausgewählten Specs.
// So startet eine einzelne Spec keine unbetroffenen Abhängigkeitsprojekte, und die Statistik läuft weiterhin zuletzt.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Projekte mit ihren Testdateien (relativ zum testDir) aus `playwright test --list --reporter=json`. */
export function projectFiles(list) {
  const files = new Map(list.config.projects.map((p) => [p.name, new Set()]));
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) files.get(t.projectName)?.add(file);
    for (const child of suite.suites ?? []) walk(child, file);
  };
  for (const suite of list.suites ?? []) walk(suite, suite.file);
  return [...files].map(([name, set]) => ({ name, files: [...set] }));
}

/** Ausführungsphasen für die ausgewählten Specs (Pfade relativ zu app/e2e, z. B. tests/54-footer.spec.ts). */
export function planPhases(projects, selected) {
  const wanted = new Set(selected.map((path) => path.replace(/^tests\//, '')));
  const known = new Set(projects.flatMap((p) => p.files));
  const missing = [...wanted].filter((file) => !known.has(file));
  if (missing.length) throw Error('Unbekannte Specs: ' + missing.join(', '));
  const phases = [];
  for (const project of projects) {
    const setup = project.files.length > 0 && project.files.every((file) => file.startsWith('../'));
    if (setup) phases.push({ project: project.name, files: [] });
    else {
      const files = project.files.filter((file) => wanted.has(file)).sort().map((file) => 'tests/' + file);
      if (files.length) phases.push({ project: project.name, files });
    }
  }
  return phases;
}

function playwright(args, env = {}) {
  const result = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: ['ignore', env.capture ? 'pipe' : 'inherit', 'inherit'], encoding: 'utf8',
    shell: process.platform === 'win32', env: { ...process.env, ...env.vars }, maxBuffer: 1 << 28,
  });
  if (result.error) throw result.error;
  return result;
}

function main(args) {
  if (!args.length) {
    console.error('Aufruf: e2e-phases.mjs all | <spec>...');
    return 2;
  }
  if (args.length === 1 && args[0] === 'all') return playwright([]).status ?? 1;
  const listed = playwright(['--list', '--reporter=json'], { capture: true });
  if (listed.status !== 0) return listed.status ?? 1;
  const phases = planPhases(projectFiles(JSON.parse(listed.stdout)), args);
  let status = 0;
  for (const phase of phases) {
    console.log(`\n▶ Phase ${phase.project}: ${phase.files.length ? phase.files.join(' ') : 'alle Tests des Projekts'}`);
    const run = playwright(['--no-deps', `--project=${phase.project}`, `--output=test-results/${phase.project}`, ...phase.files],
      { vars: { PLAYWRIGHT_HTML_OUTPUT_DIR: `playwright-report/${phase.project}` } });
    if (run.status !== 0) status = run.status ?? 1;
    // Ohne Anmeldung ist jede weitere Phase aussagelos.
    if (status !== 0 && phase.files.length === 0) return status;
  }
  return status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));

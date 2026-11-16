// Fachliche Fehlschläge dürfen Backlog sein; fehlende Ausführung und Laufzeitfehler niemals.
export function evaluateReport(report, inventory) {
  const byId = new Map();
  const invalid = [];
  const projects = ['desktop', 'mobil'];
  const collect = (source) => {
    const entries = new Map();
    const visit = (suite) => {
      for (const spec of suite.specs ?? []) {
        const id = /^(REQ-\d+-AC\d+)\b/.exec(spec.title)?.[1];
        if (!id) { invalid.push(`Testtitel ohne gültige ID: ${spec.title}`); continue; }
        if (!Array.isArray(spec.tests) || !spec.tests.length) invalid.push(`${id}: keine Testprojekte`);
        for (const execution of spec.tests ?? []) {
          const key = `${id}:${execution.projectName}`;
          if (entries.has(key)) invalid.push(`${key}: Test-ID mehrfach vergeben`);
          entries.set(key, { id, execution });
        }
      }
      for (const child of suite.suites ?? []) visit(child);
    };
    for (const suite of source.suites ?? []) visit(suite);
    return entries;
  };
  const actual = collect(report);
  if (!actual.size) invalid.push('Der Testlauf enthält keine Tests.');
  if (report.errors?.length) invalid.push('Der Testlauf enthält globale Fehler.');
  if (report.stats?.interrupted) invalid.push('Der Testlauf wurde unterbrochen.');
  if (inventory) {
    const expected = collect(inventory);
    if (!expected.size || inventory.errors?.length) invalid.push('Das Testinventar ist leer oder fehlerhaft.');
    for (const key of expected.keys()) if (!actual.has(key)) invalid.push(`${key}: Testausführung fehlt`);
    for (const key of actual.keys()) if (!expected.has(key)) invalid.push(`${key}: nicht im Testinventar`);
  }
  for (const { id, execution } of actual.values()) {
    const passed = execution.status === 'expected' && execution.expectedStatus === 'passed'
      && execution.results?.length === 1 && execution.results[0].status === 'passed';
    const previous = byId.get(id);
    byId.set(id, { passed: (previous?.passed ?? true) && passed });
    if (!projects.includes(execution.projectName)) invalid.push(`${id}: unbekanntes Testprojekt`);
    if (execution.status === 'skipped' || execution.expectedStatus !== 'passed'
      || !execution.results?.length || execution.results.some((result) => ['skipped', 'interrupted'].includes(result.status))) {
      invalid.push(`${id}: nicht regulär ausgeführt (${execution.projectName})`);
    }
  }
  for (const id of byId.keys()) {
    for (const project of projects) {
      if (!actual.has(`${id}:${project}`)) {
        byId.get(id).passed = false;
        invalid.push(`${id}: Projekt ${project} fehlt`);
      }
    }
  }
  return { byId, invalid };
}

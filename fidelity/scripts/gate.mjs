#!/usr/bin/env node
// Wertet einen Fidelity-Lauf (results.json von Playwright) gegen die Baseline aus.
//
//   node scripts/gate.mjs [--require "REQ-12-AC1 REQ-12-AC2"] [--results results.json] [--inventory inventory.json] [--no-baseline]
//
// Ergebnis je Test-ID (REQ-<n>-AC<m>, Anfang des Testtitels): bestanden nur, wenn der Test in allen
// Projekten (desktop, mobil) bestanden hat.
//
// Exitcode 1, wenn
//   - eine ID aus baseline.txt („Dinge, die funktionieren“) nicht bestanden hat oder fehlt (Regression),
//   - eine mit --require bzw. REQUIRED_IDS geforderte ID nicht bestanden hat oder fehlt,
//   - ein Testtitel nicht mit einer gültigen ID beginnt.
// Nicht bestandene Tests außerhalb der Baseline sind erlaubt: Sie sind der offene Backlog.
//
// Die Zusammenfassung geht nach stdout und, in GitHub Actions, in die Zusammenfassung des Laufs.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateReport } from './report.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : fallback;
}

const resultsPath = arg('--results', join(root, 'results.json'));
const required = (arg('--require') || process.env.REQUIRED_IDS || '').split(/[\s,]+/).filter(Boolean);
// --no-baseline: Teillauf (z. B. Smoke-Test gegen Produktion), dann zählen nur die geforderten IDs
const baseline = process.argv.includes('--no-baseline')
  ? []
  : readFileSync(join(root, 'baseline.txt'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*/, '').trim())
      .filter(Boolean);

const report = JSON.parse(readFileSync(resultsPath, 'utf8'));
const inventoryPath = arg('--inventory');
const inventory = inventoryPath ? JSON.parse(readFileSync(inventoryPath, 'utf8')) : undefined;
const { byId, invalid } = evaluateReport(report, inventory);
for (const id of (process.env.SELECTED_IDS ?? '').split(/[\s,]+/).filter(Boolean)) {
  if (!byId.has(id)) invalid.push(`${id}: ausgewählte Test-ID fehlt`);
}

const status = (id) => (byId.has(id) ? (byId.get(id).passed ? 'bestanden' : 'fehlgeschlagen') : 'fehlt');
const regressions = baseline.filter((id) => status(id) !== 'bestanden');
const missingRequired = required.filter((id) => status(id) !== 'bestanden');
const all = [...byId.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const works = all.filter((id) => byId.get(id).passed);
const fails = all.filter((id) => !byId.get(id).passed);
const newlyWorking = works.filter((id) => !baseline.includes(id));

const lines = [
  '### Fidelity-Gate',
  '',
  `| | Anzahl |`,
  `|---|---|`,
  `| Test-IDs gesamt | ${all.length} |`,
  `| funktionieren | ${works.length} |`,
  `| funktionieren nicht (offener Backlog) | ${fails.length} |`,
  `| neu funktionierend, noch nicht in baseline.txt | ${newlyWorking.length} |`,
  `| Regressionen gegenüber baseline.txt | ${regressions.length} |`,
  '',
];
if (required.length) {
  lines.push('**Geforderte IDs dieses Pull Requests**', '');
  for (const id of required) lines.push(`- ${id}: ${status(id)}`);
  lines.push('');
}
if (regressions.length) lines.push('**Regressionen**', '', ...regressions.map((id) => `- ${id}: ${status(id)}`), '');
if (invalid.length) lines.push('**Ungültiger oder unvollständiger Testlauf**', '', ...invalid.map((t) => `- ${t}`), '');
if (newlyWorking.length) lines.push('**Neu funktionierend**', '', ...newlyWorking.map((id) => `- ${id}`), '');
if (fails.length) lines.push('<details><summary>Funktionieren nicht</summary>', '', ...fails.map((id) => `- ${id}`), '', '</details>', '');

const ok = regressions.length === 0 && missingRequired.length === 0 && invalid.length === 0;
lines.push(ok ? '**Ergebnis: bestanden**' : '**Ergebnis: nicht bestanden**');

const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
// Maschinenlesbar für Team 2 (Testlauf) und das Release Gate
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `works=${works.join(' ')}\nfails=${fails.join(' ')}\nnewly_working=${newlyWorking.join(' ')}\n`);
}
process.exit(ok ? 0 : 1);

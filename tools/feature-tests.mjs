// Select only the features of this PR. An empty selection must never mean "run everything".
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { command, api, repository, issueLabels } from './github.mjs';

export function selectFeatureTests({ branch, body, changed, baseline, sources, testDefect = false }) {
  const required = new Set();
  for (const line of body.split(/\r?\n/).filter((line) => /^Fidelity:/i.test(line))) {
    const value = line.replace(/^Fidelity:\s*/i, '').trim();
    if (!/^(REQ-\d+-AC\d+)([\s,]+REQ-\d+-AC\d+)*$/.test(value)) {
      throw new Error('Fidelity: muss ausschließlich gültige Test-IDs enthalten; unbenutzte Zeile entfernen.');
    }
    for (const id of value.match(/REQ-\d+-AC\d+/g)) required.add(id);
  }
  const previous = new Set(baseline.before.match(/REQ-\d+-AC\d+/g) ?? []);
  const current = new Set(baseline.after.match(/REQ-\d+-AC\d+/g) ?? []);
  for (const id of current) if (!previous.has(id)) required.add(id);
  if (/^fix\//.test(branch) && !testDefect && !required.size) {
    throw new Error('Implementierungs- und Bugfix-PRs brauchen Fidelity: mit den IDs ihres Tickets.');
  }
  const features = new Set([...required].map((id) => /^REQ-\d+/.exec(id)[0]));
  for (const file of changed) {
    const match = /^fidelity\/(?:specs|tests)\/(REQ-\d+)(?=[./])/.exec(file);
    if (match) features.add(match[1]);
  }
  if (!features.size && changed.some((file) => /^fidelity\/tests\//.test(file))) {
    throw new Error('Geänderte Test-Hilfsdatei ohne Feature-Zuordnung: betroffene IDs unter Fidelity: angeben.');
  }
  const selected = new Set();
  for (const feature of features) {
    const source = sources[`${feature}.spec.ts`];
    if (source === undefined) throw new Error(`Testdatei für ${feature} fehlt.`);
    const ids = source.match(new RegExp(`\\b${feature}-AC\\d+\\b`, 'g')) ?? [];
    if (!ids.length) throw new Error(`Keine Test-IDs für ${feature}.`);
    for (const id of ids) selected.add(id);
  }
  // Protect the baseline of the selected features only. Global regression protection is the Release Gate.
  for (const id of current) if (features.has(/^REQ-\d+/.exec(id)[0])) required.add(id);
  for (const id of required) if (!selected.has(id)) throw new Error(`Geforderte ID ${id} fehlt im Feature.`);
  return {
    grep: features.size ? `\\b(?:${[...features].sort().join('|')})-AC[0-9]+\\b` : '',
    required: [...required].sort().join(' '),
    selected: [...selected].sort().join(' '),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = process.env.BASE;
    if (!base) throw new Error('BASE fehlt.');
    const branch = process.env.BRANCH ?? '';
    const changed = command('git', ['diff', '--name-only', '-z', `${base}...HEAD`]).split('\0').filter(Boolean);
    const testDefect = /^fix\/\d+$/.test(branch)
      && issueLabels(api(`repos/${repository}/issues/${branch.split('/')[1]}`)).has('test-defect');
    const result = selectFeatureTests({ branch, body: process.env.PR_BODY ?? '', changed, testDefect,
      baseline: { before: command('git', ['show', `${base}:fidelity/baseline.txt`]), after: readFileSync('fidelity/baseline.txt', 'utf8') },
      sources: Object.fromEntries(readdirSync('fidelity/tests').filter((name) => /^REQ-\d+\.spec\.ts$/.test(name))
        .map((name) => [name, readFileSync(`fidelity/tests/${name}`, 'utf8')])),
    });
    console.log(`Feature-Tests: ${result.selected || 'keine (reine Wartung)'}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `grep=${result.grep}\nrequired=${result.required}\nselected=${result.selected}\n`);
  } catch (error) { console.error(`::error::${error.message}`); process.exitCode = 1; }
}

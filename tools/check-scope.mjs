import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { api, repository, issueLabels } from './github.mjs';

export function checkScope(branch, files, before, after, { testDefect = false } = {}) {
  const rule = branch.startsWith('spec/') ? /^fidelity\/(specs|tests)\//
    : branch.startsWith('verify/') ? /^fidelity\/baseline\.txt$/
      // Only a linked test-defect issue permits Team 3 to correct Fidelity tests/specifications.
      : branch.startsWith('fix/') ? (testDefect ? /^(app\/|fidelity\/(specs|tests)\/)/ : /^app\//) : null;
  if (!rule) return; // Wartung braucht einen ausdrücklichen Maintainer-Auftrag und Review.
  const forbidden = files.filter((file) => !rule.test(file));
  if (forbidden.length) throw new Error(`Team-Grenze für ${branch} verletzt: ${forbidden.join(', ')}`);
  if (!files.includes('fidelity/baseline.txt')) return;
  const normalize = (value) => value.replaceAll('\r\n', '\n');
  before = normalize(before);
  after = normalize(after);
  if (!after.startsWith(before)) throw new Error('Die Baseline darf nur am Ende ergänzt werden.');
  const ids = new Set(before.split('\n').filter((line) => /^REQ-/.test(line)));
  for (const line of after.slice(before.length).split('\n').filter(Boolean)) {
    if (!/^REQ-\d+-AC\d+$/.test(line) || ids.has(line)) throw new Error(`Ungültige oder doppelte Baseline-ID: ${line}`);
    ids.add(line);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
    const base = process.env.BASE;
    if (!base) throw new Error('BASE fehlt.');
    const files = git('diff', '--name-only', '-z', `${base}...HEAD`).split('\0').filter(Boolean);
    const branch = process.env.BRANCH ?? '';
    const testDefect = /^fix\/\d+$/.test(branch) && files.some((file) => /^fidelity\/(specs|tests)\//.test(file))
      && issueLabels(api(`repos/${repository}/issues/${branch.split('/')[1]}`)).has('test-defect');
    checkScope(branch, files,
      git('show', `${base}:fidelity/baseline.txt`), git('show', 'HEAD:fidelity/baseline.txt'), { testDefect });
    console.log('Team-Grenzen und append-only Baseline geprüft.');
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

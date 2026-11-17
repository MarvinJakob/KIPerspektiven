import { spawnSync } from 'node:child_process';

export const repository = 'MarvinJakob/KIPerspektiven';
export function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program}: ${result.stderr?.trim() || `Exit ${result.status}`}`);
  return result.stdout?.trim() ?? '';
}
export function api(path, { method = 'GET', body } = {}) {
  const args = ['api', path, '--method', method];
  if (body !== undefined) args.push('--input', '-');
  const output = command('gh', args, { input: body === undefined ? undefined : JSON.stringify(body) });
  return output ? JSON.parse(output) : null;
}
export function pages(path) {
  const lines = command('gh', ['api', '--paginate', path, '--jq', '.[] | @json']);
  return lines ? lines.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}
export function issueLabels(issue) { return new Set(issue.labels.map((label) => label.name)); }

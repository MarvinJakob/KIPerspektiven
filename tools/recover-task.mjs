// Explicit recovery approval is bound to a task, owner AND lock object. Age alone is never permission.
import { readFileSync, existsSync, unlinkSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, repository, command } from './github.mjs';

try {
  const [branchKind, number, commentId] = process.argv.slice(2);
  if (!/^(spec|verify|fix|maint)$/.test(branchKind ?? '') || !/^\d+$/.test(number ?? '') || !/^\d+$/.test(commentId ?? '')) {
    throw new Error('Aufruf: node tools/recover-task.mjs <branchKind> <issue> <Freigabe-Kommentar-ID>');
  }
  const common = command('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const state = join(common, 'agent-tasks', `${branchKind}-${number}`);
  const owner = existsSync(join(state, 'active/owner')) ? readFileSync(join(state, 'active/owner'), 'utf8').trim() : 'legacy';
  const ref = `refs/agent-task-locks/${branchKind}-${number}`;
  const lock = command('git', ['for-each-ref', '--format=%(objectname)', ref]) || 'none';
  const approval = api(`repos/${repository}/issues/comments/${commentId}`);
  const permission = api(`repos/${repository}/collaborators/${encodeURIComponent(approval.user.login)}/permission`).permission;
  if (permission !== 'admin' || !approval.issue_url.endsWith(`/issues/${number}`)) throw new Error('Freigabe muss vom Maintainer am betreffenden Issue stammen.');
  const marker = `Recover-Task: ${branchKind}/${number}\nOwner: ${owner}\nOperation-Lock: ${lock}`;
  if (!approval.body.replaceAll('\r\n', '\n').includes(marker)) throw new Error(`Freigabe muss den aktuellen Zustand benennen:\n${marker}`);
  if (existsSync(join(state, 'heartbeat')) && Number(readFileSync(join(state, 'heartbeat'), 'utf8')) * 1000 > Date.parse(approval.created_at)) {
    throw new Error('Nach der Freigabe gab es ein Lebenszeichen; erneute Klärung nötig.');
  }
  // No worktree or branch is removed. The owner-bound approval is the deliberate recovery decision.
  if (lock !== 'none') command('git', ['update-ref', '-d', ref, lock]);
  const recoveryLock = command('git', ['hash-object', '-w', '--stdin'], { input: `recovery:${commentId}` });
  command('git', ['update-ref', ref, recoveryLock, '0'.repeat(40)]);
  try {
    if (!existsSync(state)) throw new Error('Legacy-Worktree: Zustand erst anhand des dokumentierten Übergabestands migrieren; keine automatische Übernahme.');
    if (existsSync(join(state, 'active/owner')) && readFileSync(join(state, 'active/owner'), 'utf8').trim() !== owner) throw new Error('Besitzer hat sich geändert.');
    if (existsSync(join(state, 'heartbeat')) && Number(readFileSync(join(state, 'heartbeat'), 'utf8')) * 1000 > Date.parse(approval.created_at)) {
      throw new Error('Lebenszeichen hat sich während der Prüfung geändert; Freigabe ist veraltet.');
    }
    command('gh', ['issue', 'edit', number, '-R', repository, '--remove-label', 'in-progress']);
    if (existsSync(join(state, 'active/owner'))) unlinkSync(join(state, 'active/owner'));
    if (existsSync(join(state, 'active'))) rmdirSync(join(state, 'active'));
    writeFileSync(join(state, 'paused'), '');
    console.log(`Freigegeben nach Maintainer-Entscheid ${commentId}; alle Arbeitsdateien bleiben erhalten.`);
  } finally { command('git', ['update-ref', '-d', ref, recoveryLock]); }
} catch (error) { console.error(error.message); process.exitCode = 1; }

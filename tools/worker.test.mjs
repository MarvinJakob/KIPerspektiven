import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates } from './worker.mjs';
import { repository } from './github.mjs';

test('REQ-45-AC3: freie Umsetzung wählen, laufende Bearbeitungen und PRs erhalten', () => {
  const states = ['Spezifiziert','Bug offen','Backlog','In Arbeit','Merge Gate','Spezifiziert'];
  const issues = states.map((_, i) => ({state:'open',number:i+1,labels:[],assignees:[]}));
  const board = states.map((status,i) => ({number:i+1,status,issueState:'OPEN',repository:{nameWithOwner:repository}}));
  issues[1].labels.push({name:'release-blocker'});
  issues[2].assignees.push({login:'bearbeiter'});
  const pulls = [{head:{ref:'codex/6-ticket'}}];
  assert.deepEqual(candidates(issues,pulls,board).map(i => i.number), [2,1]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { checkRelease, matchesEvidence } from './release-blockers.mjs';

const tree = '1'.repeat(40);
const repository = 'example/project';
const evidence = 'Release-Nachweis: https://github.com/example/project/actions/runs/41/artifacts/17';
const artifact = {name: 'release-' + tree + '-1', expired: false, workflow_run: {id: 41}};

test('REQ-45-AC1: Nachweis bindet Projekt, Lauf, unverfallenes Artefakt und Git-Tree', () => {
  assert.equal(matchesEvidence(artifact, tree, 41), true);
  assert.equal(matchesEvidence(artifact, '2'.repeat(40), 41), false);
  assert.equal(matchesEvidence({...artifact, expired:true}, tree, 41), false);
  assert.equal(matchesEvidence(artifact, tree, 42), false);
});

test('REQ-45-AC1: Freigabe über HTTP mit offenen, behobenen und erneut geöffneten Blockern', async t => {
  let issues = [], comments = [], events = [], fail = false, permission = 'write', passed = true;
  const calls = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url,'http://localhost');
    const path = url.pathname.replace('/repos/' + repository + '/', '');
    calls.push(path);
    const routes = {
      issues: url.searchParams.get('page') === '2' ? issues : Array.from({length:100}, () => ({pull_request:{}})),
      'issues/7/comments': comments, 'issues/7/events': events,
      'issues/8/comments': [], 'issues/8/events': [],
      'collaborators/alice/permission': {permission},
      'actions/artifacts/17': artifact,
      'actions/runs/41': {path:'.github/workflows/merge-gate.yml',event:'pull_request'},
      'actions/runs/41/attempts/1/jobs': { jobs:[{name:'Merge Gate',conclusion: passed ? 'success' : 'failure'}] },
    };
    if (path === 'issues') {
      assert.equal(url.searchParams.get('labels'),'release-blocker');
      assert.equal(url.searchParams.get('state'),'open');
    }
    res.writeHead(fail || !(path in routes) ? 503 : 200, {'content-type':'application/json'});
    res.end(JSON.stringify(routes[path] ?? {}));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const verify = () => checkRelease({repository, tree, token:'local-test', baseURL:'http://127.0.0.1:' + server.address().port});
  await verify();
  issues = [{number:7}];
  await assert.rejects(verify, /#7/);
  comments = [{user:{login:'alice'},body:evidence,created_at:'2026-01-10T00:00:00Z',updated_at:'2026-01-10T00:00:00Z'}];
  await verify();
  assert.ok(calls.includes('actions/artifacts/17'));
  permission = 'read'; await assert.rejects(verify, /#7/); permission = 'write';
  passed = false; await assert.rejects(verify, /#7/); passed = true;
  events = [{event:'reopened',created_at:'2026-01-11T00:00:00Z'}];
  await assert.rejects(verify, /#7/); events = [];
  issues.push({number:8}); await assert.rejects(verify, /#8/);
  fail = true; await assert.rejects(verify, /503/);
});

test('REQ-45-AC2: Unit- und Fidelity-Prüfungen sind vor Installation verpflichtend', () => {
  const workflow = readFileSync(new URL('../.github/workflows/merge-gate.yml',import.meta.url),'utf8');
  assert.match(workflow,/node --test/);
  const dockerfile = readFileSync(new URL('../app/Dockerfile',import.meta.url),'utf8');
  assert.match(dockerfile,/^RUN CGO_ENABLED=0 go test \.\/\.\.\.$/m);
  assert.match(workflow,/npx playwright test/);
  const check = workflow.indexOf('node tools/release-blockers.mjs');
  assert.ok(check > workflow.indexOf('id: previous') && check < workflow.indexOf('id: install'));
});

import { pathToFileURL } from 'node:url';

const workflow = '.github/workflows/merge-gate.yml';
const digest = /^[a-f0-9]{40}$/;

export function matchesEvidence(artifact, tree, runId) {
  return digest.test(tree) && artifact.expired === false && artifact.workflow_run?.id === runId
    && new RegExp('^release-' + tree + '-[1-9][0-9]*$').test(artifact.name);
}

export async function checkRelease({repository, tree, token, baseURL = 'https://api.github.com'}) {
  if (!token || !digest.test(tree) || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw Error('Ungültiger Freigabestand.');
  const root = baseURL + '/repos/' + repository + '/';
  async function get(path, query) {
    const url = new URL(root + path);
    url.search = new URLSearchParams(query).toString();
    const response = await fetch(url, {
      headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json'},
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error('GitHub-Abfrage ' + path + ': HTTP ' + response.status);
    return response.json();
  }

  async function list(path, query = {}, key) {
    const all = [];
    for (let page = 1; ; page++) {
      const data = await get(path, {...query, per_page: 100, page});
      const items = key ? data[key] : data;
      if (!Array.isArray(items)) throw Error('Unerwartete GitHub-Antwort für ' + path);
      all.push(...items);
      if (items.length < 100) return all;
    }
  }

  async function hasProof(issue) {
    const path = 'issues/' + issue.number;
    const events = await list(path + '/events');
    const resets = events.filter(e => e.event === 'reopened' ||
      (e.event === 'labeled' && e.label?.name === 'release-blocker'));
    const since = resets.map(e => e.created_at).sort().at(-1);
    const comments = await list(path + '/comments');
    const prefix = 'Release-Nachweis: https://github.com/' + repository + '/actions/runs/';
    for (const comment of comments.reverse()) {
      if (since && comment.created_at <= since) continue;
      // Edited evidence must be posted again so that its authorship is unambiguous.
      if (comment.created_at !== comment.updated_at) continue;
      const line = comment.body.split(/\r?\n/).find(s => s.startsWith(prefix));
      if (!line) continue;
      const ids = /^(\d+)\/artifacts\/(\d+)$/.exec(line.slice(prefix.length).trim());
      if (!ids) continue;
      const {permission} = await get('collaborators/' + encodeURIComponent(comment.user.login) + '/permission');
      if (!['admin','maintain','write'].includes(permission)) continue;
      const [, runId, artifactId] = ids;
      const artifact = await get('actions/artifacts/' + artifactId);
      if (!matchesEvidence(artifact, tree, Number(runId))) continue;
      const run = await get('actions/runs/' + runId);
      if (run.path !== workflow || !['pull_request','push','workflow_dispatch'].includes(run.event)) continue;
      const attempt = artifact.name.split('-').at(-1);
      const jobs = await list('actions/runs/' + runId + '/attempts/' + attempt + '/jobs', {}, 'jobs');
      if (jobs.some(job => job.name === 'Merge Gate' && job.conclusion === 'success')) return true;
    }
    return false;
  }

  const issues = await list('issues', {state:'open', labels:'release-blocker'});
  for (const issue of issues.filter(i => !i.pull_request)) {
    if (!await hasProof(issue)) throw Error('Release-Blocker #' + issue.number + ' ohne gültigen Nachweis für ' + tree);
    console.log('Nachweis für Release-Blocker #' + issue.number + ' bestätigt.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRelease({repository: process.env.GITHUB_REPOSITORY, tree: process.env.RELEASE_TREE, token: process.env.GH_TOKEN})
    .then(() => console.log('Release-Blockerprüfung erfolgreich.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

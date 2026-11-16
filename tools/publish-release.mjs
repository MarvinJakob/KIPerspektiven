import { api, repository } from './github.mjs';
try {
  const commit = process.env.RELEASE_COMMIT, tag = process.env.RELEASE_TAG, image = process.env.RELEASE_IMAGE;
  if (!/^[a-f0-9]{40}$/.test(commit ?? '') || !/^v[\d.]+-[a-f0-9]+-[a-f0-9]+$/.test(tag ?? '')
    || !/^sha256:[a-f0-9]{64}$/.test(image ?? '')) throw new Error('Release-Identität fehlt oder ist ungültig.');
  let existing;
  try { existing = api(`repos/${repository}/releases/tags/${tag}`); }
  catch (error) { if (!/HTTP 404/.test(error.message)) throw error; }
  if (existing) {
    if (existing.target_commitish !== commit || existing.draft || !existing.body.includes(image)) throw new Error('Vorhandenes Release gehört nicht zum geprüften Commit/Image.');
    console.log(`Bereits veröffentlicht: ${existing.html_url}`);
  } else {
    const release = api(`repos/${repository}/releases`, { method: 'POST', body: {
      tag_name: tag, target_commitish: commit, name: tag, generate_release_notes: true,
      body: `Produktions-Smoke-Test bestanden.\n\nCommit: ${commit}\nImage-ID: ${image}\nWorkflow: https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    } });
    console.log(release.html_url);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }

import { pathToFileURL } from 'node:url';

export function checkReview(body, head) {
  const field = (name) => {
    const values = [...body.matchAll(new RegExp(`^${name}:[ \\t]*(.*)$`, 'gm'))];
    if (values.length !== 1) throw new Error(`${name}: genau einmal im PR-Text angeben.`);
    return values[0][1].trim();
  };
  const validId = (id) => /^\/?[A-Za-z0-9][A-Za-z0-9._:/-]+$/.test(id) && !/^(TODO|TBD|pending)$/i.test(id);
  const implementers = field('Implementer-Agents').split(/[\s,]+/);
  const reviewer = field('Reviewer-Agent');
  if (!implementers.length || !implementers.every(validId) || !validId(reviewer)) {
    throw new Error('Eindeutige Implementierer- und Reviewer-Sitzungs-IDs fehlen.');
  }
  if (implementers.includes(reviewer)) throw new Error('Ein Implementierer darf sein Ticket nicht selbst reviewen.');
  const commit = field('Reviewed-Commit');
  if (!/^[a-f0-9]{40}$/.test(commit) || commit !== head) throw new Error('Unabhängiges Review des aktuellen Head-Commits fehlt.');
  if (!/^\s*- \[[xX]\] .*Review/m.test(body) || /^\s*- \[ \]/m.test(body)) {
    throw new Error('Merge-Gate-Checkliste einschließlich unabhängigem Review ist nicht vollständig.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkReview(process.env.PR_BODY ?? '', process.env.HEAD_SHA ?? '');
    console.log('Unabhängiger Reviewer und aktueller Commit dokumentiert; Checkliste vollständig.');
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

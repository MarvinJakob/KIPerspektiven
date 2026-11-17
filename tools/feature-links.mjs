// Explicit issue relationships; REQ IDs alone do not link independent implementations.
import { createHash } from 'node:crypto';
import { api, pages, repository } from './github.mjs';

export function featureParent(body = '') {
  body ??= '';
  const lines = body.split(/\r?\n/).filter((line) => /^Feature-Ticket:/.test(line));
  if (!lines.length) return undefined;
  if (lines.length !== 1 || !/^Feature-Ticket: #[1-9]\d*\s*$/.test(lines[0])) {
    throw new Error('Feature-Ticket: genau einmal mit einer gültigen Issue-Nummer angeben.');
  }
  return Number(lines[0].match(/#(\d+)/)[1]);
}

export function featureFixes(number, issues, { strict = true, diagnose = console.warn } = {}) {
  const children = new Map(), invalid = new Map();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    let parents;
    try {
      const parent = featureParent(issue.body);
      parents = parent === undefined ? [] : [parent];
    } catch (error) {
      const message = `Ungültige Feature-Verknüpfung an #${issue.number}: ${error.message}`;
      invalid.set(issue.number, message);
      diagnose(message);
      // Keep every recognizable parent blocked, but do not poison unrelated features.
      // An unassignable malformed field still blocks the malformed issue's own review.
      const lines = (issue.body ?? '').split(/\r?\n/).filter((line) => /^Feature-Ticket:/.test(line));
      parents = [...new Set(lines.flatMap((line) => [...line.matchAll(/#([1-9]\d*)/g)].map((m) => Number(m[1]))))];
    }
    for (const parent of parents) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(issue);
    }
  }
  const result = [], seen = new Set([number]);
  function visit(parent) {
    if (strict && invalid.has(parent)) throw new Error(invalid.get(parent));
    for (const child of children.get(parent) ?? []) {
      if (seen.has(child.number)) {
        if (strict) throw new Error(`Zyklische Feature-Verknüpfung bei #${child.number}.`);
        continue;
      }
      seen.add(child.number); result.push(child); visit(child.number);
    }
  }
  visit(number);
  return result.sort((a, b) => a.number - b.number);
}

export function pendingFixes(number, issues) {
  return featureFixes(number, issues).filter((issue) => issue.state !== 'closed' || issue.state_reason !== 'completed');
}

export function featureEvidence(number, issues, pulls) {
  const fixes = featureFixes(number, issues);
  const pending = fixes.filter((issue) => issue.state !== 'closed' || issue.state_reason !== 'completed');
  if (pending.length) throw new Error(`Offene Feature-Fixes: ${pending.map((i) => `#${i.number}`).join(', ')}.`);
  return fixes.map((issue) => {
    const references = [...(issue.body ?? '').matchAll(/^Fix-PR: #([1-9]\d*)\s*$/gm)].map((m) => Number(m[1]));
    const prs = pulls.filter((pr) => pr.merged_at && pr.base.ref === 'main'
      && (pr.head.ref === `fix/${issue.number}` || references.includes(pr.number)));
    if (!prs.length) throw new Error(`Gemergter Fix-Nachweis für #${issue.number} fehlt.`);
    return { issue: issue.number, updated: issue.updated_at, fixes: prs.map((pr) => ({ pr: pr.number, head: pr.head.sha,
      merge: pr.merge_commit_sha, implementers: /^Implementer-Agents: (.+)$/m.exec(pr.body ?? '')?.[1].trim() ?? '' }))
      .sort((a, b) => a.pr - b.pr) };
  });
}

export function evidenceDigest(evidence) {
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

export function liveFeatureEvidence(branch, head, reviewer, { get = api, list = pages } = {}) {
  const match = /^fix\/([1-9]\d*)$/.exec(branch);
  if (!match) return [];
  const issues = list(`repos/${repository}/issues?state=all&per_page=100`);
  const fixes = featureFixes(Number(match[1]), issues);
  if (!fixes.length) return [];
  const pulls = list(`repos/${repository}/pulls?state=closed&per_page=100`);
  const evidence = featureEvidence(Number(match[1]), issues, pulls);
  for (const entry of evidence) for (const fix of entry.fixes) {
    const actors = fix.implementers.split(/[\s,]+/);
    if (!actors.length || !actors.every((id) => /^\/?[A-Za-z0-9][A-Za-z0-9._:/-]+$/.test(id) && !/^(TODO|TBD|pending)$/i.test(id))
      || !/^[a-f0-9]{40}$/.test(fix.merge ?? '')) throw new Error(`Unvollständiger Fix-Nachweis an PR #${fix.pr}.`);
    if (reviewer && actors.includes(reviewer)) throw new Error(`Reviewer hat Feature-Fix #${entry.issue} selbst implementiert.`);
    const compare = get(`repos/${repository}/compare/${fix.merge}...${head}`);
    if (!['ahead', 'identical'].includes(compare.status)) throw new Error(`Fix aus PR #${fix.pr} fehlt im Feature-Head; Branch zuerst auf main aktualisieren.`);
  }
  return evidence;
}

export function checkFeatureEvidence(body, evidence) {
  if (!evidence.length) {
    if (/^Reviewed-Feature-Fixes:/m.test(body)) throw new Error('Feature-Fix-Zuordnung seit dem Review geändert.');
    return;
  }
  const fields = [...body.matchAll(/^Reviewed-Feature-Fixes: ([a-f0-9]{64})\s*$/gm)];
  if (fields.length !== 1 || fields[0][1] !== evidenceDigest(evidence)) {
    throw new Error('Aktuelles unabhängiges Review aller Feature-Fixes fehlt.');
  }
}

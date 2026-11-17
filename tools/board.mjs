import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const owner = 'MarvinJakob';
const repo = `${owner}/KIPerspektiven`;
const title = 'KI Perspektiven';

function gh(args, input) {
  const result = spawnSync('gh', args, { encoding: 'utf8', input, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh fehlgeschlagen (${result.status})`);
  return result.stdout.trim();
}

function graphql(query, variables) {
  const result = JSON.parse(gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables })));
  if (result.errors?.length) throw new Error(result.errors.map((e) => e.message).join('; '));
  return result.data;
}

export function addBlocked(options) {
  if (options.some((o) => o.name === 'Blocked')) return options;
  // IDs bewahren, damit GitHub bestehende Statuszuordnungen nicht löscht.
  return [...options.map(({ id, name, color, description }) => ({ id, name, color, description })),
    { name: 'Blocked', color: 'RED', description: 'Rückfrage offen; Antwort im Issue und zurück nach In Progress.' }];
}

export function resolveStatus(requested, options) {
  const aliases = {
    'In Arbeit': ['In Progress', 'In progress', 'In Arbeit'],
    'In Progress': ['In Progress', 'In progress', 'In Arbeit'],
    'Merge Gate': ['Review', 'In review', 'Merge Gate'],
    Review: ['Review', 'In review', 'Merge Gate'],
    Ready: ['Ready', 'Todo', 'Neu', 'Backlog'],
    Neu: ['Neu', 'Ready', 'Todo', 'Backlog'],
    Backlog: ['Backlog', 'Neu', 'Ready', 'Todo'],
  };
  const option = (aliases[requested] ?? [requested]).map((name) => options.find((o) => o.name === name)).find(Boolean);
  if (!option) throw new Error(`Status „${requested}“ fehlt. Vorhanden: ${options.map((o) => o.name).join(', ')}`);
  return option;
}

export function openItems(nodes) {
  return nodes.filter((i) => (i.content?.issueState ?? i.content?.prState) === 'OPEN').map((i) => ({
    status: i.fieldValueByName?.name ?? '', ...i.content,
  }));
}

function project() {
  const projects = [];
  let cursor = null;
  do {
    const data = graphql(`query($owner: String!, $cursor: String) { user(login: $owner) {
      projectsV2(first: 100, after: $cursor) { nodes { id number title } pageInfo { hasNextPage endCursor } }
    } }`, { owner, cursor });
    const page = data.user.projectsV2;
    projects.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  const matches = projects.filter((p) => p.title === title);
  if (matches.length !== 1) throw new Error(`Projekt „${title}“ nicht eindeutig gefunden (Scope project prüfen).`);
  const result = matches[0];
  const data = graphql(`query($id: ID!) { node(id: $id) { ... on ProjectV2 {
    fields(first: 100) { nodes { ... on ProjectV2SingleSelectField { id name options { id name color description } } } }
  } } }`, { id: result.id });
  const field = data.node.fields.nodes.find((f) => f.name === 'Status');
  if (!field) throw new Error('Status-Feld fehlt.');
  return { ...result, field };
}

function items(board) {
  const result = [];
  let cursor = null;
  do {
    const data = graphql(`query($id: ID!, $cursor: String) { node(id: $id) { ... on ProjectV2 {
      items(first: 100, after: $cursor) { pageInfo { hasNextPage endCursor } nodes {
        id fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
        content { ... on Issue { number title url issueState: state repository { nameWithOwner } }
          ... on PullRequest { number title url prState: state repository { nameWithOwner } } }
      } }
    } } }`, { id: board.id, cursor });
    const page = data.node.items;
    result.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return result;
}

function itemFor(board, issue) {
  return items(board).find((item) => item.content?.url === `https://github.com/${repo}/issues/${issue}`);
}

function setStatus(board, issue, requested) {
  const option = resolveStatus(requested, board.field.options);
  let item = itemFor(board, issue);
  if (!item) {
    const contentId = JSON.parse(gh(['api', `repos/${repo}/issues/${issue}`])).node_id;
    item = graphql(`mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
    }`, { project: board.id, content: contentId }).addProjectV2ItemById.item;
  }
  graphql(`mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field,
      value: { singleSelectOptionId: $option } }) { projectV2Item { id } }
  }`, { project: board.id, item: item.id, field: board.field.id, option: option.id });
  console.log(`#${issue} → ${option.name}`);
}

function main(args) {
  const [command, value, extra] = args;
  const board = project();
  if (command === 'ensure-blocked') {
    if (board.field.options.some((o) => o.name === 'Blocked')) return console.log('Blocked vorhanden.');
    graphql(`mutation($field: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
      updateProjectV2Field(input: { fieldId: $field, singleSelectOptions: $options }) {
        projectV2Field { ... on ProjectV2SingleSelectField { id } }
      }
    }`, { field: board.field.id, options: addBlocked(board.field.options) });
    const updated = project().field.options;
    if (!updated.some((o) => o.name === 'Blocked') || board.field.options.some((o) => !updated.some((n) => n.id === o.id))) {
      throw new Error('Statusänderung konnte nicht vollständig bestätigt werden.');
    }
    return console.log('Blocked angelegt; bestehende Status-IDs erhalten.');
  }
  if (command === 'list') {
    const nodes = items(board);
    return console.log(JSON.stringify(value === '--all' ? nodes : openItems(nodes), null, 2));
  }
  const issue = /^\d+$/.test(command ?? '') ? command : value;
  if (!/^\d+$/.test(issue ?? '')) throw new Error('Issue-Nummer fehlt; siehe tools/board.sh.');
  if (command === 'get') return console.log(JSON.stringify(itemFor(board, issue) ?? null, null, 2));
  if (command === 'block') {
    const question = readFileSync(extra, 'utf8').trim();
    if (!question) throw new Error('Die Fragen-Datei ist leer.');
    resolveStatus('Blocked', board.field.options);
    gh(['issue', 'comment', issue, '-R', repo, '--body-file', '-'], question);
    gh(['issue', 'edit', issue, '-R', repo, '--add-label', 'blocked']);
    return setStatus(board, issue, 'Blocked');
  }
  if (command === 'unblock') {
    const item = itemFor(board, issue);
    if (item?.fieldValueByName?.name !== resolveStatus('In Progress', board.field.options).name) {
      throw new Error('Der Maintainer muss das Ticket nach seiner Antwort zurück nach In Progress verschieben.');
    }
    gh(['issue', 'edit', issue, '-R', repo, '--remove-label', 'blocked']);
    return console.log(`#${issue}: Blocker nach gelesener Antwort aufgehoben.`);
  }
  if (!/^\d+$/.test(command)) throw new Error(`Unbekannter Befehl: ${command}`);
  setStatus(board, issue, value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`FEHLER: ${error.message}`); process.exitCode = 1; }
}

import { readFileSync } from 'node:fs';
import { api, repository, command } from './github.mjs';
import { featureParent } from './feature-links.mjs';

try {
  const [parent, file] = process.argv.slice(2);
  if (!/^[1-9]\d*$/.test(parent ?? '') || !file) throw new Error('Aufruf: node tools/feature-bug.mjs <Ursprungsticket> <Befund-Datei>; erste Zeile = Bug-Titel.');
  const source = api(`repos/${repository}/issues/${parent}`);
  if (source.state !== 'open' || source.pull_request) throw new Error('Offenes Ursprungsticket erforderlich.');
  const [title, ...details] = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  if (!title || title.length > 250 || details.join('\n').trim().length < 40) throw new Error('Titel und konkreter Befund mit Reproduktion, erwartetem/tatsächlichem Verhalten und Test-Commit fehlen.');
  const body = `Feature-Ticket: #${parent}\n\n${details.join('\n').trim()}\n`;
  featureParent(body); // Reject duplicate/malformed relationship fields in the report.
  const bug = api(`repos/${repository}/issues`, { method: 'POST', body: { title, body, labels: ['bug'] } });
  console.log(`Bug #${bug.number}: ${bug.html_url}`);
  command(process.execPath, ['tools/board.mjs', String(bug.number), 'Bug offen']);
  const status = JSON.parse(command(process.execPath, ['tools/board.mjs', 'get', String(bug.number)]));
  if (status?.content?.number !== bug.number || status?.fieldValueByName?.name !== 'Bug offen') throw new Error(`Boardstatus für Bug #${bug.number} nicht bestätigt; Ticket erhalten, nicht erneut anlegen.`);
  console.log(`Ursprungsticket #${parent} bleibt im Merge Gate. Vor erneutem Anlegen immer Duplikate suchen.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

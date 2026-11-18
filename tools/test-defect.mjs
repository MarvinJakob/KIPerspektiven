import { readFileSync } from 'node:fs';
import { api, pages, repository, issueLabels } from './github.mjs';
import { dependencies } from './reconcile.mjs';

const [parentNumber, file] = process.argv.slice(2);
try {
  if (!/^[1-9]\d*$/.test(parentNumber ?? '') || !file) throw new Error('Aufruf: node tools/test-defect.mjs <Bug-Issue> <Befund-Datei>');
  const parent = api(`repos/${repository}/issues/${parentNumber}`);
  if (!['bug', 'feature'].some((label) => issueLabels(parent).has(label))) throw new Error('Das wartende Ticket muss ein Bug- oder Feature-Issue sein.');
  const body = readFileSync(file, 'utf8').trim();
  if (!body) throw new Error('Konkreter Testbefund fehlt.');
  const marker = `Test-Defect-For: #${parentNumber}`;
  const existing = dependencies(parent.body).map((id) => api(`repos/${repository}/issues/${id}`)).find((i) => i.state === 'open')
    ?? pages(`repos/${repository}/issues?state=open&labels=test-defect&per_page=100`).find((i) => i.body?.split(/\r?\n/).includes(marker));
  const defect = existing ?? api(`repos/${repository}/issues`, { method: 'POST', body: {
    title: `Testkorrektur für #${parentNumber}: ${parent.title}`.slice(0, 250),
    body: `${marker}\n\nBlockiert die Umsetzung von #${parentNumber}. Der Bearbeiter des Ursprungstickets übernimmt die Korrektur und prüft beide Tickets.\n\n${body}`,
    labels: ['test-defect', 'bug'], assignees: parent.assignees.map(user => user.login),
  } });
  if (!dependencies(parent.body).includes(defect.number)) api(`repos/${repository}/issues/${parentNumber}`, { method: 'PATCH',
    body: { body: `${parent.body ?? ''}\n\nTest-Defect-Dependency: #${defect.number}\n` } });
  console.log(`Testdefekt #${defect.number}; #${parentNumber} und Testkorrektur zusammen bis zum Produktionsnachweis bearbeiten.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

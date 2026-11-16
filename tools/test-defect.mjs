import { readFileSync } from 'node:fs';
import { api, pages, repository, issueLabels } from './github.mjs';
import { dependencies } from './reconcile.mjs';

const [parentNumber, file] = process.argv.slice(2);
try {
  if (!/^[1-9]\d*$/.test(parentNumber ?? '') || !file) throw new Error('Aufruf: node tools/test-defect.mjs <Bug-Issue> <Befund-Datei>');
  const parent = api(`repos/${repository}/issues/${parentNumber}`);
  if (!issueLabels(parent).has('bug')) throw new Error('Das wartende Ticket muss ein Bug-Issue sein.');
  const body = readFileSync(file, 'utf8').trim();
  if (!body) throw new Error('Konkreter Testbefund fehlt.');
  const marker = `Test-Defect-For: #${parentNumber}`;
  const existing = dependencies(parent.body).map((id) => api(`repos/${repository}/issues/${id}`)).find((i) => i.state === 'open')
    ?? pages(`repos/${repository}/issues?state=open&labels=test-defect&per_page=100`).find((i) => i.body?.split(/\r?\n/).includes(marker));
  const defect = existing ?? api(`repos/${repository}/issues`, { method: 'POST', body: {
    title: `Testkorrektur für #${parentNumber}: ${parent.title}`.slice(0, 250),
    body: `${marker}\n\nBlockiert die Umsetzung von #${parentNumber}. Dieses Testdefekt-Ticket bleibt für Team 1 frei.\n\n${body}`,
    labels: ['test-defect'],
  } });
  if (!dependencies(parent.body).includes(defect.number)) api(`repos/${repository}/issues/${parentNumber}`, { method: 'PATCH',
    body: { body: `${parent.body ?? ''}\n\nTest-Defect-Dependency: #${defect.number}\n` } });
  api(`repos/${repository}/issues/${parentNumber}/labels`, { method: 'POST', body: { labels: ['waiting-for-test'] } });
  console.log(`Testdefekt #${defect.number}; #${parentNumber} wartet. Eigenen Zwischenstand committen, pushen und task.sh pause ausführen.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

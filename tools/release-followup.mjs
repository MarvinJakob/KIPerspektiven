import { api, pages, repository } from './github.mjs';
try {
  const id = process.env.RELEASE_RUN;
  if (!/^\d+$/.test(id ?? '')) throw new Error('RELEASE_RUN fehlt.');
  const run = api(`repos/${repository}/actions/runs/${id}`);
  if (run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed') process.exit(0);
  const issues = pages(`repos/${repository}/issues?state=open&labels=release-failure&per_page=100`).filter((i) => !i.pull_request);
  if (run.conclusion === 'failure') {
    const body = `Automatische Nacharbeit eines fehlgeschlagenen Release Gate.\n\nRelease-Commit: ${run.head_sha}\nRelease-Lauf: ${run.html_url}\n\nAutorisierter Umfang: Ursache anhand der Logs bestimmen, Zugangs-/Konfigurationsfehler konkret blockieren, Prozesskorrekturen ausschließlich per PR und Merge Gate. Wiederholung erst nach behobener Ursache. Keine Gates umgehen, keine Schlüssel ausgeben.\n`;
    if (!issues.length) api(`repos/${repository}/issues`, { method: 'POST', body: {
      title: 'Release-Nacharbeit: Produktionsauslieferung fehlgeschlagen', body,
      labels: ['maintenance', 'maintenance-approved', 'release-failure'],
    } });
    else if (!issues[0].body.includes(run.html_url)) api(`repos/${repository}/issues/${issues[0].number}/comments`, { method: 'POST', body: { body: `Weiterer fehlgeschlagener Lauf: ${run.html_url} (${run.head_sha}).` } });
  }
  // Success is evidence, but not permission to close an actively edited infrastructure issue.
  if (run.conclusion === 'success') for (const issue of issues) {
    api(`repos/${repository}/issues/${issue.number}/comments`, { method: 'POST', body: { body: `Produktionsnachweis: ${run.html_url} erfolgreich. Vor Abschluss verbleibenden Issue-Umfang und aktive Belegung prüfen.` } });
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }

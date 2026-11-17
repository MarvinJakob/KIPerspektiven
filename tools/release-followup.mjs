import { api, pages, repository } from './github.mjs';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
export function followupRelease(id, apiCall = api, list = pages, metadata) {
  if (!/^\d+$/.test(id ?? '')) throw new Error('RELEASE_RUN fehlt.');
  const run = apiCall(`repos/${repository}/actions/runs/${id}`);
  if (run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed') return;
  if (metadata && (metadata.run !== id || !/^[a-f0-9]{40}$/.test(metadata.commit))) throw new Error('Release-Metadaten gehören nicht zum Lauf.');
  const commit = metadata?.commit ?? (run.event === 'push' ? run.head_sha : null);
  const identity = commit ? `Release-Commit: ${commit}` : `Getesteter Commit: nicht ermittelt; Prepare-Logs prüfen.\nWorkflow-Commit: ${run.head_sha}`;
  const issues = list(`repos/${repository}/issues?state=open&labels=release-failure&per_page=100`).filter((i) => !i.pull_request);
  if (run.conclusion === 'failure') {
    const body = `Automatische Nacharbeit eines fehlgeschlagenen Release Gate.\n\n${identity}\nRelease-Lauf: ${run.html_url}\n\nAutorisierter Umfang: Ursache anhand der Logs bestimmen, Zugangs-/Konfigurationsfehler konkret blockieren, Prozesskorrekturen ausschließlich per PR und Merge Gate. Wiederholung erst nach behobener Ursache. Keine Gates umgehen, keine Schlüssel ausgeben.\n`;
    if (!issues.length) apiCall(`repos/${repository}/issues`, { method: 'POST', body: {
      title: 'Release-Nacharbeit: Produktionsauslieferung fehlgeschlagen', body,
      labels: ['maintenance', 'maintenance-approved', 'release-failure'],
    } });
    else if (!issues[0].body?.includes(run.html_url)) apiCall(`repos/${repository}/issues/${issues[0].number}/comments`, { method: 'POST', body: { body: `Weiterer fehlgeschlagener Lauf: ${run.html_url}\n${identity}` } });
  }
  // Success is evidence, but not permission to close an actively edited infrastructure issue.
  const published = run.conclusion === 'success' && !!commit && metadata?.tests_only !== true
    && apiCall(`repos/${repository}/actions/runs/${id}/jobs?per_page=100`).jobs.some((job) =>
      job.name === '5 Release-Stand und Veröffentlichung' && job.conclusion === 'success');
  // Even a green gate may contain new failures outside the baseline. Team 4 must inspect that backlog.
  if (run.conclusion === 'success') {
    const marker = `Release-Review-Run: ${id}/${run.run_attempt}`;
    const reviews = list(`repos/${repository}/issues?state=all&labels=release-review&per_page=100`);
    if (!reviews.some((issue) => issue.body?.split(/\r?\n/).includes(marker))) {
      apiCall(`repos/${repository}/issues`, { method: 'POST', body: {
        title: `Release-Tests prüfen: ${commit?.slice(0, 12) ?? 'Commit ungeklärt'} (Lauf ${id})`,
        body: `${marker}\n\n${identity}\nRelease-Lauf: ${run.html_url}\n\n${published ? 'Deployment und Veröffentlichung bestanden.' : 'Nur Test-/übersprungener Kandidatenlauf; kein Produktionsnachweis.'}\n\nTeam 4: Artefakt fidelity-release auswerten, neue Fehler nach Ursache deduplizieren und als Feature-/Bug-/Testdefekt-Tickets an Team 3 übergeben. Baseline-Regressionen erhalten release-blocker. Auswertung am Issue dokumentieren und dieses Ticket schließen. Autorisierter Umfang: ausschließlich Review, Diagnose und Tickets; keine Implementierung und keine Änderung von Gates oder Berechtigungen.`,
        labels: ['maintenance', 'maintenance-approved', 'release-review'],
      } });
    }
  }
  if (published) for (const issue of issues) {
    apiCall(`repos/${repository}/issues/${issue.number}/comments`, { method: 'POST', body: { body: `Produktionsnachweis: ${run.html_url} erfolgreich. Vor Abschluss verbleibenden Issue-Umfang und aktive Belegung prüfen.` } });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const file = process.env.RELEASE_METADATA;
    followupRelease(process.env.RELEASE_RUN, api, pages, file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined);
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

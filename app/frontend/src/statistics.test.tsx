import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { failReadiness, holdReadiness, installFakeApi, readinessCalls, renderApp } from './test/fakeApi';

// Ticket #130: Ergebnisse der Selbsteinschätzung nur mit Einwilligung anonym speichern. Seitenaufrufe zählt
// der Server beim Ausliefern; das Frontend meldet dafür nichts.

let fetchMock: ReturnType<typeof installFakeApi>;
beforeEach(() => {
  fetchMock = installFakeApi();
});

const SHARE = 'Ergebnis anonym für die Statistik speichern';
const SAVED = /Ihr Ergebnis ist anonym gespeichert/;
const shareBox = () => screen.getByRole('checkbox', { name: SHARE });

type User = ReturnType<typeof userEvent.setup>;

/** Bewertet beide Dimensionen des Testkatalogs und öffnet die Auswertung, auf Wunsch mit Einwilligung. */
async function rateAll(user: User, { share = false, levels = ['Stufe 2 Strukturiert', 'Stufe 3 Intelligent'] } = {}) {
  const view = renderApp('/de/themen/ai-audit/strategie-und-wirtschaftlichkeit');
  await user.click(await screen.findByRole('radio', { name: levels[0] }));
  await user.click(screen.getByRole('button', { name: 'Weiter' }));
  await user.click(await screen.findByRole('radio', { name: levels[1] }));
  if (share) await user.click(shareBox());
  await user.click(screen.getByRole('button', { name: 'Auswertung anzeigen' }));
  await screen.findByRole('heading', { level: 1, name: 'Auswertung der Selbsteinschätzung' });
  return view.router;
}

const posts = () => readinessCalls.filter((c) => c.method === 'POST');

describe('Ticket #130: Ergebnis der Selbsteinschätzung anonym speichern', () => {
  it('zeigt vor „Auswertung anzeigen“ ein nicht vorausgewähltes Kästchen mit Hinweis und Link zur Datenschutzerklärung', async () => {
    renderApp('/de/themen/ai-audit/betrieb');
    const box = await screen.findByRole('checkbox', { name: SHARE });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(/beim Anzeigen der Auswertung anonym/);
    expect(box).toHaveAccessibleDescription(/ohne Namen, IP-Adresse oder sonstige Kennung/);
    expect(screen.getByRole('link', { name: 'Mehr dazu in der Datenschutzerklärung' })).toHaveAttribute('href', '/de/datenschutz');
    const button = screen.getByRole('button', { name: 'Auswertung anzeigen' });
    expect(box.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fragt nur im letzten Schritt, nicht schon vorher', async () => {
    renderApp('/de/themen/ai-audit/strategie-und-wirtschaftlichkeit');
    await screen.findByRole('button', { name: 'Weiter' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('erklärt die Speicherung auch auf Englisch', async () => {
    renderApp('/en/themen/ai-audit/betrieb');
    const box = await screen.findByRole('checkbox', { name: 'Store my result anonymously for statistics' });
    expect(box).toHaveAccessibleDescription(/stored? your result anonymously when your results are shown/);
    expect(screen.getByRole('link', { name: 'More in the privacy policy' })).toHaveAttribute('href', '/en/datenschutz');
  });

  it('überträgt ohne Haken nichts', async () => {
    await rateAll(userEvent.setup());
    expect(screen.getByRole('table')).toHaveTextContent('3 – Intelligent');
    expect(shareBox()).not.toBeChecked();
    expect(readinessCalls).toEqual([]);
  });

  it('speichert mit Haken beim Öffnen der Auswertung und aktualisiert nach Änderungen dasselbe Ergebnis', async () => {
    const user = userEvent.setup();
    const router = await rateAll(user, { share: true });
    expect(await screen.findByText(SAVED)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    const first = posts()[0].body!;
    expect(first.key).toMatch(/^[0-9a-f]{32}$/);
    expect(first).toEqual({
      key: first.key,
      lang: 'de',
      ratings: [
        { dimension: 'strategie-und-wirtschaftlichkeit', level: 2 },
        { dimension: 'betrieb', level: 3 },
      ],
    });
    expect(shareBox()).toBeChecked();

    // Erneut öffnen ohne Änderung: kein weiterer Aufruf.
    await router.navigate('/de/themen/ai-audit');
    await router.navigate('/de/themen/ai-audit/auswertung');
    await screen.findByRole('table');
    expect(posts()).toHaveLength(1);

    // Nach einer Änderung wird dasselbe Ergebnis (dieselbe Kennung) aktualisiert.
    await user.click(screen.getByRole('link', { name: 'Ändern: Betrieb' }));
    await user.click(await screen.findByRole('radio', { name: 'Stufe 1 Einfach' }));
    expect(posts()).toHaveLength(1); // erst beim Anzeigen der Auswertung
    await user.click(screen.getByRole('button', { name: 'Auswertung anzeigen' }));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1].body).toEqual({ ...first, ratings: [first.ratings[0], { dimension: 'betrieb', level: 1 }] });
  });

  it('speichert sofort, wenn der Haken erst auf der Auswertung gesetzt wird', async () => {
    const user = userEvent.setup();
    await rateAll(user);
    expect(readinessCalls).toEqual([]);
    await user.click(shareBox());
    expect(await screen.findByText(SAVED)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it('löscht das gespeicherte Ergebnis, wenn der Haken entfernt wird', async () => {
    const user = userEvent.setup();
    await rateAll(user, { share: true });
    await screen.findByText(SAVED);
    const { key } = posts()[0].body!;
    await user.click(shareBox());
    expect(await screen.findByText('Ihr gespeichertes Ergebnis wurde gelöscht.')).toBeInTheDocument();
    expect(readinessCalls.at(-1)).toEqual({ method: 'DELETE', path: `/api/readiness-results/${key}`, body: undefined });
    expect(shareBox()).not.toBeChecked();
  });

  // Bug #135: Ein gescheiterter Aufruf darf nicht vergessen lassen, dass ein anderer das Ergebnis gespeichert hat.
  const lastIsDelete = (key: string) =>
    waitFor(() => expect(readinessCalls.at(-1)).toEqual({ method: 'DELETE', path: `/api/readiness-results/${key}`, body: undefined }));

  it('löscht beim Abwählen auch, wenn ein älteres Speichern nach einem neueren scheitert', async () => {
    const user = userEvent.setup();
    const answerFirst = holdReadiness();
    await rateAll(user, { share: true });
    await user.click(screen.getByRole('link', { name: 'Ändern: Betrieb' }));
    await user.click(await screen.findByRole('radio', { name: 'Stufe 1 Einfach' }));
    await user.click(screen.getByRole('button', { name: 'Auswertung anzeigen' }));
    answerFirst(500);
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(await screen.findByText(SAVED)).toBeInTheDocument();
    await user.click(shareBox());
    await lastIsDelete(posts()[0].body!.key);
  });

  it('löscht beim Abwählen auch, wenn Löschen und erneutes Speichern scheitern', async () => {
    const user = userEvent.setup();
    await rateAll(user, { share: true });
    await screen.findByText(SAVED);
    const { key } = posts()[0].body!;
    const answerDelete = holdReadiness();
    const answerSave = holdReadiness();
    await user.click(shareBox());
    await user.click(shareBox());
    answerDelete(500);
    await waitFor(() => expect(posts()).toHaveLength(2));
    answerSave(500);
    expect(await screen.findByText(/Ihr Ergebnis konnte nicht gespeichert werden/)).toBeInTheDocument();
    await user.click(shareBox());
    await lastIsDelete(key);
  });

  it('zeigt die Auswertung vollständig, wenn das Speichern scheitert', async () => {
    failReadiness();
    await rateAll(userEvent.setup(), { share: true });
    expect(await screen.findByText(/Ihr Ergebnis konnte nicht gespeichert werden/)).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('cell').textContent)).toEqual([expect.stringContaining('2 – Strukturiert'), expect.stringContaining('3 – Intelligent')]);
    expect(screen.getByRole('img', { name: 'Netzdiagramm Ihrer selbst eingeschätzten Reifegrade' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nicht überall auf der höchsten Stufe' })).toBeInTheDocument();
  });

  it('legt weder Cookies noch Web-Storage-Einträge an', async () => {
    const user = userEvent.setup();
    await rateAll(user, { share: true });
    await screen.findByText(SAVED);
    await user.click(shareBox());
    await screen.findByText('Ihr gespeichertes Ergebnis wurde gelöscht.');
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('Ticket #130: Seitenaufrufe zählt nur der Server', () => {
  it('sendet bei Seitenwechseln innerhalb der Anwendung nichts an den Server', async () => {
    const user = userEvent.setup();
    renderApp('/de');
    await screen.findByRole('heading', { level: 1 });
    await user.click(within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', { name: 'Blog' }));
    await screen.findByRole('heading', { level: 1, name: 'Blog' });
    await user.click(within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', { name: 'KI Readiness' }));
    await screen.findByRole('heading', { level: 1, name: 'KI Readiness' });
    const requests = fetchMock.mock.calls.map(([input]) => input as Request);
    expect(requests.length).toBeGreaterThan(0);
    // Nur Inhalte werden geladen; es gibt keine Meldung von Seitenaufrufen.
    expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
    expect(requests.map((r) => new URL(r.url).pathname).filter((p) => !/^\/api\/(topics|posts|audit)(\/|$)/.test(p))).toEqual([]);
  });
});

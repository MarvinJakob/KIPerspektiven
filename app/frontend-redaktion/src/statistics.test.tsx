import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Period, ReadinessResult } from './api/statistics';
import { ADMIN, EDITOR, fakeBackend, json, renderAt, type FakeState, type Handler } from './test/fakeApi';

afterEach(() => vi.unstubAllGlobals());

const DIMENSIONS = [
  { slug: 'strategie-und-wirtschaftlichkeit', title: 'Strategie und Wirtschaftlichkeit' },
  { slug: 'betrieb', title: 'Betrieb' },
];
const LEVELS = [
  { level: 1, name: 'Einfach', motto: 'Leitsatz 1' },
  { level: 2, name: 'Strukturiert', motto: 'Leitsatz 2' },
  { level: 3, name: 'Intelligent', motto: 'Leitsatz 3' },
];
const PAGE_SIZE = 50;
const LENGTH: Record<Period, number> = { '7d': 7, '30d': 30, all: 3 };

/** Tage rückwärts ab dem 14.11.2026 */
const day = (i: number) => new Date(Date.UTC(2026, 10, 14 - i)).toISOString().slice(0, 10);

/** n Ergebnisse, neueste zuerst; das neueste am 14.11.2026 um 09:32 UTC (10:32 Uhr deutscher Zeit). */
function makeResults(n: number): ReadinessResult[] {
  return Array.from({ length: n }, (_, i) => ({
    id: n - i,
    lang: i % 2 === 0 ? 'de' : 'en',
    submittedAt: new Date(Date.UTC(2026, 10, 14, 9, 32) - i * 3_600_000).toISOString(),
    ratings: [
      { dimension: DIMENSIONS[0].slug, level: 2 },
      { dimension: DIMENSIONS[1].slug, level: (i % 3) + 1 },
    ],
  }));
}

/**
 * Statistik-Backend im Speicher: views je Tag (gleich für alle Tage) und eine Zahl gespeicherter Ergebnisse.
 * seen protokolliert die Abfragen, z. B. „page-views 7d“ oder „readiness-results all 2“.
 */
function statsBackend({ viewsPerDay = 3, results = 3 } = {}) {
  const all = makeResults(results);
  const seen: string[] = [];
  const handler: Handler = (r, url, state: FakeState) => {
    if (!r.path.startsWith('/api/admin/statistics/')) return undefined;
    if (state.me?.role !== 'editor' && state.me?.role !== 'admin') return json(403, { message: 'Keine Berechtigung.' });
    const period = (url.searchParams.get('period') ?? '30d') as Period;
    seen.push([r.path.split('/').at(-1), period, url.searchParams.get('page')].filter(Boolean).join(' '));
    if (r.path === '/api/admin/statistics/page-views') {
      const days = viewsPerDay === 0 && period === 'all' ? [] : Array.from({ length: LENGTH[period] }, (_, i) => ({ date: day(i), views: viewsPerDay }));
      return json(200, { period, total: days.reduce((s, d) => s + d.views, 0), days });
    }
    if (r.path === '/api/admin/statistics/readiness-results') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return json(200, { period, total: all.length, page, pageSize: PAGE_SIZE, dimensions: DIMENSIONS, levels: LEVELS, items });
    }
    return json(404, { message: 'Unbekannter Endpunkt.' });
  };
  return { handler, seen };
}

/** Wert einer Kennzahl, z. B. „1.230 in den letzten 30 Tagen“ */
const statValue = (label: string) => within(screen.getByText(label, { selector: 'dt' }).closest('dl')!).getByRole('definition');

async function openStatistics() {
  renderAt('/statistik');
  return screen.findByRole('heading', { level: 1, name: 'Statistik' });
}

describe('Ticket #130: Statistik der Redaktion', () => {
  it.each([
    ['Redaktion', EDITOR],
    ['Admin', ADMIN],
  ])('ist für %s über die Navigation unter /redaktion/statistik erreichbar', async (_, me) => {
    const user = userEvent.setup();
    fakeBackend(me, statsBackend().handler);
    const { router } = renderAt('/beitraege/neu');
    const nav = await screen.findByRole('navigation', { name: 'Redaktion' });
    const link = within(nav).getByRole('link', { name: 'Statistik' });
    expect(link).toHaveAttribute('href', '/redaktion/statistik');
    await user.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Statistik' })).toHaveFocus();
    expect(router.state.location.pathname).toBe('/redaktion/statistik');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('führt ohne Anmeldung zur Anmeldung und lädt keine Statistik', async () => {
    const state = fakeBackend(null, statsBackend().handler);
    renderAt('/statistik');
    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(state.requests.some((r) => r.path.startsWith('/api/admin/statistics'))).toBe(false);
  });

  it('zeigt mit der Vorauswahl „Letzte 30 Tage“ die Summe und eine Tabelle der Seitenaufrufe je Tag', async () => {
    const { handler, seen } = statsBackend({ viewsPerDay: 41 });
    fakeBackend(EDITOR, handler);
    await openStatistics();
    expect(screen.getByRole('radio', { name: 'Letzte 30 Tage' })).toBeChecked();
    expect(await screen.findByText('1.230')).toBeInTheDocument();
    expect(statValue('Seitenaufrufe')).toHaveTextContent('1.230 in den letzten 30 Tagen');
    expect(screen.getByText(/zählt keine eindeutigen Besucher/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Seitenaufrufe je Tag, neueste zuerst' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(30);
    expect(rows[0]).toHaveTextContent('Sa., 14.11.2026');
    expect(rows[0]).toHaveTextContent('41');
    expect(rows[29]).toHaveTextContent('16.10.2026');
    expect(seen).toContain('page-views 30d');
    expect(seen).toContain('readiness-results 30d 1');
  });

  it('wechselt den Zeitraum per Tastatur und Klick', async () => {
    const user = userEvent.setup();
    const { handler, seen } = statsBackend({ viewsPerDay: 2 });
    fakeBackend(EDITOR, handler);
    await openStatistics();
    await screen.findByText('60');
    screen.getByRole('radio', { name: 'Letzte 30 Tage' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Letzte 7 Tage' })).toBeChecked();
    expect(await screen.findByText('14')).toBeInTheDocument();
    expect(statValue('Seitenaufrufe')).toHaveTextContent('in den letzten 7 Tagen');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(8);

    await user.click(screen.getByRole('radio', { name: 'Gesamt' }));
    await waitFor(() => expect(statValue('Seitenaufrufe')).toHaveTextContent('6 insgesamt'));
    expect(seen).toEqual(expect.arrayContaining(['page-views 7d', 'page-views all', 'readiness-results 7d 1', 'readiness-results all 1']));
    expect(statValue('Abgeschlossene Selbsteinschätzungen')).toHaveTextContent('insgesamt');
  });

  it('listet Ergebnisse neueste zuerst mit Datum, Uhrzeit, Sprache und Reifegrad als Text', async () => {
    fakeBackend(EDITOR, statsBackend({ results: 3 }).handler);
    await openStatistics();
    const list = await screen.findByRole('list');
    expect(statValue('Abgeschlossene Selbsteinschätzungen')).toHaveTextContent('3 in den letzten 30 Tagen');
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(3);
    const first = entries[0];
    expect(first).toHaveTextContent('14.11.2026, 10:32 Uhr');
    expect(first).toHaveTextContent('Deutsch');
    expect(entries[1]).toHaveTextContent('14.11.2026, 09:32 Uhr');
    expect(entries[1]).toHaveTextContent('Englisch');
    const levels = within(first).getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
    expect(levels).toEqual([
      ['Strategie und Wirtschaftlichkeit', 'Strukturiert'],
      ['Betrieb', 'Einfach'],
    ]);
    expect(screen.queryByRole('navigation', { name: 'Seiten der Ergebnisliste' })).not.toBeInTheDocument();
  });

  it('blättert ab dem 51. Eintrag und setzt den Fokus auf die neue Seite', async () => {
    const user = userEvent.setup();
    const { handler, seen } = statsBackend({ results: PAGE_SIZE + 1 });
    fakeBackend(EDITOR, handler);
    await openStatistics();
    const pager = await screen.findByRole('navigation', { name: 'Seiten der Ergebnisliste' });
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(PAGE_SIZE);
    expect(screen.getByText('Einträge 1–50 von 51')).toBeInTheDocument();
    expect(within(pager).getByText('Seite 1 von 2')).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Vorherige Seite' })).toBeDisabled();

    await user.click(within(pager).getByRole('button', { name: 'Nächste Seite' }));
    expect(await screen.findByText('Einträge 51–51 von 51')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 3, name: 'Ergebnisse, neueste zuerst' })).toHaveFocus();
    expect(within(pager).getByRole('button', { name: 'Nächste Seite' })).toBeDisabled();
    expect(seen).toContain('readiness-results 30d 2');
  });

  it('zeigt ohne Daten verständliche Hinweise statt leerer Tabellen', async () => {
    fakeBackend(EDITOR, statsBackend({ viewsPerDay: 0, results: 0 }).handler);
    await openStatistics();
    expect(await screen.findByText('Im gewählten Zeitraum wurden noch keine Seitenaufrufe gezählt.')).toBeInTheDocument();
    expect(await screen.findByText('Im gewählten Zeitraum wurden noch keine Ergebnisse gespeichert.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

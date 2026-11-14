import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Period, ReadinessResult } from './api/statistics';
import { ADMIN, EDITOR, fakeBackend, json, renderAt, type FakeState, type Handler } from './test/fakeApi';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
});

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
    expect(statValue('Absolute Anzahl')).toHaveTextContent('1.230 in den letzten 30 Tagen');
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
    expect(statValue('Absolute Anzahl')).toHaveTextContent('in den letzten 7 Tagen');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(8);

    await user.click(screen.getByRole('radio', { name: 'Gesamt' }));
    await waitFor(() => expect(statValue('Absolute Anzahl')).toHaveTextContent('6 insgesamt'));
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
    const user = userEvent.setup();
    fakeBackend(EDITOR, statsBackend({ viewsPerDay: 0, results: 0 }).handler);
    await openStatistics();
    expect(await screen.findByText('Im gewählten Zeitraum wurden noch keine Seitenaufrufe gezählt.')).toBeInTheDocument();
    expect(await screen.findByText('Im gewählten Zeitraum wurden noch keine Ergebnisse gespeichert.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Verlauf der Seitenaufrufe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Gesamt' }));
    await waitFor(() => expect(statValue('Absolute Anzahl')).toHaveTextContent('0 insgesamt'));
    expect(screen.queryByRole('img', { name: /Verlauf der Seitenaufrufe/ })).not.toBeInTheDocument();
  });
});

describe('Ticket #139: Verlauf der Seitenaufrufe', () => {
  const chart = () => screen.getByRole('img', { name: /Verlauf der Seitenaufrufe/ });

  it('ordnet Tageswerte chronologisch zu und übernimmt beim Zeitraumwechsel dieselben Werte wie die Tabelle', async () => {
    const user = userEvent.setup();
    fakeBackend(EDITOR, (r, url) => {
      if (r.path !== '/api/admin/statistics/page-views') return undefined;
      const period = (url.searchParams.get('period') ?? '30d') as Period;
      const days = Array.from({ length: LENGTH[period] }, (_, i) => ({ date: day(i), views: i === 1 ? 0 : i + 1 }));
      return json(200, { period, total: days.reduce((sum, d) => sum + d.views, 0), uniqueTotal: days.some(d => d.views > 0) ? 1 : 0, uniqueSince: "2026-10-01T00:00:00Z", days: days.map(d => ({ ...d, uniqueViews: Math.min(d.views, 1) })) });
    }, statsBackend({ results: 0 }).handler);
    await openStatistics();
    await screen.findByRole('img', { name: /Verlauf der Seitenaufrufe/ });
    for (const [label, length] of [['Letzte 30 Tage', 30], ['Letzte 7 Tage', 7], ['Gesamt', 3]] as const) {
      await user.click(screen.getByRole('radio', { name: label }));
      await waitFor(() => expect(chart().querySelectorAll('.chart-point')).toHaveLength(length));
      const dots = [...chart().querySelectorAll('.chart-point')];
      const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).reverse();
      expect(rows).toHaveLength(length);
      dots.forEach((dot, i) => {
        const date = day(length - 1 - i);
        const views = length - 1 - i === 1 ? 0 : length - i;
        const formatted = date.split('-').reverse().join('.');
        expect(dot).toHaveTextContent(`${formatted}: ${views} Seitenaufrufe`);
        expect(rows[i]).toHaveTextContent(formatted);
        expect(within(rows[i]).getAllByRole('cell')[1]).toHaveTextContent(String(views));
        if (i > 0) expect(Number(dot.getAttribute('cx'))).toBeGreaterThan(Number(dots[i - 1].getAttribute('cx')));
      });
      expect(Number(dots[length - 2].getAttribute('cy'))).toBeGreaterThan(Number(dots[length - 1].getAttribute('cy')));
      expect(Number(dots[0].getAttribute('cy'))).toBeLessThan(Number(dots[length - 1].getAttribute('cy')));
      expect(statValue('Absolute Anzahl')).toHaveTextContent(String(length * (length + 1) / 2 - 2));
    }
  });

  it('zeigt beim Laden und nach einem Fehler keine alten Daten und erlaubt einen neuen Versuch', async () => {
    const user = userEvent.setup();
    let resolveRequest: (response: Response) => void = () => {};
    fakeBackend(EDITOR, statsBackend({ results: 0 }).handler);
    const fallback = globalThis.fetch;
    vi.stubGlobal('fetch', (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === '/api/admin/statistics/page-views' && url.searchParams.get('period') === '7d') {
        return new Promise<Response>((resolve) => { resolveRequest = resolve; });
      }
      return fallback(req);
    });
    await openStatistics();
    await screen.findByRole('img', { name: /Verlauf der Seitenaufrufe/ });
    await user.click(screen.getByRole('radio', { name: 'Letzte 7 Tage' }));
    expect(screen.queryByRole('img', { name: /Verlauf der Seitenaufrufe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Absolute Anzahl', { selector: 'dt' })).not.toBeInTheDocument();
    resolveRequest(json(400, { message: 'Testfehler' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Seitenaufrufe konnten nicht geladen werden');
    expect(screen.queryByRole('img', { name: /Verlauf der Seitenaufrufe/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    resolveRequest(json(200, { period: '7d', total: 1, uniqueTotal: 1, uniqueSince: '2026-10-01T00:00:00Z', days: [{ date: day(0), views: 1, uniqueViews: 1 }] }));
    await screen.findByRole('img', { name: /Verlauf der Seitenaufrufe/ });
    expect(chart().querySelectorAll('.chart-point')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});


describe('Ticket #142: IP-bereinigte Seitenaufrufe', () => {
  it('zeigt 5 absolute Abrufe und 2 IPs, schaltet nur die zweite Kurve per Tastatur und behaelt die Wahl beim Zeitraumwechsel', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    fakeBackend(EDITOR, (r, url) => {
      if (r.path !== '/api/admin/statistics/page-views') return undefined;
      const period = url.searchParams.get('period'); seen.push(period!);
      return json(200, { period, total: 5, uniqueTotal: 2, uniqueSince: '2026-11-13T00:00:00Z', days: [
        { date: day(0), views: 2, uniqueViews: 2 }, { date: day(1), views: 3, uniqueViews: 1 },
      ] });
    }, statsBackend({ results: 0 }).handler);
    await openStatistics();
    await waitFor(() => expect(statValue('Bereinigte Anzahl')).toHaveTextContent('2 in den letzten 30 Tagen'));
    expect(statValue('Absolute Anzahl')).toHaveTextContent('5 in den letzten 30 Tagen');
    const toggle = screen.getByRole('checkbox', { name: 'Bereinigte Anzahl anzeigen' });
    const chart = () => screen.getByRole('img', { name: /Verlauf der Seitenaufrufe/ });
    expect(toggle).toBeChecked();
    expect(chart().querySelector('.chart-unique-line')).not.toBeNull();
    expect([...chart().querySelectorAll('.chart-unique-point')].map(p => p.textContent)).toEqual(['13.11.2026: 1 bereinigt', '14.11.2026: 2 bereinigt']);
    const absoluteToday = chart().querySelectorAll('.chart-point')[1];
    const uniqueToday = chart().querySelectorAll('.chart-unique-point')[1];
    expect(uniqueToday.getAttribute('cx')).toBe(absoluteToday.getAttribute('cx'));
    expect(uniqueToday.getAttribute('cy')).toBe(absoluteToday.getAttribute('cy'));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell').map(c => c.textContent)).toEqual(['Sa., 14.11.2026', '2', '2']);
    expect(within(rows[2]).getAllByRole('cell').map(c => c.textContent)).toEqual(['Fr., 13.11.2026', '3', '1']);
    const table = screen.getByRole('table').textContent;
    toggle.focus(); await user.keyboard(' ');
    expect(toggle).not.toBeChecked();
    expect(chart().querySelector('.chart-unique-line')).toBeNull();
    expect(chart().querySelector('.chart-line')).not.toBeNull();
    expect(screen.getByRole('table')).toHaveTextContent(table!);
    expect(statValue('Bereinigte Anzahl')).toHaveTextContent('2');
    for (const label of ['Letzte 7 Tage', 'Gesamt']) {
      await user.click(screen.getByRole('radio', { name: label }));
      await waitFor(() => expect(chart().querySelector('.chart-line')).not.toBeNull());
      expect(screen.getByRole('checkbox', { name: 'Bereinigte Anzahl anzeigen' })).not.toBeChecked();
      expect(chart().querySelector('.chart-unique-line')).toBeNull();
    }
    await user.click(screen.getByRole('checkbox', { name: 'Bereinigte Anzahl anzeigen' }));
    expect(chart().querySelector('.chart-unique-line')).not.toBeNull();
    expect(seen).toEqual(['30d', '7d', 'all']);
  });

  it('zeigt fehlende Historie als nicht verfuegbar und unterbricht die Kurve an Datenluecken', async () => {
    fakeBackend(EDITOR, (r) => r.path === '/api/admin/statistics/page-views' ? json(200, {
      period: '30d', total: 8, uniqueTotal: null, uniqueSince: '2026-11-14T08:00:00Z', days: [
        { date: day(0), views: 1, uniqueViews: 1 },
        { date: day(1), views: 5, uniqueViews: null },
        { date: day(2), views: 2, uniqueViews: 1 },
        { date: day(3), views: 0, uniqueViews: 0 },
      ],
    }) : undefined, statsBackend({ results: 0 }).handler);
    await openStatistics();
    await screen.findByRole('note');
    expect(statValue('Bereinigte Anzahl')).toHaveTextContent('Nicht verfügbar');
    expect(statValue('Absolute Anzahl')).toHaveTextContent('8');
    expect(screen.getByRole('note')).toHaveTextContent('14.11.2026 um 09:00 Uhr');
    const chart = screen.getByRole('img', { name: /Verlauf der Seitenaufrufe/ });
    const path = chart.querySelector('.chart-unique-line')!.getAttribute('d')!;
    expect(path.match(/M/g)).toHaveLength(2);
    expect(chart.querySelectorAll('.chart-unique-point')).toHaveLength(3);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[2]).getAllByRole('cell')[2]).toHaveTextContent('Nicht verfügbar');
    expect(within(rows[4]).getAllByRole('cell')[2]).toHaveTextContent('0');
  });
});

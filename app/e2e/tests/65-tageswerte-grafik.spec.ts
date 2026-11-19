// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Statistics.tsx
import type { Page } from '@playwright/test';
import { AUTH, expect, test } from '../support/fixtures';

// Anforderung #65: Redaktionsstatistik zeigt Tageswerte direkt in der Grafik statt in einer Tagestabelle.
// Die Antwort von /api/admin/statistics/page-views wird per Route fixiert: Geprüft wird die Darstellung
// bestehender Tageswerte (Backend unverändert), und feste Daten machen Datum und Werte eindeutig erwartbar.
// Unit-Tests: app/frontend-redaktion/src/components/chartDays.test.ts und PageViewsChart.test.tsx.

interface Day { date: string; views: number; uniqueViews: number | null }

/** `count` lückenlose Kalendertage bis einschließlich 18.11.2026, neueste zuerst (wie die API). */
function series(count: number, special: Record<string, [number, number | null]> = {}): Day[] {
  const end = Date.UTC(2026, 10, 18);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    const [views, uniqueViews] = special[date] ?? [20 + (i % 9), 10 + (i % 5)];
    return { date, views, uniqueViews };
  });
}

// Beispiel aus dem Screenshot im Ticket (18.11.2026: 138 / 54), dazu ein Nulltag und ein Tag ohne bereinigten Wert.
const SPECIAL: Record<string, [number, number | null]> = {
  '2026-11-18': [138, 54],
  '2026-11-17': [0, 0],
  '2026-11-16': [7, null],
  '2025-12-24': [4242, 1717],
};
const DATA: Record<string, Day[]> = { '7d': series(7, SPECIAL), '30d': series(30, SPECIAL), all: series(400, SPECIAL) };

async function mockPageViews(page: Page, data = DATA) {
  await page.route('**/api/admin/statistics/page-views*', (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') ?? '30d';
    const days = data[period];
    const total = days.reduce((sum, d) => sum + d.views, 0);
    return route.fulfill({ json: { period, total, uniqueTotal: total === 0 ? 0 : 99, uniqueSince: null, days } });
  });
}

const section = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Seitenaufrufe' }) });
const tooltip = (page: Page) => section(page).getByRole('tooltip');

/** Bildschirmposition des Tages `date` in der Grafik (Datenbereich ohne Achsenbeschriftung links, 62 px, und rechts, 12 px). */
async function dayPoint(page: Page, period: string, date: string) {
  const chrono = [...DATA[period]].reverse();
  const i = chrono.findIndex((d) => d.date === date);
  expect(i, `Testdaten enthalten ${date}`).toBeGreaterThanOrEqual(0);
  const svg = section(page).locator('figure svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  return { x: box.x + 62 + (box.width - 74) * i / (chrono.length - 1), y: box.y + 120 };
}

async function hoverDay(page: Page, period: string, date: string) {
  const { x, y } = await dayPoint(page, period, date);
  await page.mouse.move(x, y);
}

test.describe('Tageswerte in der Grafik', () => {
  test.use({ storageState: AUTH.marketing });

  test.beforeEach(async ({ page }) => {
    await mockPageViews(page);
    await page.goto('/redaktion/statistik');
    await expect(section(page).locator('figure svg[role="img"]')).toBeVisible();
  });

  test('REQ-65-AC1: keine Tagestabelle mehr, Hinweise verweisen auf die Grafik, Summen und Umschalter bleiben', async ({ page }) => {
    await expect(section(page).getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Seitenaufrufe je Tag, neueste zuerst' })).toHaveCount(0);
    await expect(section(page)).not.toContainText('Tabelle');
    await expect(section(page).getByText(/in der Grafik je Kalendertag einmal/)).toBeVisible();
    await expect(section(page).locator('figcaption')).toContainText('Genaue Tageswerte');
    // Unverändert: Periodensummen und Kurvenumschaltung
    await expect(section(page).locator('.stats-totals')).toContainText('Absolute Anzahl');
    await expect(section(page).locator('.stats-totals')).toContainText('Bereinigte Anzahl');
    await expect(section(page).getByRole('checkbox', { name: 'Bereinigte Anzahl anzeigen' })).toBeChecked();
  });

  test('REQ-65-AC2: Tooltip beim Überfahren zeigt Datum und beide Werte, folgt dem Zeiger und verschwindet beim Verlassen', async ({ page }) => {
    await expect(tooltip(page)).toHaveCount(0);
    await hoverDay(page, '30d', '2026-11-18');
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toContainText('Mi., 18.11.2026');
    await expect(tooltip(page)).toContainText(/Absolute Anzahl\s*138/);
    await expect(tooltip(page)).toContainText(/Bereinigte Anzahl\s*54/);

    await hoverDay(page, '30d', '2026-11-16');
    await expect(tooltip(page)).toContainText('Mo., 16.11.2026');
    await expect(tooltip(page)).toContainText(/Absolute Anzahl\s*7/);
    await expect(tooltip(page)).not.toContainText('138');

    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toHaveCount(0);

    // Bei ausgeblendeter bereinigter Kurve bleiben beide Tageswerte abrufbar.
    await section(page).getByRole('checkbox', { name: 'Bereinigte Anzahl anzeigen' }).uncheck();
    await hoverDay(page, '30d', '2026-11-18');
    await expect(tooltip(page)).toContainText(/Absolute Anzahl\s*138/);
    await expect(tooltip(page)).toContainText(/Bereinigte Anzahl\s*54/);
  });
});

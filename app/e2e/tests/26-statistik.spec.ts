// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/App.tsx app/frontend-redaktion/src/pages/Statistics.tsx
import { randomBytes } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { AUTH, expect, randomIp, test, type Session } from '../support/fixtures';

// Anforderung #26: Seitenaufrufe und Readiness-Ergebnisse in Statistiken auswerten.
// Läuft im Projekt „statistik“ nach allen anderen Tests und seriell: Seitenaufrufe zählen serverweit.
// Nicht automatisiert: der Teil von REQ-26-AC4 über mehrere Kalendertage (bereinigte Gesamtsumme ≠ Summe der
// Tageswerte über Tage hinweg), weil die Serverzeit im Test nicht steuerbar ist. Manuelle Prüfung im Ticket.
test.describe.configure({ mode: 'serial' });

interface Day {
  date: string;
  views: number;
  uniqueViews: number | null;
}
interface PageViews {
  period: string;
  total: number;
  uniqueTotal: number | null;
  uniqueSince: string | null;
  days: Day[];
}
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const pageViews = async (s: Session, period = '30d') => (await (await s.get(`/api/admin/statistics/page-views?period=${period}`)).json()) as PageViews;
/** TT.MM.JJJJ des Berliner Kalendertags vor `daysAgo` Tagen. */
const berlinDate = (daysAgo: number) => {
  const [y, m, d] = today().split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d - daysAgo)));
};
const todayOf = (p: PageViews) => p.days.find((d) => d.date === today())!;

async function visit(ctx: APIRequestContext, ip: string, path = '/de/blog') {
  const res = await ctx.get(path, { headers: { 'X-Forwarded-For': ip } });
  expect(res.status()).toBe(200);
}

const dims = async (ctx: APIRequestContext) =>
  ((await (await ctx.get('/api/audit?lang=de')).json()) as { dimensions: { slug: string }[] }).dimensions.map((d) => d.slug);
async function storeResult(ctx: APIRequestContext, lang: 'de' | 'en', levels: (i: number) => number) {
  const ratings = (await dims(ctx)).map((dimension, i) => ({ dimension, level: levels(i) }));
  const res = await ctx.post('/api/readiness-results', { data: { key: randomBytes(16).toString('hex'), lang, ratings } });
  expect(res.status()).toBe(204);
  return ratings;
}

test('REQ-26-AC1 REQ-64-AC5: Statistik für Marketing und Admin; ohne Sitzung sind Seite und API geschützt', async ({ request, marketing, admin, page }) => {
  expect((await request.get('/api/admin/statistics/page-views')).status()).toBe(401);
  expect((await request.get('/api/admin/statistics/readiness-results')).status()).toBe(401);
  for (const s of [marketing, admin]) {
    expect((await s.get('/api/admin/statistics/page-views')).status()).toBe(200);
    expect((await s.get('/api/admin/statistics/readiness-results')).status()).toBe(200);
  }
  await page.goto('/redaktion/statistik');
  await expect(page).toHaveURL(/\/redaktion\/anmelden/);
});

test('REQ-26-AC3 REQ-26-AC4: absolute und IP-bereinigte Zählung, je Zeitraum und Kalendertag', async ({ request, marketing }) => {
  const before = await pageViews(marketing);
  const [a, b] = [randomIp(), randomIp()];
  for (const ip of [a, a, a, b]) await visit(request, ip);
  await visit(request, b, '/en/profil');

  const after = await pageViews(marketing);
  expect(after.total - before.total).toBe(5);
  expect(after.uniqueTotal).not.toBeNull();
  expect(after.uniqueTotal! - before.uniqueTotal!).toBe(2);
  expect(todayOf(after).views - todayOf(before).views).toBe(5);
  expect(todayOf(after).uniqueViews! - todayOf(before).uniqueViews!).toBe(2);
  // Begrenzte Zeiträume enthalten jeden Tag, neueste zuerst
  expect(after.days).toHaveLength(30);
  expect(after.days[0].date).toBe(today());

  // Nicht gezählt: API-Abrufe, Fehlerseiten und Vorab-Abrufe
  await request.get('/api/posts?lang=de', { headers: { 'X-Forwarded-For': a } });
  await request.get('/de/blog', { headers: { 'X-Forwarded-For': a, 'Sec-Purpose': 'prefetch' } });
  expect((await pageViews(marketing)).total).toBe(after.total);
});

test('REQ-26-AC3: Navigation innerhalb der Webseite zählt nicht zusätzlich', async ({ page, marketing }) => {
  const before = (await pageViews(marketing)).total;
  await page.goto('/de');
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Blog' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Marvin Jakob' })).toBeVisible();
  expect((await pageViews(marketing)).total - before).toBe(1);
});

test.describe('Oberfläche', () => {
  test.use({ storageState: AUTH.marketing });

  test('REQ-26-AC2 REQ-26-AC3 REQ-26-AC6 REQ-26-AC8: Zeitraum, Kennzahlen, Tageswerte und Ergebnisliste mit Seitennavigation', async ({ page, request, marketing }) => {
    // Genug gespeicherte Ergebnisse für eine zweite Seite (50 je Seite)
    const existing = ((await (await marketing.get('/api/admin/statistics/readiness-results?period=30d')).json()) as { total: number }).total;
    for (let i = existing; i < 51; i++) await storeResult(request, 'de', () => 2);
    const latest = await storeResult(request, 'en', (i) => (i % 3) + 1);

    await page.goto('/redaktion/statistik');
    const thirty = page.getByRole('radio', { name: 'Letzte 30 Tage' });
    await expect(thirty).toBeChecked();
    await expect(page.getByText('Absolute Anzahl').first()).toBeVisible();
    await expect(page.getByText('Bereinigte Anzahl').first()).toBeVisible();
    await expect(page.getByText(/unterscheidet IP-Adressen, keine Personen/)).toBeVisible();
    await expect(page.getByText(/Seitenwechsel innerhalb der geöffneten Webseite zählen nicht/)).toBeVisible();
    await expect(page.getByText(/Tage und Uhrzeiten gelten in deutscher Zeit/)).toBeVisible();
    // Diagramm; die genauen Tageswerte stehen seit #65 in der Grafik statt in einer Tabelle (REQ-65-AC1).
    await expect(page.locator('figure svg[role="img"]')).toBeVisible();
    const days = page.getByRole('group', { name: /Tageswerte/ });
    const status = page.locator('figure').getByRole('status');
    await days.focus();
    await page.keyboard.press('Home');
    await expect(status).toContainText(berlinDate(29));
    await page.keyboard.press('End');
    await expect(status).toContainText(berlinDate(0));

    // Neuestes Ergebnis zuerst, mit Zeitpunkt, Sprache und Reifegraden, ohne Adressen
    const first = page.locator('.result-entry').first();
    await expect(first.locator('.result-meta')).toContainText('Englisch');
    await expect(first.locator('time')).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr$/);
    const names = ['Einfach', 'Strukturiert', 'Intelligent'];
    await expect(first.locator('dd')).toHaveText(latest.map((r) => names[r.level - 1]));
    await expect(page.locator('main')).not.toContainText('@');

    // Seitennavigation; Zeitraumwechsel setzt auf Seite 1 zurück
    const pager = page.getByRole('navigation', { name: 'Seiten der Ergebnisliste' });
    await pager.getByRole('button', { name: 'Nächste Seite' }).click();
    await expect(page.locator('.results-range')).toContainText('Einträge 51–');
    await page.getByRole('radio', { name: 'Letzte 7 Tage' }).check();
    await expect(page.locator('.results-range')).toContainText('Einträge 1–50');
    await days.focus();
    await page.keyboard.press('Home');
    await expect(status).toContainText(berlinDate(6));
    await page.getByRole('radio', { name: 'Gesamt' }).check();
    await expect(page.locator('.results-range')).toContainText('Einträge 1–50');

    // Tastatur: Zeitraum mit Pfeiltasten wechseln
    await page.getByRole('radio', { name: 'Gesamt' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Letzte 30 Tage' })).toBeChecked();
  });

  test('REQ-26-AC7: Leerzustand und Ladefehler mit erneutem Versuch', async ({ page }) => {
    await page.route('**/api/admin/statistics/page-views*', (r) =>
      r.fulfill({ json: { period: '30d', total: 0, uniqueTotal: 0, uniqueSince: null, days: [] } }),
    );
    await page.route('**/api/admin/statistics/readiness-results*', (r) =>
      r.fulfill({ json: { period: '30d', total: 0, page: 1, pageSize: 50, dimensions: [], levels: [], items: [] } }),
    );
    await page.goto('/redaktion/statistik');
    await expect(page.getByText('Im gewählten Zeitraum wurden noch keine Seitenaufrufe gezählt.')).toBeVisible();
    await expect(page.getByText('Im gewählten Zeitraum wurden noch keine Ergebnisse gespeichert.')).toBeVisible();

    await page.unrouteAll();
    let fail = true;
    await page.route('**/api/admin/statistics/page-views*', (r) => (fail ? r.fulfill({ status: 500, json: { message: 'x' } }) : r.continue()));
    await page.reload();
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Erneut versuchen' }) });
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.locator('figure svg[role="img"]')).toBeVisible();
  });

  test.describe('mobil', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
    test('REQ-26-AC8: Zeitraum und Werte auf 375 px erreichbar', async ({ page }) => {
      await page.goto('/redaktion/statistik');
      const seven = page.getByRole('radio', { name: 'Letzte 7 Tage' });
      await seven.focus();
      await page.keyboard.press('Space');
      await expect(seven).toBeChecked();
      // Tageswerte per Antippen in der Grafik (REQ-65-AC3), neuester Tag am rechten Rand des Datenbereichs.
      const chart = page.locator('figure svg[role="img"]');
      await chart.scrollIntoViewIfNeeded();
      const box = (await chart.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width - 13, box.y + 120);
      await expect(page.getByRole('tooltip')).toContainText(berlinDate(0));
    });
  });
});

// Muss zuletzt laufen: Ein Abruf ohne gültige Client-IP macht die Bereinigung des Tages unvollständig.
test('REQ-26-AC5: bei unvollständigen Daten steht „Nicht verfügbar“ statt 0, absolute Zahlen bleiben sichtbar', async ({ playwright, baseURL, marketing, browser }) => {
  const noIp = await playwright.request.newContext({ baseURL, extraHTTPHeaders: {} });
  const before = await pageViews(marketing);
  expect((await noIp.get('/de/blog')).status()).toBe(200);
  await noIp.dispose();

  const after = await pageViews(marketing);
  expect(after.total).toBe(before.total + 1);
  expect(after.uniqueTotal).toBeNull();
  expect(todayOf(after).uniqueViews).toBeNull();
  expect(todayOf(after).views).toBe(todayOf(before).views + 1);

  const ctx = await browser.newContext({ baseURL, storageState: AUTH.marketing, extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });
  const page = await ctx.newPage();
  await page.goto('/redaktion/statistik');
  await expect(page.getByText('Nicht verfügbar').first()).toBeVisible();
  await expect(page.getByText(/Für diesen Zeitraum fehlen vollständige Daten zur Bereinigung\./)).toBeVisible();
  if (after.uniqueSince) await expect(page.getByText(/Der aktuelle Erfassungsbeginn ist der \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2} Uhr\./)).toBeVisible();
  await expect(page.locator('main')).toContainText(new Intl.NumberFormat('de-DE').format(after.total));
  await ctx.close();
});

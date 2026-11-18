// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx app/frontend/src/pages/AuditDimension.tsx app/frontend/src/pages/AuditResult.tsx
import { readFileSync } from 'node:fs';
import type { Page, Request } from '@playwright/test';
import { completeAssessment, expect, expectNoHorizontalScroll, test, type Session } from '../support/fixtures';

// Anforderung #23: KI Readiness einschätzen und Ergebnisse auswerten.
// Quelle der Dimensionen: content/topics/audit/KI Readiness.md, Abschnitt „Die Dimensionen“.
const DIMENSIONS = [
  'Strategie und Wirtschaftlichkeit',
  'Ressourcenplanung und Kompetenzen',
  'Betrieb',
  'Governance und Compliance',
  'Agenten und Prozesse',
  'Technologie und Infrastruktur',
  'Daten und Wissen',
  'Sicherheit und Zuverlässigkeit',
];
const OVERVIEW = '/de/themen/ai-audit';
const released = (JSON.parse(readFileSync(new URL('../../backend/internal/audit/content.json', import.meta.url), 'utf8')) as {
  dimensions: { slug: string; released: boolean }[];
}).dimensions;

interface Result {
  id: number;
  lang: string;
  submittedAt: string;
  ratings: { dimension: string; level: number }[];
}
const results = async (s: Session) =>
  ((await (await s.get('/api/admin/statistics/readiness-results?period=7d')).json()) as { items: Result[] }).items;

function track(page: Page) {
  const calls: Request[] = [];
  page.on('request', (r) => r.url().includes('/api/readiness-results') && calls.push(r));
  return calls;
}

test('REQ-23-AC1: Übersicht mit Einleitung, Anleitung und ausschließlich freigegebenen Dimensionen samt Links', async ({ page, request }) => {
  await page.goto(OVERVIEW);
  await expect(page.getByRole('heading', { name: 'Warum eine Selbsteinschätzung?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'So ist die Selbsteinschätzung aufgebaut' })).toBeVisible();
  const toggles = page.locator('.dim-acc-toggle');
  await expect(toggles.locator('.dim-acc-title')).toHaveText(DIMENSIONS);
  expect(released.filter((d) => d.released)).toHaveLength(DIMENSIONS.length);

  // Erklärungen sind anfangs geschlossen; aufgeklappt führen sie zur Dimensionsseite
  await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false');
  await toggles.nth(2).click();
  await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Reifegrade und Prüffragen: Betrieb' }).click();
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit\/betrieb$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Betrieb');

  // Nicht freigegebene oder unbekannte Dimensionen sind nicht erreichbar
  expect((await request.get('/api/audit/dimensions/gibt-es-nicht?lang=de')).status()).toBe(404);
  for (const d of released.filter((x) => !x.released)) expect((await request.get(`/api/audit/dimensions/${d.slug}?lang=de`)).status()).toBe(404);
});

test('REQ-23-AC2: Dimensionsseite zeigt Beschreibung, Prüffragen und drei Stufen ohne Vorauswahl', async ({ page }) => {
  await page.goto(`${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(DIMENSIONS[0]);
  await expect(page.locator('.dim-intro p').first()).not.toBeEmpty();
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(3);
  for (const r of await radios.all()) await expect(r).not.toBeChecked();
  for (const name of ['Einfach', 'Strukturiert', 'Intelligent']) {
    await expect(page.getByRole('heading', { name: `Prüffragen zu „${name}“` })).toBeVisible();
  }
  await expect(page.locator('.choice-questions li').first()).not.toBeEmpty();

  // „Weiter“ ist ohne Auswahl gesperrt und nennt den Grund
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Weiter' })).toHaveAccessibleDescription('Wähle einen Reifegrad, um fortzufahren.');
  await page.getByRole('radio', { name: /Intelligent/ }).check();
  await expect(page.getByRole('radio', { name: /Intelligent/ })).toBeChecked();
  await expect(page).toHaveURL(/strategie-und-wirtschaftlichkeit$/); // Auswahl allein wechselt nicht
});

test('REQ-23-AC3 REQ-23-AC4: Bewertungen bleiben beim Navigieren erhalten, unvollständige Auswertung nennt offene Dimensionen, Neuladen beginnt neu', async ({ page }) => {
  await page.goto(`${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await page.getByRole('radio', { name: /Strukturiert/ }).check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('radio', { name: /Einfach/ }).check();
  await expect(page.locator('.assess-steps-count')).toHaveText('2 von 8 bewertet');

  // Zurück zur ersten Dimension: die Wahl ist erhalten
  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(page.getByRole('radio', { name: /Strukturiert/ })).toBeChecked();
  // Über die Navigation zur Übersicht und wieder in die Selbsteinschätzung
  await page.getByRole('link', { name: 'KI Readiness' }).first().click();
  await expect(page).toHaveURL(new RegExp(`${OVERVIEW}$`));
  await page.getByRole('link', { name: 'Selbsteinschätzung starten' }).first().click();
  await expect(page.locator('.assess-steps-count')).toHaveText('2 von 8 bewertet');
  await expect(page.getByRole('radio', { name: /Strukturiert/ })).toBeChecked();

  // Unvollständige Auswertung (Navigation innerhalb der Anwendung)
  await page.evaluate(() => {
    history.pushState({}, '', '/de/themen/ai-audit/auswertung');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const incomplete = page.locator('.result-incomplete');
  await expect(incomplete).toContainText('Bisher bewertet: 2 von 8');
  await expect(incomplete.getByRole('listitem')).toHaveText(DIMENSIONS.slice(2));
  await expect(page.getByRole('link', { name: 'Selbsteinschätzung fortsetzen' })).toHaveAttribute('href', '/de/themen/ai-audit/betrieb');
  await expect(page.locator('svg[role="img"]')).toHaveCount(0);
  await expect(page.locator('table.result-table')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.result-incomplete')).toContainText('Bisher bewertet: 0 von 8');
});

test('REQ-23-AC5: vollständige Auswertung mit Netzdiagramm, Tabelle und Ändern-Links, ohne Gesamtnote', async ({ page }) => {
  const levels = [1, 2, 3, 1, 2, 3, 1, 2];
  const slugs = await completeAssessment(page, 'de', levels);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auswertung der Selbsteinschätzung');
  await expect(page.getByRole('img', { name: 'Netzdiagramm deiner selbst eingeschätzten Reifegrade' })).toBeVisible();
  const rows = page.locator('table.result-table tbody tr');
  await expect(rows).toHaveCount(8);
  const names = ['Einfach', 'Strukturiert', 'Intelligent'];
  for (const [i, row] of (await rows.all()).entries()) {
    await expect(row.getByRole('rowheader')).toHaveText(`${i + 1}. ${DIMENSIONS[i]}`);
    await expect(row.getByRole('cell')).toContainText(`${levels[i]} – ${names[levels[i] - 1]}`);
    await expect(row.getByRole('link', { name: new RegExp(`^Ändern\\s*: ${DIMENSIONS[i]}$`) })).toHaveAttribute('href', `/de/themen/ai-audit/${slugs[i]}`);
  }
  await expect(page.locator('main')).not.toContainText(/Gesamtnote|Gesamtergebnis|Durchschnitt|Gesamtreifegrad/);

  // Ändern führt zur Dimension; die Änderung erscheint in der Auswertung
  await rows.nth(0).getByRole('link').click();
  await page.getByRole('radio', { name: /Intelligent/ }).check();
  await page.locator('.assess-steps a', { hasText: DIMENSIONS[7] }).click();
  await page.getByRole('button', { name: 'Auswertung anzeigen' }).click();
  await expect(rows.nth(0).getByRole('cell')).toContainText('3 – Intelligent');
});

test('REQ-23-AC6: ohne Einwilligung wird nichts übertragen', async ({ page }) => {
  const calls = track(page);
  await completeAssessment(page, 'de');
  await expect(page.locator('table.result-table')).toBeVisible();
  await page.getByRole('link', { name: /Ändern/ }).first().click();
  await page.getByRole('radio', { name: /Einfach/ }).check();
  expect(calls).toHaveLength(0);
});

test('REQ-23-AC6: mit Einwilligung wird nur das vollständige Ergebnis gespeichert, aktualisiert und beim Widerruf gelöscht', async ({ page, editor }) => {
  const calls = track(page);
  const levels = [3, 1, 3, 1, 3, 1, 3, 3]; // Muster nur in diesem Test
  const start = Date.now() - 2_000;
  const slugs = await completeAssessmentWithConsent(page, levels);
  await expect(page.locator('.share-status')).toHaveText(/anonym gespeichert/);
  expect(calls.map((c) => c.method())).toEqual(['POST']);
  const first = calls[0].postDataJSON() as { key: string; lang: string; ratings: { dimension: string; level: number }[] };
  expect(Object.keys(first).sort()).toEqual(['key', 'lang', 'ratings']);
  expect(first.ratings).toEqual(slugs.map((s, i) => ({ dimension: s, level: levels[i] })));

  const mine = (r: Result) => Date.parse(r.submittedAt) >= start && r.ratings.map((x) => x.level).join() === levels.join();
  await expect.poll(async () => (await results(editor)).filter(mine)).toHaveLength(1);

  // Änderung aktualisiert dasselbe Ergebnis
  await page.locator('table.result-table').getByRole('link').last().click();
  await page.getByRole('radio', { name: /Strukturiert/ }).check();
  await page.getByRole('button', { name: 'Auswertung anzeigen' }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].postDataJSON().key).toBe(first.key);
  const changed = [...levels.slice(0, 7), 2];
  await expect.poll(async () => (await results(editor)).filter((r) => r.ratings.map((x) => x.level).join() === changed.join() && Date.parse(r.submittedAt) >= start)).toHaveLength(1);
  expect((await results(editor)).filter(mine)).toHaveLength(0);

  // Widerruf löscht
  await page.getByLabel('Ergebnis anonym für die Statistik speichern').uncheck();
  await expect(page.locator('.share-status')).toHaveText('Dein gespeichertes Ergebnis wurde gelöscht.');
  expect(calls[2].method()).toBe('DELETE');
  expect(calls[2].url()).toContain(first.key);
  expect((await results(editor)).filter((r) => r.ratings.map((x) => x.level).join() === changed.join() && Date.parse(r.submittedAt) >= start)).toHaveLength(0);
});

test('REQ-23-AC6: das Backend nimmt nur vollständige Ergebnisse an', async ({ request }) => {
  const dims = released.filter((d) => d.released).map((d) => d.slug);
  const key = 'a'.repeat(32);
  const partial = dims.slice(1).map((dimension) => ({ dimension, level: 2 }));
  expect((await request.post('/api/readiness-results', { data: { key, lang: 'de', ratings: partial } })).status()).toBe(422);
  const invalid = dims.map((dimension) => ({ dimension, level: 4 }));
  expect((await request.post('/api/readiness-results', { data: { key, lang: 'de', ratings: invalid } })).status()).toBe(422);
});

test('REQ-23-AC7: Lade-, Speicher- und Löschfehler werden verständlich angezeigt', async ({ page }) => {
  let failAudit = true;
  await page.route('**/api/audit?*', (r) => (failAudit ? r.fulfill({ status: 500, json: { message: 'x' } }) : r.continue()));
  await page.goto(OVERVIEW);
  await expect(page.getByRole('alert')).toContainText('Inhalte konnten nicht geladen werden');
  failAudit = false;
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('.dim-acc-toggle')).toHaveCount(8);

  await page.route('**/api/readiness-results**', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
  await completeAssessmentWithConsent(page);
  await expect(page.locator('.share-status')).toHaveText('Dein Ergebnis konnte nicht gespeichert werden. Deine Auswertung ist davon nicht betroffen.');
  await expect(page.locator('table.result-table tbody tr')).toHaveCount(8);

  // Löschfehler: zuerst erfolgreich speichern, dann Widerruf scheitert
  await page.unroute('**/api/readiness-results**');
  await page.reload();
  await page.route('**/api/readiness-results/*', (r) => (r.request().method() === 'DELETE' ? r.fulfill({ status: 500, json: { message: 'x' } }) : r.continue()));
  await completeAssessmentWithConsent(page);
  await expect(page.locator('.share-status')).toHaveText(/anonym gespeichert/);
  await page.getByLabel('Ergebnis anonym für die Statistik speichern').uncheck();
  await expect(page.locator('.share-status')).toHaveText(/konnte nicht gelöscht werden/);
});

test('REQ-23-AC8 REQ-24-AC5: unter EN sind Bedienelemente englisch, deutsche Fachinhalte gekennzeichnet, das Diagramm hat eine Textalternative', async ({ page }) => {
  await page.goto('/en/themen/ai-audit');
  await expect(page.locator('main')).toContainText('The AI Readiness content is not available in English. You are reading the German version.');
  await expect(page.locator('.dim-acc-text').first()).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('link', { name: 'Start self-assessment' }).first()).toBeVisible();

  await completeAssessment(page, 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Self-assessment results');
  const radar = page.locator('svg[role="img"]');
  const desc = await radar.locator('desc').textContent();
  for (const d of DIMENSIONS) expect(desc).toContain(d);
  await expect(page.getByRole('link', { name: /^Change/ }).first()).toBeVisible();
});

test('REQ-23-AC8: Reifegrad per Tastatur wählen und weitergehen', async ({ page }) => {
  await page.goto(`${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await page.getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio').first()).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  await page.getByRole('button', { name: 'Weiter' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/ressourcenplanung-und-kompetenzen$/);
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test('REQ-23-AC8: Selbsteinschätzung und Auswertung auf 375 px ohne horizontalen Bildlauf', async ({ page }) => {
    await page.goto(`${OVERVIEW}/betrieb`);
    await expectNoHorizontalScroll(page);
    await completeAssessment(page, 'de');
    await expect(page.locator('table.result-table')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

/** Alle Dimensionen bewerten, im letzten Schritt einwilligen und die Auswertung öffnen. */
async function completeAssessmentWithConsent(page: Page, levels?: number[]) {
  const audit = (await (await page.request.get('/api/audit?lang=de')).json()) as { dimensions: { slug: string }[] };
  await page.goto(`${OVERVIEW}/${audit.dimensions[0].slug}`);
  for (const [i, d] of audit.dimensions.entries()) {
    await page.locator(`#reifegrad-${d.slug}-${levels?.[i] ?? 2}`).check();
    const last = i === audit.dimensions.length - 1;
    if (last) await page.getByLabel('Ergebnis anonym für die Statistik speichern').check();
    await page.getByRole('button', { name: last ? 'Auswertung anzeigen' : 'Weiter' }).click();
    if (!last) await expect(page).toHaveURL(new RegExp(`/${audit.dimensions[i + 1].slug}$`));
  }
  await expect(page).toHaveURL(/\/auswertung$/);
  return audit.dimensions.map((d) => d.slug);
}

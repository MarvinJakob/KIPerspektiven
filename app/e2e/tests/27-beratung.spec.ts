// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx app/frontend/src/pages/AuditDimension.tsx app/frontend/src/pages/AuditResult.tsx app/frontend-redaktion/src/pages/ConsultationRequests.tsx
import type { Request } from '@playwright/test';
import { AUTH, completeAssessment, expect, expectNoHorizontalScroll, test, uid, type Session } from '../support/fixtures';

// Anforderung #27: Beratung aus der Readiness-Auswertung anfragen und Anfragen verwalten.
interface Consultation {
  id: number;
  email: string;
  lang: string;
  requestedAt: string;
}
const requests = async (s: Session) => ((await (await s.get('/api/admin/consultation-requests')).json()) as { items: Consultation[] }).items;
const address = () => `beratung.${uid()}@example.org`;

test('REQ-27-AC1 REQ-27-AC2: freiwillige Anfrage mit nur einer E-Mail-Adresse; gespeichert werden Adresse, Sprache und Zeitpunkt', async ({ page, editor }) => {
  await completeAssessment(page, 'de');
  const offer = page.locator('section.consult');
  await expect(offer.getByRole('heading', { name: 'Kostenloses Beratungsgespräch anfragen' })).toBeVisible();
  await expect(offer.getByRole('textbox')).toHaveCount(1);
  await expect(offer.getByLabel('E-Mail-Adresse')).toBeVisible();
  // Die Auswertung ist ohne Anfrage vollständig nutzbar
  await expect(page.locator('table.result-table tbody tr')).toHaveCount(8);

  const email = address();
  let sent: Request | undefined;
  page.on('request', (r) => r.url().endsWith('/api/consultation-requests') && (sent = r));
  const start = Date.now() - 2_000;
  await offer.getByLabel('E-Mail-Adresse').fill(email.toUpperCase());
  await offer.getByRole('button', { name: 'Anfrage senden' }).click();
  await expect(page.getByRole('heading', { name: 'Vielen Dank für deine Anfrage' })).toBeFocused();
  await expect(offer).toContainText(email.toUpperCase());

  expect(sent!.postDataJSON()).toEqual({ email: email.toUpperCase(), lang: 'de' });
  const stored = (await requests(editor)).find((r) => r.email === email);
  expect(stored).toBeDefined();
  expect(Object.keys(stored!).sort()).toEqual(['email', 'id', 'lang', 'requestedAt']);
  expect(stored!.lang).toBe('de');
  expect(Date.parse(stored!.requestedAt)).toBeGreaterThanOrEqual(start);
  await editor.send('DELETE', `/api/admin/consultation-requests/${stored!.id}`);
});

test('REQ-27-AC3: leere oder ungültige Adresse zeigt einen Feldfehler mit Fokus und speichert nichts', async ({ page, request, editor }) => {
  await completeAssessment(page, 'de');
  const field = page.locator('section.consult').getByLabel('E-Mail-Adresse');
  const submit = page.getByRole('button', { name: 'Anfrage senden' });
  let posted = 0;
  page.on('request', (r) => r.url().endsWith('/api/consultation-requests') && posted++);

  await submit.click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(/^Bitte gib deine E-Mail-Adresse ein\./);

  await field.fill('kein-at.example.org');
  await submit.click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(/^Bitte gib eine gültige E-Mail-Adresse ein/);
  expect(posted).toBe(0);

  const bad = `kaputt.${uid()}@`;
  expect((await request.post('/api/consultation-requests', { data: { email: bad, lang: 'de' } })).status()).toBe(422);
  expect((await request.post('/api/consultation-requests', { data: { email: '', lang: 'de' } })).status()).toBe(422);
  expect((await requests(editor)).some((r) => r.email.startsWith(bad))).toBe(false);
});

test('REQ-27-AC4: Server-, Netz- und Ratenfehler zeigen Meldungen, Adresse und Auswertung bleiben erhalten', async ({ page }) => {
  await completeAssessment(page, 'de');
  const field = page.locator('section.consult').getByLabel('E-Mail-Adresse');
  await field.fill('ada@example.org');
  for (const [status, text] of [
    [500, 'Deine Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'],
    [0, 'Deine Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'],
    [429, 'Von deinem Anschluss sind gerade zu viele Anfragen eingegangen. Bitte versuche es in einer Stunde erneut.'],
  ] as const) {
    await page.route('**/api/consultation-requests', (r) => (status ? r.fulfill({ status, json: { message: 'x' } }) : r.abort('failed')));
    await page.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(page.locator('section.consult').getByRole('alert')).toHaveText(text);
    await expect(field).toHaveValue('ada@example.org');
    await expect(page.locator('table.result-table tbody tr')).toHaveCount(8);
    await page.unrouteAll();
  }
});

test('REQ-27-AC4: das Backend begrenzt Anfragen je IP-Adresse (429 nach fünf Anfragen)', async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await request.post('/api/consultation-requests', { data: { email: address(), lang: 'en' } })).status());
  expect(statuses).toEqual([204, 204, 204, 204, 204, 429]);
});

test('REQ-27-AC5: Anfragen nur mit Sitzung, neueste zuerst', async ({ request, editor, admin }) => {
  expect((await request.get('/api/admin/consultation-requests')).status()).toBe(401);
  expect((await request.delete('/api/admin/consultation-requests/1')).status()).toBe(401);
  const [first, second] = [address(), address()];
  for (const email of [first, second]) expect((await request.post('/api/consultation-requests', { data: { email, lang: 'en' } })).status()).toBe(204);
  for (const s of [editor, admin]) {
    const mine = (await requests(s)).filter((r) => [first, second].includes(r.email));
    expect(mine.map((r) => r.email)).toEqual([second, first]);
    expect(mine.every((r) => r.lang === 'en')).toBe(true);
  }
  for (const r of (await requests(editor)).filter((x) => [first, second].includes(x.email))) await editor.send('DELETE', `/api/admin/consultation-requests/${r.id}`);
});

test.describe('Verwaltung in der Redaktion', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-27-AC5 REQ-27-AC6: Liste mit Adresse, Sprache und Eingang; Löschen nur nach Bestätigung', async ({ page, request, editor }) => {
    const email = address();
    expect((await request.post('/api/consultation-requests', { data: { email, lang: 'de' } })).status()).toBe(204);
    await page.goto('/redaktion/beratungsanfragen');
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row.getByRole('link', { name: email })).toHaveAttribute('href', `mailto:${email}`);
    await expect(row).toContainText('Deutsch');
    await expect(row.locator('time')).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr$/);
    // Uhrzeit in deutscher Zeit
    const iso = await row.locator('time').getAttribute('datetime');
    const berlin = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso!));
    await expect(row.locator('time')).toContainText(berlin);

    await row.getByRole('button', { name: `Anfrage von ${email} löschen` }).click();
    await row.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(row).toBeVisible();
    expect((await requests(editor)).some((r) => r.email === email)).toBe(true);

    await row.getByRole('button', { name: `Anfrage von ${email} löschen` }).click();
    await row.getByRole('button', { name: `Anfrage von ${email} endgültig löschen` }).click();
    await expect(page.getByRole('status')).toHaveText(`Die Anfrage von ${email} wurde gelöscht.`);
    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
    expect((await requests(editor)).some((r) => r.email === email)).toBe(false);
  });

  test('REQ-27-AC6 REQ-27-AC7: Löschfehler, leere Liste und Ladefehler werden ausdrücklich angezeigt', async ({ page, request, editor }) => {
    const email = address();
    expect((await request.post('/api/consultation-requests', { data: { email, lang: 'de' } })).status()).toBe(204);
    await page.goto('/redaktion/beratungsanfragen');
    await page.route('**/api/admin/consultation-requests/*', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: `Anfrage von ${email} löschen` }).click();
    await row.getByRole('button', { name: `Anfrage von ${email} endgültig löschen` }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'wurde nicht gelöscht' })).toBeVisible();
    await expect(row).toBeVisible();
    const stored = (await requests(editor)).find((r) => r.email === email)!;
    await editor.send('DELETE', `/api/admin/consultation-requests/${stored.id}`);

    await page.unrouteAll();
    await page.route('**/api/admin/consultation-requests', (r) => r.fulfill({ json: { items: [] } }));
    await page.reload();
    await expect(page.getByText('Es liegen keine offenen Anfragen vor.')).toBeVisible();
    await page.unrouteAll();
    await page.route('**/api/admin/consultation-requests', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Die Anfragen konnten nicht geladen werden.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  });
});

test('REQ-27-AC5: Anfragenseite ohne Sitzung führt zur Anmeldung', async ({ page }) => {
  await page.goto('/redaktion/beratungsanfragen');
  await expect(page).toHaveURL(/\/redaktion\/anmelden/);
});

test('REQ-27-AC8: englisches Formular mit englischen Fehlern, Absenden per Tastatur', async ({ page, editor }) => {
  await completeAssessment(page, 'en');
  const field = page.locator('section.consult').getByLabel('Email address');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(field).toHaveAccessibleDescription(/^Please enter your email address\./);
  const email = address();
  await field.focus();
  await page.keyboard.type(email);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Thank you for your request' })).toBeFocused();
  const stored = (await requests(editor)).find((r) => r.email === email)!;
  expect(stored.lang).toBe('en');
  await editor.send('DELETE', `/api/admin/consultation-requests/${stored.id}`);
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test('REQ-27-AC8: Anfrage auf 375 px bedienbar, Verwaltung erreichbar', async ({ page, browser, baseURL, extraHTTPHeaders }) => {
    await completeAssessment(page, 'de');
    const field = page.locator('section.consult').getByLabel('E-Mail-Adresse');
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeInViewport();
    await expectNoHorizontalScroll(page);

    const ctx = await browser.newContext({ baseURL, storageState: AUTH.editor, viewport: { width: 375, height: 812 }, extraHTTPHeaders });
    const admin = await ctx.newPage();
    await admin.goto('/redaktion/beratungsanfragen');
    await expect(admin.getByRole('heading', { name: 'Beratungsanfragen' })).toBeVisible();
    await ctx.close();
  });
});

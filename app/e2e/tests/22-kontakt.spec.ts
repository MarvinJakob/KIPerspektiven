import type { Page } from '@playwright/test';
import { AUTH, expect, expectNoHorizontalScroll, test, uid, type Session } from '../support/fixtures';

// Anforderung #22: Kontaktformular absenden und Nachrichten in der Redaktion lesen.
interface Message {
  id: number;
  name: string;
  company: string;
  email: string;
  message: string;
  lang: string;
  receivedAt: string;
}
const inbox = async (s: Session) => ((await (await s.get('/api/admin/contact-messages')).json()) as { items: Message[] }).items;

async function fill(page: Page, v: { name?: string; company?: string; email?: string; message?: string }, en = false) {
  if (v.name !== undefined) await page.getByLabel('Name').fill(v.name);
  if (v.company !== undefined) await page.getByLabel(en ? 'Company (optional)' : 'Unternehmen (optional)').fill(v.company);
  if (v.email !== undefined) await page.getByLabel(en ? 'Email address' : 'E-Mail-Adresse').fill(v.email);
  if (v.message !== undefined) await page.getByLabel(en ? 'Message' : 'Nachricht').fill(v.message);
}

test('REQ-22-AC1: Pflichtfelder Name, E-Mail und Nachricht, Unternehmen freiwillig, Verweis zum Datenschutz', async ({ page }) => {
  await page.goto('/de/kontakt');
  for (const label of ['Name', 'E-Mail-Adresse', 'Nachricht']) await expect(page.getByLabel(label)).toHaveAttribute('required', '');
  await expect(page.getByLabel('Unternehmen (optional)')).not.toHaveAttribute('required', '');
  await expect(page.getByRole('link', { name: 'Mehr dazu in der Datenschutzerklärung' })).toHaveAttribute('href', '/de/datenschutz');
});

test('REQ-22-AC2: gültige Nachricht wird gespeichert, Bestätigung ersetzt das Formular und erhält den Fokus', async ({ page, editor }) => {
  const tag = uid();
  await page.goto('/de/kontakt');
  await fill(page, { name: `Ada ${tag}`, company: 'Analytical Engines', email: ` Ada.${tag}@Example.org `, message: `Hallo ${tag}` });
  await page.getByRole('button', { name: 'Nachricht senden' }).click();

  const done = page.getByRole('heading', { name: 'Vielen Dank für deine Nachricht' });
  await expect(done).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveCount(0); // Formular ist ersetzt
  const stored = (await inbox(editor)).find((m) => m.name === `Ada ${tag}`);
  expect(stored).toMatchObject({ company: 'Analytical Engines', email: `ada.${tag}@example.org`, message: `Hallo ${tag}`, lang: 'de' });
});

test('REQ-22-AC3: fehlende Angaben und ungültige Adresse zeigen Feldfehler, Fokus auf erstes Feld, nichts wird gespeichert', async ({ page, editor, request }) => {
  const tag = uid();
  await page.goto('/de/kontakt');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.getByLabel('Name')).toBeFocused();
  for (const [label, text] of [
    ['Name', 'Bitte gib deinen Namen ein.'],
    ['E-Mail-Adresse', 'Bitte gib deine E-Mail-Adresse ein.'],
    ['Nachricht', 'Bitte gib eine Nachricht ein.'],
  ]) {
    await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel(label)).toHaveAccessibleDescription(text);
  }

  await fill(page, { name: `Grace ${tag}`, company: 'Navy', email: 'grace@', message: `Text ${tag}` });
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.getByLabel('E-Mail-Adresse')).toBeFocused();
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveAccessibleDescription('Bitte gib eine gültige E-Mail-Adresse ein, zum Beispiel name@beispiel.de.');
  await expect(page.getByLabel('Name')).toHaveValue(`Grace ${tag}`);
  await expect(page.getByLabel('Unternehmen (optional)')).toHaveValue('Navy');
  await expect(page.getByLabel('Nachricht')).toHaveValue(`Text ${tag}`);

  // Auch das Backend lehnt ab
  for (const data of [
    { name: '', email: `x${tag}@example.org`, message: 'x', lang: 'de' },
    { name: `Grace ${tag}`, email: 'grace@', message: 'x', lang: 'de' },
    { name: `Grace ${tag}`, email: `x${tag}@example.org`, message: '  ', lang: 'de' },
  ]) {
    expect((await request.post('/api/contact-messages', { data })).status()).toBe(422);
  }
  expect((await inbox(editor)).some((m) => m.name.includes(tag) || m.message.includes(tag))).toBe(false);
});

test('REQ-22-AC4: Eingaben werden begrenzt und zu lange Angaben serverseitig abgelehnt', async ({ page, request, editor }) => {
  await page.goto('/de/kontakt');
  const limits: [string, number][] = [['Name', 200], ['Unternehmen (optional)', 200], ['E-Mail-Adresse', 254], ['Nachricht', 5000]];
  for (const [label, max] of limits) {
    const field = page.getByLabel(label);
    await field.fill('a'.repeat(max + 10));
    expect((await field.inputValue()).length, label).toBe(max);
  }

  const tag = uid();
  const ok = { name: 'n'.repeat(200), company: 'c'.repeat(200), email: `${tag}@example.org`, message: `${tag}${'m'.repeat(5000 - tag.length)}`, lang: 'de' };
  expect((await request.post('/api/contact-messages', { data: ok })).status()).toBe(204);
  for (const tooLong of [
    { ...ok, name: 'n'.repeat(201) },
    { ...ok, company: 'c'.repeat(201) },
    { ...ok, email: `${'e'.repeat(243)}@example.org` },
    { ...ok, message: 'm'.repeat(5001) },
  ]) {
    expect((await request.post('/api/contact-messages', { data: tooLong })).status()).toBe(422);
  }
  expect((await inbox(editor)).filter((m) => m.email === `${tag}@example.org`)).toHaveLength(1);
});

test('REQ-22-AC5: Server-, Netz- und Ratenfehler zeigen eine Meldung ohne Bestätigung, Eingaben bleiben erhalten', async ({ page }) => {
  await page.goto('/de/kontakt');
  await fill(page, { name: 'Ada', email: 'ada@example.org', message: 'Hallo' });
  const cases: [string, (r: import('@playwright/test').Route) => Promise<void>, string][] = [
    ['500', (r) => r.fulfill({ status: 500, json: { message: 'x' } }), 'Deine Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.'],
    ['Netz', (r) => r.abort('failed'), 'Deine Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.'],
    ['429', (r) => r.fulfill({ status: 429, json: { message: 'x' } }), 'Von deinem Anschluss sind gerade zu viele Nachrichten eingegangen. Bitte versuche es später erneut.'],
  ];
  for (const [name, handler, text] of cases) {
    await page.route('**/api/contact-messages', handler);
    await page.getByRole('button', { name: 'Nachricht senden' }).click();
    await expect(page.getByRole('alert'), name).toHaveText(text);
    await expect(page.getByRole('heading', { name: 'Vielen Dank für deine Nachricht' })).toHaveCount(0);
    await expect(page.getByLabel('Nachricht')).toHaveValue('Hallo');
    await page.unrouteAll();
  }
});

test('REQ-22-AC6: Eingang nur mit Sitzung, neueste zuerst', async ({ request, editor, admin }) => {
  expect((await request.get('/api/admin/contact-messages')).status()).toBe(401);
  const tag = uid();
  for (const n of [1, 2]) {
    const data = { name: `Absender ${n} ${tag}`, email: `${n}.${tag}@example.org`, message: `Nachricht ${n}`, lang: 'en' };
    expect((await request.post('/api/contact-messages', { data })).status()).toBe(204);
  }
  for (const s of [editor, admin]) {
    const mine = (await inbox(s)).filter((m) => m.name.endsWith(tag));
    expect(mine.map((m) => m.name)).toEqual([`Absender 2 ${tag}`, `Absender 1 ${tag}`]);
  }
});

test.describe('Nachrichteneingang in der Redaktion', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-22-AC6: Nachrichten mit Name, Unternehmen, Adresse, Text und Eingang; Leerzustand und Ladefehler', async ({ page, request }) => {
    const tag = uid();
    const data = { name: `Linus ${tag}`, email: `linus.${tag}@example.org`, message: `Frage ${tag}`, lang: 'de' };
    expect((await request.post('/api/contact-messages', { data })).status()).toBe(204);
    await page.goto('/redaktion/nachrichten');
    const item = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `Linus ${tag}` }) });
    await expect(item).toContainText('Nicht angegeben'); // ohne Unternehmen
    await expect(item.getByRole('link', { name: `linus.${tag}@example.org` })).toHaveAttribute('href', `mailto:linus.${tag}@example.org`);
    await expect(item).toContainText(`Frage ${tag}`);
    await expect(item.locator('time')).toContainText(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr/);

    await page.route('**/api/admin/contact-messages', (r) => r.fulfill({ json: { items: [] } }));
    await page.reload();
    await expect(page.getByText('Es liegen keine Nachrichten vor.')).toBeVisible();
    await page.unrouteAll();
    await page.route('**/api/admin/contact-messages', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Die Nachrichten konnten nicht geladen werden.');
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  });
});

test('REQ-22-AC6: Nachrichtenseite ohne Sitzung führt zur Anmeldung', async ({ page }) => {
  await page.goto('/redaktion/nachrichten');
  await expect(page).toHaveURL(/\/redaktion\/anmelden/);
});

test('REQ-22-AC7: englische Beschriftungen und Fehler, Absenden per Tastatur', async ({ page, editor }) => {
  const tag = uid();
  await page.goto('/en/kontakt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByLabel('Name')).toHaveAccessibleDescription('Please enter your name.');
  await expect(page.getByLabel('Email address')).toHaveAccessibleDescription('Please enter your email address.');
  await expect(page.getByLabel('Message')).toHaveAccessibleDescription('Please enter a message.');

  await fill(page, { name: `Key ${tag}`, email: `key.${tag}@example.org` }, true);
  await page.getByLabel('Message').focus();
  await page.keyboard.type(`Keyboard ${tag}`);
  await page.keyboard.press('Tab'); // Hinweis-Link
  await page.keyboard.press('Tab'); // Senden
  await expect(page.getByRole('button', { name: 'Send message' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Thank you for your message' })).toBeFocused();
  expect((await inbox(editor)).find((m) => m.name === `Key ${tag}`)?.lang).toBe('en');
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test('REQ-22-AC7: Formular auf 375 px ohne horizontalen Bildlauf bedienbar', async ({ page }) => {
    await page.goto('/de/kontakt');
    await expectNoHorizontalScroll(page);
    for (const label of ['Name', 'Unternehmen (optional)', 'E-Mail-Adresse', 'Nachricht']) await expect(page.getByLabel(label)).toBeVisible();
    await page.getByRole('button', { name: 'Nachricht senden' }).tap();
    await expect(page.getByLabel('Name')).toBeFocused();
  });
});

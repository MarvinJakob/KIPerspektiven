// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Contact.tsx app/frontend/src/pages/Legal.tsx app/frontend-redaktion/src/pages/ContactMessages.tsx
import type { Page } from '@playwright/test';
import { AUTH, expect, test, uid, type Session } from '../support/fixtures';

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

test('REQ-22-AC2: gültige Nachricht wird gespeichert, Bestätigung ersetzt das Formular und erhält den Fokus', async ({ page, marketing }) => {
  const tag = uid();
  await page.goto('/de/kontakt');
  await fill(page, { name: `Ada ${tag}`, company: 'Analytical Engines', email: ` Ada.${tag}@Example.org `, message: `Hallo ${tag}` });
  await page.getByRole('button', { name: 'Nachricht senden' }).click();

  const done = page.getByRole('heading', { name: 'Vielen Dank für deine Nachricht' });
  await expect(done).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveCount(0); // Formular ist ersetzt
  const stored = (await inbox(marketing)).find((m) => m.name === `Ada ${tag}`);
  expect(stored).toMatchObject({ company: 'Analytical Engines', email: `ada.${tag}@example.org`, message: `Hallo ${tag}`, lang: 'de' });
});

test('REQ-22-AC3: fehlende Angaben und ungültige Adresse zeigen Feldfehler, Fokus auf erstes Feld, nichts wird gespeichert', async ({ page, marketing, request }) => {
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
  expect((await inbox(marketing)).some((m) => m.name.includes(tag) || m.message.includes(tag))).toBe(false);
});

test('REQ-22-AC6: Eingang nur mit Sitzung, neueste zuerst', async ({ request, marketing, admin }) => {
  expect((await request.get('/api/admin/contact-messages')).status()).toBe(401);
  const tag = uid();
  for (const n of [1, 2]) {
    const data = { name: `Absender ${n} ${tag}`, email: `${n}.${tag}@example.org`, message: `Nachricht ${n}`, lang: 'en' };
    expect((await request.post('/api/contact-messages', { data })).status()).toBe(204);
  }
  for (const s of [marketing, admin]) {
    const mine = (await inbox(s)).filter((m) => m.name.endsWith(tag));
    expect(mine.map((m) => m.name)).toEqual([`Absender 2 ${tag}`, `Absender 1 ${tag}`]);
  }
});

test.describe('Nachrichteneingang in der Redaktion', () => {
  test.use({ storageState: AUTH.marketing });

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

// REQ-4 Kontaktseite mit Nachrichtenformular und Eingang im Redaktionssystem – Spezifikation: specs/REQ-4.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Locator, type Page } from '@playwright/test';

type Lang = 'de' | 'en';

const TEXT = {
  de: {
    link: 'Kontakt',
    name: /^(dein |ihr )?name\b/i,
    company: /unternehmen|firma/i,
    email: /e-mail/i,
    message: /nachricht/i,
    submit: /senden/i,
    error: /bitte|angeben|eingeben|ausfüllen|pflicht|erforderlich|fehlt|gültig/i,
    confirmation: /danke|gesendet|übermittelt|erhalten|eingegangen/i,
  },
  en: {
    link: 'Contact',
    name: /^(your )?name\b/i,
    company: /company|organi[sz]ation/i,
    email: /e-?mail/i,
    message: /message/i,
    submit: /send|submit/i,
    error: /please|enter|provide|required|missing|valid/i,
    confirmation: /thank|sent|received|submitted/i,
  },
} as const;

const GERMAN_WORDS = /bitte|eingeben|angeben|pflicht|gültig/i;

const ACCOUNTS = {
  editor: { email: 'redaktion@example.test', password: 'redaktion-test' },
  admin: { email: 'admin@example.test', password: 'admin-test-123' },
} as const;

/** Eindeutige Kennung je Test, damit parallele Läufe und Wiederholungen sich nicht stören. */
function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Öffnet bei schmaler Ansicht das Hauptmenü, falls das gesuchte Element darin verborgen ist. */
async function revealInMenu(page: Page, target: Locator): Promise<Locator> {
  if ((await target.filter({ visible: true }).count()) === 0) {
    const menu = page.getByRole('button', { name: /^(menü|menu)$/i }).filter({ visible: true });
    if ((await menu.count()) > 0) await menu.first().click();
  }
  const visible = target.filter({ visible: true }).first();
  await expect(visible).toBeVisible();
  return visible;
}

function fields(page: Page, lang: Lang) {
  const t = TEXT[lang];
  return {
    name: page.getByRole('textbox', { name: t.name }),
    company: page.getByRole('textbox', { name: t.company }),
    email: page.getByRole('textbox', { name: t.email }),
    message: page.getByRole('textbox', { name: t.message }),
    submit: page.getByRole('button', { name: t.submit }),
  };
}

/** Folgt von der Startseite dem Kontakt-Link und gibt die URL der Kontaktseite zurück. */
async function openContactPage(page: Page, lang: Lang): Promise<string> {
  await page.goto(`/${lang}`);
  const link = await revealInMenu(page, page.getByRole('link', { name: TEXT[lang].link, exact: true }));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/`));
  await expect(fields(page, lang).message).toBeVisible();
  return page.url();
}

async function expectContactForm(page: Page, lang: Lang) {
  const f = fields(page, lang);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  for (const field of [f.name, f.company, f.email, f.message, f.submit]) {
    await expect(field).toBeVisible();
  }
}

async function expectFieldError(field: Locator, error: RegExp) {
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(error);
}

async function expectFieldValid(field: Locator) {
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
}

function visibleCount(page: Page, text: RegExp): Promise<number> {
  return page.getByText(text).filter({ visible: true }).count();
}

async function submitMessage(
  page: Page,
  lang: Lang,
  data: { name: string; email: string; message: string; company?: string },
) {
  const f = fields(page, lang);
  await f.name.fill(data.name);
  if (data.company) await f.company.fill(data.company);
  await f.email.fill(data.email);
  await f.message.fill(data.message);
  const before = await visibleCount(page, TEXT[lang].confirmation);
  await f.submit.click();
  await expect.poll(() => visibleCount(page, TEXT[lang].confirmation)).toBeGreaterThan(before);
}

function testMessage(id: string) {
  return {
    name: `Fidelity Kontakt ${id}`,
    company: `Testfirma ${id} GmbH`,
    email: `kontakt-${id}@example.test`,
    message: `Testnachricht ${id}: Bitte meldet euch zu einem Austausch über KI-Projekte.`,
  };
}

async function login(page: Page, account: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[account];
  await page.goto('/redaktion/anmelden');
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).not.toHaveURL(/\/anmelden/);
}

async function openMessages(page: Page) {
  const link = await revealInMenu(page, page.getByRole('link', { name: /nachricht|kontakt/i }));
  await link.click();
  await expect(page).toHaveURL(/\/redaktion\//);
}

test('REQ-4-AC1 Deutsche Kontaktseite ist über die Website erreichbar', async ({ page, request }) => {
  const url = await openContactPage(page, 'de');
  await expectContactForm(page, 'de');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontaler Überlauf in Pixeln').toBeLessThanOrEqual(0);
  expect((await request.get(url)).status()).toBe(200);
});

test('REQ-4-AC2 Englische Kontaktseite ist über die Website erreichbar', async ({ page, request }) => {
  const url = await openContactPage(page, 'en');
  await expectContactForm(page, 'en');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontaler Überlauf in Pixeln').toBeLessThanOrEqual(0);
  expect((await request.get(url)).status()).toBe(200);
});

test('REQ-4-AC3 Sprachwechsel führt zur englischen Kontaktseite', async ({ page }) => {
  await openContactPage(page, 'de');
  const english = await revealInMenu(page, page.getByRole('button', { name: 'English', exact: true }));
  await english.click();
  await expect(page).toHaveURL(/\/en\//);
  await expectContactForm(page, 'en');
});

test('REQ-4-AC4 Fehlende Pflichtangaben werden auf Deutsch angezeigt', async ({ page }) => {
  await openContactPage(page, 'de');
  const f = fields(page, 'de');
  for (const field of [f.name, f.email, f.message]) await expectFieldValid(field);
  const before = await visibleCount(page, TEXT.de.confirmation);

  await f.submit.click();

  for (const field of [f.name, f.email, f.message]) await expectFieldError(field, TEXT.de.error);
  await expect(page.getByText(TEXT.de.error).filter({ visible: true }).first()).toBeVisible();
  await expectFieldValid(f.company);
  expect(await visibleCount(page, TEXT.de.confirmation)).toBe(before);
});

test('REQ-4-AC5 Ungültige E-Mail-Adresse wird angezeigt, Eingaben bleiben erhalten', async ({ page }) => {
  await openContactPage(page, 'de');
  const f = fields(page, 'de');
  const data = testMessage(uniqueId());
  await f.name.fill(data.name);
  await f.email.fill('max.mustermann@');
  await f.message.fill(data.message);
  const before = await visibleCount(page, TEXT.de.confirmation);

  await f.submit.click();

  await expectFieldError(f.email, TEXT.de.error);
  await expectFieldValid(f.name);
  await expectFieldValid(f.message);
  await expect(f.name).toHaveValue(data.name);
  await expect(f.email).toHaveValue('max.mustermann@');
  await expect(f.message).toHaveValue(data.message);
  expect(await visibleCount(page, TEXT.de.confirmation)).toBe(before);
});

test('REQ-4-AC6 Fehlermeldungen der englischen Seite sind auf Englisch', async ({ page }) => {
  await openContactPage(page, 'en');
  const f = fields(page, 'en');

  await f.submit.click();

  for (const field of [f.name, f.email, f.message]) {
    await expectFieldError(field, TEXT.en.error);
    await expect(field).not.toHaveAccessibleDescription(GERMAN_WORDS);
  }
});

test('REQ-4-AC7 Absenden ohne Unternehmen zeigt eine deutsche Bestätigung', async ({ page }) => {
  await openContactPage(page, 'de');
  const { company: _company, ...data } = testMessage(uniqueId());

  await submitMessage(page, 'de', data);

  // Bleibt das Formular nach dem Absenden stehen, ist kein Feld als ungültig markiert.
  const f = fields(page, 'de');
  for (const field of [f.name, f.company, f.email, f.message]) {
    if ((await field.count()) > 0) await expectFieldValid(field);
  }
});

test('REQ-4-AC8 Absenden auf der englischen Seite zeigt eine englische Bestätigung', async ({ page }) => {
  await openContactPage(page, 'en');
  await submitMessage(page, 'en', testMessage(uniqueId()));
});

test('REQ-4-AC9 Nachricht ist für editor und admin in der Redaktion einsehbar', async ({ page }) => {
  const data = testMessage(uniqueId());
  await openContactPage(page, 'de');
  await submitMessage(page, 'de', data);

  for (const account of ['editor', 'admin'] as const) {
    await page.context().clearCookies();
    await login(page, account);
    await openMessages(page);
    for (const value of [data.name, data.company, data.email, data.message]) {
      await expect(page.getByText(value, { exact: false }).first(), `${account}: ${value}`).toBeVisible();
    }
  }
});

test('REQ-4-AC10 Ohne Anmeldung sind Nachrichten nicht einsehbar', async ({ page, request }) => {
  const data = testMessage(uniqueId());
  await openContactPage(page, 'de');
  await submitMessage(page, 'de', data);

  // Angemeldet: Seite und Datenabrufe merken, die die Nachricht liefern
  const dataRequests = new Set<string>();
  page.on('response', async (response) => {
    const type = response.request().resourceType();
    if (response.request().method() !== 'GET' || (type !== 'fetch' && type !== 'xhr')) return;
    const body = await response.text().catch(() => '');
    if (body.includes(data.email)) dataRequests.add(response.url());
  });
  await login(page, 'editor');
  await openMessages(page);
  await expect(page.getByText(data.email).first()).toBeVisible();
  const messagesUrl = page.url();
  expect(dataRequests.size, 'Datenabruf mit der Nachricht').toBeGreaterThan(0);

  // Ohne Sitzung: Seite führt zur Anmeldung, Datenabrufe sind gesperrt
  await page.context().clearCookies();
  await page.goto(messagesUrl);
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText(data.email)).toHaveCount(0);
  for (const url of dataRequests) {
    const response = await request.get(url);
    expect([401, 403], `Status von ${url}`).toContain(response.status());
    expect(await response.text()).not.toContain(data.email);
  }
});

// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/AccountLogin.tsx app/frontend-redaktion/src/pages/Login.tsx
import type { BrowserContext, Page } from '@playwright/test';
import { ACCOUNTS, expect, test, uid } from '../support/fixtures';

// Anforderung #109: Redaktionsanmeldung im Dialog öffnen und Anmeldeseite für Direktaufrufe erhalten.
// Feature „Anmeldung“ (app/docs/testbestand.md): Hauptablauf im Dialog, wichtigste Fehlermeldung und Direktaufruf.
// Sollwerte stammen aus der Spezifikation im Ticket. Texte DE/EN und Meldung je Ablehnungsgrund prüfen
// app/frontend/src/lib/editorialLogin.test.ts und app/frontend/src/components/AccountLogin.test.tsx, den Schutz
// aller Redaktionsseiten und die Startseite je Rolle app/backend/internal/web/editorial_direct_test.go.
// Englisch, 375 px, reine Tastaturbedienung, die Rollen Admin und Marketing sowie unbekanntes und deaktiviertes
// Konto sind bei der Umsetzung einmalig geprüft und im Ticket nachgewiesen (AGENTS.md, Abschnitt 2).

const TEXT = {
  account: 'Anmeldung für die Redaktion',
  title: 'Anmelden',
  email: 'E-Mail-Adresse',
  password: 'Passwort',
  close: 'Schließen',
  submit: 'Anmelden',
  invalid:
    'E-Mail-Adresse oder Passwort ist falsch, oder das Konto ist deaktiviert. Bitte Eingaben prüfen oder an die Administration wenden.',
} as const;

/** Startseite der Redaktion für Redakteure (Rollentabelle aus #64). */
const EDITOR_START = /\/redaktion$/;

const ui = (page: Page) => {
  const dialog = page.getByRole('dialog', { name: TEXT.title });
  return {
    account: page.getByRole('button', { name: TEXT.account }),
    dialog,
    email: dialog.getByLabel(TEXT.email),
    password: dialog.getByLabel(TEXT.password, { exact: true }),
    close: dialog.getByRole('button', { name: TEXT.close }),
    submit: dialog.getByRole('button', { name: TEXT.submit, exact: true }),
    alert: dialog.getByRole('alert'),
  };
};

type Marked = { __seite109?: boolean };
/** Die Marke am geladenen Dokument überlebt nur, solange die Seite nicht neu geladen oder verlassen wird. */
const stillSamePage = async (page: Page, url: string) => {
  expect(page.url(), 'URL bleibt erhalten').toBe(url);
  expect(await page.evaluate(() => (window as unknown as Marked).__seite109), 'Seite wurde nicht neu geladen oder verlassen').toBe(true);
};
const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === 'ki_session');

/** Öffnet eine öffentliche Seite und den Anmeldedialog; liefert die URL der Seite. */
async function openDialog(page: Page) {
  await page.goto('/de/blog');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => void ((window as unknown as Marked).__seite109 = true));
  const url = page.url();
  const u = ui(page);
  await u.account.click();
  await expect(u.dialog).toBeVisible();
  return { url, ...u };
}

/** Sendet die Anmeldung; `503` (Passwortprüfung ausgelastet, #138) zählt nicht als Fehlversuch und wird wiederholt. */
async function submitLogin(page: Page, submit: () => Promise<void>) {
  for (let i = 0; ; i++) {
    const res = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST');
    await submit();
    const status = (await res).status();
    if (status !== 503 || i >= 10) return status;
    await page.waitForTimeout(1000);
  }
}

test('REQ-109-AC1 REQ-109-AC2: Kontosymbol öffnet den Anmeldedialog auf derselben Seite; Schließen und Escape geben den Fokus zurück', async ({ page, context }) => {
  const { url, account, dialog, email, password, close, submit } = await openDialog(page);

  await expect(email).toBeFocused();
  await expect(password, 'Passwort ist maskiert').toHaveAttribute('type', 'password');
  await expect(close).toBeVisible();
  await expect(submit).toBeVisible();
  await stillSamePage(page, url);
  expect(new URL(url).pathname).toBe('/de/blog');
  await expect(page.locator('main h1'), 'Inhalt der Seite bleibt hinter dem Dialog erhalten').toBeVisible();

  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(account, 'Fokus kehrt zum Kontosymbol zurück').toBeFocused();
  await stillSamePage(page, url);

  await account.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(account, 'Fokus kehrt nach Escape zum Kontosymbol zurück').toBeFocused();
  await stillSamePage(page, url);
  expect(await sessionCookie(context), 'Öffnen und Schließen setzen kein Sitzungscookie').toBeUndefined();
});

test('REQ-109-AC3: Anmeldung im Dialog erstellt eine Sitzung und öffnet die Startseite der Rolle', async ({ page, context }) => {
  const { email, password } = await openDialog(page);
  await email.fill(ACCOUNTS.editor.email);
  await password.fill(ACCOUNTS.editor.password);
  expect(await submitLogin(page, () => page.keyboard.press('Enter'))).toBe(200);

  await expect(page).toHaveURL(EDITOR_START);
  expect(await sessionCookie(context), 'Sitzungscookie ist gesetzt').toBeDefined();
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(((await me.json()) as { email: string }).email).toBe(ACCOUNTS.editor.email);
  await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toHaveCount(0);
});

test('REQ-109-AC3: abgelehnte Anmeldung zeigt eine Meldung, der Dialog bleibt offen und es entsteht keine Sitzung', async ({ page, context }) => {
  const { url, dialog, email, password, submit, alert } = await openDialog(page);
  await email.fill(ACCOUNTS.editor.email);
  await password.fill(`falsch-${uid()}`);
  expect(await submitLogin(page, () => submit.click())).toBe(401);

  await expect(alert).toHaveText(TEXT.invalid);
  await expect(dialog, 'Dialog bleibt offen').toBeVisible();
  await expect(email, 'Eingabe bleibt zum Korrigieren erhalten').toHaveValue(ACCOUNTS.editor.email);
  await stillSamePage(page, url);
  expect(await sessionCookie(context), 'abgelehnte Anmeldung erzeugt keine Sitzung').toBeUndefined();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});

test('REQ-109-AC4: Direktaufruf von /redaktion zeigt ohne Sitzung die eigenständige Anmeldeseite und führt mit Sitzung in die Redaktion', async ({ page, context }) => {
  await page.goto('/redaktion');
  await expect(page).toHaveURL(/\/redaktion\/anmelden$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  // Eigenständige Seite des Redaktionsfrontends: kein Dialog, keine öffentliche Kopfzeile
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.site-header')).toHaveCount(0);
  expect(await sessionCookie(context)).toBeUndefined();
  expect((await page.request.get('/api/admin/posts')).status(), 'Redaktionsfunktion ist ohne Sitzung geschützt').toBe(401);

  await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.editor.email);
  await page.getByLabel('Passwort', { exact: true }).fill(ACCOUNTS.editor.password);
  expect(await submitLogin(page, () => page.getByRole('button', { name: 'Anmelden' }).click())).toBe(200);
  await expect(page).toHaveURL(EDITOR_START);
  expect((await page.request.get('/api/admin/posts')).status(), 'Redaktionsfunktion ist nach der Anmeldung nutzbar').toBe(200);

  // Mit gültiger Sitzung: Direktaufruf bleibt in der Redaktion, gesperrte Bereiche bleiben gesperrt
  const direct = await page.goto('/redaktion');
  expect(direct?.status()).toBe(200);
  await expect(page).toHaveURL(EDITOR_START);
  expect((await page.goto('/redaktion/benutzer'))?.status(), 'Benutzerverwaltung bleibt Admins vorbehalten').toBe(403);

  // Annahme A1: Das Kontosymbol führt mit bestehender Sitzung ohne Dialog in die Redaktion
  await page.goto('/de/blog');
  await page.getByRole('button', { name: TEXT.account }).click();
  await expect(page).toHaveURL(EDITOR_START);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

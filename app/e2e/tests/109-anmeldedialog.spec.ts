// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/AccountLogin.tsx app/frontend-redaktion/src/pages/Login.tsx
import type { BrowserContext, Page } from '@playwright/test';
import { ACCOUNTS, AUTH, expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test, uid } from '../support/fixtures';

// Anforderung #109: Redaktionsanmeldung im Dialog öffnen und Anmeldeseite für Direktaufrufe erhalten.
// Sollwerte (Texte, Startseiten je Rolle) stammen aus der Spezifikation im Ticket.
// Unit-Tests: app/frontend/src/lib/editorialLogin.test.ts, app/backend/internal/web/editorial_direct_test.go.
// Komponententests mit simulierter API: app/frontend/src/components/AccountLogin.test.tsx.

const TEXT = {
  de: {
    account: 'Anmeldung für die Redaktion',
    title: 'Anmelden',
    intro: 'Der Zugang ist Mitgliedern der Redaktion vorbehalten. Konten richtet die Administration ein.',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    close: 'Schließen',
    submit: 'Anmelden',
    missing: 'Bitte E-Mail-Adresse und Passwort eingeben.',
    invalid:
      'E-Mail-Adresse oder Passwort ist falsch, oder das Konto ist deaktiviert. Bitte Eingaben prüfen oder an die Administration wenden.',
  },
  en: {
    account: 'Sign in for editors',
    title: 'Sign in',
    intro: 'Access is reserved for members of the editorial team. Accounts are set up by the administrators.',
    email: 'Email address',
    password: 'Password',
    close: 'Close',
    submit: 'Sign in',
    missing: 'Please enter your email address and password.',
    invalid:
      'The email address or password is incorrect, or the account is deactivated. Please check your entries or contact the administrators.',
  },
} as const;
type Lang = keyof typeof TEXT;
const LANGS: Lang[] = ['de', 'en'];

/** Startseite der Redaktion je Rolle (Rollentabelle aus #64). */
const START = { admin: /\/redaktion\/benutzer$/, editor: /\/redaktion$/, marketing: /\/redaktion\/statistik$/ } as const;

const ui = (page: Page, lang: Lang) => {
  const T = TEXT[lang];
  const dialog = page.getByRole('dialog', { name: T.title });
  return {
    account: page.getByRole('button', { name: T.account }),
    dialog,
    email: dialog.getByLabel(T.email),
    password: dialog.getByLabel(T.password, { exact: true }),
    close: dialog.getByRole('button', { name: T.close }),
    submit: dialog.getByRole('button', { name: T.submit, exact: true }),
    alert: dialog.getByRole('alert'),
  };
};

/** Markiert das geladene Dokument. Die Marke überlebt nur, solange die Seite nicht neu geladen oder verlassen wird. */
const mark = (page: Page) => page.evaluate(() => void ((window as unknown as { __seite109?: boolean }).__seite109 = true));
const stillSamePage = async (page: Page, url: string) => {
  expect(page.url(), 'URL bleibt erhalten').toBe(url);
  expect(await page.evaluate(() => (window as unknown as { __seite109?: boolean }).__seite109), 'Seite wurde nicht neu geladen oder verlassen').toBe(true);
};
const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === 'ki_session');

/** Öffnet eine öffentliche Seite und den Anmeldedialog; liefert die URL der Seite. */
async function openDialog(page: Page, lang: Lang, path = `/${lang}/blog`) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await mark(page);
  const url = page.url();
  const u = ui(page, lang);
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

for (const lang of LANGS) {
  test(`REQ-109-AC1: Kontosymbol öffnet den Anmeldedialog auf derselben Seite (${lang})`, async ({ page, context }) => {
    const { url, dialog, email, password, close, submit } = await openDialog(page, lang);

    await expect(email).toBeVisible();
    await expect(email).toBeFocused();
    await expect(password).toBeVisible();
    await expect(password, 'Passwort ist maskiert').toHaveAttribute('type', 'password');
    await expect(close).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(dialog).toContainText(TEXT[lang].intro);

    await stillSamePage(page, url);
    expect(new URL(url).pathname).toBe(`/${lang}/blog`);
    await expect(page.locator('main h1'), 'Inhalt der Seite bleibt hinter dem Dialog erhalten').toBeVisible();
    expect(await sessionCookie(context), 'Öffnen des Dialogs setzt kein Sitzungscookie (Abgrenzung A2)').toBeUndefined();
  });

  test(`REQ-109-AC2: Schließen-Schaltfläche und Escape schließen den Dialog, Seite und Fokus bleiben (${lang})`, async ({ page, context }) => {
    const { url, account, dialog, email, close } = await openDialog(page, lang);
    await email.fill('jemand@example.test');
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
    expect(await sessionCookie(context)).toBeUndefined();
  });

  test(`REQ-109-AC2 REQ-109-AC3: Beschriftungen und Rückmeldungen folgen der Seitensprache; abgelehnte Anmeldung bleibt im Dialog (${lang})`, async ({ page, context }) => {
    const T = TEXT[lang];
    const { url, dialog, email, password, submit, alert } = await openDialog(page, lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);

    // Fehlende Eingaben: Meldung, keine Anfrage
    const sent: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/auth/login') sent.push(r.method());
    });
    await submit.click();
    await expect(alert).toHaveText(T.missing);
    expect(sent, 'ohne Eingaben wird keine Anmeldung gesendet').toHaveLength(0);

    // Falsches Passwort eines bestehenden Kontos
    await email.fill(ACCOUNTS.editor.email);
    await password.fill(`falsch-${uid()}`);
    expect(await submitLogin(page, () => submit.click())).toBe(401);
    await expect(alert).toHaveText(T.invalid);
    await expect(dialog, 'Dialog bleibt offen').toBeVisible();
    await expect(email, 'Eingabe bleibt zum Korrigieren erhalten').toHaveValue(ACCOUNTS.editor.email);
    await stillSamePage(page, url);
    expect(await sessionCookie(context), 'abgelehnte Anmeldung erzeugt keine Sitzung').toBeUndefined();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  });
}

test('REQ-109-AC2: der Dialog ist vollständig per Tastatur bedienbar', async ({ page }) => {
  await page.goto('/de/blog');
  await mark(page);
  const url = page.url();
  const { account, dialog, email, password, close } = ui(page, 'de');

  await expectVisibleKeyboardFocus(page, account);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(email).toBeFocused();
  await page.keyboard.type('jemand@example.test');
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.type('irgendein-passwort');
  await expect(password).toHaveValue('irgendein-passwort');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expectVisibleKeyboardFocus(page, close);
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(account).toBeFocused();
  await stillSamePage(page, url);

  // Leertaste öffnet ebenfalls; der Fokus bleibt im Dialog, solange er offen ist
  await page.keyboard.press(' ');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const a = document.activeElement;
      return !a || a === document.body || !!a.closest('dialog');
    });
    expect(inside, `Tab ${i + 1}: Fokus verlässt den Dialog nicht in die Seite dahinter`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(account).toBeFocused();
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('REQ-109-AC2: Mobil 375 px – Dialog liegt vollständig im Fenster und ist per Antippen bedienbar', async ({ page }) => {
    await page.goto('/de/blog');
    await mark(page);
    const url = page.url();
    const { account, dialog, email, password, close, submit, alert } = ui(page, 'de');

    await account.tap();
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport({ ratio: 1 });
    for (const el of [email, password, close, submit]) {
      await expect(el).toBeInViewport({ ratio: 1 });
      const box = (await el.boundingBox())!;
      expect(box.height, 'ausreichende Trefferfläche').toBeGreaterThanOrEqual(44);
      // An seiner Mitte nicht von anderen Elementen verdeckt
      const hit = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && (top === node || node.contains(top));
      });
      expect(hit, 'Element ist nicht überlagert').toBe(true);
    }
    await expectNoHorizontalScroll(page);

    await submit.tap();
    await expect(alert).toHaveText(TEXT.de.missing);
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await expectNoHorizontalScroll(page);

    await close.tap();
    await expect(dialog).toHaveCount(0);
    await stillSamePage(page, url);
  });
});

for (const role of ['editor', 'admin', 'marketing'] as const) {
  test(`REQ-109-AC3: Anmeldung im Dialog als ${role} erstellt eine Sitzung und öffnet die Startseite der Rolle`, async ({ page, context }) => {
    const { email, password, submit } = await openDialog(page, role === 'admin' ? 'en' : 'de', role === 'marketing' ? '/de' : undefined);
    await email.fill(ACCOUNTS[role].email);
    await password.fill(ACCOUNTS[role].password);
    // Redakteur sendet mit Enter, die anderen über die Schaltfläche
    expect(await submitLogin(page, () => (role === 'editor' ? page.keyboard.press('Enter') : submit.click()))).toBe(200);

    await expect(page).toHaveURL(START[role]);
    expect(await sessionCookie(context), 'Sitzungscookie ist gesetzt').toBeDefined();
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(((await me.json()) as { email: string }).email).toBe(ACCOUNTS[role].email);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toHaveCount(0);
  });
}

test('REQ-109-AC3: unbekanntes und deaktiviertes Konto werden abgelehnt; der Dialog bleibt offen', async ({ page, context, admin }) => {
  const T = TEXT.de;
  const address = `dialog.${uid()}@example.test`;
  const secret = `start-${uid()}-${uid()}`;
  const created = await admin.send('POST', '/api/admin/users', { email: address, password: secret, roles: ['editor'] });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  expect((await admin.send('PATCH', `/api/admin/users/${id}`, { active: false })).status()).toBe(200);

  const { url, dialog, email, password, submit, alert } = await openDialog(page, 'de');
  for (const [who, mail, pass] of [
    ['unbekanntes Konto', `niemand.${uid()}@example.test`, 'irgendein-passwort'],
    ['deaktiviertes Konto mit richtigem Passwort', address, secret],
  ]) {
    await email.fill(mail);
    await password.fill(pass);
    expect(await submitLogin(page, () => submit.click()), who).toBe(401);
    await expect(alert, who).toHaveText(T.invalid);
    await expect(dialog, who).toBeVisible();
    await stillSamePage(page, url);
    expect(await sessionCookie(context), who).toBeUndefined();
  }
});

test('REQ-109-AC4: Direktaufruf von /redaktion ohne Sitzung zeigt die eigenständige Anmeldeseite; die Anmeldung führt in die Redaktion der Rolle', async ({ page, context }) => {
  await page.goto('/redaktion');
  await expect(page).toHaveURL(/\/redaktion\/anmelden$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  // Eigenständige Seite des Redaktionsfrontends: kein Dialog, keine öffentliche Kopfzeile
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: TEXT.de.account })).toHaveCount(0);
  expect(await sessionCookie(context)).toBeUndefined();

  await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.editor.email);
  await page.getByLabel('Passwort', { exact: true }).fill(ACCOUNTS.editor.password);
  expect(await submitLogin(page, () => page.getByRole('button', { name: 'Anmelden' }).click())).toBe(200);
  await expect(page).toHaveURL(START.editor);
  expect((await page.request.get('/api/admin/posts')).status(), 'Redaktionsfunktion ist nach der Anmeldung nutzbar').toBe(200);
});

test('REQ-109-AC4: ohne gültige Sitzung bleiben redaktionelle Inhalte und Funktionen geschützt', async ({ playwright, baseURL, ip }) => {
  const contexts = {
    'ohne Cookie': await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': ip } }),
    'mit ungültigem Cookie': await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { 'X-Forwarded-For': ip, Cookie: `ki_session=${uid()}${uid()}` },
    }),
  };
  try {
    for (const [who, ctx] of Object.entries(contexts)) {
      for (const path of ['/redaktion', '/redaktion/beitraege/neu', '/redaktion/statistik', '/redaktion/benutzer', '/redaktion/profil']) {
        const res = await ctx.get(path, { maxRedirects: 0 });
        expect(res.status(), `${path} ${who}`).toBe(303);
        expect(res.headers().location, `${path} ${who}`).toBe('/redaktion/anmelden');
      }
      for (const path of ['/api/admin/posts', '/api/admin/users', '/api/admin/contact-messages', '/api/auth/me', '/api/profile']) {
        expect((await ctx.get(path)).status(), `${path} ${who}`).toBe(401);
      }
      const write = await ctx.post('/api/admin/posts', { data: { featured: false, topics: [], texts: [] } });
      expect(write.status(), `POST /api/admin/posts ${who}`).toBe(401);
    }
  } finally {
    for (const ctx of Object.values(contexts)) await ctx.dispose();
  }
});

test.describe('mit gültiger Sitzung als Redakteur', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-109-AC4: Direktaufruf führt in die Redaktion gemäß den bestehenden Berechtigungen', async ({ page }) => {
    const res = await page.goto('/redaktion');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(START.editor);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Anmeldeseite mit Sitzung: weiter zur Startseite der Rolle
    await page.goto('/redaktion/anmelden');
    await expect(page).toHaveURL(START.editor);

    // Bereich ohne Berechtigung bleibt gesperrt
    const users = await page.goto('/redaktion/benutzer');
    expect(users?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
  });

  test('Annahme A1: Kontosymbol mit bestehender Sitzung öffnet ohne Dialog die Redaktion', async ({ page }) => {
    await page.goto('/de/blog');
    await page.getByRole('button', { name: TEXT.de.account }).click();
    await expect(page).toHaveURL(START.editor);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

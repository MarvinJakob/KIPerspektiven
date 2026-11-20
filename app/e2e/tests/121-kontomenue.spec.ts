// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/AccountMenu.tsx app/frontend-redaktion/src/pages/Login.tsx
import type { BrowserContext, Page } from '@playwright/test';
import { ACCOUNTS, AUTH, expect, test } from '../support/fixtures';

// Anforderung #121: Das Kontosymbol öffnet ein Menü mit Link zur Anmeldeseite der Redaktion. Es löst den
// Anmeldedialog aus #109 und #114 ab; REQ-109-AC4 (Direktaufruf von /redaktion) gilt weiter und wird hier mitgeprüft.
// Sollwerte stammen aus dem Ticket (Tabelle „Aufbau des Menüs“, „Fläche und Lage“, Akzeptanzkriterien).
// Anforderung #130 streicht Hinweis und Trennlinie aus dem Menü (REQ-130-AC1 bis -AC4); die Anmeldeseite behält
// ihren Einleitungstext (REQ-130-AC5).
// Englische Texte, den zugänglichen Namen des Eintrags und die einzelnen Schließwege prüft
// app/frontend/src/components/AccountMenu.test.tsx, die Startseite je Rolle
// app/backend/internal/web/editorial_direct_test.go.

const TEXT = {
  account: 'Anmeldung für die Redaktion',
  label: 'Redaktion',
  title: 'Anmelden',
  desc: 'Zur Anmeldeseite der Redaktion',
} as const;

/** Bis #130 Hinweis im Kontomenü; steht seitdem nur noch als Einleitung auf der Anmeldeseite (REQ-130-AC5). */
const SIGN_IN_INTRO = 'Der Zugang ist Mitgliedern der Redaktion vorbehalten. Konten richtet die Administration ein.';
/** Innenabstand der Menüfläche in px (Ticket #121, „Fläche und Lage“). */
const MENU_PADDING = 10;

/** Startseite der Redaktion für Redakteure (Rollentabelle aus #64). */
const EDITOR_START = /\/redaktion$/;
const SIGN_IN = /\/redaktion\/anmelden$/;

const ui = (page: Page) => {
  const account = page.getByRole('button', { name: TEXT.account });
  // Das Menü selbst ordnet aria-controls dem Kontosymbol zu (REQ-121-AC6), siehe expectOpen.
  return { account, link: page.locator('.site-header').getByRole('link', { name: /^Anmelden/ }) };
};

type Marked = { __seite121?: boolean };
/** Die Marke am geladenen Dokument überlebt nur, solange die Seite nicht neu geladen oder verlassen wird. */
const stillSamePage = async (page: Page, url: string) => {
  expect(page.url(), 'URL bleibt erhalten').toBe(url);
  expect(await page.evaluate(() => (window as unknown as Marked).__seite121), 'Seite wurde nicht neu geladen oder verlassen').toBe(true);
};
const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === 'ki_session');

async function openPage(page: Page, path = '/de/blog') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => void ((window as unknown as Marked).__seite121 = true));
  return page.url();
}

/** Das Menü ist vollständig eingeblendet (Deckkraft 1), nicht nur im DOM vorhanden. */
async function expectOpen(page: Page) {
  const { account, link } = ui(page);
  await expect(account).toHaveAttribute('aria-expanded', 'true');
  await expect(link).toBeVisible();
  const id = await account.getAttribute('aria-controls');
  await expect.poll(() => page.evaluate((i) => getComputedStyle(document.getElementById(i!)!).opacity, id)).toBe('1');
  return page.locator(`[id="${id}"]`);
}
async function expectClosed(page: Page) {
  const { account, link } = ui(page);
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await expect(link).toBeHidden();
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

test('REQ-130-AC1 REQ-130-AC3 REQ-121-AC1 REQ-121-AC3 REQ-121-AC6: Kontosymbol öffnet das Menü auf derselben Seite ohne Sitzungsabfrage; Symbol, Klick außerhalb, Fokuswechsel und Esc schließen es', async ({ page, context }) => {
  const authCalls: string[] = [];
  page.on('request', (r) => {
    const { pathname } = new URL(r.url());
    if (pathname.startsWith('/api/auth')) authCalls.push(`${r.method()} ${pathname}`);
  });
  const url = await openPage(page);
  const { account, link } = ui(page);
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await expect(link, 'geschlossen ist der Eintrag nicht sichtbar').toBeHidden();

  // REQ-130-AC1: genau Kennzeile, Eintrag und Zeile darunter; der Hinweis steht auch nicht mehr im Markup
  await account.click();
  const menu = await expectOpen(page);
  await expect(menu).toHaveText(new RegExp(`^\\s*${TEXT.label}\\s*${TEXT.title}\\s*${TEXT.desc}\\s*$`));
  expect(await menu.innerHTML(), 'Hinweis fehlt im Markup des Menüs').not.toContain('vorbehalten');
  // REQ-130-AC3: keine Beschreibung mehr, der Name nennt Eintrag und Zeile darunter
  await expect(link).not.toHaveAttribute('aria-describedby');
  await expect(link).toHaveAccessibleDescription('');
  await expect(link).toHaveAccessibleName(new RegExp(`${TEXT.title}\\s*${TEXT.desc}`));
  await stillSamePage(page, url);

  // AC1: Die Seite dahinter bleibt bedienbar. Der Klick erreicht den Schalter und schließt als Klick außerhalb das Menü (AC3).
  await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectClosed(page);

  // AC3: Kontosymbol erneut aktivieren
  await account.click();
  await expectOpen(page);
  await account.click();
  await expectClosed(page);

  // AC6: per Enter geöffnet liegt der Fokus auf „Anmelden“ und ist sichtbar; AC3: Esc gibt ihn an das Symbol zurück
  await account.focus();
  await page.keyboard.press('Enter');
  await expectOpen(page);
  await expect(link).toBeFocused();
  expect(await link.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)), 'sichtbarer Fokus am Eintrag').toBeGreaterThanOrEqual(2);
  expect((await link.boundingBox())!.height, 'Eintrag mindestens 44 px hoch').toBeGreaterThanOrEqual(44);
  expect((await account.boundingBox())!.height, 'Kontosymbol mindestens 44 px hoch').toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expectClosed(page);
  await expect(account).toBeFocused();
  expect(await account.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)), 'sichtbarer Fokus am Kontosymbol').toBeGreaterThanOrEqual(2);

  // AC6: Leertaste öffnet ebenfalls; AC3: Tab aus dem Menü heraus schließt es
  await page.keyboard.press('Space');
  await expectOpen(page);
  await expect(link).toBeFocused();
  await page.keyboard.press('Tab');
  await expectClosed(page);

  await stillSamePage(page, url);
  expect(authCalls, 'weder Sitzungsabfrage noch Anmeldung').toEqual([]);
  expect(await sessionCookie(context), 'kein Sitzungscookie').toBeUndefined();
});

test('REQ-130-AC2 REQ-121-AC2: Menü liegt bei 320, 375 und 1280 px hell und dunkel rechtsbündig unter der Kapsel, deckend und vollständig im Fenster; unter „Anmelden“ folgen weder Trennlinie noch Leerraum', async ({ page }) => {
  for (const width of [320, 375, 1280]) {
    for (const scheme of ['light', 'dark'] as const) {
      const where = `${width} px ${scheme}`;
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/de/blog');
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      const { account, link } = ui(page);
      await account.click();
      const menu = await expectOpen(page);

      // REQ-130-AC2: Der Eintrag ist das letzte Element; bis zum unteren Rand bleibt nur der Innenabstand der Fläche.
      await expect.poll(() => menu.evaluate((el) => getComputedStyle(el).transform), `${where}: Einblenden abgeschlossen`).toBe('none');
      const end = await menu.evaluate((el, a) => {
        const last = el.lastElementChild!;
        return {
          lastIsLink: last === a,
          gap: el.getBoundingClientRect().bottom - parseFloat(getComputedStyle(el).borderBottomWidth) - last.getBoundingClientRect().bottom,
          lines: [...el.querySelectorAll('*')].filter(
            (c) => c.tagName === 'HR' || parseFloat(getComputedStyle(c).borderTopWidth) > 0 || parseFloat(getComputedStyle(c).borderBottomWidth) > 0,
          ).length,
        };
      }, await link.elementHandle());
      expect(end.lastIsLink, `${where}: „Anmelden“ ist das letzte Element der Fläche`).toBe(true);
      expect(end.lines, `${where}: keine Trennlinie`).toBe(0);
      expect(end.gap, `${where}: Abstand vom Eintrag zum unteren Rand = Innenabstand`).toBeCloseTo(MENU_PADDING, 0);

      const m = (await menu.boundingBox())!;
      const a = (await account.boundingBox())!;
      const capsule = (await page.locator('.site-header nav').boundingBox())!;
      expect(Math.abs(m.x + m.width - (a.x + a.width)), `${where}: rechte Kante am Kontosymbol`).toBeLessThanOrEqual(1);
      expect(m.y, `${where}: Oberkante unter der Navigationskapsel`).toBeGreaterThanOrEqual(capsule.y + capsule.height);
      expect(m.x, `${where}: links im Fenster`).toBeGreaterThanOrEqual(0);
      expect(m.x + m.width, `${where}: rechts im Fenster`).toBeLessThanOrEqual(width);
      expect(m.y + m.height, `${where}: unten im Fenster`).toBeLessThanOrEqual(800);
      expect(m.width, `${where}: Breite 320 px, höchstens Fensterbreite minus 32 px`).toBeCloseTo(Math.min(320, width - 32), 0);

      const page_ = await page.evaluate(() => ({
        scroll: document.scrollingElement!.scrollWidth,
        inner: document.documentElement.clientWidth,
      }));
      expect(page_.scroll, `${where}: kein horizontaler Bildlauf`).toBeLessThanOrEqual(page_.inner);

      const surface = await menu.evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.bottom - 6);
        return { bg: s.backgroundColor, blur: s.backdropFilter, onTop: !!top && el.contains(top) };
      });
      expect(surface.bg, `${where}: deckende Fläche`).toMatch(/^rgb\(/);
      expect(surface.blur, `${where}: kein Glaseffekt`).toBe('none');
      expect(surface.onTop, `${where}: Menü liegt über dem Seiteninhalt`).toBe(true);
    }
  }
});

test('REQ-130-AC5 REQ-121-AC4 REQ-121-AC9 REQ-109-AC4: „Anmelden“ führt im selben Tab zur Anmeldeseite mit unverändertem Einleitungstext und von dort zur Startseite der Rolle; es gibt keinen Anmeldedialog', async ({ page, context }) => {
  // REQ-109-AC4, REQ-121-AC9: Direktaufruf ohne Sitzung zeigt die eigenständige Anmeldeseite
  await page.goto('/redaktion');
  await expect(page).toHaveURL(SIGN_IN);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  await expect(page.locator('.site-header')).toHaveCount(0);
  expect((await page.request.get('/api/admin/posts')).status(), 'Redaktionsfunktion ist ohne Sitzung geschützt').toBe(401);

  // REQ-121-AC9: Das Kontosymbol zeigt keine Felder für Zugangsdaten
  await openPage(page);
  const { account, link } = ui(page);
  await account.click();
  await expectOpen(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('input[type="password"], input[type="email"]')).toHaveCount(0);

  // REQ-121-AC4
  await link.click();
  await expect(page).toHaveURL(SIGN_IN);
  expect(context.pages(), 'kein neuer Tab').toHaveLength(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  // REQ-130-AC5: Der Einleitungstext unter der Überschrift bleibt.
  await expect(page.locator('h1 + p'), 'Einleitung der Anmeldeseite').toHaveText(SIGN_IN_INTRO);
  expect(await sessionCookie(context), 'der Weg zur Anmeldeseite setzt kein Sitzungscookie').toBeUndefined();

  await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.editor.email);
  await page.getByLabel('Passwort', { exact: true }).fill(ACCOUNTS.editor.password);
  expect(await submitLogin(page, () => page.getByRole('button', { name: 'Anmelden' }).click())).toBe(200);
  await expect(page).toHaveURL(EDITOR_START);
  expect((await page.request.get('/api/admin/posts')).status(), 'Redaktionsfunktion ist nach der Anmeldung nutzbar').toBe(200);
});

test.describe('mit Redaktionssitzung', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-130-AC4 REQ-121-AC5: mit Sitzung erscheint dasselbe Menü; „Anmelden“ führt ohne Eingabe zur Startseite der Rolle', async ({ page }) => {
    expect((await page.request.get('/api/auth/me')).status(), 'Voraussetzung: gültige Sitzung').toBe(200);
    const url = await openPage(page);
    const { account, link } = ui(page);
    await account.click();
    const menu = await expectOpen(page);
    await expect(menu).toHaveText(new RegExp(`^\\s*${TEXT.label}\\s*${TEXT.title}\\s*${TEXT.desc}\\s*$`));
    await stillSamePage(page, url);

    await link.click();
    await expect(page).toHaveURL(EDITOR_START);
    await expect(page.getByLabel('Passwort', { exact: true }), 'keine erneute Eingabe').toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toHaveCount(0);
  });
});

test('REQ-121-AC8: Kontomenü und Themenmenü beziehungsweise mobiles Hauptmenü schließen sich gegenseitig', async ({ page }) => {
  // Desktop: Themenmenü
  await openPage(page);
  const { account } = ui(page);
  const topics = page.getByRole('button', { name: 'Themen' });
  await topics.click();
  await expect(topics).toHaveAttribute('aria-expanded', 'true');
  await account.click();
  await expectOpen(page);
  await expect(topics, 'Themenmenü schließt beim Öffnen des Kontomenüs').toHaveAttribute('aria-expanded', 'false');
  await topics.click();
  await expect(topics).toHaveAttribute('aria-expanded', 'true');
  await expectClosed(page);

  // Bis 650 px: Hauptmenü, auch mit darin aufgeklapptem Themenmenü
  await page.setViewportSize({ width: 375, height: 800 });
  await openPage(page);
  const main = page.getByRole('button', { name: 'Menü' });
  await main.click();
  await expect(main).toHaveAttribute('aria-expanded', 'true');
  await topics.click();
  await expect(topics).toHaveAttribute('aria-expanded', 'true');
  await account.click();
  await expectOpen(page);
  await expect(main, 'Hauptmenü schließt beim Öffnen des Kontomenüs').toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.site-header').getByRole('link', { name: 'News', exact: true }), 'Einträge des Hauptmenüs sind ausgeblendet').toBeHidden();
  await main.click();
  await expect(main).toHaveAttribute('aria-expanded', 'true');
  await expectClosed(page);
});

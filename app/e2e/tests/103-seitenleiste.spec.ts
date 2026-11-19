// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/components/Layout.tsx app/frontend-redaktion/src/lib/navigation.ts
import type { Locator, Page } from '@playwright/test';
import { AUTH, expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test, type Role } from '../support/fixtures';

// Anforderung #103: einklappbare Seitenleiste für die Navigation im Redaktionssystem.
// Kriterien: Spezifikation REQ-103 im Ticket. Rollentabelle aus #64. Wechselpunkt: bis 899 px schmale Ansicht.

const ALL = ['Beiträge', 'Themenartikel', 'Statistik', 'Beratungsanfragen', 'Nachrichten', 'Benutzer', 'Einstellungen', 'Profil'];
const EXPECTED: Record<Role, string[]> = {
  admin: ALL,
  editor: ['Beiträge', 'Themenartikel', 'Profil'],
  marketing: ['Statistik', 'Beratungsanfragen', 'Nachrichten', 'Profil'],
};
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };
const PUBLIC_LINK = 'KI Perspektiven – zur öffentlichen Webseite';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Redaktion' });
const sidebarToggle = (page: Page) => page.getByRole('button', { name: 'Seitenleiste' });
const menuButton = (page: Page) => page.getByRole('button', { name: 'Navigation', exact: true });

/** Sichtbare Ziele der Navigation in Dokumentreihenfolge (Profil steht immer darin). */
async function visibleTargets(page: Page) {
  await expect(nav(page).getByRole('link', { name: 'Profil', exact: true })).toBeVisible();
  const links = nav(page).getByRole('link');
  const out: string[] = [];
  for (let i = 0; i < (await links.count()); i++) {
    const link = links.nth(i);
    if (await link.isVisible()) out.push(((await link.getAttribute('aria-label')) ?? (await link.innerText())).trim());
  }
  return out;
}

async function width(l: Locator) {
  const box = await l.boundingBox();
  expect(box, 'Element ist sichtbar').not.toBeNull();
  return box!.width;
}

/** Das Element am Mittelpunkt der Hauptüberschrift gehört zur Überschrift: nichts überdeckt den Zielinhalt. */
async function expectHeadingUncovered(page: Page) {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toBeVisible();
  const free = await h1.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(free, 'Hauptüberschrift ist nicht von der Navigation verdeckt').toBe(true);
}

test.describe('Desktop', () => {
  test.use({ viewport: DESKTOP });

  test.describe('Admin', () => {
    test.use({ storageState: AUTH.admin });

    test('REQ-103-AC1: alle Ziele links in der Seitenleiste, keine oberen Navigationseinträge, aktiver Bereich erkennbar', async ({ page }) => {
      await page.goto('/redaktion/statistik');
      expect(await visibleTargets(page)).toEqual(ALL);

      const main = page.locator('main#inhalt');
      const navBox = (await nav(page).boundingBox())!;
      const mainBox = (await main.boundingBox())!;
      expect(navBox.x + navBox.width, 'Seitenleiste liegt links vom Inhalt').toBeLessThanOrEqual(mainBox.x + 1);
      expect(navBox.height, 'Seitenleiste ist eine senkrechte Leiste').toBeGreaterThan(navBox.width);
      for (const name of ALL) {
        await expect(page.getByRole('banner').getByRole('link', { name, exact: true }), `kein oberer Eintrag „${name}“`).toHaveCount(0);
      }

      const stat = nav(page).getByRole('link', { name: 'Statistik', exact: true });
      await expect(stat, 'Direktaufruf markiert den Bereich').toHaveAttribute('aria-current', 'page');
      await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1);
      const inactiveBg = await nav(page).getByRole('link', { name: 'Nachrichten', exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor);
      const activeBg = await stat.evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(activeBg, 'aktiver Bereich ist visuell hervorgehoben').not.toBe(inactiveBg);

      await nav(page).getByRole('link', { name: 'Nachrichten', exact: true }).click();
      await expect(page).toHaveURL(/\/redaktion\/nachrichten$/);
      await expect(nav(page).getByRole('link', { name: 'Nachrichten', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(stat).not.toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalScroll(page);
    });

    test('REQ-103-AC2: einklappen schafft Platz, Ziele bleiben erreichbar, Zustand bleibt beim Seitenwechsel erhalten', async ({ page }) => {
      await page.goto('/redaktion/benutzer');
      const toggle = sidebarToggle(page);
      const main = page.locator('main#inhalt');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const navWide = await width(nav(page));
      const mainNarrow = await width(main);
      for (const name of ALL) await expect(nav(page).getByRole('link', { name, exact: true })).toHaveText(name, { useInnerText: true });

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => width(nav(page)), 'Leiste wird schmaler').toBeLessThan(navWide - 80);
      await expect.poll(() => width(main), 'Inhalt erhält mehr Platz').toBeGreaterThan(mainNarrow + 40);
      for (const name of ALL) {
        const link = nav(page).getByRole('link', { name, exact: true });
        await expect(link, `„${name}“ bleibt sichtbar`).toBeVisible();
        await expect(link, `„${name}“ bleibt eindeutig benannt`).toHaveAccessibleName(name);
        await expect(link, `„${name}“ ohne Textbeschriftung`).not.toHaveText(name, { useInnerText: true });
      }

      await nav(page).getByRole('link', { name: 'Profil', exact: true }).click();
      await expect(page).toHaveURL(/\/redaktion\/profil$/);
      await expect(sidebarToggle(page), 'Zustand bleibt beim Seitenwechsel').toHaveAttribute('aria-expanded', 'false');
      await page.goto('/redaktion/statistik');
      await expect(sidebarToggle(page), 'Zustand bleibt auch beim Neuladen').toHaveAttribute('aria-expanded', 'false');

      await sidebarToggle(page).click();
      await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'true');
      for (const name of ALL) await expect(nav(page).getByRole('link', { name, exact: true })).toHaveText(name, { useInnerText: true });
      await expect.poll(() => width(nav(page))).toBeGreaterThan(navWide - 2);
    });

    test('REQ-103-AC4: Umschalter und Ziele per Tastatur mit sichtbarem Fokus', async ({ page }) => {
      await page.goto('/redaktion/benutzer');
      const toggle = sidebarToggle(page);
      // Vom Seitenanfang aus tabben (die Seite fokussiert sonst ihre Überschrift im Inhalt).
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await page.getByRole('link', { name: 'Zum Inhalt springen' }).focus();
      let reached = false;
      for (let i = 0; i < 12 && !reached; i++) {
        await page.keyboard.press('Tab');
        reached = await toggle.evaluate((el) => el === document.activeElement);
      }
      expect(reached, 'Umschalter ist per Tab erreichbar').toBe(true);
      await expectVisibleKeyboardFocus(page, toggle);
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');

      const target = nav(page).getByRole('link', { name: 'Einstellungen', exact: true });
      for (let i = 0; i < 12 && !(await target.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expectVisibleKeyboardFocus(page, target);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/redaktion\/einstellungen$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    });
  });

  test.describe('Marketing', () => {
    test.use({ storageState: AUTH.marketing });
    test('REQ-103-AC5: Marketing sieht genau seine Ziele; nicht freigegebene Bereiche bleiben geschützt', async ({ page }) => {
      await page.goto('/redaktion/beratungsanfragen');
      expect(await visibleTargets(page)).toEqual(EXPECTED.marketing);
      await expect(nav(page).getByRole('link', { name: 'Beratungsanfragen', exact: true })).toHaveAttribute('aria-current', 'page');
      const res = await page.goto('/redaktion/themenartikel');
      expect(res?.status()).toBe(403);
      await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
    });
  });
});

test.describe('Schmale Ansicht', () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true });

  test.describe('Redakteur', () => {
    test.use({ storageState: AUTH.editor });

    test('REQ-103-AC3: Navigation öffnen, Ziel wählen, wieder schließen; kein horizontaler Bildlauf', async ({ page }) => {
      await page.goto('/redaktion');
      const button = menuButton(page);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(nav(page).getByRole('link', { name: 'Themenartikel', exact: true })).toBeHidden();
      await expectHeadingUncovered(page);
      await expectNoHorizontalScroll(page);

      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(await visibleTargets(page)).toEqual(EXPECTED.editor);
      await expectNoHorizontalScroll(page);
      await nav(page).getByRole('link', { name: 'Themenartikel', exact: true }).click();
      await expect(page).toHaveURL(/\/redaktion\/themenartikel$/);
      await expect(nav(page).getByRole('link', { name: 'Themenartikel', exact: true })).toBeHidden();
      await expect(page.getByRole('heading', { level: 1, name: 'Themenartikel' })).toBeVisible();
      await expectHeadingUncovered(page);
      await expectNoHorizontalScroll(page);

      await menuButton(page).click();
      await expect(nav(page).getByRole('link', { name: 'Profil', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Navigation schließen' }).click();
      await expect(nav(page).getByRole('link', { name: 'Profil', exact: true })).toBeHidden();
      await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(page).toHaveURL(/\/redaktion\/themenartikel$/);
      await expectHeadingUncovered(page);
    });

    test('REQ-103-AC4: überlagernde Navigation per Tastatur; Schließen ohne Zielwechsel führt den Fokus zum Umschalter', async ({ page }) => {
      await page.goto('/redaktion/profil');
      const button = menuButton(page);
      await expectVisibleKeyboardFocus(page, button);
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      const first = nav(page).getByRole('link', { name: 'Beiträge', exact: true });
      await expect(first).toBeVisible();
      for (let i = 0; i < 6 && !(await first.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expectVisibleKeyboardFocus(page, first);

      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(first).toBeHidden();
      await expect(button, 'Escape führt den Fokus zum Umschalter').toBeFocused();

      await page.keyboard.press('Enter');
      const close = page.getByRole('button', { name: 'Navigation schließen' });
      await expectVisibleKeyboardFocus(page, close);
      await page.keyboard.press('Enter');
      await expect(button, 'Schließen-Schaltfläche führt den Fokus zum Umschalter').toBeFocused();
      await expect(page).toHaveURL(/\/redaktion\/profil$/);
    });
  });

  for (const role of ['editor', 'marketing', 'admin'] as const) {
    test.describe(role, () => {
      test.use({ storageState: AUTH[role] });
      test(`REQ-103-AC5: ${role} sieht genau seine Ziele, Kontoinformationen und Kontofunktionen in der schmalen Ansicht`, async ({ page }) => {
        await page.goto('/redaktion/profil');
        const me = (await (await page.request.get('/api/auth/me')).json()) as { email: string; displayName: string };
        await menuButton(page).click();
        expect(await visibleTargets(page)).toEqual(EXPECTED[role]);
        const label = { admin: 'Admin', editor: 'Redakteur', marketing: 'Marketing' }[role];
        const account = page.getByRole('dialog', { name: 'Navigation' });
        await expect(account.getByText(me.displayName || me.email, { exact: true })).toBeVisible();
        await expect(account.getByText(label, { exact: true })).toBeVisible();
        await expect(account.getByRole('button', { name: 'Dunkle Darstellung' })).toBeVisible();
        await expect(account.getByRole('button', { name: 'Abmelden' })).toBeVisible();
        await expect(page.getByRole('link', { name: PUBLIC_LINK })).toBeVisible();
        await expectNoHorizontalScroll(page);
      });
    });
  }

  test.describe('Redakteur ohne Freigabe', () => {
    test.use({ storageState: AUTH.editor });
    test('REQ-103-AC5: Direktaufruf der Benutzerverwaltung bleibt geschützt', async ({ page }) => {
      const res = await page.goto('/redaktion/benutzer');
      expect(res?.status()).toBe(403);
      await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
      await menuButton(page).click();
      await expect(nav(page).getByRole('link', { name: 'Benutzer', exact: true })).toHaveCount(0);
    });
  });
});

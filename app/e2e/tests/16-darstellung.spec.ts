// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx app/frontend/src/pages/Contact.tsx app/frontend-redaktion/src/pages/Login.tsx
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #16: Light und Darkmode für Webseite und Redaktion wählen.
const THEME_KEY = 'ki-perspektiven.theme';
const storedTheme = (page: Page) => page.evaluate((k) => localStorage.getItem(k), THEME_KEY);

async function chooseCookies(page: Page, option: 'Sprache und Darstellung merken' | 'Nur für diesen Besuch') {
  await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: option }).click();
  await dialog.getByRole('button', { name: 'Schließen' }).click();
}

/** Kontrast nach WCAG zwischen Textfarbe eines Elements und dem ersten deckenden Hintergrund darunter. */
async function contrast(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg: number[] = [255, 255, 255];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.9)) {
        bg = c;
        break;
      }
    }
    const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

test('REQ-16-AC1: ohne gespeicherte Wahl erscheint die helle Darstellung, auch bei dunkler Systemeinstellung', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Dunkle Darstellung' })).toHaveAttribute('aria-pressed', 'false');
});

test('REQ-16-AC2: Umschalten auf der Webseite wechselt die Darstellung und erhält Seite und Formularwerte', async ({ page }) => {
  await page.goto('/de/kontakt');
  await page.getByLabel('Name').fill('Ada Lovelace');
  const toggle = page.getByRole('button', { name: 'Dunkle Darstellung' });

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/de\/kontakt$/);
  await expect(page.getByLabel('Name')).toHaveValue('Ada Lovelace');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByLabel('Name')).toHaveValue('Ada Lovelace');
});

test('REQ-16-AC2: Umschalten in der Redaktion wechselt die Darstellung und erhält Eingaben', async ({ page }) => {
  await page.goto('/redaktion/anmelden');
  await page.getByLabel('E-Mail-Adresse').fill('jemand@example.test');
  await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page).toHaveURL(/\/redaktion\/anmelden$/);
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue('jemand@example.test');
});

test('REQ-16-AC3: mit Einwilligung gilt die Wahl nach Neuladen und in der Redaktion', async ({ page }) => {
  await page.goto('/de');
  await chooseCookies(page, 'Sprache und Darstellung merken');
  await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
  await expect.poll(() => storedTheme(page)).toBe('dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/redaktion/anmelden');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dunkle Darstellung' })).toHaveAttribute('aria-pressed', 'true');
});

test('REQ-16-AC4: ohne Einwilligung wechselt die Darstellung, wird aber nicht dauerhaft gespeichert', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/de');
  await chooseCookies(page, 'Nur für diesen Besuch');
  await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await storedTheme(page)).toBeNull();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('REQ-16-AC4: bei blockiertem Browserspeicher funktioniert der Wechsel ohne Fehler', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blockiert', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/de');
  await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('REQ-16-AC5: Tastaturbedienung, zugänglicher Name in DE/EN und lesbare Texte in beiden Modi', async ({ page }) => {
  await page.goto('/en/kontakt');
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  await expectVisibleKeyboardFocus(page, toggle);
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await contrast(page, 'h1')).toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, 'label')).toBeGreaterThanOrEqual(4.5);

  await page.goto('/de/kontakt');
  const de = page.getByRole('button', { name: 'Dunkle Darstellung' });
  await de.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await contrast(page, 'h1')).toBeGreaterThanOrEqual(4.5);
  // Fehlermeldungen bleiben lesbar
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  expect(await contrast(page, '.contact-error')).toBeGreaterThanOrEqual(4.5);
  await de.click();
  expect(await contrast(page, '.contact-error')).toBeGreaterThanOrEqual(4.5);
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('REQ-16-AC5: Darstellungswahl ist auf 375 px per Touch bedienbar', async ({ page }) => {
    await page.goto('/de');
    const toggle = page.getByRole('button', { name: 'Dunkle Darstellung' });
    await expect(toggle).toBeVisible();
    await toggle.tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoHorizontalScroll(page);
  });
});

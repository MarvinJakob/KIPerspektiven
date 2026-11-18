// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/App.tsx
import type { Page } from '@playwright/test';
import { expect, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #24: Öffentliche Webseite zwischen Deutsch und Englisch umstellen.
// REQ-24-AC5 (fehlende Übersetzungen) prüfen 20-blog.spec.ts (Beitrag) und 23-readiness.spec.ts (Readiness-Inhalte).
const LANG_KEY = 'ki-perspektiven.lang';
const browserLanguages = (page: Page, langs: string[]) =>
  page.addInitScript((l) => Object.defineProperty(navigator, 'languages', { get: () => l }), langs);

async function chooseCookies(page: Page, option: string) {
  await page.getByRole('button', { name: /Cookie-Einstellungen|Cookie settings/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: option }).click();
  await dialog.getByRole('button', { name: /Schließen|Close/ }).click();
}

test.describe('Browsersprache Englisch', () => {
  test.use({ locale: 'en-US' });
  test('REQ-24-AC1: das Präfix /de bestimmt die Sprache unabhängig von der Browsersprache', async ({ page }) => {
    await page.goto('/de/blog');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(nav.getByRole('button', { name: 'Themen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('REQ-24-AC3: ohne gespeicherte Wahl führt / zur Browsersprache Englisch', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/?$/);
  });
});

test('REQ-24-AC1: das Präfix /en bestimmt die Sprache bei deutscher Browsersprache', async ({ page }) => {
  await page.goto('/en/blog');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Topics' })).toBeVisible();
});

test('REQ-24-AC2: Sprachwechsel öffnet dieselbe Unterseite und übersetzt Navigation und Schaltflächen', async ({ page }) => {
  await page.goto('/de/kontakt');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/kontakt$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'AI Readiness' })).toHaveAttribute('href', '/en/themen/ai-audit');
  await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/en/profil');

  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/kontakt$/);
  await expect(page.getByRole('button', { name: 'Nachricht senden' })).toBeVisible();
});

test('REQ-24-AC3: erste unterstützte Browsersprache, sonst Deutsch', async ({ page }) => {
  await browserLanguages(page, ['fr-FR', 'en-GB', 'de-DE']);
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/?$/);
  await page.context().clearCookies();

  const other = await page.context().newPage();
  await browserLanguages(other, ['fr-FR', 'es-ES']);
  await other.goto('/');
  await expect(other).toHaveURL(/\/de\/?$/);
});

test('REQ-24-AC3 REQ-24-AC4: mit Einwilligung gilt die gespeicherte Wahl beim Einstieg über /', async ({ page }) => {
  await page.goto('/de');
  await chooseCookies(page, 'Sprache und Darstellung merken');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBe('en');
  await page.goto('/'); // Browsersprache ist Deutsch
  await expect(page).toHaveURL(/\/en\/?$/);
});

test('REQ-24-AC4: ohne Einwilligung wird keine dauerhafte Sprachwahl gespeichert', async ({ page }) => {
  await page.goto('/de');
  await chooseCookies(page, 'Nur für diesen Besuch');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBeNull();
  await page.goto('/');
  await expect(page).toHaveURL(/\/de\/?$/);
});

test('REQ-24-AC4: bei blockiertem Speicher funktioniert die Auswahl weiterhin', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blockiert', 'SecurityError');
      },
    }),
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/de/blog');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/blog$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});

test('REQ-24-AC6: Sprachwahl ist beschriftet und per Tastatur mit sichtbarem Fokus bedienbar', async ({ page }) => {
  await page.goto('/de/profil');
  const group = page.getByRole('group', { name: 'Sprache' });
  await expect(group.getByRole('button', { name: 'Deutsch' })).toBeVisible();
  const en = group.getByRole('button', { name: 'English' });
  await expectVisibleKeyboardFocus(page, en);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/profil$/);
  await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('REQ-24-AC6: auf 375 px ist die Sprachwahl im Navigationsmenü verfügbar', async ({ page }) => {
    await page.goto('/de/blog');
    const en = page.getByRole('button', { name: 'English' });
    await expect(en).toBeHidden();
    await page.getByRole('button', { name: 'Menü' }).tap();
    await expect(en).toBeVisible();
    await en.tap();
    await expect(page).toHaveURL(/\/en\/blog$/);
  });
});

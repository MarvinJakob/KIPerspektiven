// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx app/frontend/src/pages/Contact.tsx app/frontend-redaktion/src/pages/Login.tsx
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #16: Light und Darkmode für Webseite und Redaktion wählen.
const THEME_KEY = 'ki-perspektiven.theme';
const storedTheme = (page: Page) => page.evaluate((k) => localStorage.getItem(k), THEME_KEY);

async function chooseCookies(page: Page, option: 'Sprache und Darstellung merken' | 'Nur für diesen Besuch') {
  await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: option }).click();
  await dialog.getByRole('button', { name: 'Schließen' }).click();
}

// Seit #104 (Entscheidung vom 19.11.2026, REQ-104-AC10) folgt die Webseite ohne gespeicherte Wahl der Systemeinstellung.
test('REQ-16-AC1 REQ-104-AC10: ohne gespeicherte Wahl folgt die Darstellung der Systemeinstellung', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Dunkle Darstellung' })).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dunkle Darstellung' })).toHaveAttribute('aria-pressed', 'true');
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

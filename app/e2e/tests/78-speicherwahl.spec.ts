// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/CookieSettings.tsx app/frontend/src/components/consentTexts.ts
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #78: Speicherwahl im Cookie-Dialog verständlich beschriften.
// Sollwerte aus der Spezifikation im Ticket #78; Unit-Tests: app/frontend/src/components/consentTexts.test.ts.
const SOLL = {
  de: {
    open: 'Cookie-Einstellungen',
    close: 'Schließen',
    remember: 'Sprache und Darstellung merken',
    visit: 'Nur für diesen Besuch',
    savedRemember:
      'Gewählt: Sprache und Darstellung merken. Die Website merkt sich deine Sprache und Darstellung in diesem Browser für spätere Besuche.',
    savedVisit: 'Gewählt: Nur für diesen Besuch. Die Website übernimmt deine Sprache und Darstellung beim nächsten Besuch nicht.',
    hint: 'Diese Wahl gilt nur, bis die Seite vollständig neu geladen wird. Danach kannst du sie hier erneut treffen.',
  },
  en: {
    open: 'Cookie settings',
    close: 'Close',
    remember: 'Remember language and appearance',
    visit: 'For this visit only',
    savedRemember:
      'Chosen: remember language and appearance. The website remembers your language and appearance in this browser for future visits.',
    savedVisit: 'Chosen: for this visit only. The website will not reuse your language and appearance on your next visit.',
    hint: 'This choice only lasts until the page is fully reloaded. You can make it again here afterwards.',
  },
} as const;

async function openDialog(page: Page, lang: 'de' | 'en') {
  await page.getByRole('button', { name: SOLL[lang].open, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

// Beide Abläufe mit Browsersprache Deutsch; die englischen Texte prüft consentTexts.test.ts.
const lang = 'de';

test(`REQ-78-AC3: „merken“ bestätigt die Speicherung und / übernimmt Sprache und Darstellung`, async ({ page }) => {
  const s = SOLL[lang];
  // Die Sprache wird nur bei ausdrücklicher Wahl gespeichert (REQ-24). Deshalb die jeweils
  // andere Sprache als die Browsersprache wählen, damit / nur mit gespeicherter Wahl dorthin führt.
  const other = { lang: 'en', button: 'English', dark: 'Dark mode' };
  await page.goto(`/${lang}`);
  const dialog = await openDialog(page, lang);
  await dialog.getByRole('button', { name: s.remember, exact: true }).click();
  await expect(dialog.locator('[aria-live="polite"]')).toHaveText(s.savedRemember);
  await dialog.getByRole('button', { name: s.close, exact: true }).click();

  await page.getByRole('button', { name: other.button }).click();
  await expect(page).toHaveURL(new RegExp(`/${other.lang}/?$`));
  await page.getByRole('button', { name: other.dark }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/${other.lang}/?$`));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test(`REQ-78-AC4: „nur für diesen Besuch“ bestätigt den Verzicht und / stellt nichts wieder her`, async ({ page }) => {
  // Ausgangslage bei Browsersprache Deutsch: Englisch und dunkel sind gespeichert.
  await page.goto('/de');
  let dialog = await openDialog(page, 'de');
  await dialog.getByRole('button', { name: SOLL.de.remember, exact: true }).click();
  await dialog.getByRole('button', { name: SOLL.de.close, exact: true }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const s = SOLL[lang];
  await page.goto(`/${lang}`);
  dialog = await openDialog(page, lang);
  await dialog.getByRole('button', { name: s.visit, exact: true }).click();
  await expect(dialog.locator('[aria-live="polite"] .consent-status').first()).toHaveText(`${s.savedVisit} ${s.hint}`);

  await page.goto('/'); // Browsersprache Deutsch, keine gespeicherte Wahl mehr
  await expect(page).toHaveURL(/\/de\/?$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

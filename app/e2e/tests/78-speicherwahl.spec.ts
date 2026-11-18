// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/CookieSettings.tsx app/frontend/src/components/consentTexts.ts
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

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
    old: ['Nur notwendige Cookies', 'Keine Cookies speichern'],
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
    old: ['Necessary cookies only', 'Store no cookies'],
  },
} as const;

async function openDialog(page: Page, lang: 'de' | 'en') {
  await page.getByRole('button', { name: SOLL[lang].open, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Beide Auswahl-Schaltflächen: Text, zugänglicher Name und vollständige Sichtbarkeit. */
async function expectReadableOptions(page: Page, lang: 'de' | 'en') {
  const s = SOLL[lang];
  const dialog = await openDialog(page, lang);
  const group = dialog.getByRole('group');
  await expect(group.getByRole('button'), 'genau zwei Auswahl-Schaltflächen').toHaveCount(2);
  for (const label of [s.remember, s.visit]) {
    const button = group.getByRole('button', { name: label, exact: true });
    await expect(button, `zugänglicher Name „${label}“`).toBeVisible();
    await expect(button, 'sichtbarer Text entspricht dem zugänglichen Namen').toHaveText(label);
    await button.scrollIntoViewIfNeeded();
    const clipped = await button.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1);
    expect(clipped, `„${label}“ ist vollständig lesbar`).toBe(false);
  }
  for (const old of s.old) await expect(dialog.getByText(old), `alter Text „${old}“`).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  return dialog;
}

for (const lang of ['de', 'en'] as const) {
  const id = lang === 'de' ? 'REQ-78-AC1' : 'REQ-78-AC2';

  test(`${id}: Beschriftung der Speicherwahl auf Desktop (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}`);
    await expectReadableOptions(page, lang);
  });

  test(`REQ-78-AC2: Speicherwahl per Tastatur bedienbar (${lang})`, async ({ page }) => {
    const s = SOLL[lang];
    await page.goto(`/${lang}`);
    const dialog = await openDialog(page, lang);
    for (const [label, status] of [
      [s.remember, s.savedRemember],
      [s.visit, s.savedVisit],
    ] as const) {
      const button = dialog.getByRole('button', { name: label, exact: true });
      let focused = false;
      for (let i = 0; i < 12 && !focused; i++) {
        await page.keyboard.press('Tab');
        focused = await button.evaluate((el) => el === document.activeElement);
      }
      expect(focused, `„${label}“ per Tab erreichbar`).toBe(true);
      const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, `sichtbarer Fokus auf „${label}“`).not.toBe('none');
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByText(status)).toBeVisible();
    }
  });

  test.describe('mobil', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    test(`${id} REQ-78-AC2: Beschriftung auf 375 px vollständig lesbar (${lang})`, async ({ page }) => {
      await page.goto(`/${lang}`);
      await expectReadableOptions(page, lang);
    });
  });

  test(`REQ-78-AC3: „merken“ bestätigt die Speicherung und / übernimmt Sprache und Darstellung (${lang})`, async ({ page }) => {
    const s = SOLL[lang];
    await page.goto(`/${lang}`);
    const dialog = await openDialog(page, lang);
    await dialog.getByRole('button', { name: s.remember, exact: true }).click();
    await expect(dialog.locator('[aria-live="polite"]')).toHaveText(s.savedRemember);
    await dialog.getByRole('button', { name: s.close, exact: true }).click();

    // Abweichend von der Browsersprache Deutsch: Englisch und dunkel einstellen.
    if (lang === 'de') await page.getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await page.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test(`REQ-78-AC4: „nur für diesen Besuch“ bestätigt den Verzicht und / stellt nichts wieder her (${lang})`, async ({ page }) => {
    // Ausgangslage: Englisch und dunkel sind gespeichert.
    await page.goto('/en');
    let dialog = await openDialog(page, 'en');
    await dialog.getByRole('button', { name: SOLL.en.remember, exact: true }).click();
    await dialog.getByRole('button', { name: SOLL.en.close, exact: true }).click();
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
}

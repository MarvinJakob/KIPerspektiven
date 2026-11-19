// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/MobileToc.tsx app/frontend/src/lib/toc.ts app/frontend/src/components/Layout.tsx
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #98: Mobiles Inhaltsverzeichnis zeigt den aktuellen Abschnitt.
// Abschnittsüberschriften aus den Testdaten (app/backend/migrations/dev/00001_dev_posts.sql, Beitrag „ai-audit-fuenf-fragen“).
// Grenzfälle (Breakpoint, weniger als zwei Abschnitte, Seiten ohne Verzeichnis, Tastatur) prüfen die Unit-Tests
// app/frontend/src/lib/toc.test.ts und app/frontend/src/components/MobileToc.test.tsx.

const MOBILE = { width: 390, height: 700 };
const POST = '/de/blog/ai-audit-fuenf-fragen';
const HEADINGS = ['1. Wo nutzen wir KI heute?', '2. Welche Daten fließen hinein?', '3. Wer trägt Verantwortung?', '4. Welche Vorgaben gelten?', '5. Wie messen wir den Nutzen?'];

const toc = (page: Page) => page.getByRole('navigation', { name: 'Inhaltsverzeichnis' });
const toggle = (page: Page) => page.locator('.toc-toggle');
// Einträge auch bei geschlossener Liste (dann für Rollenabfragen verborgen).
const entries = (page: Page) => toc(page).locator('a');
const current = (page: Page) => toc(page).locator('a[aria-current="location"]');

/** Scrollt so, dass die Oberkante der Überschrift knapp unter der schwebenden Kopfzeile liegt. */
async function scrollToHeading(heading: Locator) {
  await heading.evaluate((h) => scrollTo({ top: h.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' }));
}

test.use({ viewport: MOBILE });

test('REQ-98-AC1/AC6: Beitrag zeigt am Rand ein Inhaltsverzeichnis mit seinen Abschnitten', async ({ page }) => {
  await page.goto(POST);
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toContainText('Inhaltsverzeichnis');
  // Nach den fünf Abschnitten des Beitrags folgt der Abschnitt mit weiteren Beiträgen zum Thema.
  await expect.poll(async () => (await entries(page).allTextContents()).slice(0, HEADINGS.length)).toEqual(HEADINGS);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(toggle(page), 'am Seitenende erreichbar').toBeInViewport({ ratio: 1 });
  await toggle(page).click();
  await expect(entries(page).first()).toBeInViewport();
});

test('REQ-98-AC2: die Markierung folgt dem Scrollen vorwärts und rückwärts', async ({ page }) => {
  await page.goto(POST);
  const headings = page.locator('main h2');
  await expect(toggle(page)).toBeVisible();
  for (const i of [0, 4, 1]) {
    await scrollToHeading(headings.nth(i));
    await expect(current(page), `nach Scrollen zu Abschnitt ${i + 1}`).toHaveText(HEADINGS[i]);
    await expect(toggle(page), 'Leiste nennt den aktuellen Abschnitt').toContainText(HEADINGS[i]);
  }
});

test('REQ-98-AC3: Antippen eines Eintrags führt zur Überschrift und schließt die Liste', async ({ browser }) => {
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto(POST);
    const heading = page.locator('main h2').nth(3);
    await toggle(page).tap();
    await entries(page).nth(3).tap();
    await expect(current(page)).toHaveText(HEADINGS[3]);
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport({ ratio: 1 });
    await expect(entries(page).first(), 'Liste ist nach der Auswahl geschlossen').toBeHidden();
  } finally {
    await context.close();
  }
});

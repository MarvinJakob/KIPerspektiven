import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

// Anforderung #43: Die Einleitung von „Vibe Coding“ nutzt auf dem Desktop die Breite der Perspektivenabschnitte.
// Referenz (Ticket): von der linken Kante der Nummer „01“ bis zur rechten Außenkante des Kastens „Im Beispiel“
// im Abschnitt „01 · Prompt Engineering“. Toleranz 1 px für Rundung von Subpixeln.
const TOL = 1;

async function edges(l: Locator) {
  const b = await l.boundingBox();
  expect(b, 'Element ist sichtbar').not.toBeNull();
  return { left: b!.x, right: b!.x + b!.width };
}

async function reference(page: Page) {
  const left = (await edges(page.locator('#vc-prompt .vc-number'))).left;
  const right = (await edges(page.locator('#vc-prompt .vc-example'))).right;
  return { left, right };
}

function expectFlush(name: string, actual: { left: number; right: number }, ref: { left: number; right: number }) {
  expect(Math.abs(actual.left - ref.left), `${name}: linke Kante ${actual.left} statt ${ref.left}`).toBeLessThanOrEqual(TOL);
  expect(Math.abs(actual.right - ref.right), `${name}: rechte Kante ${actual.right} statt ${ref.right}`).toBeLessThanOrEqual(TOL);
}

for (const width of [1440, 1920]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`REQ-43-AC1: Fließtext der Einleitung beginnt an der linken und nutzt die Breite bis zur rechten Inhaltskante von „01“ (${width} px)`, async ({ page }) => {
      await page.goto('/de/themen/vibe-coding');
      const ref = await reference(page);
      const paragraphs = page.locator('.vc-intro .vc-reading > p');
      await expect(paragraphs.first()).toContainText('Du beschreibst, was du möchtest');
      const count = await paragraphs.count();
      expect(count).toBeGreaterThan(1);
      for (let i = 0; i < count; i++) {
        expectFlush(`Absatz ${i + 1} der Einleitung`, await edges(paragraphs.nth(i)), ref);
      }
    });

    test(`REQ-43-AC2: Kasten „Stell dir vor“ und Trennlinien der Übersicht schließen bündig ab (${width} px)`, async ({ page }) => {
      await page.goto('/de/themen/vibe-coding');
      const ref = await reference(page);
      const story = page.locator('figure[aria-labelledby="vc-story-caption"]');
      await expect(story.locator('figcaption')).toHaveText(/Stell dir vor/i);
      expectFlush('Kasten „Stell dir vor“', await edges(story), ref);
      const index = page.locator('.vc-intro .vc-index');
      expectFlush('Obere Trennlinie der Übersicht', await edges(index), ref);
      const items = index.locator('li');
      await expect(items).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        expectFlush(`Trennlinie unter Eintrag ${i + 1}`, await edges(items.nth(i)), ref);
      }
    });
  });
}

test.describe('390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('REQ-43-AC3: Einleitung, Beispielkasten und Übersicht passen ohne horizontales Scrollen in den Viewport', async ({ page }) => {
    await page.goto('/de/themen/vibe-coding');
    await expectNoHorizontalScroll(page);
    const parts = [
      ...(await page.locator('.vc-intro .vc-reading > p').all()),
      page.locator('figure[aria-labelledby="vc-story-caption"]'),
      page.locator('.vc-intro .vc-index'),
      ...(await page.locator('.vc-intro .vc-index li').all()),
    ];
    for (const part of parts) {
      await part.scrollIntoViewIfNeeded();
      await expect(part).toBeVisible();
      const { left, right } = await edges(part);
      expect(left, 'linke Kante im Viewport').toBeGreaterThanOrEqual(0);
      expect(right, 'rechte Kante im Viewport').toBeLessThanOrEqual(390);
    }
  });
});

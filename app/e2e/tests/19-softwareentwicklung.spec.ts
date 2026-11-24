// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx
import { expect, test } from '../support/fixtures';

// Anforderung #19: Themenseite Softwareentwicklung mit KI. Quelle: content/topics/Software Development v1_de.md.
const PATH = (lang: string) => `/${lang}/themen/softwareentwicklung`;
const text = (s: string) => s.replace(/­/g, '').replace(/\s+/g, ' ').trim();

test('REQ-19-AC1: Artikel mit Hero, Autor, Stand und Lesezeit in beiden Sprachen', async ({ page }) => {
  const expected = {
    de: { title: 'KI in der Softwareentwicklung', stand: 'Stand: 16. November 2026', time: /Lesezeit/ },
    en: { title: 'AI in Software Development', stand: 'Updated: 16 November 2026', time: /min read/ },
  };
  for (const lang of ['de', 'en'] as const) {
    await page.goto(PATH(lang));
    await expect.poll(async () => text(await page.getByRole('heading', { level: 1 }).innerText())).toBe(expected[lang].title);
    const byline = page.locator('.byline');
    await expect(byline).toContainText('Marvin Jakob');
    await expect(byline).toContainText(expected[lang].stand);
    await expect(byline).toContainText(expected[lang].time);
  }
});

// Seit #41 ohne Link zur Originalgröße (REQ-41-AC1/AC4); geprüft wird die ausgelieferte Bilddatei.
test('REQ-19-AC3: Prozess- und Release-Gate-Grafik sprachpassend mit Alternativtext', async ({ page, request }) => {
  const sources: Record<string, string[]> = {};
  for (const lang of ['de', 'en'] as const) {
    await page.goto(PATH(lang));
    sources[lang] = [];
    for (const n of [0, 1]) {
      const img = page.locator('main figure img').nth(n);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      expect((await img.getAttribute('alt'))!.length).toBeGreaterThan(40);
      const href = (await img.getAttribute('src'))!;
      expect((await request.get(href)).status()).toBe(200);
      sources[lang].push(href);
    }
  }
  // Je Sprache eigene Grafiken
  expect(sources.de).not.toEqual(sources.en);
});

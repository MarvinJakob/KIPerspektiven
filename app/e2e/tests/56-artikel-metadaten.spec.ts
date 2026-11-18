import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #56: Autor, Stand und Lesezeit in jedem Themenartikel.
// Sollwerte: Autor und Stand aus den Textvorlagen (content/topics/*), Lesezeit max(1, ⌈Wörter/120⌉)
// nach Entscheidung vom 18.11.2026; die Referenz „ca. 4 Min.“ stammt aus dem Screenshot der Originalanforderung.
const ARTICLES = [
  {
    slug: 'softwareentwicklung',
    de: { stand: 'Stand: 16. November 2026', time: 'ca. 4 Min. Lesezeit' },
    en: { stand: 'Updated: 16 November 2026', time: 'approx. 4 min read' },
  },
  {
    slug: 'vibe-coding',
    de: { stand: 'Stand: 16. November 2026', time: 'ca. 9 Min. Lesezeit' },
    en: { stand: 'Updated: 16 November 2026', time: 'approx. 10 min read' },
  },
] as const;
const AUTHOR = 'Marvin Jakob';

for (const article of ARTICLES) {
  for (const lang of ['de', 'en'] as const) {
    const path = `/${lang}/themen/${article.slug}`;

    test(`REQ-56-AC1–AC3: ${path} zeigt Porträt, Autor, Stand und Lesezeit unter dem Titel`, async ({ page }) => {
      await page.goto(path);
      const h1 = page.locator('main h1');
      await expect(h1).toBeVisible();
      const byline = page.locator('main .byline');
      await expect(byline, 'genau ein Metadatenblock').toHaveCount(1);

      // AC1: rundes Porträt links vom hervorgehobenen Namen, Block unterhalb des Titels
      const img = byline.locator('img');
      const name = byline.locator('strong');
      await expect(name).toHaveText(AUTHOR);
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      const shape = await img.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) };
      });
      expect(Math.abs(shape.w - shape.h), 'Porträt quadratisch').toBeLessThanOrEqual(1);
      expect(shape.radius, 'Porträt rund').toBeGreaterThanOrEqual(shape.w / 2 - 0.5);
      const [imgBox, nameBox, h1Box] = [(await img.boundingBox())!, (await name.boundingBox())!, (await h1.boundingBox())!];
      expect(imgBox.x + imgBox.width, 'Porträt links vom Namen').toBeLessThanOrEqual(nameBox.x);
      expect(imgBox.y, 'Block unter dem Titel').toBeGreaterThanOrEqual(h1Box.y + h1Box.height);

      // AC2 und AC3: Zeile unter dem Namen mit „Stand · Lesezeit“
      const meta = byline.locator('.byline-meta');
      await expect(meta).toHaveText(`${article[lang].stand} · ${article[lang].time}`);
      await expect(meta.locator('time')).toHaveAttribute('datetime', '2026-11-16');
      const metaBox = (await meta.boundingBox())!;
      expect(metaBox.y, 'Metazeile unter dem Namen').toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    });
  }
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });
    for (const article of ARTICLES) {
      for (const lang of ['de', 'en'] as const) {
        const path = `/${lang}/themen/${article.slug}`;
        test(`REQ-56-AC4: ${path} zeigt Name, Stand und Lesezeit je einmal vollständig sichtbar (${viewport.width} px)`, async ({ page }) => {
          await page.goto(path);
          await expect(page.locator('main h1')).toBeVisible();
          await expectNoHorizontalScroll(page);
          const main = page.locator('main');
          for (const text of [AUTHOR, article[lang].stand, article[lang].time]) {
            const hit = main.getByText(text, { exact: true });
            await expect(hit, `„${text}“ genau einmal`).toHaveCount(1);
            await hit.scrollIntoViewIfNeeded();
            await expect(hit).toBeVisible();
            const box = (await hit.boundingBox())!;
            expect(box.x, `„${text}“ linke Kante im Viewport`).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, `„${text}“ rechte Kante im Viewport`).toBeLessThanOrEqual(viewport.width);
            // Nicht abgeschnitten: Der umgebende Block läuft nicht über (kein verdeckter Überlauf).
            const overflow = await hit.evaluate((el) => {
              const block = el.closest('p, div')!;
              return block.scrollWidth - block.clientWidth;
            });
            expect(overflow, `„${text}“ nicht abgeschnitten`).toBeLessThanOrEqual(1);
          }
        });
      }
    }
  });
}

import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

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
    expect(text(await page.locator('#sd-title').innerText())).toBe(expected[lang].title);
    const byline = page.locator('.byline');
    await expect(byline).toContainText('Marvin Jakob');
    await expect(byline).toContainText(expected[lang].stand);
    await expect(byline).toContainText(expected[lang].time);
  }
});

test('REQ-19-AC2: Abschnitte folgen der Vorlage', async ({ page }) => {
  await page.goto(PATH('de'));
  const ids = ['moderne-softwareentwicklung', 'der-weg', 'drei-teams', 'release-gate', 'meinung', 'more-title'];
  const positions = await Promise.all(ids.map((id) => page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top + scrollY)));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  await expect(page.locator('#moderne-softwareentwicklung')).toHaveText('Moderne Softwareentwicklung');
  await expect(page.locator('#der-weg')).toContainText('Das ist der Weg!');
  await expect(page.locator('#opinion-title')).toBeVisible();
});

test('REQ-19-AC3: Prozess- und Release-Gate-Grafik sprachpassend mit Alternativtext und Link zur Originalgröße', async ({ page, request }) => {
  const sources: Record<string, string[]> = {};
  for (const lang of ['de', 'en'] as const) {
    await page.goto(PATH(lang));
    sources[lang] = [];
    for (const n of [0, 1]) {
      const img = page.locator('main figure img').nth(n);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      expect((await img.getAttribute('alt'))!.length).toBeGreaterThan(40);
      const link = img.locator('xpath=ancestor::a[1]');
      await expect(link).toHaveAttribute('target', '_blank');
      const href = (await link.getAttribute('href'))!;
      expect(href).toBe(await img.getAttribute('src'));
      expect((await request.get(href)).status()).toBe(200);
      sources[lang].push(href);
    }
  }
  // Je Sprache eigene Grafiken
  expect(sources.de).not.toEqual(sources.en);
});

test('REQ-19-AC4: Vibe-Coding-, Kontakt- und Themenverweise führen zu vorhandenen Zielen der aktiven Sprache', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(PATH(lang));
    await expect(page.locator('#sd-title')).toBeVisible();
    const hrefs = await page.locator('main a[href^="/"]:not([href^="/assets"])').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
    expect(hrefs).toContain(`/${lang}/themen/vibe-coding`);
    expect(hrefs).toContain(`/${lang}/kontakt`);
    for (const href of hrefs) expect(href.startsWith(`/${lang}`), href).toBe(true);
    for (const href of hrefs.filter((h) => !h.includes('#'))) {
      await page.goto(href);
      await expect(page.getByRole('heading', { name: /Seite nicht gefunden|Page not found/ }), href).toHaveCount(0);
    }
  }
  await page.goto(PATH('de'));
  await page.getByRole('link', { name: 'Alle Themen' }).click();
  await expect(page).toHaveURL(/\/de#themen$/);
  await expect(page.locator('#themen')).toBeInViewport();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });
    test(`REQ-19-AC5: ohne horizontalen Bildlauf nutzbar, Sprachwechsel bleibt im Artikel (${viewport.width} px)`, async ({ page }) => {
      await page.goto(PATH('de'));
      await expectNoHorizontalScroll(page);
      for (const img of await page.locator('main figure img').all()) {
        const box = (await img.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      if (viewport.width < 650) await page.getByRole('button', { name: 'Menü' }).click();
      await page.getByRole('button', { name: 'English' }).click();
      await expect(page).toHaveURL(/\/en\/themen\/softwareentwicklung$/);
      expect(text(await page.locator('#sd-title').innerText())).toBe('AI in Software Development');
      await expectNoHorizontalScroll(page);
    });
  });
}

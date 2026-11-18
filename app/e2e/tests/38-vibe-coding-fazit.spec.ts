import { expect, test } from '../support/fixtures';

// Anforderung #38: Unter dem Fazit der Themenseite „Vibe Coding“ stehen keine Linkkarten mehr.
// Quelle: Ticket #38 (Screenshot des Bereichs nav.vc-next am Ende von VibeCoding.tsx).
const CARDS = {
  de: ['Zur Themenübersicht', 'KI Readiness einschätzen', 'Weiterlesen'],
  en: ['Back to the topic overview', 'Assess your AI Readiness', 'Read on'],
} as const;
const VIEWPORTS = [{ name: 'Desktop', width: 1280, height: 800 }, { name: 'Mobil', width: 375, height: 812 }];

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`REQ-38-AC1: keine Linkkarten unter dem Fazit (de/en, ${vp.name})`, async ({ page }) => {
      for (const lang of ['de', 'en'] as const) {
        await page.goto(`/${lang}/themen/vibe-coding`);
        const conclusion = page.locator('section[aria-labelledby="vc-conclusion-title"]');
        await conclusion.scrollIntoViewIfNeeded();
        await expect(conclusion, `${lang}: Fazit sichtbar`).toBeVisible();
        const [allTopics, readiness, label] = CARDS[lang];
        await expect(page.locator('main').getByRole('link', { name: allTopics, exact: true }), `${lang}: Karte „${allTopics}“`).toHaveCount(0);
        await expect(page.locator('main').getByRole('link', { name: readiness, exact: true }), `${lang}: Karte „${readiness}“`).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: label, exact: true }), `${lang}: Bereich „${label}“`).toHaveCount(0);
      }
    });

    test(`REQ-38-AC2: nach dem Fazit folgt direkt das Seitenende (${vp.name})`, async ({ page }) => {
      for (const lang of ['de', 'en'] as const) {
        await page.goto(`/${lang}/themen/vibe-coding`);
        const article = page.locator('article.vc-page');
        await expect(article.locator('#vc-conclusion-title')).toBeVisible();
        // Das Fazit ist das letzte Element des Beitrags; kein Platzhalter und kein leerer Kartenbereich folgt.
        const trailing = await article.evaluate((el) => {
          const conclusion = el.querySelector('section[aria-labelledby="vc-conclusion-title"]')!;
          const after: string[] = [];
          for (let n = conclusion.nextElementSibling; n; n = n.nextElementSibling) after.push(n.outerHTML.slice(0, 80));
          return after;
        });
        expect(trailing, `${lang}: Elemente nach dem Fazit`).toEqual([]);
        // Zwischen Fazit und Seitenfuß bleibt nur der reguläre Abstand des Seitenfußes (margin-top),
        // kein zusätzlicher Raum für die Karten.
        const { gap, regular } = await page.evaluate(() => {
          const c = document.querySelector('section[aria-labelledby="vc-conclusion-title"]')!.getBoundingClientRect();
          const footer = document.querySelector('footer.site-footer')!;
          return { gap: footer.getBoundingClientRect().top - c.bottom, regular: parseFloat(getComputedStyle(footer).marginTop) };
        });
        expect(gap, `${lang}: Abstand Fazit → Seitenfuß in px`).toBeGreaterThanOrEqual(0);
        expect(gap, `${lang}: Abstand Fazit → Seitenfuß in px (regulär ${regular} px)`).toBeLessThanOrEqual(regular + 1);
      }
    });
  });
}

test('REQ-38-AC3: Tastatur und Screenreader erreichen nach dem Fazit direkt den Seitenfuß', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}/themen/vibe-coding`);
    const [allTopics, readiness, label] = CARDS[lang];
    // Barrierefreiheitsbaum: weder Navigationsbereich noch Kartenlinks im Beitrag.
    const tree = await page.locator('article.vc-page').ariaSnapshot();
    expect(tree, `${lang}: Barrierefreiheitsbaum`).not.toContain(label);
    expect(tree).not.toContain(allTopics);
    expect(tree).not.toContain(readiness);
    // Tastatur: Fokus vom letzten fokussierbaren Element vor dem Fazit-Ende springt per Tab in den Seitenfuß.
    const lastInArticle = await page.locator('article.vc-page').evaluate((el) => {
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])')];
      const last = items.at(-1)!;
      last.focus();
      return last.outerHTML.slice(0, 120);
    });
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => ({
      inFooter: !!document.activeElement?.closest('footer.site-footer'),
      text: document.activeElement?.textContent?.trim() ?? '',
    }));
    expect(next.inFooter, `${lang}: nach ${lastInArticle} folgt „${next.text}“`).toBe(true);
  }
});

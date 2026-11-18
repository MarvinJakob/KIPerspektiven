// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/SoftwareDevelopment.tsx
import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #66: „Softwareentwicklung“ – Überschrift und Zitat in den Lesefluss integrieren.
// Ersetzt für diesen Artikel REQ-57-AC2 (Titelspalte links, Lesespalte höchstens 760 px).
// Unit-Tests: app/frontend/src/pages/SoftwareDevelopment.test.tsx.

const LANGS = ['de', 'en'] as const;
const SD = (lang: string) => `/${lang}/themen/softwareentwicklung`;

/** Erwartete Texte aus der Anforderung bzw. dem Artikeltext (content/topics/Software Development v1_de.md), je Sprache. */
const TEXT = {
  de: { heading: 'Moderne Softwareentwicklung', quote: 'Das ist der Weg!', author: '– Din Djarin', way: 'Es führt kein Weg daran vorbei' },
  en: { heading: 'Modern Software Development', quote: 'This is the way!', author: '– Din Djarin', way: 'There is no way around' },
} as const;

/**
 * REQ-66-AC3: Artikelrahmen laut DESIGN.md („Gemeinsames Raster“): `min(1240px, 100% − 96px)`, zentriert.
 * Unabhängig vom Anwendungscode berechnet: 1280 → 1184 px (48–1232), 1440 → 1240 px (100–1340).
 */
const FRAME: Record<number, [number, number]> = { 1280: [48, 1232], 1440: [100, 1340] };

type Box = { left: number; right: number; top: number; bottom: number };
const box = (l: Locator): Promise<Box> =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
  });
const px = (b: Box) => `${b.left.toFixed(1)}–${b.right.toFixed(1)} px`;

/** Fläche genau des Textknotens mit `text` innerhalb des Elements (unabhängig davon, wie er ausgezeichnet ist). */
const textBox = (l: Locator, text: string): Promise<Box> =>
  l.evaluate((e, text) => {
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const at = n.textContent!.indexOf(text);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(n, at);
      range.setEnd(n, at + text.length);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
    }
    throw new Error(`Text „${text}“ nicht gefunden`);
  }, text);

/** Die Elemente des Lesebeginns: Überschrift, Einleitung, Verweis, zweiter Absatz, Zitat, Zuschreibung, Absatz „Der Weg“. */
async function opening(page: Page, lang: (typeof LANGS)[number]) {
  const t = TEXT[lang];
  const article = page.locator('main article');
  const heading = page.getByRole('heading', { level: 2, name: t.heading });
  const quote = article.locator('#der-weg');
  const paragraphs = article.locator('section[aria-labelledby="moderne-softwareentwicklung"] p');
  return {
    heading,
    lead: paragraphs.first(),
    related: article.locator('a.related-link'),
    intro: paragraphs.last(),
    quote,
    quoteText: () => textBox(quote, t.quote),
    author: () => textBox(quote, t.author),
    way: article.locator('p', { hasText: t.way }),
  };
}

for (const width of [1280, 1440] as const) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });
    const [frameLeft, frameRight] = FRAME[width];

    test(`REQ-66-AC1: Zwischenüberschrift steht über dem Einleitungsabsatz auf der linken Textkante (${width} px, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(SD(lang));
        const o = await opening(page, lang);
        await expect(o.heading).toBeVisible();
        const [h, lead] = [await box(o.heading), await box(o.lead)];
        const label = `${lang}: Überschrift ${px(h)}, Einleitung ${px(lead)}`;
        expect(Math.abs(h.left - lead.left), `${label} – gleiche linke Kante`).toBeLessThanOrEqual(1);
        expect(Math.abs(h.left - frameLeft), `${label} – linke Rahmenkante ${frameLeft} px`).toBeLessThanOrEqual(1);
        expect(h.bottom, `${label} – Überschrift oberhalb der Einleitung`).toBeLessThanOrEqual(lead.top);
        // Als Zwischenüberschrift erkennbar: deutlich größer und kräftiger als der Fließtext.
        const [hs, ps] = await Promise.all([o.heading, o.lead].map((l) => l.evaluate((e) => { const s = getComputedStyle(e); return { size: parseFloat(s.fontSize), weight: Number(s.fontWeight) }; })));
        expect(hs.size, `${lang}: Schriftgröße Überschrift ${hs.size} px vs. Text ${ps.size} px`).toBeGreaterThanOrEqual(ps.size * 1.4);
        expect(hs.weight, `${lang}: Schriftstärke Überschrift`).toBeGreaterThan(ps.weight);
      }
    });

    test(`REQ-66-AC2: Zitat mit Zuschreibung steht zwischen Einleitung und Absatz „Der Weg“ (${width} px, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(SD(lang));
        const o = await opening(page, lang);
        await expect(o.quote).toBeVisible();
        const [intro, quote, way] = await Promise.all([o.intro, o.quote, o.way].map(box));
        const [text, author] = [await o.quoteText(), await o.author()];
        const label = `${lang}: Einleitung bis ${intro.bottom.toFixed(0)}, Zitat ${quote.top.toFixed(0)}–${quote.bottom.toFixed(0)}, Absatz ab ${way.top.toFixed(0)}`;
        expect(quote.top, `${label} – Zitat unter der Einleitung`).toBeGreaterThanOrEqual(intro.bottom);
        expect(quote.bottom, `${label} – Zitat über dem Absatz`).toBeLessThanOrEqual(way.top);
        expect(Math.abs(quote.left - frameLeft), `${lang}: Zitat ${px(quote)} beginnt an der linken Rahmenkante`).toBeLessThanOrEqual(1);
        // Optisch zusammengehörig: Zuschreibung direkt unter dem Zitattext, linksbündig, im selben Block.
        expect(author.top, `${lang}: Zuschreibung unter dem Zitattext`).toBeGreaterThanOrEqual(text.bottom - 1);
        expect(author.top - text.bottom, `${lang}: Abstand Zitat → Zuschreibung`).toBeLessThanOrEqual(24);
        expect(Math.abs(author.left - quote.left), `${lang}: Zuschreibung linksbündig zum Zitat`).toBeLessThanOrEqual(1);
        // Vorlesereihenfolge: Zitat, Zuschreibung, dann der Absatz.
        const tree = (await page.locator('main article').ariaSnapshot()).replace(/\s+/g, ' ');
        const order = [TEXT[lang].quote, TEXT[lang].author, TEXT[lang].way].map((s) => tree.indexOf(s));
        expect(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], `${lang}: Vorlesereihenfolge ${order.join(' < ')}`).toBe(true);
      }
    });

    test(`REQ-66-AC3: Absätze reichen über den ganzen Artikelrahmen ${frameLeft}–${frameRight} px (${width} px, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(SD(lang));
        await expect(page.locator('#sd-title')).toBeVisible();
        const sections = page.locator('main article > section:not(.opinion)');
        // Moderne Softwareentwicklung, Der Weg, Drei Teams, Release Gate
        await expect(sections).toHaveCount(4);
        for (const p of await sections.locator('p').all()) {
          const b = await box(p);
          const msg = `Absatz „${(await p.innerText()).slice(0, 40)}…“ (${lang}): ${px(b)}, erwartet ${frameLeft}–${frameRight} px`;
          expect(Math.abs(b.left - frameLeft), msg).toBeLessThanOrEqual(1);
          expect(Math.abs(b.right - frameRight), msg).toBeLessThanOrEqual(1);
        }
        // Keine separate Spalte: Überschrift und Zitat beginnen auf derselben Kante wie der Text.
        for (const id of ['moderne-softwareentwicklung', 'der-weg']) {
          const b = await box(page.locator(`#${id}`));
          expect(Math.abs(b.left - frameLeft), `#${id} (${lang}): ${px(b)} in eigener Spalte`).toBeLessThanOrEqual(1);
        }
        await expectNoHorizontalScroll(page);
      }
    });
  });
}

test.describe('390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('REQ-66-AC4: Überschrift, Einleitung, Zitat mit Zuschreibung und Absätze stehen untereinander, ohne horizontalen Bildlauf (DE/EN)', async ({ page }) => {
    for (const lang of LANGS) {
      await page.goto(SD(lang));
      const o = await opening(page, lang);
      await expect(o.heading).toBeVisible();
      const names = ['Überschrift', 'Einleitung', 'Verweis', 'zweiter Absatz', 'Zitat', 'Zuschreibung', 'Absatz „Der Weg“'];
      const boxes = [await box(o.heading), await box(o.lead), await box(o.related), await box(o.intro), await o.quoteText(), await o.author(), await box(o.way)];
      for (const [i, b] of boxes.entries()) {
        expect(b.left, `${names[i]} (${lang}) links außerhalb: ${px(b)}`).toBeGreaterThanOrEqual(0);
        expect(b.right, `${names[i]} (${lang}) rechts außerhalb: ${px(b)}`).toBeLessThanOrEqual(390);
        if (i) expect(b.top, `${names[i]} steht nicht unter ${names[i - 1]} (${lang})`).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
      }
      await expectNoHorizontalScroll(page);
    }
  });
});

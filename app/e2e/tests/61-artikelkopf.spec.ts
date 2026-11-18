// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx app/frontend/src/pages/AuditDimension.tsx app/frontend/src/pages/AuditResult.tsx
import type { Page } from '@playwright/test';
import { completeAssessment, expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #61: Titel aller Themenartikel vereinheitlichen und Brotkrumennavigation entfernen.
// Sollwerte der Titeltypografie aus dem Referenzstand 0bf4b0f (VibeCoding.css, `.vc-hero h1`):
// font-size clamp(3.6rem, 8vw, 7rem), line-height 1, letter-spacing -.06em, font-weight 700 (styles.css, h1).
const ARTICLES = ['vibe-coding', 'softwareentwicklung'] as const;
const LANGS = ['de', 'en'] as const;
const REFERENCE = {
  1280: { fontSize: 102.4, lineHeight: 102.4, letterSpacing: -6.144, fontWeight: '700' },
  1440: { fontSize: 112, lineHeight: 112, letterSpacing: -6.72, fontWeight: '700' },
} as const;
const SUBTITLE = {
  de: 'Willkommen beim Vibe Coding: Dem einfachsten Weg, SLOP zu erzeugen.',
  en: 'Welcome to Vibe Coding: The easiest way to generate SLOP.',
} as const;
const CRUMB_NAMES = /^(Pfadnavigation|Breadcrumbs?|Brotkrumen|Brotkrümelnavigation)$/i;
const CRUMB_TEXT = /(Start|Home)\s*\/\s*(Themen|Topics)|(Themen|Topics)\s*\/\s*\S/;

type Typo = { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing: number; fontWeight: string };
const typography = (page: Page): Promise<Typo> =>
  page.locator('main h1').evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      fontFamily: s.fontFamily,
      fontSize: parseFloat(s.fontSize),
      lineHeight: parseFloat(s.lineHeight),
      letterSpacing: parseFloat(s.letterSpacing),
      fontWeight: s.fontWeight,
    };
  });

/** Mittelpunkt der Inhaltsbox des Artikelrahmens (.container um den Kopf) und Mittelpunkte von Titel und Autorenblock. */
const centers = (page: Page) =>
  page.locator('main h1').evaluate((h1) => {
    const frame = h1.closest('.container')!;
    const r = frame.getBoundingClientRect();
    const s = getComputedStyle(frame);
    const mid = (b: DOMRect) => b.left + b.width / 2;
    const content = r.left + parseFloat(s.paddingLeft) + (r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)) / 2;
    return {
      frame: content,
      title: mid(h1.getBoundingClientRect()),
      textAlign: getComputedStyle(h1).textAlign,
      byline: mid(frame.querySelector('.byline')!.getBoundingClientRect()),
    };
  });

/** Inhalt des Artikelkopfs in Dokumentreihenfolge: Titel, Untertitel (falls vorhanden), Autorenblock. */
const headOrder = (page: Page) =>
  page.locator('main h1').evaluate((h1) => {
    const head = h1.parentElement!;
    return [...head.children].map((el) => (el === h1 ? 'title' : el.classList.contains('byline') ? 'byline' : el.tagName === 'P' ? 'subtitle' : `other:${el.className}`));
  });

for (const width of [1280, 1440] as const) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`REQ-61-AC1: Vibe-Coding-Referenz behält ihre Titeltypografie (${width} px)`, async ({ page }) => {
      await page.goto('/de/themen/vibe-coding');
      const t = await typography(page);
      const want = REFERENCE[width];
      expect(t.fontSize, 'Schriftgröße').toBeCloseTo(want.fontSize, 1);
      expect(t.lineHeight, 'Zeilenhöhe').toBeCloseTo(want.lineHeight, 1);
      expect(t.letterSpacing, 'Laufweite').toBeCloseTo(want.letterSpacing, 1);
      expect(t.fontWeight, 'Schriftstärke').toBe(want.fontWeight);
    });

    for (const slug of ARTICLES) {
      for (const lang of LANGS) {
        const path = `/${lang}/themen/${slug}`;
        test(`REQ-61-AC1: ${path} hat den gemeinsamen zentrierten Artikelkopf (${width} px)`, async ({ page }) => {
          await page.goto('/de/themen/vibe-coding');
          const reference = await typography(page);
          await page.goto(path);
          await expect(page.locator('main h1'), 'genau eine Hauptüberschrift').toHaveCount(1);
          expect(await typography(page), 'Titeltypografie wie Vibe Coding').toEqual(reference);

          const c = await centers(page);
          expect(c.textAlign).toBe('center');
          expect(Math.abs(c.title - c.frame), 'Titel horizontal im Artikelrahmen zentriert').toBeLessThanOrEqual(1);
          expect(Math.abs(c.byline - c.frame), 'Autorenblock zentriert').toBeLessThanOrEqual(1);

          const order = await headOrder(page);
          expect(order, 'Reihenfolge Titel, Untertitel, Autorenblock').toEqual(slug === 'vibe-coding' ? ['title', 'subtitle', 'byline'] : ['title', 'byline']);
          if (slug === 'vibe-coding') await expect(page.locator('main h1 + p')).toHaveText(SUBTITLE[lang]);

          // Keine nummerierte Themenzeile und keine Kennzeile oberhalb des Titels.
          const head = page.locator('main h1').locator('xpath=..');
          await expect(head.locator('.topic-number, .eyebrow')).toHaveCount(0);
          await expect(page.locator('main .topic-number')).toHaveCount(0);

          // Porträt, Name, Stand und Lesezeit bleiben sichtbar.
          const byline = page.locator('main .byline');
          await expect(byline.locator('img')).toBeVisible();
          await expect(byline.locator('strong')).toHaveText('Marvin Jakob');
          await expect(byline.locator('time')).toBeVisible();
          await expect(byline.locator('.byline-meta')).toContainText(lang === 'de' ? 'Lesezeit' : 'min read');
          const [h1Box, bylineBox] = [(await page.locator('main h1').boundingBox())!, (await byline.boundingBox())!];
          expect(bylineBox.y, 'Autorenblock unter dem Titel').toBeGreaterThanOrEqual(h1Box.y + h1Box.height);
        });
      }
    }
  });
}

/** Prüft eine Themenroute auf Reste der Brotkrumennavigation (sichtbar, für Screenreader, per Tab). */
async function expectNoBreadcrumbs(page: Page, path: string) {
  const main = page.locator('main');
  await expect(main.locator('h1'), `${path}: Seitentitel geladen`).toBeVisible();
  await expect(main.getByRole('navigation', { name: CRUMB_NAMES }), `${path}: Brotkrumen-Navigation`).toHaveCount(0);
  await expect(main.locator('.crumbs, .article-crumbs, [aria-label*="crumb" i], [aria-label*="Pfad" i], [aria-label*="Brot" i]'), `${path}: Brotkrumen-Element`).toHaveCount(0);
  expect((await main.innerText()).replace(/\s+/g, ' '), `${path}: Brotkrumenkette im Text`).not.toMatch(CRUMB_TEXT);
  // Vor dem Seitentitel ist außer der Schrittnavigation der Selbsteinschätzung nichts per Tab erreichbar.
  const before = await main.evaluate((m) => {
    const h1 = m.querySelector('h1')!;
    return [...m.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING)
      .filter((el) => !el.closest('nav.assess-steps'))
      .map((el) => `${el.tagName.toLowerCase()} „${el.textContent?.trim()}“`);
  });
  expect(before, `${path}: fokussierbar vor dem Titel`).toEqual([]);
}

for (const lang of LANGS) {
  test(`REQ-61-AC2: keine Brotkrumen auf allen Themenseiten (${lang})`, async ({ page }) => {
    const topics = (await (await page.request.get(`/api/topics?lang=${lang}`)).json()) as { items: { slug: string }[] };
    const slugs = topics.items.map((t) => t.slug);
    for (const slug of [...ARTICLES, 'ai-audit']) expect(slugs, `Thema ${slug} vorhanden`).toContain(slug);
    for (const slug of slugs) {
      await page.goto(`/${lang}/themen/${slug}`);
      await expectNoBreadcrumbs(page, `/${lang}/themen/${slug}`);
    }
    // Hauptnavigation bleibt nutzbar: Das Themenmenü führt weiterhin zu einem Artikel.
    await page.goto(`/${lang}/themen/softwareentwicklung`);
    const menu = page.locator('.nav-topics button[aria-expanded]');
    await menu.click();
    await page.locator('.nav-topics').getByRole('link', { name: 'Vibe Coding' }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/themen/vibe-coding$`));
  });

  test(`REQ-61-AC2: Selbsteinschätzung ohne Brotkrumen und weiter bedienbar (${lang})`, async ({ page }) => {
    const audit = (await (await page.request.get(`/api/audit?lang=${lang}`)).json()) as { dimensions: { slug: string }[] };
    const first = `/${lang}/themen/ai-audit/${audit.dimensions[0].slug}`;
    await page.goto(first);
    await expectNoBreadcrumbs(page, first);
    const steps = page.getByRole('navigation', { name: lang === 'de' ? 'Ablauf der Selbsteinschätzung' : 'Self-assessment steps' });
    await expect(steps, 'Schrittnavigation vorhanden').toBeVisible();

    // Schritt- und Weiter-Navigation bleiben bedienbar bis zur Auswertung.
    await completeAssessment(page, lang);
    await expectNoBreadcrumbs(page, `/${lang}/themen/ai-audit/auswertung`);
    await steps.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/themen/ai-audit/${audit.dimensions[0].slug}$`));
  });
}

for (const width of [320, 390] as const) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });
    for (const slug of ARTICLES) {
      for (const lang of LANGS) {
        const path = `/${lang}/themen/${slug}`;
        test(`REQ-61-AC3: ${path} zeigt den Kopf vollständig und zentriert (${width} px)`, async ({ page }) => {
          await page.goto(path);
          await expect(page.locator('main h1')).toBeVisible();
          await expectNoHorizontalScroll(page);
          const c = await centers(page);
          expect(c.textAlign).toBe('center');
          expect(Math.abs(c.title - c.frame), 'Titel zentriert').toBeLessThanOrEqual(1);

          // Jede Textzeile von Titel, Untertitel und Autorenblock liegt im Fenster; kein Element läuft über.
          const report = await page.locator('main h1').evaluate((h1, vw) => {
            const parts = [...h1.parentElement!.querySelectorAll<HTMLElement>('h1, p, strong, .byline-meta, .byline')];
            const out: string[] = [];
            for (const el of parts) {
              if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') out.push(`${el.tagName} läuft über (${el.scrollWidth} > ${el.clientWidth})`);
              const range = document.createRange();
              range.selectNodeContents(el);
              for (const r of range.getClientRects()) {
                if (r.width && (r.left < -0.5 || r.right > vw + 0.5)) out.push(`${el.tagName}: Zeile ${Math.round(r.left)}–${Math.round(r.right)} px`);
              }
            }
            const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
            return { out, lines };
          }, width);
          expect(report.out, 'abgeschnittener oder überlaufender Text im Artikelkopf').toEqual([]);
          if (slug === 'softwareentwicklung') expect(report.lines, 'langer Titel bricht um').toBeGreaterThan(1);
        });
      }
    }
  });
}

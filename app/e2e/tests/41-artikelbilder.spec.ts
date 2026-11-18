import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #41: Artikelbilder ohne neuen Tab anzeigen und in „Softwareentwicklung“ an die Textbreite anpassen.
// Betroffen: Harness-Grafik (Vibe Coding), Prozess- und Release-Gate-Grafik (Softwareentwicklung), jeweils DE und EN.

const LANGS = ['de', 'en'] as const;
const VC = (lang: string) => `/${lang}/themen/vibe-coding`;
const SD = (lang: string) => `/${lang}/themen/softwareentwicklung`;
const THEME_KEY = 'ki-perspektiven.theme';

/** Die drei Diagramme mit ihrer Seite und dem angrenzenden Fließtext. */
const DIAGRAMS = [
  { name: 'Harness', path: VC, figure: (p: Page) => p.locator('#vc-harness figure:has(img)'), text: (p: Page) => p.locator('#vc-harness .vc-body > p').first() },
  { name: 'Prozess', path: SD, figure: (p: Page) => p.locator('main figure').nth(0), text: (p: Page) => p.locator('#drei-teams p').first() },
  { name: 'Release Gate', path: SD, figure: (p: Page) => p.locator('main figure').nth(1), text: (p: Page) => p.locator('#release-gate p').first() },
];

async function loaded(figure: Locator) {
  const img = figure.locator('img');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img;
}

/** Sichtbare Fläche eines Diagramms: Vereinigung der Rechtecke von figure und allen Nachfahren (Rahmen, Innenabstand, Bild). */
const visibleBox = (figure: Locator) =>
  figure.evaluate((f) => {
    const rects = [f, ...f.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)) };
  });

/** Dargestelltes und natürliches Seitenverhältnis des Bildes. */
const ratios = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => {
    const r = el.getBoundingClientRect();
    return { shown: r.width / r.height, natural: el.naturalWidth / el.naturalHeight, height: r.height };
  });

test.describe('REQ-41-AC1: Klick auf ein Diagramm hält den Artikel offen', () => {
  for (const d of DIAGRAMS) {
    test(`REQ-41-AC1: ${d.name} öffnet weder Tab noch Bilddatei (DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(d.path(lang));
        const figure = d.figure(page);
        const img = await loaded(figure);
        // Kein Link um das Bild, der eine Einzelansicht öffnen könnte
        await expect(img.locator('xpath=ancestor::a'), `${d.name} (${lang}) liegt in einem Link`).toHaveCount(0);
        const url = page.url();
        await page.evaluate(() => ((window as unknown as { __stay: boolean }).__stay = true));
        const scrollY = await page.evaluate(() => scrollY);
        // Ein neuer Tab wäre ein popup-Ereignis; ohne Ereignis ist eine begrenzte Wartezeit der einzige Nachweis.
        const popup = page.waitForEvent('popup', { timeout: 750 }).then(() => true, () => false);
        await img.click();
        expect(await popup, `${d.name} (${lang}) öffnet einen neuen Tab`).toBe(false);
        expect(page.url(), `${d.name} (${lang}) navigiert`).toBe(url);
        expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay), `${d.name} (${lang}) lädt eine neue Seite`).toBe(true);
        expect(Math.abs((await page.evaluate(() => scrollY)) - scrollY), `${d.name} (${lang}) verlässt die Textstelle`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('REQ-41-AC1: Tippen auf ein Diagramm hält den Artikel offen (375 px, Touch)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('REQ-41-AC1: Tippen auf die drei Diagramme öffnet weder Tab noch Bilddatei', async ({ page }) => {
    for (const d of DIAGRAMS) {
      await page.goto(d.path('de'));
      const img = await loaded(d.figure(page));
      const url = page.url();
      const popup = page.waitForEvent('popup', { timeout: 750 }).then(() => true, () => false);
      await img.tap();
      expect(await popup, `${d.name} öffnet einen neuen Tab`).toBe(false);
      expect(page.url(), `${d.name} navigiert`).toBe(url);
    }
  });
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });

    test(`REQ-41-AC2: Prozess- und Release-Gate-Grafik innerhalb der Textkanten, Seitenverhältnis erhalten (${viewport.width} px)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(SD(lang));
        for (const d of DIAGRAMS.filter((x) => x.path === SD)) {
          const figure = d.figure(page);
          const img = await loaded(figure);
          const box = await visibleBox(figure);
          const text = (await d.text(page).boundingBox())!;
          const label = `${d.name} (${lang}): Bildfläche ${Math.round(box.left)}–${Math.round(box.right)} px, Text ${Math.round(text.x)}–${Math.round(text.x + text.width)} px`;
          expect(box.left, label).toBeGreaterThanOrEqual(text.x - 0.5);
          expect(box.right, label).toBeLessThanOrEqual(text.x + text.width + 0.5);
          expect(box.left, label).toBeGreaterThanOrEqual(0);
          expect(box.right, label).toBeLessThanOrEqual(viewport.width);
          const r = await ratios(img);
          expect(r.height, `${d.name} (${lang}) ist sichtbar`).toBeGreaterThan(40);
          expect(Math.abs(r.shown / r.natural - 1), `${d.name} (${lang}) verzerrt`).toBeLessThan(0.01);
        }
        await expectNoHorizontalScroll(page);
      }
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`REQ-41-AC3: Harness-Grafik füllt die Artikelspalte auf heller Fläche (${theme}, ${viewport.width} px)`, async ({ page }) => {
        await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [THEME_KEY, theme]);
        const d = DIAGRAMS[0];
        for (const lang of LANGS) {
          await page.goto(VC(lang));
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const figure = d.figure(page);
          const img = await loaded(figure);
          const box = await visibleBox(figure);
          const text = (await d.text(page).boundingBox())!;
          // Wie bisher: genau so breit wie die Artikelspalte, weder schmaler noch breiter
          expect(Math.abs(box.left - text.x), `Harness (${lang}) linke Kante`).toBeLessThanOrEqual(1);
          expect(Math.abs(box.right - (text.x + text.width)), `Harness (${lang}) rechte Kante`).toBeLessThanOrEqual(1);
          const r = await ratios(img);
          expect(Math.abs(r.shown / r.natural - 1), `Harness (${lang}) verzerrt`).toBeLessThan(0.01);
          // Dunkle Pfeile und Beschriftungen brauchen eine helle, deckende Fläche direkt hinter dem Bild
          const luminance = await img.evaluate((el) => {
            const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
            for (let n: Element | null = el; n; n = n.parentElement) {
              const c = parse(getComputedStyle(n).backgroundColor);
              if (c.length >= 3 && (c.length < 4 || c[3] > 0.9)) {
                const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
                return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
              }
            }
            return -1;
          });
          expect(luminance, `Harness (${lang}, ${theme}) liegt nicht auf heller Fläche`).toBeGreaterThanOrEqual(0.9);
        }
      });
    }
  });
}

test.describe('REQ-41-AC4: Tastatur und Alternativtext', () => {
  for (const [name, path] of [['Vibe Coding', VC], ['Softwareentwicklung', SD]] as const) {
    test(`REQ-41-AC4: Tab-Navigation bietet kein Öffnen der Bilddatei, Alternativtexte bleiben (${name}, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(path(lang));
        const figures = page.locator('main figure:has(img)');
        await expect(figures.first()).toBeVisible();
        const sources = await figures.locator('img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
        expect(sources.length).toBeGreaterThan(0);
        // Mit Tab durch die ganze Seite, bis der Fokus wieder am Anfang ist
        const seen: { inFigure: boolean; href: string | null; label: string }[] = [];
        for (let i = 0; i < 400; i++) {
          await page.keyboard.press('Tab');
          const f = await page.evaluate(() => {
            const a = document.activeElement as HTMLElement | null;
            if (!a || a === document.body) return null;
            return { inFigure: !!a.closest('figure:has(img)'), href: a instanceof HTMLAnchorElement ? a.href : null, label: a.outerHTML.slice(0, 80) };
          });
          if (!f) break;
          if (seen.length && f.label === seen[0].label && f.href === seen[0].href) break;
          seen.push(f);
        }
        expect(seen.length, 'Tab-Navigation erreicht Elemente').toBeGreaterThan(3);
        for (const f of seen) {
          expect(f.inFigure, `Fokussierbares Element im Diagramm: ${f.label}`).toBe(false);
          expect(sources, `Link öffnet Bilddatei: ${f.label}`).not.toContain(f.href);
        }
        // Alternativtexte bleiben für Screenreader verfügbar
        for (const img of await figures.locator('img').all()) {
          const alt = (await img.getAttribute('alt')) ?? '';
          expect(alt.length, 'Alternativtext vorhanden').toBeGreaterThan(20);
          await expect(page.getByRole('img', { name: alt, exact: true })).toHaveCount(1);
        }
      }
    });
  }
});

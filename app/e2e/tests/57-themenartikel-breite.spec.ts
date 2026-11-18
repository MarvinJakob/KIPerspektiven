import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #57: Verfügbaren Platz auf dem Desktop in allen Themenartikeln besser nutzen.
// Themenartikel: „Vibe Coding“ (Referenz) und „KI in der Softwareentwicklung“, jeweils DE und EN.
// Unit-Tests der Gestaltungsregeln: app/frontend/src/pages/SoftwareDevelopment.test.tsx.

const LANGS = ['de', 'en'] as const;
const VC = (lang: string) => `/${lang}/themen/vibe-coding`;
const SD = (lang: string) => `/${lang}/themen/softwareentwicklung`;
const DESKTOP = [1280, 1440] as const;
const MAX_TEXT = 760;

type Box = { left: number; right: number; top: number; bottom: number; width: number };
const box = (l: Locator): Promise<Box> =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width };
  });
const px = (b: Pick<Box, 'left' | 'right'>) => `${b.left.toFixed(1)}–${b.right.toFixed(1)} px`;

/**
 * REQ-57-AC3: Desktopdarstellung von „Vibe Coding“ vor der Änderung (Stand 7fb7e48), unabhängig vom Anwendungscode aus
 * den damaligen Gestaltungsregeln berechnet: Inhaltsrahmen min(1240 px, Fenster − 96 px) zentriert; Perspektiven als
 * Raster 5fr/7fr mit 88 px Abstand; Fazit mit 64 px Innenabstand und 72 px Spaltenabstand. Werte als [links, rechts].
 */
const VC_REFERENCE: Record<number, { frame: [number, number]; head: [number, number]; body: [number, number]; conclusionHead: [number, number]; conclusionBody: [number, number] }> = {
  1280: { frame: [48, 1232], head: [48, 504.67], body: [592.67, 1232], conclusionHead: [112, 522], conclusionBody: [594, 1168] },
  1440: { frame: [100, 1340], head: [100, 580], body: [668, 1340], conclusionHead: [164, 597.33], conclusionBody: [669.33, 1276] },
};

function expectEdges(actual: Box, [left, right]: [number, number], label: string) {
  const msg = `${label}: ${px(actual)}, erwartet ${left}–${right} px`;
  expect(Math.abs(actual.left - left), msg).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.right - right), msg).toBeLessThanOrEqual(1);
}

async function imagesLoaded(page: Page) {
  for (const img of await page.locator('main figure img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
}

for (const width of DESKTOP) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`REQ-57-AC3: „Vibe Coding“ behält Breite und Spaltenanordnung der Referenz (${width} px, DE/EN)`, async ({ page }) => {
      const ref = VC_REFERENCE[width];
      for (const lang of LANGS) {
        await page.goto(VC(lang));
        await expect(page.locator('.vc-perspective').first()).toBeVisible();
        expectEdges(await box(page.locator('.vc-intro .vc-reading')), ref.frame, `Einleitung (${lang})`);
        const perspectives = await page.locator('.vc-perspective').all();
        // Harness, Kontext, Planung, Prüfung, Verantwortung (vibeCoding.perspectives)
        expect(perspectives.length).toBe(5);
        for (const [i, p] of perspectives.entries()) {
          expectEdges(await box(p), ref.frame, `Perspektive ${i + 1} (${lang})`);
          expectEdges(await box(p.locator('.vc-split-head')), ref.head, `Perspektive ${i + 1}, Titelspalte (${lang})`);
          expectEdges(await box(p.locator('.vc-body')), ref.body, `Perspektive ${i + 1}, Lesespalte (${lang})`);
        }
        const conclusion = page.locator('.vc-conclusion');
        expectEdges(await box(conclusion), ref.frame, `Fazit (${lang})`);
        expectEdges(await box(conclusion.locator('.vc-split-head')), ref.conclusionHead, `Fazit, Titelspalte (${lang})`);
        expectEdges(await box(conclusion.locator('.vc-body')), ref.conclusionBody, `Fazit, Lesespalte (${lang})`);
      }
    });

    test(`REQ-57-AC1: Hauptabschnitte von „Softwareentwicklung“ nutzen den Rahmen von „Vibe Coding“ (${width} px, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        // Rahmen der Referenz im selben Fenster messen, statt ihn aus dem geprüften Artikel abzuleiten
        await page.goto(VC(lang));
        const frame = await box(page.locator('.vc-perspective').first());
        await page.goto(SD(lang));
        await expect(page.locator('#sd-title')).toBeVisible();
        const sections = page.locator('main article > section');
        // Moderne Softwareentwicklung, Der Weg, Drei Teams, Release Gate, Meinung
        await expect(sections).toHaveCount(5);
        for (const s of await sections.all()) {
          const name = (await s.getAttribute('aria-label')) ?? (await s.getAttribute('aria-labelledby'));
          expectEdges(await box(s), [frame.left, frame.right], `Abschnitt ${name} (${lang})`);
        }
      }
    });

    test(`REQ-57-AC2: Titel und Lesespalte nebeneinander, Fließtext höchstens ${MAX_TEXT} px, Grafiken vollständig (${width} px, DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(SD(lang));
        await expect(page.locator('#sd-title')).toBeVisible();
        for (const id of ['moderne-softwareentwicklung', 'der-weg']) {
          const heading = await box(page.locator(`#${id}`));
          const section = page.locator(`section[aria-labelledby="${id}"]`);
          const text = await box(section.locator('p').first());
          const label = `${id} (${lang}): Titel ${px(heading)}, Text ${px(text)}`;
          // Nebeneinander: Der Text steht rechts neben dem Titel und beginnt, bevor der Titel endet.
          expect(heading.right, label).toBeLessThanOrEqual(text.left);
          expect(text.top, label).toBeLessThan(heading.bottom);
          // Der Titel nutzt den linken Teil des Rahmens statt über der Lesespalte zu stehen.
          expect(text.left - (await box(section)).left, label).toBeGreaterThan(200);
        }
        for (const p of await page.locator('main article p').all()) {
          const b = await box(p);
          expect(b.width, `Fließtextzeile „${(await p.innerText()).slice(0, 40)}…“ (${lang})`).toBeLessThanOrEqual(MAX_TEXT + 0.5);
        }
        await imagesLoaded(page);
        const figures = page.locator('main figure:has(img)');
        await expect(figures).toHaveCount(2);
        for (const f of await figures.all()) {
          const img = f.locator('img');
          await img.scrollIntoViewIfNeeded();
          const b = await box(f);
          const r = await img.evaluate((el: HTMLImageElement) => {
            const rect = el.getBoundingClientRect();
            return { shown: rect.width / rect.height, natural: el.naturalWidth / el.naturalHeight, height: rect.height };
          });
          const label = `Grafik ${(await img.getAttribute('alt'))!.slice(0, 30)}… (${lang}) ${px(b)}`;
          expect(b.left, label).toBeGreaterThanOrEqual(0);
          expect(b.right, label).toBeLessThanOrEqual(width);
          expect(r.height, label).toBeGreaterThan(40);
          expect(Math.abs(r.shown / r.natural - 1), `${label} verzerrt`).toBeLessThan(0.01);
          await expect(img).toBeInViewport();
        }
        await expectNoHorizontalScroll(page);
      }
    });
  });
}

test.describe('390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [name, path] of [['Vibe Coding', VC], ['Softwareentwicklung', SD]] as const) {
    test(`REQ-57-AC4: ${name} bleibt einspaltig, ohne horizontalen Bildlauf, Links und Bedienelemente erreichbar (DE/EN)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(path(lang));
        await expect(page.locator('main h1')).toBeVisible();
        await imagesLoaded(page);
        await expectNoHorizontalScroll(page);
        // Einspaltige Lesereihenfolge: Jeder Textblock beginnt unterhalb des vorherigen in Dokumentreihenfolge.
        const blocks = await page.locator('main').evaluate((m) =>
          [...m.querySelectorAll('h1, h2, p, figure > img')]
            .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || e.getAttribute('alt') || '').trim().slice(0, 40) }))
            .filter(({ r }) => r.width > 0 && r.height > 0)
            .map(({ r, t }) => ({ top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, t })),
        );
        expect(blocks.length).toBeGreaterThan(10);
        for (const [i, b] of blocks.entries()) {
          expect(b.left, `„${b.t}“ (${lang}) links außerhalb`).toBeGreaterThanOrEqual(0);
          expect(b.right, `„${b.t}“ (${lang}) rechts außerhalb`).toBeLessThanOrEqual(390);
          if (i) expect(b.top, `„${b.t}“ steht neben „${blocks[i - 1].t}“ statt darunter (${lang})`).toBeGreaterThanOrEqual(blocks[i - 1].bottom - 1);
        }
        // Alle Links und Bedienelemente des Artikels liegen vollständig im Fenster und sind sichtbar.
        const controls = page.locator('main a, main button');
        expect(await controls.count()).toBeGreaterThan(0);
        for (const c of await controls.all()) {
          await c.scrollIntoViewIfNeeded();
          await expect(c).toBeVisible();
          const b = (await c.boundingBox())!;
          const label = `${(await c.innerText()).slice(0, 40)} (${lang})`;
          expect(b.x, label).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width, label).toBeLessThanOrEqual(390);
          expect(await c.getAttribute('tabindex'), `${label} ist per Tastatur nicht erreichbar`).not.toBe('-1');
        }
      }
    });
  }
});

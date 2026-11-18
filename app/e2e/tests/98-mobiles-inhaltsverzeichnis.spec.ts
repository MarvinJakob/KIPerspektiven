// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/components/MobileToc.tsx app/frontend/src/lib/toc.ts app/frontend/src/components/Layout.tsx
import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test, uid } from '../support/fixtures';

// Anforderung #98: Mobiles Inhaltsverzeichnis zeigt den aktuellen Abschnitt.
// Sollwerte aus Ticket und Spezifikation; Abschnittsüberschriften aus den Testdaten
// (app/backend/migrations/dev/00001_dev_posts.sql, Beitrag „ai-audit-fuenf-fragen“) und den Startseitentexten.
// Unit-Tests: app/frontend/src/lib/toc.test.ts, app/frontend/src/components/MobileToc.test.tsx.

const MOBILE = { width: 390, height: 700 };
const LABEL = { de: 'Inhaltsverzeichnis', en: 'Contents' } as const;
const POST = '/blog/ai-audit-fuenf-fragen';
const HEADINGS = {
  de: ['1. Wo nutzen wir KI heute?', '2. Welche Daten fließen hinein?', '3. Wer trägt Verantwortung?', '4. Welche Vorgaben gelten?', '5. Wie messen wir den Nutzen?'],
  en: ['1. Where do we use AI today?', '2. Which data goes in?', '3. Who is accountable?', '4. Which requirements apply?', '5. How do we measure value?'],
} as const;
const HOME = {
  de: ['Gute Fragen. Neue Perspektiven.', 'KI Readiness Kurzcheck'],
  en: ['Good questions. New perspectives.', 'AI Readiness quick check'],
} as const;

const toc = (page: Page, lang: 'de' | 'en') => page.getByRole('navigation', { name: LABEL[lang] });
const toggle = (page: Page) => page.locator('.toc-toggle');
// Einträge auch bei geschlossener Liste (dann für Rollenabfragen verborgen).
const entries = (page: Page, lang: 'de' | 'en') => toc(page, lang).locator('a');
const current = (page: Page, lang: 'de' | 'en') => toc(page, lang).locator('a[aria-current="location"]');

/** Sichtbare H2 im Hauptinhalt in Seitenreihenfolge (ohne reine Screenreader-Überschriften). */
const visibleSectionHeadings = (page: Page) =>
  page.locator('main h2').evaluateAll((hs) =>
    hs.filter((h) => !h.closest('.sr-only') && h.getBoundingClientRect().width > 1).map((h) => h.textContent!.replace(/\s+/g, ' ').trim()),
  );

/** Scrollt so, dass die Oberkante der Überschrift knapp unter der schwebenden Kopfzeile liegt. */
async function scrollToHeading(page: Page, heading: Locator) {
  await heading.evaluate((h) => scrollTo({ top: h.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' }));
}

/** Die Überschrift liegt vollständig im Fenster und nicht unter der Kopfzeile oder dem Inhaltsverzeichnis. */
async function expectFullyVisible(page: Page, heading: Locator) {
  const r = await heading.evaluate((h) => {
    const b = h.getBoundingClientRect();
    const header = document.querySelector('.site-header')!.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, headerBottom: header.bottom, height: innerHeight };
  });
  expect(r.top, 'Überschrift unter der Kopfzeile').toBeGreaterThanOrEqual(r.headerBottom - 1);
  expect(r.bottom, 'Überschrift endet im Fenster').toBeLessThanOrEqual(r.height + 1);
}

/** Die Leiste am Rand verdeckt keinen Text des Hauptinhalts. */
async function expectTextNotCovered(page: Page) {
  const overlap = await page.evaluate(() => {
    const bar = document.querySelector('.toc-toggle')!.getBoundingClientRect();
    return [...document.querySelectorAll('main p, main h1, main h2, main h3, main li, main a')]
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.bottom > bar.top && r.top < bar.bottom && r.right > bar.left + 0.5)
      .map(({ e, r }) => `${e.tagName} „${e.textContent!.trim().slice(0, 30)}“ endet bei ${Math.round(r.right)} px, Leiste beginnt bei ${Math.round(bar.left)} px`);
  });
  expect(overlap, 'Text unter der Leiste').toEqual([]);
}

test.use({ viewport: MOBILE });

for (const lang of ['de', 'en'] as const) {
  test(`REQ-98-AC1/AC6 (${lang}): Beitrag zeigt beim Scrollen am Rand ein Inhaltsverzeichnis mit den Abschnitten`, async ({ page }) => {
    for (const width of [650, MOBILE.width]) {
      await page.setViewportSize({ width, height: MOBILE.height });
      await page.goto(`/${lang}${POST}`);
      await expect(toggle(page)).toBeVisible();
      await expect(toggle(page)).toContainText(LABEL[lang]);
      const expected = await visibleSectionHeadings(page);
      expect(expected.slice(0, 5), 'Abschnitte des Beitrags').toEqual([...HEADINGS[lang]]);
      await expect(entries(page, lang)).toHaveText(expected);
      for (const position of [0.5, 1]) {
        await page.evaluate((p) => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * p, behavior: 'instant' }), position);
        await expect(toggle(page), `erreichbar bei ${position * 100} % Scrolltiefe`).toBeInViewport({ ratio: 1 });
        await expectTextNotCovered(page);
      }
      await expectNoHorizontalScroll(page);
      await toggle(page).click();
      await expect(entries(page, lang).first()).toBeInViewport();
      const size = await entries(page, lang).first().evaluate((a) => parseFloat(getComputedStyle(a).fontSize));
      expect(size, 'Schriftgröße der Einträge').toBeGreaterThanOrEqual(16);
      await expectNoHorizontalScroll(page);
    }
  });

  test(`REQ-98-AC1/AC6 (${lang}): Startseite und Themenseite nennen ihre Abschnitte`, async ({ page }) => {
    await page.goto(`/${lang}`);
    await expect(entries(page, lang)).toHaveText([...HOME[lang]]);
    await page.goto(`/${lang}/themen/softwareentwicklung`);
    await expect(toggle(page)).toBeVisible();
    await expect(entries(page, lang)).toHaveText(await visibleSectionHeadings(page));
    expect(await entries(page, lang).count()).toBeGreaterThanOrEqual(2);
    await expectNoHorizontalScroll(page);
  });

  test(`REQ-98-AC2 (${lang}): die Markierung folgt dem Scrollen vorwärts und rückwärts`, async ({ page }) => {
    await page.goto(`/${lang}${POST}`);
    const headings = page.locator('main h2');
    await expect(toggle(page)).toBeVisible();
    for (const i of [0, 2, 4, 1]) {
      await scrollToHeading(page, headings.nth(i));
      await expect(current(page, lang), `nach Scrollen zu Abschnitt ${i + 1}`).toHaveText(HEADINGS[lang][i]);
      await expect(current(page, lang)).toHaveCount(1);
      await expect(toggle(page), 'Leiste nennt den aktuellen Abschnitt').toContainText(HEADINGS[lang][i]);
    }
    // Ohne alleinige Farbcodierung: Marke vor dem Eintrag, stärkere Schrift und längere Marke in der Leiste.
    await toggle(page).click();
    const style = (l: Locator) => l.evaluate((a) => ({ weight: Number(getComputedStyle(a).fontWeight) }));
    const active = current(page, lang);
    const other = entries(page, lang).first();
    await expect(active.locator('.toc-marker')).toBeVisible();
    await expect(other.locator('.toc-marker')).toHaveCount(0);
    expect((await style(active)).weight).toBeGreaterThan((await style(other)).weight);
    const ticks = await page.locator('.toc-rail span').evaluateAll((s) => s.map((e) => ({ active: e.classList.contains('is-active'), w: e.getBoundingClientRect().width })));
    const activeTick = ticks.find((t) => t.active)!;
    expect(ticks.filter((t) => !t.active).every((t) => t.w < activeTick.w), 'aktive Marke ist länger').toBe(true);
  });

  test(`REQ-98-AC3 (${lang}): Touch und Tastatur führen zur vollständig sichtbaren Überschrift`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await page.goto(`/${lang}${POST}`);
      const headings = page.locator('main h2');
      await toggle(page).tap();
      await entries(page, lang).nth(3).tap();
      await expect(current(page, lang)).toHaveText(HEADINGS[lang][3]);
      await expect(headings.nth(3)).toBeFocused();
      await expect(async () => expectFullyVisible(page, headings.nth(3))).toPass({ timeout: 3000 });
      await expect(entries(page, lang).first(), 'Liste ist nach der Auswahl geschlossen').toBeHidden();

      // Tastatur: Leiste fokussieren, öffnen, zum zweiten Eintrag wechseln und aktivieren.
      await toggle(page).focus();
      await page.keyboard.press('Enter');
      await expect(entries(page, lang).first()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(entries(page, lang).nth(1)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(current(page, lang)).toHaveText(HEADINGS[lang][1]);
      await expect(headings.nth(1)).toBeFocused();
      await expect(async () => expectFullyVisible(page, headings.nth(1))).toPass({ timeout: 3000 });
    } finally {
      await context.close();
    }
  });

  test(`REQ-98-AC4 (${lang}): über 650 CSS-Pixel gibt es kein Inhaltsverzeichnis, auch nach Vergrößern`, async ({ page }) => {
    await page.setViewportSize({ width: 651, height: 800 });
    await page.goto(`/${lang}${POST}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.toc, .toc-toggle')).toHaveCount(0);
    await expect(toc(page, lang)).toHaveCount(0);

    await page.setViewportSize(MOBILE);
    await expect(toggle(page)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.toc, .toc-toggle'), 'entfernt nach Vergrößern').toHaveCount(0);
    // Keine Tab-Station: Nach dem letzten Inhaltslink folgt kein Element des Inhaltsverzeichnisses.
    const focusables = await page.evaluate(() => [...document.querySelectorAll('[class*="toc"] a, [class*="toc"] button')].length);
    expect(focusables).toBe(0);
    await expectNoHorizontalScroll(page);
  });
}

test('REQ-98-AC5: Themenartikel mit weniger als zwei Abschnitten zeigt kein Inhaltsverzeichnis', async ({ editor, page }) => {
  const api = '/api/admin/articles';
  const variants = [
    [{ kind: 'paragraph', text: 'Nur Text' }],
    [{ kind: 'paragraph', text: 'Anfang' }, { kind: 'h1', text: 'Einziger Abschnitt' }, { kind: 'h2', text: 'Unterpunkt' }],
    [{ kind: 'h1', text: 'Erster Abschnitt' }, { kind: 'h1', text: 'Zweiter Abschnitt' }],
  ];
  const ids: number[] = [];
  try {
    for (const blocks of variants) {
      const created = await editor.send('POST', api, { status: 'published', de: { title: 'Inhalt ' + uid(), blocks } });
      expect(created.status()).toBe(201);
      ids.push((await created.json()).id);
    }
    for (const [i, id] of ids.entries()) {
      await page.goto('/de/themenartikel/' + id);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (i < 2) {
        await expect(page.locator('.toc, .toc-toggle'), `Variante ${i + 1}`).toHaveCount(0);
      } else {
        // Gegenprobe: mit zwei Abschnitten erscheint es.
        await expect(entries(page, 'de')).toHaveText(['Erster Abschnitt', 'Zweiter Abschnitt']);
      }
    }
  } finally {
    for (const id of ids) await editor.send('DELETE', `${api}/${id}`);
  }
});

test('REQ-98-AC1: Übersichten und Selbsteinschätzung bleiben ohne Inhaltsverzeichnis', async ({ page }) => {
  for (const path of ['/de/blog', '/de/themen/ai-audit', '/de/profil', '/de/kontakt']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.toc, .toc-toggle'), path).toHaveCount(0);
  }
});

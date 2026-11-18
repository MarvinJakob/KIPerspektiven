import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #54: Öffentlicher Footer nach der Mock-Variante „Kompakt mit Themen“ (mock/footer/index.html).
// Unit-Tests der Texte, Reihenfolgen und Pfade: app/frontend/src/components/footer.test.ts.

const SOLL = {
  de: {
    notes: ['Perspektiven und Erfahrungen rund um künstliche Intelligenz.', 'Diese Website wurde mit Unterstützung von KI erstellt.'],
    heading: 'Themen',
    topics: [
      ['KI in der Softwareentwicklung', '/de/themen/softwareentwicklung'],
      ['KI Readiness', '/de/themen/ai-audit'],
      ['Vibe Coding', '/de/themen/vibe-coding'],
    ],
    siteNav: 'Website',
    pages: [
      ['Blog', '/de/blog'],
      ['Kontakt', '/de/kontakt'],
      ['Impressum', '/de/impressum'],
      ['Datenschutz', '/de/datenschutz'],
    ],
    cookies: 'Cookie-Einstellungen',
    close: 'Schließen',
    notFound: 'Seite nicht gefunden',
  },
  en: {
    notes: ['Perspectives and experiences around artificial intelligence.', 'This website was created with the help of AI.'],
    heading: 'Topics',
    topics: [
      ['AI in Software Development', '/en/themen/softwareentwicklung'],
      ['AI Readiness', '/en/themen/ai-audit'],
      ['Vibe Coding', '/en/themen/vibe-coding'],
    ],
    siteNav: 'Website',
    pages: [
      ['Blog', '/en/blog'],
      ['Contact', '/en/kontakt'],
      ['Legal notice', '/en/impressum'],
      ['Privacy', '/en/datenschutz'],
    ],
    cookies: 'Cookie settings',
    close: 'Close',
    notFound: 'Page not found',
  },
} as const;

type Lang = keyof typeof SOLL;
const BRAND = 'KI Perspektiven';

const footerOf = (page: Page) => page.locator('footer.site-footer');
const box = async (l: Locator) => (await l.boundingBox())!;

/** Öffentliche Seite öffnen und zum Footer scrollen. */
async function openFooter(page: Page, lang: Lang, path = '/blog') {
  await page.goto(`/${lang}${path}`);
  const footer = footerOf(page);
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole('navigation', { name: SOLL[lang].heading }).getByRole('link')).toHaveCount(3);
  return footer;
}

/** WCAG-Kontrast zwischen einer Farbe des Elements (Text oder Kontur) und dem ersten deckenden Hintergrund darunter. */
function contrastOf(l: Locator, property: 'color' | 'outlineColor' | 'borderTopColor' = 'color') {
  return l.evaluate((el, prop) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg: number[] = [255, 255, 255];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.9)) {
        bg = c;
        break;
      }
    }
    const [a, b] = [lum(parse(getComputedStyle(el)[prop as 'color'])), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  }, property);
}

test.describe('1260 px', () => {
  test.use({ viewport: { width: 1260, height: 900 } });

  for (const lang of ['de', 'en'] as const) {
    const s = SOLL[lang];

    test(`REQ-54-AC1: Marke und Kurztext links, Themen rechts, Trennlinie und untere Zeile (${lang})`, async ({ page }) => {
      const footer = await openFooter(page, lang);
      const brand = footer.getByRole('link', { name: BRAND, exact: true });
      const note = footer.getByText(s.notes[1], { exact: true });
      const topics = footer.getByRole('navigation', { name: s.heading });
      const heading = topics.getByRole('heading', { name: s.heading, exact: true });
      await expect(brand).toBeVisible();
      await expect(heading).toBeVisible();

      // Marke und Kurztext links, Themen in derselben Zeile rechts daneben.
      const [b, n, tp] = [await box(brand), await box(note), await box(topics)];
      expect(Math.max(b.x + b.width, n.x + n.width), 'Marke und Kurztext enden links vor den Themen').toBeLessThanOrEqual(tp.x);
      expect(tp.y, 'Themen beginnen auf Höhe des Markenblocks').toBeLessThan(n.y + n.height);
      expect(tp.x, 'Themen stehen in der rechten Hälfte des Footers').toBeGreaterThan((await box(footer)).width * 0.3);

      // Orangefarbene Überschrift „Themen“ / „Topics“.
      const [r, g, bl] = await heading.evaluate((el) => (getComputedStyle(el).color.match(/[\d.]+/g) ?? []).map(Number));
      expect(r > g && g > bl && r - bl > 60, `Überschrift ist orange (rgb ${r}, ${g}, ${bl})`).toBe(true);

      // Drei hervorgehobene, unterstrichene Themenlinks.
      const topicLinks = topics.getByRole('link');
      await expect(topicLinks).toHaveText(s.topics.map(([label]) => label));
      for (const link of await topicLinks.all()) {
        const st = await link.evaluate((el) => ({ line: getComputedStyle(el).textDecorationLine, weight: Number(getComputedStyle(el).fontWeight) }));
        expect(st.line, 'Themenlink ist unterstrichen').toContain('underline');
        expect(st.weight, 'Themenlink ist hervorgehoben (mind. halbfett)').toBeGreaterThanOrEqual(600);
      }

      // Untere Zeile: links Jahr und Marke, rechts Seitenlinks und Cookie-Einstellungen in fester Reihenfolge.
      const year = await page.evaluate(() => new Date().getFullYear());
      const yearLine = footer.getByText(`${year} ${BRAND}`, { exact: true });
      const siteNav = footer.getByRole('navigation', { name: s.siteNav, exact: true });
      await expect(yearLine).toBeVisible();
      await expect(siteNav.locator('a, button')).toHaveText([...s.pages.map(([label]) => label), s.cookies]);
      const [y, sn] = [await box(yearLine), await box(siteNav)];
      expect(y.x + y.width, 'Jahreszeile steht links der Seitenlinks').toBeLessThanOrEqual(sn.x);
      expect(Math.abs(y.y + y.height / 2 - (sn.y + sn.height / 2)), 'Jahreszeile und Seitenlinks bilden eine Zeile').toBeLessThan(16);
      const fb = await box(footer);
      expect(sn.x + sn.width, 'Seitenlinks sind rechtsbündig').toBeGreaterThan(fb.x + fb.width * 0.7);
      expect(y.y, 'untere Zeile liegt unter den Themen').toBeGreaterThan(tp.y + tp.height);

      // Dezente Trennlinie zwischen Hauptbereich und unterer Zeile.
      const divider = await footer.evaluate(
        (el, { top, bottom }) => {
          const hits = [...el.querySelectorAll('*')].filter((n) => {
            const st = getComputedStyle(n);
            const r = n.getBoundingClientRect();
            return st.borderTopStyle !== 'none' && parseFloat(st.borderTopWidth) >= 1 && r.top + scrollY >= top - 1 && r.top + scrollY <= bottom + 1 && r.width > el.getBoundingClientRect().width * 0.6;
          });
          return hits.map((n) => ({ width: parseFloat(getComputedStyle(n).borderTopWidth), selector: n.tagName }));
        },
        { top: tp.y + tp.height + (await page.evaluate(() => scrollY)), bottom: y.y + (await page.evaluate(() => scrollY)) },
      );
      expect(divider.length, 'Trennlinie oberhalb der unteren Zeile').toBeGreaterThan(0);
      expect(divider[0].width, 'Trennlinie ist dezent (höchstens 1 px)').toBeLessThanOrEqual(1);

      // Kein Copyright-Zeichen.
      await expect(footer).not.toContainText('©');
    });

    test(`REQ-54-AC2: Kurztext in zwei eigenen Absätzen (${lang})`, async ({ page }) => {
      const footer = await openFooter(page, lang);
      for (const sentence of s.notes) {
        const el = footer.getByText(sentence, { exact: true });
        await expect(el, `Satz „${sentence}“`).toHaveCount(1);
        await expect(el).toBeVisible();
        expect(await el.evaluate((n) => n.tagName), `„${sentence}“ steht in einem eigenen Absatz`).toBe('P');
      }
      const [first, second] = [await box(footer.getByText(s.notes[0])), await box(footer.getByText(s.notes[1]))];
      expect(second.y, 'zweiter Satz steht unter dem ersten').toBeGreaterThanOrEqual(first.y + first.height - 1);
      const brand = await box(footer.getByRole('link', { name: BRAND, exact: true }));
      expect(first.y, 'Kurztext steht unter „KI Perspektiven“').toBeGreaterThanOrEqual(brand.y + brand.height - 1);
    });

    test(`REQ-54-AC3: Themen-, Seiten- und Markenlinks mit Ziel in derselben Sprache (${lang})`, async ({ page }) => {
      const footer = await openFooter(page, lang, '/kontakt');
      const topics = footer.getByRole('navigation', { name: s.heading });
      const expected = [...s.topics, ...s.pages, [BRAND, `/${lang}`]] as const;

      await expect(topics.getByRole('link')).toHaveText(s.topics.map(([label]) => label));
      for (const [label, path] of expected) {
        const link = footer.getByRole('link', { name: label, exact: true });
        await expect(link, `Link „${label}“`).toHaveCount(1);
        expect(await link.evaluate((el) => el.tagName), `„${label}“ ist ein HTML-Link`).toBe('A');
        await expect(link).toHaveAttribute('href', path);
        await expect(link).not.toHaveAttribute('target', /.+/);
      }

      // Jedes Ziel existiert in derselben Sprache.
      for (const [label, path] of expected) {
        await page.goto(`/${lang}/blog`);
        await footerOf(page).getByRole('link', { name: label, exact: true }).click();
        await expect(page, `Ziel von „${label}“`).toHaveURL(new RegExp(`${path}$`));
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: s.notFound }), `Ziel von „${label}“ existiert`).toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
      }
    });

    test(`REQ-54-AC4: Tastaturreihenfolge und Cookie-Dialog mit Fokusrückgabe (${lang})`, async ({ page }) => {
      const footer = await openFooter(page, lang);
      const brand = footer.getByRole('link', { name: BRAND, exact: true });
      await brand.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(brand).toBeFocused();

      const reached: string[] = [];
      for (let i = 0; i < 9; i++) {
        reached.push(await page.evaluate(() => (document.activeElement?.textContent ?? '').replace(/\s+/g, ' ').trim()));
        if (i < 8) await page.keyboard.press('Tab');
      }
      expect(reached, 'alle Footer-Links und die Cookie-Schaltfläche per Tab erreichbar').toEqual([
        `ki.${BRAND}`,
        ...s.topics.map(([label]) => label),
        ...s.pages.map(([label]) => label),
        s.cookies,
      ]);

      const opener = footer.getByRole('button', { name: s.cookies, exact: true });
      await expect(opener).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: s.cookies });
      await expect(dialog, 'bestehender Cookie-Dialog öffnet sich').toBeVisible();
      await dialog.getByRole('button', { name: s.close, exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(opener, 'Fokus kehrt nach „Schließen“ zur Schaltfläche zurück').toBeFocused();

      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener, 'Fokus kehrt nach Escape zur Schaltfläche zurück').toBeFocused();
    });
  }

  test('REQ-54-AC4: Texte, Links und Fokusmarkierungen in Hell und Dunkel gut erkennbar', async ({ page }) => {
    const s = SOLL.de;
    const footer = await openFooter(page, 'de');
    for (const theme of ['light', 'dark'] as const) {
      if (theme === 'dark') {
        await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await footer.scrollIntoViewIfNeeded();
      }
      const texts: [string, Locator][] = [
        ['Marke', footer.getByRole('link', { name: BRAND, exact: true })],
        ['Überschrift', footer.getByRole('heading', { name: s.heading, exact: true })],
        ...s.notes.map((n): [string, Locator] => [n, footer.getByText(n, { exact: true })]),
        ['Jahreszeile', footer.getByText(new RegExp(`^\\d{4} ${BRAND}$`))],
        ...[...s.topics, ...s.pages].map(([label]): [string, Locator] => [label, footer.getByRole('link', { name: label, exact: true })]),
        [s.cookies, footer.getByRole('button', { name: s.cookies, exact: true })],
      ];
      for (const [name, el] of texts) {
        expect(await contrastOf(el), `${theme}: Kontrast „${name}“ mind. 4,5:1`).toBeGreaterThanOrEqual(4.5);
      }
      const focusables = [...texts.slice(0, 1), ...texts.slice(5)];
      for (const [name, el] of focusables) {
        await expectVisibleKeyboardFocus(page, el);
        expect(await contrastOf(el, 'outlineColor'), `${theme}: Fokusmarkierung „${name}“ mind. 3:1`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  for (const lang of ['de', 'en'] as const) {
    test(`REQ-54-AC4: Footer ohne Überlappung, Abschneiden oder horizontales Scrollen (${lang})`, async ({ page }) => {
      const s = SOLL[lang];
      const footer = await openFooter(page, lang);
      await expectNoHorizontalScroll(page);

      const blocks: [string, Locator][] = [
        ['Marke', footer.getByRole('link', { name: BRAND, exact: true })],
        ...s.notes.map((n): [string, Locator] => [n, footer.getByText(n, { exact: true })]),
        ['Themen', footer.getByRole('navigation', { name: s.heading })],
        ['Jahreszeile', footer.getByText(new RegExp(`^\\d{4} ${BRAND}$`))],
        ['Seitenlinks', footer.getByRole('navigation', { name: s.siteNav, exact: true })],
      ];
      const items: [string, Locator][] = [
        ...[...s.topics, ...s.pages].map(([label]): [string, Locator] => [label, footer.getByRole('link', { name: label, exact: true })]),
        [s.cookies, footer.getByRole('button', { name: s.cookies, exact: true })],
      ];
      const width = await page.evaluate(() => document.documentElement.clientWidth);
      const rects: [string, { x: number; y: number; width: number; height: number }][] = [];
      for (const [name, el] of [...blocks, ...items]) {
        await expect(el, name).toBeVisible();
        const r = await box(el);
        expect(r.x, `„${name}“ beginnt im Fenster`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, `„${name}“ endet im Fenster`).toBeLessThanOrEqual(width + 0.5);
        const clipped = await el.evaluate((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible');
        expect(clipped, `„${name}“ ist nicht abgeschnitten`).toBe(false);
        rects.push([name, r]);
      }
      const overlaps = (a: (typeof rects)[number][1], b: (typeof rects)[number][1]) =>
        a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
      // Blöcke untereinander sowie die einzelnen Links untereinander überlappen nicht.
      for (const group of [rects.slice(0, blocks.length), rects.slice(blocks.length)]) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            expect(overlaps(group[i][1], group[j][1]), `„${group[i][0]}“ überlappt „${group[j][0]}“`).toBe(false);
          }
        }
      }
      // Reihenfolge: Marke, Themen, untere Zeile.
      const y = Object.fromEntries(rects.map(([name, r]) => [name, r.y]));
      expect(y['Themen']).toBeGreaterThan(y[s.notes[1]]);
      expect(y['Jahreszeile']).toBeGreaterThan(y['Themen']);
    });
  }
});

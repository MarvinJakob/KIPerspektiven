// REQ-10 Lesezeit und Schaltfläche „Nach oben“ – Spezifikation: specs/REQ-10.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Locator, type Page } from '@playwright/test';

// Mehrere Seiten je Test (bis zu zehn Seitenaufrufe, bis zu 150 Tab-Schritte): 90 s statt der Standardzeit.
test.describe.configure({ timeout: 90_000 });

type Lang = 'de' | 'en';
const LANGS: Lang[] = ['de', 'en'];

/** Betroffene Seiten auf origin/main: Themenseiten mit Langtext, „KI verstehen“ und ein News-Artikel aus dem Entwicklungs-Seed. */
const TOPICS = ['softwareentwicklung', 'data-analytics', 'modelle-und-kosten'];
const NEWS = 'ki-veraendert-softwareteams';
const pagesOf = (lang: Lang) => [
  ...TOPICS.map((slug) => `/${lang}/themen/${slug}`),
  `/${lang}/ki-verstehen`,
  `/${lang}/blog/${NEWS}`,
];

/** Wortlaut der Lesezeit; ein vorangestelltes „ca.“ bzw. „about“ ist erlaubt. */
const READING: Record<Lang, RegExp> = {
  de: /(?:ca\.\s*)?(\d+)\s*Min(?:\.|uten)\s*Lesezeit/,
  en: /(?:about\s*|approx\.\s*|~\s*)?(\d+)\s*min(?:ute)?s?\s*read/i,
};
const TOP_LABEL: Record<Lang, RegExp> = { de: /Nach oben/, en: /Back to top/i };
/** Überschriften, mit denen der Lesetext endet: folgende Listen zählen nicht zur Lesezeit. */
const TEXT_END = /^(?:Beiträge zu diesem Thema|Articles on this topic|Mehr Themen|More Topics)$/;
const WORDS_PER_MINUTE = 200;

const langOf = (path: string) => path.split('/')[1] as Lang;

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path}: Status`).toBe(200);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/**
 * Lesezeit im Einstiegsbereich: ein Text im Wortlaut der Sprache, der beim Laden im sichtbaren Bereich und
 * oberhalb der ersten h2 des Hauptinhalts steht. Liefert die Minuten oder null.
 */
async function entryReadingMinutes(page: Page, lang: Lang): Promise<number | null> {
  const main = page.getByRole('main');
  const h2 = main.getByRole('heading', { level: 2 }).first();
  const h2Top = (await h2.count()) ? ((await h2.boundingBox())?.y ?? Infinity) : Infinity;
  const viewportHeight = page.viewportSize()?.height ?? 0;
  const candidates = main.getByText(READING[lang]);
  for (let i = 0; i < (await candidates.count()); i++) {
    const candidate = candidates.nth(i);
    if (!(await candidate.isVisible())) continue;
    const box = await candidate.boundingBox();
    if (!box || box.y < 0 || box.y + box.height > viewportHeight || box.y >= h2Top) continue;
    const match = READING[lang].exec(await candidate.innerText());
    if (match) return Number(match[1]);
  }
  return null;
}

/** Wörter des sichtbaren Lesetexts: Artikel bzw. Hauptinhalt bis zur Überschrift der folgenden Listen, ohne Brotkrumen. */
async function readingWords(page: Page, path: string) {
  const main = page.getByRole('main');
  let text: string;
  if (path.includes('/blog/')) {
    text = await main.getByRole('article').first().innerText();
  } else {
    text = await main.innerText();
    const endHeading = main.getByRole('heading', { name: TEXT_END }).first();
    if (await endHeading.count()) {
      const end = text.lastIndexOf(await endHeading.innerText());
      if (end > 0) text = text.slice(0, end);
    }
    const crumbs = main.getByRole('navigation').first();
    if (await crumbs.count()) text = text.replace(await crumbs.innerText(), ' ');
  }
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

const scrollTo = (page: Page, where: 'top' | 'end') =>
  page.evaluate((w) => {
    const top = w === 'top' ? 0 : document.documentElement.scrollHeight;
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
  }, where);

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Schaltfläche oder Link „Nach oben“ / „Back to top“. */
const toTop = (page: Page, lang: Lang) =>
  page
    .getByRole('button', { name: TOP_LABEL[lang] })
    .or(page.getByRole('link', { name: TOP_LABEL[lang] }));

/** Am Seitenende sichtbare Schaltfläche, mindestens 24 × 24 px (WCAG 2.2, 2.5.8). */
async function visibleToTopAtEnd(page: Page, lang: Lang): Promise<Locator> {
  await scrollTo(page, 'end');
  const button = toTop(page, lang).filter({ visible: true }).first();
  await expect(button, 'Schaltfläche „Nach oben“ am Seitenende').toBeInViewport();
  const box = await button.boundingBox();
  expect(box?.width ?? 0, 'Breite der Schaltfläche').toBeGreaterThanOrEqual(24);
  expect(box?.height ?? 0, 'Höhe der Schaltfläche').toBeGreaterThanOrEqual(24);
  return button;
}

async function expectAtTop(page: Page) {
  await expect.poll(() => scrollY(page), { message: 'Scrollposition nach „Nach oben“' }).toBeLessThanOrEqual(10);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeInViewport();
}

/** Textzeilen und andere Bedienelemente, die das Rechteck der Schaltfläche schneiden (nur wenn sie sichtbar ist). */
function coveredBy(button: Locator) {
  return button.evaluate((btn) => {
    for (let el: Element | null = btn; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.opacity === '0' || style.visibility === 'hidden') return [];
    }
    const b = btn.getBoundingClientRect();
    // Verdeckt ist, was das Rechteck der Schaltfläche schneidet und an der Schnittfläche unter ihr liegt
    // (liegt etwa eine feste Kopfzeile über der Schaltfläche, verdeckt die Schaltfläche sie nicht).
    const overlaps = (r: DOMRect) => {
      const left = Math.max(r.left, b.left), right = Math.min(r.right, b.right);
      const top = Math.max(r.top, b.top), bottom = Math.min(r.bottom, b.bottom);
      if (r.width <= 1 || r.height <= 1 || right - left <= 1 || bottom - top <= 1) return false;
      const onTop = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      return !!onTop && btn.contains(onTop);
    };
    // Nur Sichtbares zählt (z. B. kein zugeklapptes Menü mit Deckkraft 0)
    const shown = (el: Element | null) =>
      !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (!text || btn.contains(node) || !shown(node.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some(overlaps)) hits.push(`Text: ${text.slice(0, 60)}`);
    }
    const controls = document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]');
    for (const el of controls) {
      if (el === btn || el.contains(btn) || btn.contains(el) || !shown(el)) continue;
      if ([...el.getClientRects()].some(overlaps)) hits.push(`Bedienelement: ${(el.textContent ?? '').trim().slice(0, 40)}`);
    }
    return hits;
  });
}

test('REQ-10-AC1 Lesezeit steht im Einstiegsbereich jeder betroffenen Seite', async ({ page }) => {
  for (const lang of LANGS) {
    for (const path of pagesOf(lang)) {
      await open(page, path);
      expect.soft(await entryReadingMinutes(page, lang), `${path}: Lesezeit sichtbar oberhalb der ersten h2`).not.toBeNull();
    }
  }
});

test('REQ-10-AC2 Lesezeit folgt der Regel 200 Wörter pro Minute und passt zum Inhalt', async ({ page }) => {
  const shown = new Map<string, number | null>();
  for (const lang of LANGS) {
    for (const path of pagesOf(lang)) {
      await open(page, path);
      const minutes = await entryReadingMinutes(page, lang);
      shown.set(path, minutes);
      const words = await readingWords(page, path);
      const expected = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
      expect.soft(minutes, `${path}: Lesezeit angezeigt`).not.toBeNull();
      if (minutes !== null) {
        expect.soft(Math.abs(minutes - expected), `${path}: ${minutes} Min. bei ${words} Wörtern (Regel: ${expected})`).toBeLessThanOrEqual(1);
      }
    }
  }
  const long = shown.get('/de/themen/data-analytics') ?? 0;
  const short = shown.get(`/de/blog/${NEWS}`) ?? Infinity;
  expect(long, 'lange Themenseite zeigt mehr Minuten als kurzer News-Artikel').toBeGreaterThan(short);
});

test('REQ-10-AC3 Nach oben per Maus bzw. Touch führt zum Seitenanfang', async ({ page, isMobile }) => {
  const activate = (button: Locator) => (isMobile ? button.tap() : button.click());
  for (const path of ['/de/themen/data-analytics', '/en/themen/softwareentwicklung', '/de/ki-verstehen']) {
    await open(page, path);
    await activate(await visibleToTopAtEnd(page, langOf(path)));
    await expectAtTop(page);
  }
  // News-Artikel: dieselbe Erwartung, wenn die Seite höher als zwei Bildschirmhöhen ist (im Seed auf Desktop und Mobil der Fall).
  const news = `/de/blog/${NEWS}`;
  await open(page, news);
  const long = await page.evaluate(() => document.documentElement.scrollHeight > 2 * window.innerHeight);
  if (long) {
    await activate(await visibleToTopAtEnd(page, 'de'));
    await expectAtTop(page);
  }
});

test('REQ-10-AC4 Nach oben ist per Tastatur erreichbar und auslösbar', async ({ page }) => {
  await open(page, '/de/themen/data-analytics');
  await page.keyboard.press('End');
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  const button = toTop(page, 'de');
  let focused = false;
  for (let i = 0; i < 150 && !focused; i++) {
    await page.keyboard.press('Tab');
    focused = await button.evaluateAll((els) => els.some((el) => el === document.activeElement));
  }
  expect(focused, '„Nach oben“ per Tab erreicht').toBe(true);
  await page.keyboard.press('Enter');
  await expectAtTop(page);
});

test('REQ-10-AC5 Nach oben verdeckt am Seitenende und am Seitenanfang keine Inhalte', async ({ page }) => {
  await open(page, '/de/themen/data-analytics');
  const button = await visibleToTopAtEnd(page, 'de');
  await page.waitForTimeout(400); // Ein- oder Ausblenden der Schaltfläche abwarten
  expect(await coveredBy(button), 'am Seitenende verdeckt').toEqual([]);

  await scrollTo(page, 'top');
  await page.waitForTimeout(400);
  const atTop = toTop(page, 'de').filter({ visible: true }).first();
  if ((await atTop.count()) && (await atTop.isVisible())) {
    expect(await coveredBy(atTop), 'am Seitenanfang verdeckt').toEqual([]);
  }
});

test('REQ-10-AC6 Lesezeit und Nach oben sind je Sprache lokalisiert', async ({ context }) => {
  const other: Record<Lang, RegExp> = { de: /min read|Back to top/i, en: /Lesezeit|Nach oben/i };
  for (const lang of LANGS) {
    for (const path of [`/${lang}/themen/softwareentwicklung`, `/${lang}/blog/${NEWS}`]) {
      // Eigener Tab je Seite: Jede Seite wird wie bei einem Erstaufruf oben geöffnet.
      const page = await context.newPage();
      await open(page, path);
      expect.soft(await entryReadingMinutes(page, lang), `${path}: Lesezeit in der Sprache der Seite`).not.toBeNull();
      if (path.includes('/themen/')) await visibleToTopAtEnd(page, lang);
      else await scrollTo(page, 'end');
      expect.soft(await page.locator('body').innerText(), `${path}: keine Beschriftung der anderen Sprache`).not.toMatch(other[lang]);
      const foreign = page.getByRole('button', { name: TOP_LABEL[lang === 'de' ? 'en' : 'de'] })
        .or(page.getByRole('link', { name: TOP_LABEL[lang === 'de' ? 'en' : 'de'] }));
      expect.soft(await foreign.count(), `${path}: keine Schaltfläche der anderen Sprache`).toBe(0);
      await page.close();
    }
  }
});

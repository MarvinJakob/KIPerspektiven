// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/styles.css app/frontend/src/typography.css app/frontend/src/pages/Home.tsx app/frontend/src/pages/VibeCoding.tsx app/frontend/src/pages/VibeCoding.css app/frontend/src/pages/Profile.tsx app/frontend/src/lib/theme.ts app/frontend/src/lib/topicStyle.ts
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #104: Öffentliche Webseite im Ninja-Design (Farbpalette und Typografie „Magazin-Kontrast“).
// Sollwerte aus dem Ticket; Start-Darstellung nach der Entscheidung vom 19.11.2026: Systemeinstellung.
type Theme = 'light' | 'dark';
const PALETTE = {
  light: { paper: '#f8f7f5', surface: '#ffffff', soft: '#f1efec', warm: '#fcf1e6', line: '#12263a29', ink: '#12263a', muted: '#4d5b6b', brandInk: '#a64b08' },
  dark: { paper: '#0a121b', surface: '#111b26', soft: '#182433', warm: '#111b26', line: '#ffffff26', ink: '#f6f8fa', muted: '#bfc9d3', brandInk: '#f39b56' },
} as const;
const BRAND = '#dc6e14';
const NAVY = '#12263a';

const PAGES = [
  '/de',
  '/de/themen/softwareentwicklung',
  '/de/themen/vibe-coding',
  '/de/profil',
  '/de/themen/ai-audit',
  '/de/blog',
  '/de/kontakt',
  '/de/impressum',
  '/de/datenschutz',
  '/de/ki-verstehen',
  '/de/ki-einsatzfelder',
  '/de/gibt-es-nicht-104',
];

/** Hex (#rrggbb oder #rrggbbaa) als [r, g, b, a]. */
const hex = (h: string) => {
  const v = h.slice(1);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(v.length === 8 ? parseInt(v.slice(6, 8), 16) / 255 : 1);
};
const rgba = (c: string) => {
  const n = (c.match(/[\d.]+/g) ?? []).map(Number);
  return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
};
/** Berechnete Farbe entspricht dem Sollwert (Alpha auf 0,01 genau). */
function expectColor(actual: string, want: string, what: string) {
  const [a, w] = [rgba(actual), hex(want)];
  expect(a.slice(0, 3), `${what}: ${actual} statt ${want}`).toEqual(w.slice(0, 3));
  expect(Math.abs(a[3] - w[3]), `${what}: Deckkraft ${actual} statt ${want}`).toBeLessThanOrEqual(0.01);
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

const style = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color,
      bg: s.backgroundColor,
      bgImage: s.backgroundImage,
      border: s.borderTopColor,
      family: s.fontFamily,
      weight: s.fontWeight,
      style: s.fontStyle,
      size: parseFloat(s.fontSize),
      spacing: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
      lineHeight: parseFloat(s.lineHeight),
      transform: s.textTransform,
    };
  });

/** Kontrast nach WCAG zwischen Textfarbe und erstem (fast) deckenden Hintergrund darunter. */
const contrast = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
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
    const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });

const PLAYFAIR = /^"?Playfair Display"?,/;
const SOURCE_SANS = /^"?Source Sans 3"?,/;

function expectType(s: Awaited<ReturnType<typeof style>>, what: string, want: { family: RegExp; weight?: string; style?: string; tracking?: number; upper?: boolean }) {
  expect(s.family, `${what}: Schrift`).toMatch(want.family);
  if (want.weight) expect(s.weight, `${what}: Gewicht`).toBe(want.weight);
  expect(s.style, `${what}: Stil`).toBe(want.style ?? 'normal');
  if (want.tracking !== undefined) expect(s.spacing, `${what}: Laufweite ${want.tracking} em`).toBeCloseTo(want.tracking * s.size, 1);
  if (want.upper) expect(s.transform, `${what}: Großbuchstaben`).toBe('uppercase');
}

for (const theme of ['dark', 'light'] as const) {
  const ac = theme === 'dark' ? 'REQ-104-AC1' : 'REQ-104-AC2';
  test(`${ac}: Farben ${theme === 'dark' ? 'dunkel' : 'hell'} auf Startseite und Kontakt`, async ({ page }) => {
    const p = PALETTE[theme];
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/de');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expectColor((await style(page, 'body')).bg, p.paper, 'Seitenhintergrund');
    expectColor((await style(page, 'body')).color, p.ink, 'Haupttext');
    expectColor((await style(page, '.home-lead')).color, p.muted, 'Nebentext');
    expectColor((await style(page, '.eyebrow')).color, p.brandInk, 'orangefarbene Schrift');
    expectColor((await style(page, '#themen-liste li')).border, p.line, 'Linie');
    expectColor((await style(page, '.lang-switch')).bg, p.soft, 'Füllfläche Sprachwahl');
    expectColor((await style(page, '.home-hero')).bg, p.warm, 'Hero-Fläche');
    const primary = await style(page, '.home-hero .btn-primary');
    expectColor(primary.bg, BRAND, 'Primärbutton Fläche');
    expectColor(primary.color, NAVY, 'Primärbutton Text');
    const nav = await style(page, '.header-inner');
    expectColor(nav.bg, theme === 'dark' ? '#0a121bcc' : '#f8f7f5cc', 'Navigation (Glas)');
    expectColor(nav.border, theme === 'dark' ? '#ffffff26' : '#12263a17', 'Navigationsrand');

    await page.goto('/de/kontakt');
    expectColor((await style(page, '#contact-name, .contact-field input')).bg, p.surface, 'Formularfläche');
    await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
    expectColor((await style(page, '.consent-backdrop')).bg, '#0a121bb8', 'Abdunklung Cookie-Dialog');
    expectColor((await style(page, '.consent')).bg, p.surface, 'Dialogfläche');
  });

  test(`REQ-104-AC4: Hero zeigt die beiden Farbfelder und bleibt lesbar (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/de');
    const hero = await style(page, '.home-hero');
    const glows = [...hero.bgImage.matchAll(/radial-gradient\((.*?)\btransparent/g)].map((m) => rgba(m[1].match(/rgba?\([^)]*\)/)![0]));
    expect(glows, `zwei Farbfelder: ${hero.bgImage}`).toHaveLength(2);
    const [warmGlow, coolGlow] = glows;
    const want = theme === 'dark' ? [hex('#dc6e1447'), hex('#2a5a8c55')] : [hex('#dc6e1433'), hex('#12263a1c')];
    expect(warmGlow.slice(0, 3)).toEqual(want[0].slice(0, 3));
    expect(warmGlow[3]).toBeCloseTo(want[0][3], 2);
    expect(coolGlow.slice(0, 3)).toEqual(want[1].slice(0, 3));
    expect(coolGlow[3]).toBeCloseTo(want[1][3], 2);
    expect(hero.bgImage.indexOf('92% 0%'), 'Orange oben rechts').toBeGreaterThan(-1);
    expect(hero.bgImage.indexOf('0% 100%'), 'Blau unten links').toBeGreaterThan(-1);

    expect(await contrast(page, '#hero-title'), 'Überschrift').toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page, '.home-lead'), 'Text').toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page, '.home-hero .btn-primary'), 'Primärbutton').toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page, '.home-hero .btn-secondary'), 'Sekundärbutton').toBeGreaterThanOrEqual(4.5);
  });
}

test('REQ-104-AC5: Typografie Startseite', async ({ page }) => {
  await page.goto('/de');
  expectType(await style(page, '#hero-title'), 'Hero', { family: PLAYFAIR, weight: '600', tracking: -0.03 });
  expectType(await style(page, '#hero-title span'), 'Hervorhebung im Hero', { family: PLAYFAIR, weight: '400', style: 'italic' });
  expectType(await style(page, '#themen-title'), 'Abschnittstitel', { family: PLAYFAIR, weight: '600', tracking: -0.02 });
  expectType(await style(page, '#themen-liste h3'), 'Themenfrage', { family: PLAYFAIR, weight: '600', tracking: -0.005 });
  expectType(await style(page, '.eyebrow'), 'Eyebrow', { family: SOURCE_SANS, weight: '600', tracking: 0.18, upper: true });
  expectType(await style(page, '.home-topic-kicker'), 'Kicker', { family: SOURCE_SANS, weight: '600', tracking: 0.18, upper: true });
  const number = await style(page, '#themen-liste .topic-number');
  expectType(number, 'Themenziffer', { family: PLAYFAIR, weight: '400', style: 'italic', tracking: -0.03 });
  expect(number.size, 'Themenziffer 3 rem').toBe(48);
  expectType(await style(page, '.brand-mark'), 'Wortmarke', { family: PLAYFAIR, weight: '600' });
  expectType(await style(page, '.home-lead'), 'Fließtext', { family: SOURCE_SANS, weight: '400' });
  expectType(await style(page, '.home-hero .btn-primary'), 'Button', { family: SOURCE_SANS });
  expectType(await style(page, '.nav-btn'), 'Navigation', { family: SOURCE_SANS });
  expectType(await style(page, '.footer-head'), 'Footer-Überschrift', { family: SOURCE_SANS, weight: '600', tracking: 0.18, upper: true });
  expect((await style(page, 'body')).size, 'Grundgröße 1.125rem').toBe(18);
  // Menütitel im Themen-Menü
  await page.getByRole('button', { name: 'Themen' }).first().click();
  expectType(await style(page, '.menu-title'), 'Menütitel', { family: PLAYFAIR, weight: '600', tracking: -0.005 });
  // Menüsymbole: Verlauf in Ninja-Farben
  const icon = await style(page, '.menu-icon');
  for (const c of ['220, 110, 20', '18, 38, 58', '24, 36, 51']) expect(icon.bgImage, `Menüsymbol enthält rgb(${c})`).toContain(c);
});

test('REQ-104-AC5: Typografie Themenartikel Vibe Coding', async ({ page }) => {
  await page.goto('/de/themen/vibe-coding');
  expectType(await style(page, 'main h1'), 'Artikeltitel', { family: PLAYFAIR, weight: '600', tracking: -0.03 });
  expectType(await style(page, '.article-subtitle'), 'Untertitel', { family: PLAYFAIR, weight: '500', tracking: -0.02 });
  expectType(await style(page, '.vc-quote p'), 'Zitat', { family: PLAYFAIR, weight: '500', style: 'italic', tracking: -0.01 });
  expectType(await style(page, '.vc-number'), 'Perspektivenziffer', { family: PLAYFAIR, weight: '400', style: 'italic', tracking: -0.03 });
  expectType(await style(page, '.article-body h2, main h2'), 'H2', { family: PLAYFAIR, weight: '600' });
  const body = await style(page, '.vc-body p');
  expectType(body, 'Fließtext', { family: SOURCE_SANS, weight: '400' });
  expect(body.lineHeight / body.size, 'Zeilenhöhe 1.75').toBeCloseTo(1.75, 2);
  // Fazit „Vibe Coding“: Text in #f6f8fa/#bfc9d3, Hover des Meinungsbuttons
  expectColor((await style(page, '.vc-conclusion')).color, '#f6f8fa', 'Fazit Text');
  expectColor((await style(page, '.vc-conclusion .vc-body p')).color, '#bfc9d3', 'Fazit Nebentext');
  // Kein Fließtextabsatz nutzt Playfair Display
  const serifParagraphs = await page.locator('main p').evaluateAll((ps) =>
    ps
      .filter((p) => !p.matches('.article-subtitle, .vc-quote p, .profile-headline') && p.textContent!.trim().length > 40)
      .filter((p) => getComputedStyle(p).fontFamily.includes('Playfair'))
      .map((p) => p.textContent!.slice(0, 60)),
  );
  expect(serifParagraphs).toEqual([]);
  await setTheme(page, 'dark');
  const conclusion = await style(page, '.vc-conclusion');
  expectColor(conclusion.bg, '#111b26', 'Fazit dunkel Fläche');
  expectColor(conclusion.border, '#ffffff26', 'Fazit dunkel Rand');
});

test('REQ-104-AC5: Typografie Softwareentwicklung (Zitat-Überschrift) und Profil', async ({ page }) => {
  await page.goto('/de/themen/softwareentwicklung');
  expectType(await style(page, '.quote-heading'), 'Zitat-Überschrift', { family: PLAYFAIR, weight: '500', style: 'italic', tracking: -0.01 });
  expectType(await style(page, '.quote-mark'), 'Anführungszeichen', { family: PLAYFAIR, weight: '400', style: 'italic' });
  const opinion = page.locator('.opinion-button').first();
  if (await opinion.count()) {
    await opinion.hover();
    await expect.poll(async () => (await style(page, '.opinion-button')).bg).toBe('rgb(24, 36, 51)');
  }

  await page.goto('/de/profil');
  expectType(await style(page, '.profile-headline'), 'Profil-Headline', { family: PLAYFAIR, weight: '500', tracking: -0.02 });
  expectType(await style(page, '.profile-headline span'), 'Hervorhebung Profil', { family: PLAYFAIR, weight: '400', style: 'italic' });
  expectType(await style(page, '.profile-facts dt'), 'Profil-Fakten', { family: PLAYFAIR, weight: '400', style: 'italic', tracking: -0.03 });
  expectType(await style(page, '.profile-offer-number'), 'Angebotsnummer', { family: PLAYFAIR, weight: '400', style: 'italic', tracking: -0.03 });
  expectType(await style(page, '.profile-tags li'), 'Profil-Tag', { family: SOURCE_SANS, weight: '600', tracking: 0.18, upper: true });
  expectType(await style(page, '.profile-about-text p'), 'Fließtext', { family: SOURCE_SANS, weight: '400' });
});

test('REQ-104-AC6: Schriften kommen ausschließlich als WOFF2 vom eigenen Server', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/de/themen/vibe-coding');
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')}/${f.style}`).sort()))
    .toEqual(expect.arrayContaining(['Playfair Display/italic', 'Playfair Display/normal', 'Source Sans 3/normal']));
  const fonts = requests.filter((u) => /\.(woff2?|ttf|otf|eot)(\?|$)/.test(u));
  expect(fonts.length, 'Schriftdateien geladen').toBeGreaterThanOrEqual(3);
  for (const u of fonts) {
    expect(new URL(u).origin, u).toBe(origin);
    expect(u, 'nur WOFF2').toMatch(/\.woff2(\?|$)/);
  }
  expect(requests.filter((u) => new URL(u).origin !== origin && !u.startsWith('data:')), 'keine fremden Hosts').toEqual([]);
  expect(requests.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
});

test('REQ-104-AC7: Text ist sofort in der Rückfallschrift sichtbar, wenn Schriftdateien fehlschlagen', async ({ page }) => {
  await page.route(/\.woff2(\?|$)/, (route) => route.abort());
  await page.goto('/de');
  await expect(page.locator('#hero-title')).toBeVisible();
  const box = await page.locator('#hero-title').boundingBox();
  expect(box!.height, 'Hero-Titel hat Höhe').toBeGreaterThan(40);
  const displays = await page.evaluate(() => [...document.fonts].filter((f) => /Playfair|Source Sans/.test(f.family)).map((f) => f.display));
  expect(displays.length).toBeGreaterThan(0);
  expect(new Set(displays)).toEqual(new Set(['swap']));
  await expectNoHorizontalScroll(page);
});

test('REQ-104-AC7: nach verzögertem Laden der Schriften verschiebt sich das Layout nicht sichtbar', async ({ page }) => {
  const requested: string[] = [];
  await page.route(/\.woff2(\?|$)/, async (route) => {
    requested.push(new URL(route.request().url()).pathname);
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/de');
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Playfair') && f.status === 'loaded'))).toBe(true);
  await page.waitForTimeout(300);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls, 'Cumulative Layout Shift durch den Schriftwechsel').toBeLessThan(0.1);
  // Nur benötigte Schnitte: die Startseite braucht Playfair normal/kursiv und Source Sans normal.
  expect(requested.length, requested.join(', ')).toBeLessThanOrEqual(3);
});

for (const path of PAGES) {
  test(`REQ-104-AC8: ${path} ohne horizontales Scrollen und ohne überlaufende Überschriften (1440/768/390/320, hell/dunkel)`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme);
        await expectNoHorizontalScroll(page);
        const overflowing = await page.locator('main h1, main h2, main h3').evaluateAll((hs) =>
          hs
            .filter((h) => (h as HTMLElement).offsetParent !== null)
            .filter((h) => h.scrollWidth > h.clientWidth + 1 || h.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
            .map((h) => h.textContent!.slice(0, 50)),
        );
        expect(overflowing, `${width} px, ${theme}: Überschriften laufen über`).toEqual([]);
      }
    }
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`REQ-104-AC9: Kontrast und sichtbarer Fokus (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const checks: [string, string[]][] = [
      ['/de', ['#hero-title', '.home-lead', '.eyebrow', '#themen-liste h3', '.home-topic-kicker', '#themen-liste .home-topic-copy p:not(.home-topic-kicker)', '.footer-note', '.footer-head', '.nav-btn']],
      ['/de/themen/vibe-coding', ['main h1', '.article-subtitle', '.vc-body p', '.vc-quote p', '.vc-conclusion .vc-body p', '.vc-conclusion .eyebrow']],
      ['/de/profil', ['.profile-headline', '.profile-headline span', '.profile-about-text p', '.profile-facts dt', '.profile-tags li', '.profile-offer-number']],
      ['/de/kontakt', ['h1', 'label', '.contact-hint']],
    ];
    for (const [path, selectors] of checks) {
      await page.goto(path);
      for (const sel of selectors) {
        if (!(await page.locator(sel).count())) throw new Error(`${path}: ${sel} fehlt`);
        expect(await contrast(page, sel), `${theme} ${path} ${sel}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    await page.goto('/de');
    await expectVisibleKeyboardFocus(page, page.locator('.home-hero .btn-primary'));
    await expectVisibleKeyboardFocus(page, page.locator('.nav-btn').first());
  });
}

test('REQ-104-AC9: erzwungene Farben und reduzierte Transparenz machen die Navigation auch dunkel opak', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/de');
  const nav = () => page.locator('.header-inner').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, filter: getComputedStyle(el).backdropFilter }));
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
  let s = await nav();
  expect(s.filter === 'none' || s.filter === '', JSON.stringify(s)).toBe(true);
  expect(s.bg, JSON.stringify(s)).toMatch(/^rgb\(/);
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'none' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  s = await nav();
  expect(s.filter === 'none' || s.filter === '', JSON.stringify(s)).toBe(true);
  expect(s.bg, JSON.stringify(s)).toMatch(/^rgb\(/);
});

test('REQ-104-AC10: erster Besuch folgt der Systemeinstellung, gespeicherte Wahl hat Vorrang', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const toggle = page.getByRole('button', { name: 'Dunkle Darstellung' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expectColor((await style(page, 'body')).bg, PALETTE.dark.paper, 'dunkler Hintergrund');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Mit Einwilligung gespeicherte Wahl „hell“ gilt auch bei dunkler Systemeinstellung.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Sprache und Darstellung merken' }).click();
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ki-perspektiven.theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('REQ-104-AC11: englische Fassung nutzt dieselben Farben und Schriften; Umlaute, ß und Anführungszeichen stammen aus beiden Schriften', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const [de, en] of [['/de', '/en'], ['/de/themen/vibe-coding', '/en/themen/vibe-coding'], ['/de/profil', '/en/profil']]) {
    await page.goto(de);
    const want = await Promise.all(['body', 'main h1', '.eyebrow, .article-subtitle, .profile-tags li'].map((s) => style(page, s)));
    await page.goto(en);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const got = await Promise.all(['body', 'main h1', '.eyebrow, .article-subtitle, .profile-tags li'].map((s) => style(page, s)));
    for (const [i, s] of got.entries()) {
      expect([s.family, s.weight, s.style, s.color, s.bg], `${en} Element ${i}`).toEqual([want[i].family, want[i].weight, want[i].style, want[i].color, want[i].bg]);
    }
  }
  // Glyphen: gleiche Breite mit zwei verschiedenen Rückfallschriften heißt, die Webschrift liefert das Zeichen selbst.
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(async () => {
    const chars = [...'ÄÖÜäöüß„“‚‘»«–'];
    const faces = ['400 normal 40px "Playfair Display"', '400 italic 40px "Playfair Display"', '600 normal 40px "Playfair Display"', '400 normal 40px "Source Sans 3"', '600 normal 40px "Source Sans 3"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, chars.join(''))));
    const ctx = document.createElement('canvas').getContext('2d')!;
    const width = (font: string, ch: string) => {
      ctx.font = font;
      return ctx.measureText(ch).width;
    };
    const out: string[] = [];
    for (const f of faces) for (const ch of chars) if (width(`${f}, monospace`, ch) !== width(`${f}, cursive`, ch)) out.push(`${f}: ${ch}`);
    return out;
  });
  expect(missing).toEqual([]);
});

test('REQ-104-AC12: das Redaktionssystem behält Farben und Schriften', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => /\.woff2(\?|$)/.test(r.url()) && fonts.push(r.url()));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/redaktion/anmelden');
  const body = await style(page, 'body');
  expect(body.family).toMatch(/^-apple-system/);
  expect(body.family).not.toMatch(/Playfair|Source Sans/);
  expect(body.bg, 'Redaktion hell wie bisher (#eef1f6)').toBe('rgb(238, 241, 246)');
  expect((await style(page, 'h1')).family).not.toMatch(/Playfair|Source Sans/);
  // Die Redaktion startet ohne gespeicherte Wahl weiterhin hell, auch bei dunkler Systemeinstellung.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(fonts, 'keine Webschriften in der Redaktion').toEqual([]);
});

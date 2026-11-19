// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/styles.css app/frontend/src/typography.css app/frontend/src/pages/Home.tsx app/frontend/src/pages/VibeCoding.tsx app/frontend/src/pages/VibeCoding.css app/frontend/src/pages/Profile.tsx app/frontend/src/lib/theme.ts app/frontend/src/lib/topicStyle.ts
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
const PALETTE = {
  light: { paper: '#f8f7f5', surface: '#ffffff', soft: '#f1efec', warm: '#fcf1e6', line: '#12263a29', ink: '#12263a', muted: '#4d5b6b', brandInk: '#a64b08' },
  dark: { paper: '#0a121b', surface: '#111b26', soft: '#182433', warm: '#111b26', line: '#ffffff26', ink: '#f6f8fa', muted: '#bfc9d3', brandInk: '#f39b56' },
} as const;
const BRAND = '#dc6e14';
const NAVY = '#12263a';

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

const style = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color,
      bg: s.backgroundColor,
      border: s.borderTopColor,
    };
  });

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
}

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

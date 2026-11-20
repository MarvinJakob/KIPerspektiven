// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #131: Im Einstieg der Startseite steht nur noch die orangefarbene Schaltfläche
// „KI Readiness einschätzen“; sie führt zur Seite „KI Readiness“.
// Sollwerte aus dem Ticket und aus DESIGN.md, Abschnitt 3 (helle Darstellung): --brand #dc6e14,
// --brand-hover #c35f0e, --on-brand #12263a, Fokusrahmen 3px in --brand-ink #a64b08.
// Der Druckzustand (.press, Skalierung 0,97) ist der des bisherigen Primärbuttons „Themen entdecken“.

const UI = {
  de: { label: 'KI Readiness einschätzen', removed: 'Themen entdecken', nav: 'KI Readiness', path: '/de/themen/ai-audit', h1: 'KI Readiness' },
  en: { label: 'Assess your AI readiness', removed: 'Explore topics', nav: 'AI Readiness', path: '/en/themen/ai-audit', h1: 'AI Readiness' },
} as const;

const BRAND = 'rgb(220, 110, 20)';
const BRAND_HOVER = 'rgb(195, 95, 14)';
const ON_BRAND = 'rgb(18, 38, 58)';
const BRAND_INK = 'rgb(166, 75, 8)';

/** Einstieg: der Abschnitt, den die H1 der Startseite benennt. */
const hero = (page: Page) => page.locator('section[aria-labelledby="hero-title"]');
const actions = (page: Page) => hero(page).locator('a, button');
const cta = (page: Page, lang: 'de' | 'en') => hero(page).getByRole('link', { name: UI[lang].label, exact: true });

for (const lang of ['de', 'en'] as const) {
  const T = UI[lang];

  test(`REQ-131-AC1 REQ-131-AC2 (${lang}): der Einstieg zeigt genau eine Schaltfläche und keinen Themenlink`, async ({ page }) => {
    await page.goto(`/${lang}`);
    await expect(page.locator('#hero-title')).toBeVisible();
    await expect(actions(page), 'genau eine Schaltfläche im Einstieg').toHaveCount(1);
    await expect(actions(page)).toHaveText(T.label);
    await expect(cta(page, lang)).toBeVisible();
    await expect(hero(page).getByText(T.removed), `keine Schaltfläche „${T.removed}“`).toHaveCount(0);
    await expect(page.getByRole('link', { name: T.removed, exact: true })).toHaveCount(0);

    // unter dem Leittext: die Schaltfläche beginnt nicht oberhalb der H1
    const titleBottom = await page.locator('#hero-title').evaluate((el) => el.getBoundingClientRect().bottom);
    const ctaTop = await cta(page, lang).evaluate((el) => el.getBoundingClientRect().top);
    expect(ctaTop, 'Schaltfläche steht unter dem Leittext').toBeGreaterThanOrEqual(titleBottom);
  });

  test(`REQ-131-AC4 (${lang}): Klick öffnet die Seite „KI Readiness“ der Hauptnavigation`, async ({ page }) => {
    await page.goto(`/${lang}`);
    // Der Eintrag steht je nach Breite im aufgeklappten Menü; sein Ziel steht unabhängig davon im Dokument.
    const navHref = await page.locator('header a').filter({ hasText: new RegExp(`^${T.nav}$`) }).getAttribute('href');
    expect(navHref, 'Ziel des Navigationseintrags').toBe(T.path);
    await expect(cta(page, lang)).toHaveAttribute('href', T.path);

    await cta(page, lang).click();
    await expect(page).toHaveURL(new RegExp(`${T.path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(T.h1);
    await expect(page.locator('#ki-readiness'), 'Kurzcheck der Startseite ist nicht mehr das Ziel').toHaveCount(0);
  });
}

test('REQ-131-AC3: orange Primärdarstellung mit Pfeil sowie Hover-, Fokus- und Druckzustand', async ({ page }) => {
  await page.goto('/de');
  const button = cta(page, 'de');
  await expect(button).toHaveCSS('background-color', BRAND);
  await expect(button).toHaveCSS('color', ON_BRAND);
  await expect(button.locator('svg'), 'Pfeilsymbol').toHaveCount(1);
  await expect(button.locator('svg')).toBeVisible();

  // Fokus per Tastatur: sichtbarer Rahmen
  await page.locator('#hero-title').focus();
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await expect(button).toHaveCSS('outline-width', '3px');
  await expect(button).toHaveCSS('outline-color', BRAND_INK);

  // Hover: dunkleres Orange
  await button.hover();
  await expect(button).toHaveCSS('background-color', BRAND_HOVER);

  // Druck: die Schaltfläche gibt nach (Skalierung 0,97)
  await page.mouse.down();
  await expect(button).toHaveCSS('transform', 'matrix(0.97, 0, 0, 0.97, 0, 0)');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test('REQ-131-AC4: Tastatur (Enter) öffnet die Seite „KI Readiness“, die Startseite scrollt nicht zum Kurzcheck', async ({ page }) => {
  await page.goto('/de');
  await cta(page, 'de').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(UI.de.h1);
});

const mobile = test.extend({});
mobile.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

mobile('REQ-131-AC5: bei 375 px ist die Schaltfläche vollständig sichtbar und bedienbar, ohne horizontales Scrollen', async ({ page }) => {
  await page.goto('/de');
  const button = cta(page, 'de');
  await expect(actions(page)).toHaveCount(1);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport({ ratio: 1 });
  const box = (await button.boundingBox())!;
  expect(box.x, 'linker Rand im Viewport').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'rechter Rand im Viewport').toBeLessThanOrEqual(375);
  expect(box.height, 'Bedienfläche mindestens 44 px hoch').toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'kein horizontales Scrollen').toBeLessThanOrEqual(0);

  await button.tap();
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(UI.de.h1);
});

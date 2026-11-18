import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #25: Home Page als Einstieg in Themen und Angebote nutzen.
const REMOVED = ['data-analytics', 'modelle-und-kosten', 'prozessautomatisierung', 'ki-tipps-und-tricks'];
const HERO = {
  de: { topics: 'Themen entdecken', news: 'News', understand: 'KI verstehen', audit: 'KI Reifegrad einschätzen', about: 'Über mich' },
  en: { topics: 'Explore topics', news: 'News', understand: 'Understand AI', audit: 'Assess your AI maturity', about: 'About me' },
};

test('REQ-25-AC1: Hero, Themenindex, Themenabschnitte, Readiness-Banner und Profilteaser in Reihenfolge und Sprache', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const parts = ['#hero-title', 'nav.topic-index', '#themen', '#softwareentwicklung', '#audit-title', '#profile-title'];
    for (const sel of parts) await expect(page.locator(sel), sel).toBeVisible();
    const tops = await Promise.all(parts.map((s) => page.locator(s).evaluate((el) => el.getBoundingClientRect().top + scrollY)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expect(page.locator('#hero-title')).toHaveText(lang === 'de' ? 'KI verstehen.Sinnvoll einsetzen.' : 'Understand AI.Use it wisely.');
    await expect(page.locator('nav.topic-index a').first()).toContainText('01');
    await expect(page.getByRole('link', { name: HERO[lang].topics })).toBeVisible();
  }
});

test('REQ-25-AC2: „Themen entdecken“ und Themenindex fokussieren die Überschrift, ohne die URL zu ändern', async ({ page }) => {
  await page.goto('/de');
  const url = page.url();
  await page.getByRole('link', { name: 'Themen entdecken' }).click();
  await expect(page.locator('#themen')).toBeFocused();
  expect(page.url()).toBe(url);

  await page.goto('/de');
  await page.locator('nav.topic-index a[href="#softwareentwicklung"]').click();
  await expect(page.locator('#softwareentwicklung')).toBeFocused();
  await expect(page.locator('#softwareentwicklung')).toBeInViewport();
  expect(page.url()).toBe(url);
});

test('REQ-25-AC3: Hero-Verweise öffnen die vorhandenen Seiten in der aktuellen Sprache', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    const targets: [string, string][] = [
      [HERO[lang].news, `/${lang}/blog`],
      [HERO[lang].understand, `/${lang}/ki-verstehen`],
      [HERO[lang].audit, `/${lang}/themen/ai-audit`],
      [HERO[lang].about, `/${lang}/profil`],
    ];
    for (const [name, path] of targets) {
      await page.goto(`/${lang}`);
      await page.locator('.home-actions').getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Seite nicht gefunden|Page not found/ })).toHaveCount(0);
    }
  }
});

test('REQ-25-AC4: Themenabsätze sind ohne Aufklappen sichtbar, Artikelverweise führen zu vorhandenen Themenseiten, entfernte Themen fehlen', async ({ page, request }) => {
  await page.goto('/de');
  const section = page.locator('section[aria-labelledby="softwareentwicklung"]');
  await expect(section.locator('[aria-expanded], details')).toHaveCount(0);
  for (const p of await section.locator('.editorial-text p').all()) await expect(p).toBeVisible();

  const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  for (const slug of REMOVED) {
    expect(hrefs.some((h) => h.includes(slug)), slug).toBe(false);
    expect((await request.get(`/api/topics/${slug}?lang=de`)).status(), slug).toBe(404);
  }
  for (const [name, path] of [
    ['Zum Artikel: KI in der Softwareentwicklung', '/de/themen/softwareentwicklung'],
    ['Zum Artikel: Vibe Coding', '/de/themen/vibe-coding'],
  ]) {
    await page.goto('/de');
    await section.getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('REQ-25-AC5: Readiness-Banner und Profilteaser führen zur Readiness-Übersicht und zum Profil der aktiven Sprache', async ({ page }) => {
  for (const [lang, cta, about] of [
    ['de', 'Zum KI-Audit', 'Über mich'],
    ['en', 'Go to the AI audit', 'About me'],
  ] as const) {
    await page.goto(`/${lang}`);
    await page.locator('.audit-banner').getByRole('link', { name: cta }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/themen/ai-audit$`));
    await page.goto(`/${lang}`);
    await page.locator('.home-profile').getByRole('link', { name: about }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/profil$`));
  }
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });
    test(`REQ-25-AC6: lesbar ohne horizontalen Bildlauf, fokussierbare Verweise, keine Illustrationen, Porträts oder Reifegradbalken (${viewport.width} px)`, async ({ page }) => {
      await page.goto('/de');
      await expect(page.locator('#hero-title')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expect(page.locator('main img, main picture, main svg:not([aria-hidden="true"]), main [role="img"]')).toHaveCount(0);
      await expect(page.locator('main progress, main meter, main [role="progressbar"], main [role="meter"]')).toHaveCount(0);
      // Keine reservierten Bildflächen in der Lesespalte
      const art = await page.locator('main .editorial-section *').evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).backgroundImage !== 'none' && el.getBoundingClientRect().height > 40).length,
      );
      expect(art).toBe(0);
      for (const link of await page.locator('main a[href]').all()) expect(await link.getAttribute('tabindex')).not.toBe('-1');
      await expectVisibleKeyboardFocus(page, page.getByRole('link', { name: 'Themen entdecken' }));
    });
  });
}

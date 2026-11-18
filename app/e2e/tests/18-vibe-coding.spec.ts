import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #18: Themenseite Vibe Coding. Quelle: content/topics/Vibe Coding v1_de.md.
const PERSPECTIVES = ['Prompt Engineering', 'Context Engineering', 'Harness Engineering', 'Specification Engineering', 'Product Engineering'];
const ids = ['prompt', 'context', 'harness', 'specification', 'product'];

test('REQ-18-AC1: Artikel erscheint vollständig auf Deutsch und Englisch', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}/themen/vibe-coding`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vibe Coding');
    await expect(page.locator('.vc-subtitle')).toContainText(lang === 'de' ? 'Willkommen beim Vibe Coding' : 'Welcome to Vibe Coding');
    for (const id of ids) {
      await expect(page.locator(`#vc-${id}`)).toContainText(PERSPECTIVES[ids.indexOf(id)]);
      await expect(page.locator(`#vc-${id}-title`)).not.toBeEmpty();
    }
    await expect(page.locator('figure[aria-labelledby="vc-story-caption"] p')).not.toBeEmpty(); // Beispiel in der Einführung
    await expect(page.locator('section[aria-labelledby="vc-conclusion-title"] .eyebrow')).toHaveText(lang === 'de' ? 'Fazit' : 'Conclusion');
    await expect(page.locator('#vc-conclusion-title')).not.toBeEmpty();
  }
});

test('REQ-18-AC2: Sprunglinks der Übersicht erreichen und fokussieren die Abschnitte', async ({ page }) => {
  await page.goto('/de/themen/vibe-coding');
  for (const [i, id] of ids.entries()) {
    await page.locator(`a[href="#vc-${id}"]`).click();
    const section = page.locator(`#vc-${id}`);
    await expect(section, PERSPECTIVES[i]).toBeFocused();
    await expect(page.locator(`#vc-${id}-title`)).toBeInViewport();
  }
});

// Seit #41 öffnet die Grafik keine Einzelansicht mehr (REQ-41-AC1/AC4); geprüft wird die ausgelieferte Bilddatei.
test('REQ-18-AC3: Harness-Grafik ist geladen und sprachpassend beschrieben', async ({ page, request }) => {
  const alts: string[] = [];
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}/themen/vibe-coding`);
    const img = page.locator('#vc-harness img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    alts.push((await img.getAttribute('alt')) ?? '');
    const res = await request.get((await img.getAttribute('src'))!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^image\//);
  }
  expect(alts[0]).toMatch(/^Harness-Grafik/);
  expect(alts[1]).toMatch(/^Harness diagram/);
});

test('REQ-18-AC4: interne Links und Sprachwechsel öffnen vorhandene Ziele', async ({ page }) => {
  await page.goto('/de/themen/vibe-coding');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vibe Coding');
  const targets = await page.locator('main a[href^="/de"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  expect(targets.length).toBeGreaterThan(0);
  for (const href of targets) {
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' }), href).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
  }
  await page.goto('/de/themen/vibe-coding');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/themen\/vibe-coding$/);
  await expect(page.locator('.vc-subtitle')).toContainText('Welcome to Vibe Coding');
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });
    test(`REQ-18-AC5: Text und Grafik bleiben im Inhaltsbereich, Links mit sichtbarem Fokus (${viewport.width} px)`, async ({ page }) => {
      await page.goto('/de/themen/vibe-coding');
      await expectNoHorizontalScroll(page);
      const img = page.locator('#vc-harness img');
      const box = await img.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await expectVisibleKeyboardFocus(page, page.locator('a[href="#vc-prompt"]'));
    });
  });
}

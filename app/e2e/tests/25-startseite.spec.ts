import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #25: Home Page als Einstieg in Themen und Angebote nutzen.
// Seit #34 folgt die Startseite dem Home-Mock (Hero, zwei Themenzeilen, Kurzcheck; „Über mich“ seit #47 entfernt). Themenindex,
// ausführliche Themenabschnitte, Readiness-Banner und die Hero-Verweise auf News und KI verstehen
// (REQ-25-AC1 bis AC3, AC5 sowie die Absätze aus AC4) sind dadurch abgelöst; ihre Nachfolger prüft
// 34-startseite-kurzcheck.spec.ts. Weiterhin gültig bleiben die folgenden Zusicherungen.
const REMOVED = ['data-analytics', 'modelle-und-kosten', 'prozessautomatisierung', 'ki-tipps-und-tricks'];

test('REQ-25-AC4: entfernte Themen werden nicht angeboten', async ({ page, request }) => {
  await page.goto('/de');
  await expect(page.locator('#hero-title')).toBeVisible();
  const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  for (const slug of REMOVED) {
    expect(hrefs.some((h) => h.includes(slug)), slug).toBe(false);
    expect((await request.get(`/api/topics/${slug}?lang=de`)).status(), slug).toBe(404);
  }
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`REQ-25-AC6: ohne horizontalen Bildlauf, fokussierbare Verweise, keine Illustrationen oder Porträts (${viewport.width} px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/de');
    await expect(page.locator('#hero-title')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expect(page.locator('main img, main picture, main svg:not([aria-hidden="true"]), main [role="img"]')).toHaveCount(0);
    for (const link of await page.locator('main a[href]').all()) expect(await link.getAttribute('tabindex')).not.toBe('-1');
  });
}

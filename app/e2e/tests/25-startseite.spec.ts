// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx
import { expect, test } from '../support/fixtures';

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

// REQ-25-AC6 (kein horizontaler Bildlauf, keine Illustrationen, fokussierbare Verweise) prüft seit #94
// 34-startseite-kurzcheck.spec.ts: REQ-34-AC6 bei 1440, 768, 390 und 320 px ohne horizontales Scrollen sowie ohne Bilder
// und mit fokussierbaren Verweisen im Hauptinhalt.

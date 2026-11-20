// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Profile.tsx app/frontend/src/i18n/profile.ts
import { expect, test } from '../support/fixtures';

// Anforderung #119: Schwerpunkt „Conference Speaker“ auf der Profilseite. Sollwerte aus Ticket #119.
const SOLL = {
  de: { list: 'Schwerpunkte', tags: ['Projekt Management', 'Business Analyse', 'Software Architektur', 'Software Entwicklung', 'Conference Speaker'] },
  en: { list: 'Focus areas', tags: ['Project Management', 'Business Analysis', 'Software Architecture', 'Software Development', 'Conference Speaker'] },
} as const;

for (const [lang, ac] of [['de', 'AC1'], ['en', 'AC2']] as const) {
  test(`REQ-119-${ac}: /${lang}/profil listet die fünf Schwerpunkte mit „Conference Speaker“ am Ende`, async ({ page }) => {
    await page.goto(`/${lang}/profil`);
    const items = page.getByRole('list', { name: SOLL[lang].list }).getByRole('listitem');
    await expect(items).toHaveText([...SOLL[lang].tags]);
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`REQ-119-AC3: „Conference Speaker“ ist bei ${viewport.width} px sichtbar, gestaltet wie die übrigen Schwerpunkte, ohne Querscrollen`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const lang of ['de', 'en'] as const) {
      await page.goto(`/${lang}/profil`);
      const list = page.getByRole('list', { name: SOLL[lang].list });
      const speaker = list.getByRole('listitem').filter({ hasText: 'Conference Speaker' });
      await expect(speaker).toBeVisible();
      await expect(list.locator('a, button')).toHaveCount(0);

      const style = (el: Element) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.borderTopWidth, s.borderTopColor, s.borderTopLeftRadius, s.paddingTop, s.paddingLeft, s.fontSize, s.fontWeight, s.color, s.textTransform].join('|');
      };
      const first = list.getByRole('listitem').first();
      expect(await speaker.evaluate(style), `${lang}: Stil wie der erste Schwerpunkt`).toBe(await first.evaluate(style));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${lang}: Seite ist nicht breiter als der Viewport`).toBeLessThanOrEqual(0);
    }
  });
}

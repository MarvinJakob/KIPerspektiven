// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Profile.tsx
import { expect, test } from '../support/fixtures';

// Anforderung #63: Breadcrumb-Navigation von der Profilseite entfernen.
// Sollwert aus dem Ticket: Zeile „Startseite / Marvin Jakob“ zwischen globaler Navigation und Profilvorstellung entfällt.
const LANGS = ['de', 'en'] as const;
const GLOBAL_NAV = { de: 'Hauptnavigation', en: 'Main navigation' } as const;
const BRAND = { de: 'KI Perspektiven – Startseite', en: 'KI Perspektiven – home' } as const;
const CRUMB_TEXT = /(Startseite|Home)\s*\/\s*Marvin Jakob/;

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });

    test(`REQ-63-AC1: Profilinhalt beginnt bündig mit der Profilvorstellung (${viewport.width} px)`, async ({ page }) => {
      for (const lang of LANGS) {
        await page.goto(`/${lang}/profil`);
        const article = page.locator('main article.profile');
        const hero = article.locator('header.profile-hero');
        await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Marvin Jakob');
        await expect(article.locator('.crumbs, .profile-crumbs'), `${lang}: Breadcrumb-Element`).toHaveCount(0);
        expect((await page.locator('main').innerText()).replace(/\s+/g, ' '), `${lang}: Breadcrumb-Text`).not.toMatch(CRUMB_TEXT);
        const first = await article.evaluate((el) => el.firstElementChild?.matches('header.profile-hero'));
        expect(first, `${lang}: erstes Element des Profilinhalts`).toBe(true);
        const [a, h] = [await article.boundingBox(), await hero.boundingBox()];
        expect(Math.abs(h!.y - a!.y), `${lang}: Abstand zwischen Inhaltsbeginn und Profilvorstellung`).toBeLessThanOrEqual(1);
      }
    });
  });
}

for (const lang of LANGS) {
  test(`REQ-63-AC2: kein Breadcrumb-Navigationsbereich für Tastatur und assistive Technik, globale Navigation bedienbar (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/profil`);
    const main = page.locator('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Marvin Jakob');
    await expect(main.getByRole('navigation'), 'Navigationsbereich im Hauptinhalt').toHaveCount(0);
    await expect(main.getByRole('link', { name: /^(Startseite|Home)$/ }), 'Startseiten-Link im Hauptinhalt').toHaveCount(0);
    const beforeTitle = await main.evaluate((m) => {
      const h1 = m.querySelector('h1')!;
      return [...m.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING)
        .map((el) => `${el.tagName.toLowerCase()} „${el.textContent?.trim()}“`);
    });
    expect(beforeTitle, 'per Tab erreichbar vor der Überschrift').toEqual([]);

    // Globale Navigation: per Tastatur erreichbar und ihr Startseiten-Link funktioniert.
    const nav = page.getByRole('navigation', { name: GLOBAL_NAV[lang] });
    await expect(nav).toBeVisible();
    const brand = nav.getByRole('link', { name: BRAND[lang] });
    for (let i = 0; i < 5 && !(await brand.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(brand, 'Startseiten-Link der globalen Navigation per Tab fokussiert').toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${lang}/?$`));
  });
}

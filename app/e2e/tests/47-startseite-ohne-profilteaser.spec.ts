// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #47: Abschnitt „Über mich“ von der Landingpage entfernen.
// Sollwerte aus dem Ticket: Screenshot mit „ÜBER MICH“, „Marvin Jakob“ und „Mehr über mich“.

const LANGS = {
  de: { eyebrow: 'Über mich', link: 'Mehr über mich', nav: 'Hauptnavigation', profile: 'Profil', menu: 'Menü', start: 'Selbsteinschätzung starten' },
  en: { eyebrow: 'About me', link: 'More about me', nav: 'Main navigation', profile: 'Profile', menu: 'Menu', start: 'Start self-assessment' },
} as const;
type Lang = keyof typeof LANGS;

const VIEWPORTS = [
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Mobil', width: 390, height: 844 },
] as const;

const check = (page: Page) => page.locator('#ki-readiness');

for (const lang of ['de', 'en'] as const) {
  for (const vp of VIEWPORTS) {
    test(`REQ-47-AC1: /${lang} ${vp.name} zeigt nach der KI-Selbsteinschätzung keinen Profilteaser und keine Trennlinie`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${lang}`);
      await expect(check(page).getByRole('link', { name: LANGS[lang].start })).toBeVisible();

      const main = page.locator('main');
      await expect(page.locator('#ueber-mich'), 'Profilabschnitt').toHaveCount(0);
      await expect(main.getByText(LANGS[lang].eyebrow, { exact: true }), 'Abschnittsname').toHaveCount(0);
      await expect(main.getByText('Marvin Jakob'), 'Name').toHaveCount(0);
      await expect(main.getByText('Creative IT Specialist'), 'Kurzbeschreibung').toHaveCount(0);
      await expect(main.getByRole('link', { name: LANGS[lang].link }), 'Profillink').toHaveCount(0);
      await expect(main.locator(`a[href="/${lang}/profil"]`), 'Profillink im Inhalt').toHaveCount(0);

      // Nach dem Kurzcheck folgt im Hauptinhalt kein weiteres Element, also auch kein leerer Abschnitt und keine Linie.
      const after = await check(page).evaluate((section) => {
        const main = section.closest('main')!;
        const all = [...main.querySelectorAll('*')];
        return all
          .filter((el) => section.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !section.contains(el))
          .map((el) => `${el.tagName.toLowerCase()}#${el.id}.${el.className}`);
      });
      expect(after, 'Elemente nach der KI-Selbsteinschätzung').toEqual([]);
    });
  }

  test(`REQ-47-AC2: /${lang} Profil in der Hauptnavigation öffnet die Profilseite per Zeiger und per Tastatur`, async ({ page }) => {
    const nav = page.getByRole('navigation', { name: LANGS[lang].nav });
    const profileLink = nav.getByRole('link', { name: LANGS[lang].profile, exact: true });
    const expectProfile = async () => {
      await expect(page).toHaveURL(new RegExp(`/${lang}/profil$`));
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Seite nicht gefunden|Page not found/ })).toHaveCount(0);
    };

    await page.goto(`/${lang}`);
    await profileLink.click();
    await expectProfile();

    await page.goto(`/${lang}`);
    await profileLink.focus();
    await expect(profileLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expectProfile();
  });

  test(`REQ-47-AC2: /${lang} mobil öffnet Profil aus dem Navigationsmenü in derselben Sprache`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${lang}`);
    const nav = page.getByRole('navigation', { name: LANGS[lang].nav });
    await nav.getByRole('button', { name: LANGS[lang].menu }).click();
    await nav.getByRole('link', { name: LANGS[lang].profile, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/profil$`));
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const vp of VIEWPORTS) {
    test(`REQ-47-AC3: /${lang} ${vp.name} am Ende folgt auf die vollständige KI-Selbsteinschätzung direkt der Footer`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${lang}`);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      const card = check(page).locator('.check');
      await expect(check(page).getByRole('heading', { level: 2 })).toBeVisible();
      await expect(check(page).getByRole('list')).toHaveCount(1);
      for (const name of lang === 'de' ? ['Ja', 'Nein', 'Überspringen'] : ['Yes', 'No', 'Skip']) {
        await expect(check(page).getByRole('button', { name, exact: true })).toBeVisible();
      }
      await expect(check(page).getByRole('link', { name: LANGS[lang].start })).toBeVisible();

      const footer = page.locator('footer.site-footer');
      await expect(footer).toBeVisible();
      const m = await page.evaluate(() => {
        const card = document.querySelector('#ki-readiness .check')!.getBoundingClientRect();
        const footer = document.querySelector('footer.site-footer')!;
        return { cardBottom: card.bottom, footerTop: footer.getBoundingClientRect().top, footerMargin: parseFloat(getComputedStyle(footer).marginTop) };
      });
      // Zwischen Kurzcheck-Fläche und Footer liegt nur noch der reguläre Footerabstand, keine frühere Teaserfläche.
      const gap = m.footerTop - m.cardBottom;
      expect(gap, `Abstand Kurzcheck → Footer (${JSON.stringify(m)})`).toBeGreaterThanOrEqual(0);
      expect(gap, `Abstand Kurzcheck → Footer (${JSON.stringify(m)})`).toBeLessThanOrEqual(m.footerMargin + 1);
      await expect(card).toBeInViewport();
    });
  }
}

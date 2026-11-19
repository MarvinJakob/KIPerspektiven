// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Legal.tsx app/frontend/src/content/legal/datenschutz.de.md app/frontend/src/content/legal/datenschutz.en.md app/frontend/src/content/legal/datenschutz.freigabe.json
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #74: Datenschutzerklärung auf Deutsch und Englisch vervollständigen.
// Unit-Tests der Inhalte: app/frontend/src/content/legal/datenschutz.test.ts.

const SOLL = {
  de: {
    title: 'Datenschutz',
    footerLink: 'Datenschutz',
    controller: 'Verantwortliche Stelle',
    contactHeading: 'Kontaktformular',
  },
  en: {
    title: 'Privacy',
    footerLink: 'Privacy',
    controller: 'Controller',
    contactHeading: 'Contact form',
  },
} as const;
type Lang = keyof typeof SOLL;
const LANGS: Lang[] = ['de', 'en'];
const FORBIDDEN = /Platzhalter|Placeholder|\[Name|TODO|rechtlich geprüft werden|legal review/i;

/** Datenschutzseite ist in der erwarteten Sprache geöffnet und frei von Platzhaltern. */
async function expectPrivacyPage(page: Page, lang: Lang) {
  const soll = SOLL[lang];
  await expect(page).toHaveURL(new RegExp(`/${lang}/datenschutz$`));
  await expect(page.getByRole('heading', { level: 1, name: soll.title })).toBeVisible();
  const prose = page.locator('.prose--legal');
  await expect(prose.getByRole('heading', { level: 2, name: soll.controller })).toBeVisible();
  await expect(prose.getByRole('heading', { level: 2, name: soll.contactHeading })).toBeVisible();
  await expect(prose.getByRole('link', { name: 'mail@marvinjakob.de' }).first()).toHaveAttribute('href', 'mailto:mail@marvinjakob.de');
  await expect(prose.getByRole('link', { name: '+49 175 1964719' }).first()).toHaveAttribute('href', 'tel:+491751964719');
  expect(await prose.innerText()).not.toMatch(FORBIDDEN);
  await expect(page.getByRole('heading', { name: /anmelden|sign in/i })).toHaveCount(0);
}

for (const lang of LANGS) {
  test(`REQ-74-AC5: Footer-Link öffnet die ${lang}-Fassung ohne Anmeldung`, async ({ page }) => {
    await page.goto(`/${lang}/blog`);
    const footer = page.locator('footer.site-footer');
    await footer.scrollIntoViewIfNeeded();
    await footer.getByRole('link', { name: SOLL[lang].footerLink, exact: true }).click();
    await expectPrivacyPage(page, lang);
  });
}

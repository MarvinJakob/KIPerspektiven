// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Legal.tsx app/frontend/src/content/legal/datenschutz.de.md app/frontend/src/content/legal/datenschutz.en.md app/frontend/src/content/legal/datenschutz.freigabe.json
import type { Page } from '@playwright/test';
import { completeAssessment, expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #74: Datenschutzerklärung auf Deutsch und Englisch vervollständigen.
// Unit-Tests der Inhalte: app/frontend/src/content/legal/datenschutz.test.ts.

const SOLL = {
  de: {
    title: 'Datenschutz',
    footerLink: 'Datenschutz',
    controller: 'Verantwortliche Stelle',
    privacyLink: 'Mehr dazu in der Datenschutzerklärung',
    contactHeading: 'Kontaktformular',
  },
  en: {
    title: 'Privacy',
    footerLink: 'Privacy',
    controller: 'Controller',
    privacyLink: 'More in the privacy policy',
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

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });

    for (const lang of LANGS) {
      test(`REQ-74-AC5: Footer-Link öffnet die ${lang}-Fassung ohne Anmeldung und ohne Überlauf`, async ({ page }) => {
        await page.goto(`/${lang}/blog`);
        const footer = page.locator('footer.site-footer');
        await footer.scrollIntoViewIfNeeded();
        await footer.getByRole('link', { name: SOLL[lang].footerLink, exact: true }).click();
        await expectPrivacyPage(page, lang);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

for (const lang of LANGS) {
  test(`REQ-74-AC5: Datenschutzhinweis im Kontaktformular führt zur ${lang}-Fassung`, async ({ page }) => {
    await page.goto(`/${lang}/kontakt`);
    await page.locator('.contact-hint').getByRole('link', { name: SOLL[lang].privacyLink }).click();
    await expectPrivacyPage(page, lang);
  });

  test(`REQ-74-AC5: Hinweise zu Ergebnisspeicherung und Beratung in der Auswertung führen zur ${lang}-Fassung`, async ({ page }) => {
    // Die Auswertung liegt nur im Arbeitsspeicher; deshalb per Verlauf zurück statt neu laden.
    await completeAssessment(page, lang);
    for (const hint of ['.share-hint', 'section.consult']) {
      await page.locator(hint).getByRole('link', { name: SOLL[lang].privacyLink }).first().click();
      await expectPrivacyPage(page, lang);
      await page.goBack();
      await expect(page).toHaveURL(/\/themen\/ai-audit\/auswertung$/);
    }
  });
}

test('REQ-74-AC1: beide Fassungen zeigen dieselbe verantwortliche Stelle', async ({ page }) => {
  const controller = async (lang: Lang) => {
    await page.goto(`/${lang}/datenschutz`);
    const heading = page.locator('.prose--legal h2', { hasText: SOLL[lang].controller });
    // Absatz 1 ist die Einleitung, Absatz 2 die Anschrift, Absatz 3 Telefon und E-Mail.
    const address = await heading.locator('xpath=following-sibling::p[2]').innerText();
    const contact = await heading.locator('xpath=following-sibling::p[3]').innerText();
    return [address.replace(/Deutschland|Germany/, '<Land>'), contact.replace(/Telefon|Phone/, '<Tel>').replace(/E-Mail|Email/, '<Mail>')].join('\n');
  };
  const de = await controller('de');
  expect(de).toContain('Marvin Jakob');
  expect(de).toContain('Danzigerstr. 2');
  expect(de).toContain('65527 Niedernhausen');
  expect(await controller('en')).toBe(de);
});

// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Legal.tsx app/frontend/src/content/legal/datenschutz.de.md app/frontend/src/content/legal/datenschutz.en.md app/frontend/src/pages/Contact.tsx app/frontend/src/components/ShareConsent.tsx app/frontend/src/components/ConsultationOffer.tsx
import type { Page } from '@playwright/test';
import { completeAssessment, expect, test } from '../support/fixtures';

// Anforderung #128: Die ausgelieferte Datenschutzerklärung nennt die rechtlich notwendigen Angaben (REQ-128-AC2)
// und ist von jeder Stelle, an der Daten erhoben werden, ohne Anmeldung erreichbar (REQ-128-AC3).
// Aufbau und Wortlaut sind frei (REQ-128-AC4). Unit-Tests je Angabe: app/frontend/src/content/legal/datenschutz.test.ts.

const SOLL = {
  de: {
    title: 'Datenschutz',
    footerLink: 'Datenschutz',
    privacyLink: 'Mehr dazu in der Datenschutzerklärung',
    // P3, P5, P8, P9, P10, P14 aus dem Ticket #128
    required: ['Art. 6 Abs. 1 lit. a DSGVO', 'Art. 6 Abs. 1 lit. b DSGVO', 'Art. 6 Abs. 1 lit. f DSGVO', '§ 25 Abs. 1 TDDDG', '§ 25 Abs. 2 TDDDG', 'Hetzner Online GmbH', 'Art. 15 DSGVO', 'Art. 16 DSGVO', 'Art. 17 DSGVO', 'Art. 18 DSGVO', 'Art. 20 DSGVO', 'Art. 7 Abs. 3 DSGVO', 'Art. 77 DSGVO'],
    objection: 'Art. 21 DSGVO',
  },
  en: {
    title: 'Privacy',
    footerLink: 'Privacy',
    privacyLink: 'More in the privacy policy',
    required: ['Art. 6(1)(a) GDPR', 'Art. 6(1)(b) GDPR', 'Art. 6(1)(f) GDPR', '§ 25(1) TDDDG', '§ 25(2) TDDDG', 'Hetzner Online GmbH', 'Art. 15 GDPR', 'Art. 16 GDPR', 'Art. 17 GDPR', 'Art. 18 GDPR', 'Art. 20 GDPR', 'Art. 7(3) GDPR', 'Art. 77 GDPR'],
    objection: 'Art. 21 GDPR',
  },
} as const;
type Lang = keyof typeof SOLL;

/** Die Erklärung ist in der erwarteten Sprache ohne Anmeldung geöffnet und zeigt die Pflichtangaben. */
async function expectPrivacyPage(page: Page, lang: Lang) {
  const soll = SOLL[lang];
  await expect(page).toHaveURL(new RegExp(`/${lang}/datenschutz$`));
  await expect(page.getByRole('heading', { level: 1, name: soll.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: /anmelden|sign in/i })).toHaveCount(0);
  const prose = page.locator('.prose--legal');
  // P1: Kontaktwege des Verantwortlichen
  await expect(prose.getByRole('link', { name: 'mail@marvinjakob.de' })).toHaveAttribute('href', 'mailto:mail@marvinjakob.de');
  await expect(prose.getByRole('link', { name: '+49 175 1964719' })).toHaveAttribute('href', 'tel:+491751964719');
  const text = await prose.innerText();
  for (const part of soll.required) expect(text, `Pflichtangabe ${part}`).toContain(part);
  // P13: Hinweis auf das Widerspruchsrecht in einem eigenen, abgesetzten Block
  await expect(prose.locator('blockquote').filter({ hasText: soll.objection })).toHaveCount(1);
}

test('REQ-128-AC2 REQ-128-AC3: Footer-Link öffnet die deutsche Fassung ohne Anmeldung mit allen Pflichtangaben', async ({ page }) => {
  await page.goto('/de/blog');
  const footer = page.locator('footer.site-footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole('link', { name: SOLL.de.footerLink, exact: true }).click();
  await expectPrivacyPage(page, 'de');
});

test('REQ-128-AC2 REQ-128-AC3: Footer-Link öffnet die englische Fassung ohne Anmeldung mit allen Pflichtangaben', async ({ page }) => {
  await page.goto('/en/blog');
  const footer = page.locator('footer.site-footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole('link', { name: SOLL.en.footerLink, exact: true }).click();
  await expectPrivacyPage(page, 'en');
});

test('REQ-128-AC3: Datenschutzlink im Kontaktformular öffnet die Fassung der gewählten Sprache', async ({ page }) => {
  await page.goto('/en/kontakt');
  await page.locator('main').getByRole('link', { name: SOLL.en.privacyLink }).click();
  await expectPrivacyPage(page, 'en');
});

test('REQ-128-AC3: Datenschutzlinks bei Einwilligung und Beratungsangebot der Selbsteinschätzung öffnen die Fassung der gewählten Sprache', async ({ page }) => {
  await completeAssessment(page, 'de');
  await page.locator('.share-consent').getByRole('link', { name: SOLL.de.privacyLink }).click();
  await expectPrivacyPage(page, 'de');
  await page.goBack();
  await page.locator('section.consult').getByRole('link', { name: SOLL.de.privacyLink }).click();
  await expectPrivacyPage(page, 'de');
});

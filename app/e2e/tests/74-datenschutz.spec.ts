// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Legal.tsx app/frontend/src/content/legal/datenschutz.de.md app/frontend/src/content/legal/datenschutz.en.md app/frontend/src/content/legal/datenschutz.freigabe.json app/frontend/src/pages/Contact.tsx app/frontend/src/components/ShareConsent.tsx app/frontend/src/components/ConsultationOffer.tsx
import type { Page } from '@playwright/test';
import { completeAssessment, expect, test } from '../support/fixtures';

// Anforderungen #74 und #118: vollständige, gekürzte Datenschutzerklärung auf Deutsch und Englisch.
// Unit-Tests der Inhalte: app/frontend/src/content/legal/datenschutz.test.ts.

const SOLL = {
  de: {
    title: 'Datenschutz',
    footerLink: 'Datenschutz',
    privacyLink: 'Mehr dazu in der Datenschutzerklärung',
    sections: [
      'Verantwortliche Stelle',
      'Aufruf der Website',
      'Reichweitenstatistik',
      'Kontaktformular',
      'Anfrage für ein Beratungsgespräch',
      'Ergebnisse der Selbsteinschätzung',
      'Cookies und Browserspeicher',
      'Empfänger',
      'Deine Rechte',
      'Widerspruchsrecht',
    ],
    objection: 'Art. 21 DSGVO',
    updated: /Stand: \d{1,2}\. \p{L}+ \d{4}/u,
  },
  en: {
    title: 'Privacy',
    footerLink: 'Privacy',
    privacyLink: 'More in the privacy policy',
    sections: [
      'Controller',
      'Visiting the website',
      'Reach statistics',
      'Contact form',
      'Consultation requests',
      'Self-assessment results',
      'Cookies and browser storage',
      'Recipients',
      'Your rights',
      'Right to object',
    ],
    objection: 'Art. 21 GDPR',
    updated: /Last updated: \d{1,2} \p{L}+ \d{4}/u,
  },
} as const;
type Lang = keyof typeof SOLL;
const FORBIDDEN = /Platzhalter|Placeholder|\[Name|TODO|rechtlich geprüft werden|legal review|Kurz gesagt|In short|HMAC/i;
const MOBILE = { width: 390, height: 844 };

/** Die neue Fassung ist in der erwarteten Sprache ohne Anmeldung geöffnet. */
async function expectPrivacyPage(page: Page, lang: Lang) {
  const soll = SOLL[lang];
  await expect(page).toHaveURL(new RegExp(`/${lang}/datenschutz$`));
  await expect(page.getByRole('heading', { level: 1, name: soll.title })).toBeVisible();
  const prose = page.locator('.prose--legal');
  // REQ-118-AC6/AC8: neue Abschnitte in der vorgesehenen Reihenfolge
  await expect(prose.getByRole('heading', { level: 2 })).toHaveText([...soll.sections]);
  await expect(prose.getByRole('link', { name: 'mail@marvinjakob.de' })).toHaveAttribute('href', 'mailto:mail@marvinjakob.de');
  await expect(prose.getByRole('link', { name: '+49 175 1964719' })).toHaveAttribute('href', 'tel:+491751964719');
  await expect(prose).toContainText(soll.updated);
  expect(await prose.innerText()).not.toMatch(FORBIDDEN);
  await expect(page.getByRole('heading', { name: /anmelden|sign in/i })).toHaveCount(0);
}

/** REQ-118-AC5 (P13): Der Hinweis auf das Widerspruchsrecht ist als eigener Block optisch abgesetzt. */
async function expectObjectionSetOff(page: Page, lang: Lang) {
  const prose = page.locator('.prose--legal');
  const notice = prose.locator('blockquote');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText(SOLL[lang].objection);
  const style = await notice.evaluate((el) => {
    const own = getComputedStyle(el);
    const around = getComputedStyle(el.parentElement!);
    return { border: parseFloat(own.borderLeftWidth), background: own.backgroundColor, parentBackground: around.backgroundColor, weight: Number(getComputedStyle(el.querySelector('strong')!).fontWeight) };
  });
  expect(style.border, 'Randlinie').toBeGreaterThan(0);
  expect(style.background, 'eigener Hintergrund').not.toBe(style.parentBackground);
  expect(style.weight, 'fett gesetzt').toBeGreaterThanOrEqual(600);
}

/** Kein waagerechtes Scrollen: Text und Tabelle passen in die Breite des Geräts. */
async function expectFitsViewport(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'Seite ragt über den Bildschirm hinaus').toBeLessThanOrEqual(0);
}

test('REQ-118-AC8 REQ-74-AC5: Footer-Link öffnet am Desktop die deutsche Fassung ohne Anmeldung, Widerspruchsrecht abgesetzt', async ({ page }) => {
  await page.goto('/de/blog');
  const footer = page.locator('footer.site-footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole('link', { name: SOLL.de.footerLink, exact: true }).click();
  await expectPrivacyPage(page, 'de');
  await expectObjectionSetOff(page, 'de');
  await expectFitsViewport(page);
});

test('REQ-118-AC8 REQ-74-AC5: Footer-Link öffnet auf dem Mobilgerät die englische Fassung ohne Anmeldung', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/en/blog');
  const footer = page.locator('footer.site-footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole('link', { name: SOLL.en.footerLink, exact: true }).click();
  await expectPrivacyPage(page, 'en');
  await expectObjectionSetOff(page, 'en');
  await expectFitsViewport(page);
});

test('REQ-118-AC8: Datenschutzlink im Kontaktformular öffnet die Fassung der gewählten Sprache', async ({ page }) => {
  await page.goto('/en/kontakt');
  await page.locator('main').getByRole('link', { name: SOLL.en.privacyLink }).click();
  await expectPrivacyPage(page, 'en');
});

test('REQ-118-AC8: Datenschutzlinks bei Einwilligung und Beratungsangebot der Selbsteinschätzung öffnen die Fassung der gewählten Sprache', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await completeAssessment(page, 'de');
  await page.locator('.share-consent').getByRole('link', { name: SOLL.de.privacyLink }).click();
  await expectPrivacyPage(page, 'de');
  await page.goBack();
  await page.locator('section.consult').getByRole('link', { name: SOLL.de.privacyLink }).click();
  await expectPrivacyPage(page, 'de');
});

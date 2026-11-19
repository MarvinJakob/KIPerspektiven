// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/App.tsx
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

// Anforderung #54: Öffentlicher Footer nach der Mock-Variante „Kompakt mit Themen“ (.mock/footer/index.html).
// Unit-Tests der Texte, Reihenfolgen und Pfade: app/frontend/src/components/footer.test.ts.

const SOLL = {
  de: {
    heading: 'Themen',
    topics: [
      ['KI in der Softwareentwicklung', '/de/themen/softwareentwicklung'],
      ['KI Readiness', '/de/themen/ai-audit'],
      ['Vibe Coding', '/de/themen/vibe-coding'],
    ],
    pages: [
      ['News', '/de/blog'],
      ['Kontakt', '/de/kontakt'],
      ['Impressum', '/de/impressum'],
      ['Datenschutz', '/de/datenschutz'],
    ],
  },
  en: {
    heading: 'Topics',
    topics: [
      ['AI in Software Development', '/en/themen/softwareentwicklung'],
      ['AI Readiness', '/en/themen/ai-audit'],
      ['Vibe Coding', '/en/themen/vibe-coding'],
    ],
    pages: [
      ['News', '/en/blog'],
      ['Contact', '/en/kontakt'],
      ['Legal notice', '/en/impressum'],
      ['Privacy', '/en/datenschutz'],
    ],
  },
} as const;

type Lang = keyof typeof SOLL;
const BRAND = 'KI Perspektiven';

/** Öffentliche Seite öffnen und zum Footer scrollen. */
async function openFooter(page: Page, lang: Lang, path = '/blog') {
  await page.goto(`/${lang}${path}`);
  const footer = page.locator('footer.site-footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole('navigation', { name: SOLL[lang].heading }).getByRole('link')).toHaveCount(3);
  return footer;
}

for (const lang of ['de', 'en'] as const) {
  const s = SOLL[lang];

  test(`REQ-54-AC3: Themen-, Seiten- und Markenlinks mit Ziel in derselben Sprache (${lang})`, async ({ page }) => {
    const footer = await openFooter(page, lang, '/kontakt');
    const topics = footer.getByRole('navigation', { name: s.heading });
    const expected = [...s.topics, ...s.pages, [BRAND, `/${lang}`]] as const;

    await expect(topics.getByRole('link')).toHaveText(s.topics.map(([label]) => label));
    for (const [label, path] of expected) {
      const link = footer.getByRole('link', { name: label, exact: true });
      await expect(link, `Link „${label}“`).toHaveCount(1);
      expect(await link.evaluate((el) => el.tagName), `„${label}“ ist ein HTML-Link`).toBe('A');
      await expect(link).toHaveAttribute('href', path);
      await expect(link).not.toHaveAttribute('target', /.+/);
    }

    await footer.getByRole('link', { name: s.topics[0][0], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${s.topics[0][1]}$`));
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  });
}

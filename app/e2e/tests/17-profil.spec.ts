import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #17: Öffentliches Profil von Marvin Jakob anzeigen. Quelle: content/topics/persona/Persona.md.
const OFFERS_DE = [
  'KI sinnvoll einsetzen – vom Potenzial zum nächsten Schritt',
  'Datenstrategie – die Grundlage für verlässliche KI',
  'Agentic AI – Prozesse kontrolliert automatisieren',
];

test('REQ-17-AC1: /de/profil und /en/profil zeigen ohne Anmeldung das Profil in der jeweiligen Sprache', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}/profil`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marvin Jakob');
    await expect(page.getByRole('heading', { level: 2, name: lang === 'de' ? 'Beratungsangebote' : /consulting|services|offer/i })).toBeVisible();
  }
});

test('REQ-17-AC2: Vorstellung, Beschreibung, Fakten, Kontakt und Angebote erscheinen in der Reihenfolge der Vorlage', async ({ page }) => {
  await page.goto('/de/profil');
  const main = page.locator('main');
  const order = await main.evaluate((root) => {
    const pick = (sel: string) => root.querySelector(sel);
    const items = {
      vorstellung: pick('h1'),
      portraet: pick('img'),
      beschreibung: [...root.querySelectorAll('h2')].find((h) => h.textContent === 'Über mich') ?? null,
      fakten: pick('dl[aria-label="Auf einen Blick"]'),
      kontakt: [...root.querySelectorAll('h2')].find((h) => h.textContent === 'Kontakt') ?? null,
      angebote: [...root.querySelectorAll('h2')].find((h) => h.textContent === 'Beratungsangebote') ?? null,
    };
    const missing = Object.entries(items).filter(([, el]) => !el).map(([k]) => k);
    const els = Object.values(items).filter(Boolean) as Element[];
    const sorted = els.every((el, i) => i === 0 || (els[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    return { missing, sorted };
  });
  expect(order.missing).toEqual([]);
  expect(order.sorted, 'Abschnitte folgen der Reihenfolge aus Persona.md').toBe(true);

  await expect(page.locator('dl[aria-label="Auf einen Blick"] > div')).toHaveCount(3);
  const offers = page.locator('section[aria-labelledby^="offer-"]');
  await expect(offers.getByRole('heading', { level: 3 })).toHaveText(OFFERS_DE);
  for (const offer of await offers.all()) {
    for (const label of ['Leistungsumfang', 'Ergebnis']) {
      const dd = offer.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd');
      await expect(dd).not.toBeEmpty();
    }
  }
});

test('REQ-17-AC3: Einstieg führt zu den Angeboten, LinkedIn und E-Mail nutzen die hinterlegten Ziele', async ({ page }) => {
  await page.goto('/de/profil');
  await page.getByRole('link', { name: 'Beratungsangebote entdecken' }).click();
  await expect(page.getByRole('heading', { name: 'Beratungsangebote' })).toBeInViewport();

  const linkedin = page.getByRole('link', { name: /LinkedIn/ });
  await expect(linkedin).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/in\/marvin-jakob-/);
  await expect(linkedin).toHaveAttribute('target', '_blank');
  // Kontaktadresse aus dem Impressum (Quelle der Mailadresse laut Persona-Umsetzung)
  const mail = page.getByRole('link', { name: 'Mail' });
  const href = await mail.getAttribute('href');
  expect(href).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]+$/);
  await page.goto('/de/impressum');
  await expect(page.locator('main')).toContainText(href!.replace('mailto:', ''));
});

test('REQ-17-AC4: Sprachwechsel bleibt auf der Profilseite', async ({ page }) => {
  await page.goto('/de/profil');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/profil$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marvin Jakob');
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/profil$/);
  await expect(page.getByRole('heading', { name: 'Über mich' })).toBeVisible();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });

    test(`REQ-17-AC5: kein horizontaler Bildlauf, fokussierbare Links und sprachpassender Alternativtext (${viewport.width} px)`, async ({ page }) => {
      const alts: string[] = [];
      for (const lang of ['de', 'en'] as const) {
        await page.goto(`/${lang}/profil`);
        await expectNoHorizontalScroll(page);
        const img = page.locator('main figure img');
        const alt = (await img.getAttribute('alt')) ?? '';
        expect(alt).toContain(lang === 'de' ? 'Porträt' : 'portrait');
        alts.push(alt);
      }
      expect(alts[0]).not.toBe(alts[1]);
      for (const link of await page.locator('main a[href]').all()) {
        expect(await link.getAttribute('tabindex')).not.toBe('-1');
      }
      await expectVisibleKeyboardFocus(page, page.getByRole('link', { name: /LinkedIn/ }));
    });
  });
}

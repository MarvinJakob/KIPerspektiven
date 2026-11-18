// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx
import { expect, test } from '../support/fixtures';

// Anforderung #37: Abschnitt „Weitere Perspektiven / Mehr Themen.“ am Ende der Themenseite
// „Softwareentwicklung“ entfernen. Der Beitrag endet mit dem Meinungsabschnitt samt Kontaktmöglichkeit.
const PATH = (lang: string) => `/${lang}/themen/softwareentwicklung`;

const removed = {
  de: { eyebrow: 'Weitere Perspektiven', title: 'Mehr Themen.', cards: ['Vibe Coding', 'KI Readiness'], link: 'Zum Thema', all: 'Alle Themen', contact: 'Zum Kontaktformular' },
  en: { eyebrow: 'More perspectives', title: 'More topics.', cards: ['Vibe Coding', 'AI Readiness'], link: 'Go to topic', all: 'All topics', contact: 'Go to the contact form' },
} as const;

/** Alles im Hauptinhalt, was im Dokument nach dem Meinungsabschnitt folgt (ohne dessen eigene Kindelemente). */
const afterOpinion = (page: import('@playwright/test').Page) =>
  page.locator('main').evaluate((main) => {
    const opinion = main.querySelector('#meinung')!;
    const following = [...main.querySelectorAll('*')].filter(
      (el) => !opinion.contains(el) && opinion.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const text = following.map((el) => (el.children.length === 0 ? el.textContent ?? '' : '')).join(' ').replace(/\s+/g, ' ').trim();
    const focusable = following.filter((el) => el.matches('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    return { text, focusable: focusable.map((el) => el.outerHTML.slice(0, 120)) };
  });

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });

    for (const lang of ['de', 'en'] as const) {
      const r = removed[lang];

      test(`REQ-37-AC1: Beitrag endet mit Meinungsabschnitt, ohne „Mehr Themen“ und ohne Leerfläche (${lang}, ${viewport.width} px)`, async ({ page }) => {
        await page.goto(PATH(lang));
        const opinion = page.locator('#meinung');
        await expect(opinion).toBeVisible();
        await expect(opinion.getByRole('link', { name: r.contact })).toHaveAttribute('href', `/${lang}/kontakt`);

        // Bis zum Ende des Beitrags scrollen.
        await page.locator('footer').scrollIntoViewIfNeeded();

        const main = page.locator('main');
        await expect(main.getByText(r.eyebrow, { exact: true }), 'Kennzeichnung des entfernten Abschnitts').toHaveCount(0);
        await expect(main.getByRole('heading', { name: r.title }), 'Überschrift des entfernten Abschnitts').toHaveCount(0);
        await expect(page.locator('#more-title, .more-topics'), 'Container des entfernten Abschnitts').toHaveCount(0);

        // Nach dem Meinungsabschnitt folgt im Hauptinhalt kein weiterer Inhalt.
        expect((await afterOpinion(page)).text, 'Inhalt nach dem Meinungsabschnitt').toBe('');

        // Keine leere Fläche: Nach dem Meinungsabschnitt bleibt im Hauptinhalt nur der Abschlussabstand des Artikels
        // (96 px Desktop, 72 px mobil); der entfernte Abschnitt war mehrere hundert Pixel hoch. Danach folgt der
        // Seitenfuß mit seinem seitenweit üblichen Außenabstand, ohne zusätzliche Fläche dazwischen.
        const opinionBottom = await opinion.evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
        const mainBottom = await main.evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
        const footer = await page.locator('footer').evaluate((el) => ({
          top: el.getBoundingClientRect().top + scrollY,
          margin: parseFloat(getComputedStyle(el).marginTop),
        }));
        expect(mainBottom - opinionBottom, 'Abstand Meinungsabschnitt → Ende des Hauptinhalts').toBeLessThanOrEqual(120);
        expect(footer.top - mainBottom, 'Abstand Hauptinhalt → Seitenfuß = regulärer Fußabstand').toBeCloseTo(footer.margin, 0);
      });

      test(`REQ-37-AC2: am Seitenabschluss keine Themenkarten, kein „${r.all}“ und keine Ersatzverweise, auch per Tab (${lang}, ${viewport.width} px)`, async ({ page }) => {
        await page.goto(PATH(lang));
        // Erst prüfen, wenn der Beitrag vollständig gerendert ist; sonst wären die Negativprüfungen wertlos.
        await expect(page.locator('#meinung')).toBeVisible();
        await page.locator('footer').scrollIntoViewIfNeeded();
        const main = page.locator('main');
        for (const card of r.cards) {
          // Karte = Link mit dem Thementitel als eigenem Textelement. Der Weiterlesen-Verweis im Artikel
          // („… mit Vibe Coding …“) bleibt erlaubt und trägt den Titel nur als Teil eines Satzes.
          await expect(main.getByRole('link').filter({ has: page.getByText(card, { exact: true }) }), `Karte ${card}`).toHaveCount(0);
        }
        await expect(main.getByText(r.link, { exact: true }), `„${r.link}“`).toHaveCount(0);
        await expect(main.getByRole('link', { name: r.all }), `„${r.all}“`).toHaveCount(0);
        await expect(page.locator('.more-card, .all-topics')).toHaveCount(0);

        // Kein fokussierbares Element und kein Themenverweis nach dem Meinungsabschnitt.
        const after = await afterOpinion(page);
        expect(after.focusable, 'fokussierbare Elemente nach dem Meinungsabschnitt').toEqual([]);
        const topicLinksAfter = await main.evaluate((m) => {
          const opinion = m.querySelector('#meinung')!;
          return [...m.querySelectorAll('a[href*="/themen/"], a[href*="#themen"]')]
            .filter((a) => !opinion.contains(a) && opinion.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)
            .map((a) => a.getAttribute('href'));
        });
        expect(topicLinksAfter, 'Ersatzverweise auf Themen nach dem Meinungsabschnitt').toEqual([]);

        // Tabulatordurchlauf: Nach „Zum Kontaktformular“ verlässt der Fokus den Hauptinhalt.
        const contact = page.locator('#meinung').getByRole('link', { name: r.contact });
        await contact.focus();
        await expect(contact).toBeFocused();
        await page.keyboard.press('Tab');
        const next = await page.evaluate(() => {
          const el = document.activeElement!;
          return { inMain: !!el.closest('main'), inFooter: !!el.closest('footer'), text: (el.textContent ?? '').trim() };
        });
        expect(next.inMain, `nächster Tab-Stopp nach dem Kontaktlink liegt noch im Beitrag: „${next.text}“`).toBe(false);
        expect(next.inFooter, `nächster Tab-Stopp „${next.text}“ liegt im Seitenfuß`).toBe(true);
      });
    }
  });
}

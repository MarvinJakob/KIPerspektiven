// REQ-9 Einstiegsbereich mit klarer Hauptaktion zur KI Readiness – Spezifikation: specs/REQ-9.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Locator, type Page } from '@playwright/test';

type Lang = 'de' | 'en';

const READINESS = { de: /KI Readiness/, en: /AI Readiness/ } as const;

/** Nachrangige Zugänge laut Spezifikation: Name und erwartetes Ziel. */
const SECONDARY: Record<Lang, { label: string; name: RegExp; target: 'topics' | RegExp }[]> = {
  de: [
    { label: 'Themen', name: /themen/i, target: 'topics' },
    { label: 'News', name: /\bnews\b/i, target: /\/de\/blog(\/|$|\?|#)/ },
    { label: 'KI verstehen', name: /ki verstehen/i, target: /\/de\/ki-verstehen(\/|$|\?|#)/ },
    { label: 'Über mich', name: /über mich/i, target: /\/de\/profil(\/|$|\?|#)/ },
  ],
  en: [
    { label: 'Topics', name: /topics/i, target: 'topics' },
    { label: 'News', name: /\bnews\b/i, target: /\/en\/blog(\/|$|\?|#)/ },
    { label: 'Understand AI', name: /understand ai/i, target: /\/en\/ki-verstehen(\/|$|\?|#)/ },
    { label: 'About me', name: /about me/i, target: /\/en\/profil(\/|$|\?|#)/ },
  ],
};

/** Überschrift der Themenübersicht auf der Startseite (Ziel des Zugangs „Themen“). */
const TOPICS_HEADING = { de: /Gute Fragen\.\s*Neue Perspektiven\./, en: /Good questions\.\s*New perspectives\./ } as const;

interface Action {
  locator: Locator;
  filled: boolean;
}

/** Einstiegsbereich: die Region der Startseite, die die Hauptüberschrift enthält. */
function hero(page: Page): Locator {
  return page.getByRole('region').filter({ has: page.getByRole('heading', { level: 1 }) }).first();
}

/**
 * Sichtbare Links und Schaltflächen des Einstiegsbereichs außerhalb verschachtelter Navigationen,
 * jeweils mit der Angabe, ob sie eine gefüllte Fläche (Button-Optik) haben.
 */
async function heroActions(page: Page): Promise<Action[]> {
  const region = hero(page);
  await expect(region).toBeVisible();
  const candidates = await region.getByRole('link').or(region.getByRole('button')).all();
  const actions: Action[] = [];
  for (const locator of candidates) {
    if (!(await locator.isVisible())) continue;
    const { inNav, filled } = await locator.evaluate((el) => {
      const parse = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a = '1'] = m[1].split(/[,\s/]+/).filter(Boolean);
        return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
      };
      const own = getComputedStyle(el);
      const color = parse(own.backgroundColor);
      let behind = { r: 255, g: 255, b: 255, a: 1 };
      for (let e = el.parentElement; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0) {
          behind = c;
          break;
        }
      }
      const differs =
        !!color &&
        color.a > 0.1 &&
        Math.abs(color.r - behind.r) + Math.abs(color.g - behind.g) + Math.abs(color.b - behind.b) > 12;
      return {
        inNav: !!el.parentElement?.closest('nav, [role="navigation"]'),
        filled: (own.backgroundImage !== 'none' && own.backgroundImage !== '') || differs,
      };
    });
    if (!inNav) actions.push({ locator, filled });
  }
  return actions;
}

async function primaryAction(page: Page, lang: Lang): Promise<Locator> {
  await page.goto(`/${lang}`);
  const filled = (await heroActions(page)).filter((a) => a.filled);
  expect(filled, 'genau eine Aktion mit gefüllter Fläche im Einstiegsbereich').toHaveLength(1);
  return filled[0].locator;
}

async function expectReadinessStart(page: Page, lang: Lang) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(READINESS[lang]);
  const url = new URL(page.url());
  expect(url.pathname).toMatch(new RegExp(`^/${lang}/.+`));
  const response = await page.request.get(url.pathname);
  expect(response.status()).toBe(200);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'Seite ist nicht breiter als das Fenster').toBeLessThanOrEqual(1);
}

for (const [id, lang] of [
  ['REQ-9-AC1', 'de'],
  ['REQ-9-AC2', 'en'],
] as const) {
  test(`${id} Einstiegsbereich auf /${lang} hat genau eine Hauptaktion zur ${lang === 'de' ? 'KI' : 'AI'} Readiness`, async ({
    page,
  }) => {
    const primary = await primaryAction(page, lang);
    await expect(primary).toHaveAccessibleName(READINESS[lang]);
  });
}

test('REQ-9-AC3 Hauptaktion führt direkt zur Startseite der KI Readiness', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    const primary = await primaryAction(page, lang);
    await primary.click();
    await expect(page).not.toHaveURL(new RegExp(`/${lang}/?$`));
    await expectReadinessStart(page, lang);
  }
});

for (const [id, lang] of [
  ['REQ-9-AC4', 'de'],
  ['REQ-9-AC5', 'en'],
] as const) {
  test(`${id} Nachrangige Zugänge im Einstiegsbereich auf /${lang} sind erreichbar`, async ({ page }) => {
    for (const entry of SECONDARY[lang]) {
      await test.step(entry.label, async () => {
        await page.goto(`/${lang}`);
        const matches: Action[] = [];
        for (const action of await heroActions(page)) {
          const name = (await action.locator.getAttribute('aria-label')) ?? (await action.locator.innerText());
          if (entry.name.test(name)) matches.push(action);
        }
        expect(matches, `Zugang „${entry.label}“ im Einstiegsbereich`).not.toHaveLength(0);
        const link = matches[0];
        await expect(link.locator).toHaveAccessibleName(entry.name);
        expect(link.filled, `„${entry.label}“ ist nachrangig (keine gefüllte Fläche)`).toBe(false);
        await link.locator.click();
        if (entry.target === 'topics') {
          await expect(page.getByRole('heading', { level: 2, name: TOPICS_HEADING[lang] })).toBeInViewport();
        } else {
          await expect(page).toHaveURL(entry.target);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        }
      });
    }
  });
}

test('REQ-9-AC6 Hauptaktion sofort sichtbar, nachrangige Zugänge in höchstens zwei Zeilen', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await test.step(lang, async () => {
      const primary = await primaryAction(page, lang);
      await expect(primary).toBeInViewport({ ratio: 1 });

      const secondary = (await heroActions(page)).filter((a) => !a.filled);
      expect(secondary.length, 'nachrangige Zugänge vorhanden').toBeGreaterThan(0);
      const boxes = [];
      for (const s of secondary) {
        const box = await s.locator.boundingBox();
        if (box) boxes.push({ top: box.y, bottom: box.y + box.height });
      }
      // Zeilen: Gruppen von Links, deren vertikale Lage sich überlappt
      boxes.sort((a, b) => a.top - b.top);
      const rows: { top: number; bottom: number }[] = [];
      for (const box of boxes) {
        const row = rows.find((r) => box.top < r.bottom - 1 && box.bottom > r.top + 1);
        if (row) row.bottom = Math.max(row.bottom, box.bottom);
        else rows.push({ ...box });
      }
      expect(rows.length, 'Zeilen der nachrangigen Zugänge').toBeLessThanOrEqual(2);

      await expectNoHorizontalOverflow(page);
    });
  }
});

test('REQ-9-AC7 Hauptaktion und nachrangige Zugänge sind mit der Tastatur bedienbar', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await test.step(lang, async () => {
      await page.goto(`/${lang}`);
      const actions = await heroActions(page);
      const primaryIndex = actions.findIndex((a) => a.filled);
      expect(primaryIndex, 'Hauptaktion vorhanden').toBeGreaterThanOrEqual(0);
      const handles = await Promise.all(actions.map((a) => a.locator.elementHandle()));

      const reached = new Set<number>();
      for (let i = 0; i < 40 && reached.size < actions.length; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate((els) => els.findIndex((e) => e === document.activeElement), handles);
        if (focused >= 0) reached.add(focused);
      }
      for (const [i, action] of actions.entries()) {
        expect(reached.has(i), `per Tab erreichbar: ${await action.locator.innerText()}`).toBe(true);
      }

      // Enter auf der fokussierten Hauptaktion öffnet die KI Readiness
      await page.goto(`/${lang}`);
      const primary = (await heroActions(page))[primaryIndex].locator;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        if (await primary.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(primary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).not.toHaveURL(new RegExp(`/${lang}/?$`));
      await expectReadinessStart(page, lang);
    });
  }
});

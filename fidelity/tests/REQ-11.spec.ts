// REQ-11 Selbsteinschätzung: Schrittnummer für Screenreader genau einmal – Spezifikation: specs/REQ-11.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
//
// Zugänglicher Inhalt = Accessibility-Baum des Browsers (Chrome DevTools Protocol), also das, was ein
// Screenreader vom Browser erhält, einschließlich Listenmarkern. Beide Projekte (desktop, mobil) laufen in Chromium.
import { expect, test, type Locator, type Page } from '@playwright/test';

type Lang = 'de' | 'en';

const TEXT = {
  de: {
    start: 'Selbsteinschätzung starten',
    steps: 'Ablauf der Selbsteinschätzung',
    level1: /^Stufe 1\b/,
    next: 'Weiter',
    showResult: 'Auswertung anzeigen',
    current: /\bAktuell\b/,
    open: /\bOffen\b/,
    rated: /\bBewertet\b/,
    stepOf: (n: number, total: number) => new RegExp(`Dimension ${n} von ${total}\\b`),
    resultTitle: /Auswertung/,
  },
  en: {
    start: 'Start self-assessment',
    steps: 'Self-assessment steps',
    level1: /^Level 1\b/,
    next: 'Next',
    showResult: 'Show results',
    current: /\bCurrent\b/,
    open: /\bOpen\b/,
    rated: /\bRated\b/,
    stepOf: (n: number, total: number) => new RegExp(`Dimension ${n} of ${total}\\b`),
    resultTitle: /result/i,
  },
} as const;

interface AXNode {
  nodeId: string;
  ignored?: boolean;
  role?: { value?: string };
  name?: { value?: string };
  childIds?: string[];
}

/**
 * Zugängliche Ausgabe jedes Eintrags der Schrittliste in Lesereihenfolge: Text und Listenmarker aus dem
 * Accessibility-Baum des Browsers, ohne verborgene (aria-hidden, display:none) Inhalte.
 */
async function spokenSteps(page: Page, lang: Lang): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const role = (n: AXNode) => n.role?.value ?? '';
    const nav = nodes.find((n) => !n.ignored && role(n) === 'navigation' && n.name?.value === TEXT[lang].steps);
    if (!nav) return [];
    const children = (n: AXNode) => (n.childIds ?? []).map((id) => byId.get(id)).filter((c): c is AXNode => !!c);
    const find = (n: AXNode, r: string): AXNode[] =>
      role(n) === r ? [n] : children(n).flatMap((c) => find(c, r));
    const text = (n: AXNode): string[] => {
      if (role(n) === 'ListMarker') return [n.name?.value ?? ''];
      if (role(n) === 'StaticText') return n.ignored ? [] : [n.name?.value ?? ''];
      return children(n).flatMap(text);
    };
    const list = find(nav, 'list')[0];
    if (!list) return [];
    return children(list)
      .filter((c) => role(c) === 'listitem' && !c.ignored)
      .map((item) => text(item).join(' ').replace(/\s+/g, ' ').trim());
  } finally {
    await cdp.detach();
  }
}

/** Alle eigenständigen Zahlen eines Textes, z. B. „1. Strategie“ → [1]; „1 1. Strategie“ → [1, 1]. */
function numbers(text: string): number[] {
  return [...text.matchAll(/(?<![\d.])\d+(?![\d])/g)].map((m) => Number(m[0]));
}

/**
 * Für Sehende sichtbare Zahlen eines Eintrags: Ziffern in Textknoten, die an ihrer Position tatsächlich
 * dargestellt werden (nicht weggeschnitten, nicht verdeckt). Nur für Screenreader bestimmter Text zählt nicht.
 */
async function visibleNumbers(item: Locator): Promise<number[]> {
  const digits = await item.evaluate((root) => {
    root.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent ?? '';
      if (!/\d/.test(value) || !node.parentElement) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && (hit === node.parentElement || node.parentElement.contains(hit))) found.push(value);
    }
    return found.join(' ');
  });
  return numbers(digits);
}

function stepsNav(page: Page, lang: Lang): Locator {
  return page.getByRole('navigation', { name: TEXT[lang].steps });
}

/** Startet die Selbsteinschätzung über die Übersicht und landet auf der ersten Dimension. */
async function startAssessment(page: Page, lang: Lang) {
  await page.goto(`/${lang}/themen/ai-audit`);
  await page.getByRole('link', { name: TEXT[lang].start }).first().click();
  await expect(stepsNav(page, lang)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Bewertet die angezeigte Dimension mit Stufe 1 und geht zum nächsten Schritt (ohne Neuladen: Auswahl bleibt erhalten). */
async function rateAndContinue(page: Page, lang: Lang, button: string = TEXT[lang].next) {
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  await page.getByRole('radio', { name: TEXT[lang].level1 }).check();
  await page.getByRole('button', { name: button }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(title);
}

/** Erster Schritt bewertet, zweiter aktuell, übrige offen. Gibt die Titel der ersten beiden Dimensionen zurück. */
async function openSecondStep(page: Page, lang: Lang): Promise<[string, string]> {
  await startAssessment(page, lang);
  const first = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  await rateAndContinue(page, lang);
  await expect(page.getByText(TEXT[lang].stepOf(2, await stepCount(page, lang)))).toBeVisible();
  const second = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  return [first, second];
}

async function stepCount(page: Page, lang: Lang): Promise<number> {
  return stepsNav(page, lang).getByRole('listitem').count();
}

/** Jeder Eintrag i (ab 1) nennt im zugänglichen Inhalt genau eine Zahl, und zwar i. */
async function expectEachNumberOnce(page: Page, lang: Lang) {
  const total = await stepCount(page, lang);
  expect(total).toBeGreaterThanOrEqual(2);
  const spoken = await spokenSteps(page, lang);
  expect(spoken, 'Schrittliste im Accessibility-Baum').toHaveLength(total);
  spoken.forEach((entry, i) => {
    expect(numbers(entry), `Eintrag ${i + 1}: „${entry}“`).toEqual([i + 1]);
  });
  return spoken;
}

/** Bezeichnung und Status jedes Schritts sind zugänglich, der aktuelle Schritt ist als solcher erkennbar. */
async function expectStepInfo(page: Page, lang: Lang, [first, second]: [string, string]) {
  const t = TEXT[lang];
  const total = await stepCount(page, lang);
  await expect(page.getByText(t.stepOf(2, total))).toBeVisible();
  const spoken = await spokenSteps(page, lang);
  expect(spoken).toHaveLength(total);
  expect(spoken[0], 'Schritt 1 nennt seine Dimension').toContain(first);
  expect(spoken[0], 'Schritt 1 ist bewertet').toMatch(t.rated);
  expect(spoken[1], 'Schritt 2 nennt die angezeigte Dimension').toContain(second);
  expect(spoken[1], 'Schritt 2 ist der aktuelle').toMatch(t.current);
  spoken.forEach((entry, i) => {
    // Nummer, Bezeichnung (mindestens ein Wort außer dem Status) und Status
    const label = entry.replace(/^\d+\s*\.?\s*/, '').replace(new RegExp(`\\s*(${t.current.source}|${t.open.source}|${t.rated.source}).*$`), '');
    expect(label.length, `Eintrag ${i + 1} hat eine Bezeichnung: „${entry}“`).toBeGreaterThan(2);
    if (i >= 2) expect(entry, `Schritt ${i + 1} ist offen`).toMatch(t.open);
    if (i !== 1) expect(entry, `nur Schritt 2 ist aktuell`).not.toMatch(t.current);
  });
}

test.describe('REQ-11 Schrittnummer der Selbsteinschätzung genau einmal', () => {
  test('REQ-11-AC1 Deutsch: die erste Schrittnummer wird genau einmal ausgegeben', async ({ page }) => {
    await startAssessment(page, 'de');
    const spoken = await spokenSteps(page, 'de');
    expect(spoken.length, 'Schrittliste im Accessibility-Baum').toBeGreaterThanOrEqual(2);
    expect(spoken[0]).not.toMatch(/(?<![\d.])1\s*\.?\s+1(?!\d)/);
    expect(numbers(spoken[0]), `erster Eintrag: „${spoken[0]}“`).toEqual([1]);
    expect(spoken[0]).toMatch(/^1\s*\.?\s+\S/);
  });

  test('REQ-11-AC2 Deutsch: jede Schrittnummer wird in jedem Zustand genau einmal ausgegeben', async ({ page }) => {
    await openSecondStep(page, 'de');
    await expectEachNumberOnce(page, 'de');
  });

  test('REQ-11-AC3 Deutsch: Schrittbezeichnung und aktueller Schritt bleiben zugänglich', async ({ page }) => {
    await expectStepInfo(page, 'de', await openSecondStep(page, 'de'));
  });

  test('REQ-11-AC4 sichtbare Nummerierung und zugängliche Ausgabe stimmen überein (Deutsch und Englisch)', async ({ page }) => {
    // Nur die Höhe wächst (Breite und damit Layout bleiben): Die ganze Schrittliste passt ins Fenster,
    // auch wenn sie auf Desktop am oberen Rand klebt.
    const viewport = page.viewportSize();
    if (viewport) await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, 1600) });
    for (const lang of ['de', 'en'] as const) {
      await openSecondStep(page, lang);
      const spoken = await expectEachNumberOnce(page, lang);
      const items = stepsNav(page, lang).getByRole('listitem');
      for (let i = 0; i < spoken.length; i++) {
        const visible = await visibleNumbers(items.nth(i));
        // bewertete Schritte (hier nur Schritt 1) dürfen statt der Nummer ein Häkchen zeigen
        if (i > 0) expect(visible, `${lang}: Eintrag ${i + 1} zeigt sichtbar seine Nummer`).toContain(i + 1);
        for (const n of visible) expect(n, `${lang}: sichtbare Zahl in Eintrag ${i + 1}`).toBe(i + 1);
      }
    }
  });

  test('REQ-11-AC5 Englisch: jede Schrittnummer wird in jedem Zustand genau einmal ausgegeben', async ({ page }) => {
    await openSecondStep(page, 'en');
    await expectEachNumberOnce(page, 'en');
  });

  test('REQ-11-AC6 Englisch: Schrittbezeichnung und aktueller Schritt bleiben zugänglich', async ({ page }) => {
    await expectStepInfo(page, 'en', await openSecondStep(page, 'en'));
  });

  test('REQ-11-AC7 Auswertung: Schrittliste nach allen Bewertungen nennt jede Nummer genau einmal', async ({ page }) => {
    test.slow();
    await startAssessment(page, 'de');
    const total = await stepCount(page, 'de');
    for (let i = 1; i < total; i++) await rateAndContinue(page, 'de');
    await rateAndContinue(page, 'de', TEXT.de.showResult);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEXT.de.resultTitle);
    const spoken = await expectEachNumberOnce(page, 'de');
    spoken.forEach((entry, i) => expect(entry, `Schritt ${i + 1} ist bewertet`).toMatch(TEXT.de.rated));
  });
});

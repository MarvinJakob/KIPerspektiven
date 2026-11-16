// REQ-6 Themenseite Vibe Coding – Spezifikation: specs/REQ-6.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Page } from '@playwright/test';

const DE = '/de/themen/vibe-coding';
const EN = '/en/themen/vibe-coding';

/** Kennzeichnende Sätze der Vorlage (content/topics/Vibe Coding v1_de.md), je einer pro Absatz. */
const INTRO = {
  subtitle: /Dem einfachsten Weg,? SLOP zu erzeugen/i,
  lead: 'Du beschreibst, was du möchtest',
  prototype: 'Zwischen Idee und vorzeigbarem Ergebnis liegt so plötzlich kaum noch Zeit',
  story: 'Nach zwölf Runden läuft die Demo wieder',
  abundance: 'Code ist plötzlich im Überfluss vorhanden',
  quote: 'Humans should review ideas, not code',
  transition: 'Engineering-Perspektiven helfen dabei, diese Verantwortung',
};

/** Die fünf Perspektiven in der Reihenfolge des Mocks: Name, Überschrift, Text, Beispiel, Schlusssatz. */
const PERSPECTIVES = [
  {
    name: 'Prompt Engineering',
    heading: /Den Auftrag verständlich formulieren/i,
    body: 'Dazu gehören das gewünschte Ergebnis, die Zielgruppe, wichtige Grenzen und das Format',
    example: 'Nenne deshalb Nutzen, Aufwand und offene Fragen',
    closing: 'Ein guter Prompt verbessert die Voraussetzungen, garantiert aber keine richtige Antwort',
  },
  {
    name: 'Context Engineering',
    heading: /Die KI war beim entscheidenden Meeting leider nicht dabei/i,
    body: 'die jeweils relevanten Informationen bereitzustellen',
    example: 'welche technische Altlast seit drei Jahren liebevoll',
    closing: 'Sonst implementiert sie eine ausgesprochen elegante Lösung',
  },
  {
    name: 'Harness Engineering',
    heading: /für die KI/i,
    body: 'Damit sie über mehrere Arbeitsschritte verlässlich vorankommt, braucht sie eine technische Arbeitsumgebung',
    example: 'Schlägt eine Prüfung fehl, fließt das Ergebnis in den nächsten Versuch ein',
    closing: 'Im Harness Engineering steuern wir die Fähigkeiten, die unser Agent erhält',
  },
  {
    name: 'Specification Engineering',
    heading: /Sind wir schon da/i,
    body: 'Wir sollten uns selbst klar darüber werden, was das gewünschte Ergebnis eigentlich ist',
    example: 'Was passiert, wenn die Datenbank nicht erreichbar ist?',
    closing: 'die Wünsche vom vorletzten Donnerstag',
  },
  {
    name: 'Product Engineering',
    heading: /Braucht jemand dieses Formular noch/i,
    body: 'Product Engineering verbindet das Verständnis für Nutzerprobleme',
    example: 'Vielleicht wollen die Menschen überhaupt keine Daten eingeben',
    closing: 'geben ihr eine sehr geschmackvolle Benutzeroberfläche',
  },
];

const CONCLUSION = [
  'Jetzt wäre ein guter Moment, auch den Anspruch anzuheben',
  'Kreativität hält sich schließlich selten an den Projektplan',
  'dürfen wir uns ruhig etwas einfallen lassen',
];

/** Alle deutschen Prüfsätze als Text (ohne den Untertitel-Ausdruck). */
const GERMAN_PHRASES = [
  INTRO.lead,
  INTRO.prototype,
  INTRO.story,
  INTRO.abundance,
  INTRO.transition,
  ...PERSPECTIVES.flatMap((p) => [p.body, p.example, p.closing]),
  ...CONCLUSION,
];

/** Sichtbarer Text des Hauptinhalts, Leerraum vereinheitlicht, weiche Trennstriche entfernt. */
async function mainText(page: Page) {
  const text = await page.getByRole('main').innerText();
  return text.replace(/­/g, '').replace(/\s+/g, ' ').trim();
}

/** Seiteneigener Inhalt: Hauptinhalt bis vor die gemeinsame Beitragsliste (sofern vorhanden). */
async function ownText(page: Page) {
  const text = await mainText(page);
  const cut = text.search(/Beiträge zu diesem Thema|Articles on this topic/);
  return cut > 0 ? text.slice(0, cut) : text;
}

/** Sprachwechsel im Kopfbereich; auf Mobil liegt er im Menü. */
async function switchLanguage(page: Page, label: 'English' | 'Deutsch') {
  const button = page.getByRole('banner').getByRole('button', { name: label, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole('banner').getByRole('button', { name: /^(Menü|Menu)$/ }).click();
  }
  await button.click();
}

test('REQ-6-AC1 Seite ist je Sprache direkt aufrufbar', async ({ page }) => {
  for (const path of [DE, EN]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\s*Vibe Coding\s*$/);
    await expect(page).toHaveTitle(/Vibe Coding/);
  }
});

test('REQ-6-AC2 Themenübersicht der Startseite verlinkt die Seite', async ({ page }) => {
  for (const lang of ['de', 'en']) {
    await page.goto(`/${lang}`);
    const links = page.getByRole('main').getByRole('link', { name: /Vibe Coding/i });
    const count = await links.count();
    let target = -1;
    for (let i = 0; i < count && target < 0; i++) {
      const hrefValue = (await links.nth(i).getAttribute('href')) ?? '';
      if (new RegExp(`/${lang}/themen/vibe-coding/?$`).test(hrefValue)) target = i;
    }
    expect(target, `Link auf /${lang}/themen/vibe-coding in der Themenübersicht`).toBeGreaterThanOrEqual(0);
    await links.nth(target).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/themen/vibe-coding/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  }
});

test('REQ-6-AC3 Deutscher Inhalt ist vollständig', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const text = await mainText(page);
  const lower = text.toLowerCase();
  expect(text).toMatch(INTRO.subtitle);
  expect(text).toContain('Stand: 16. November 2026');
  expect(text).toContain(INTRO.quote);
  for (const phrase of GERMAN_PHRASES) expect(text, phrase).toContain(phrase);
  for (const p of PERSPECTIVES) {
    expect(lower, p.name).toContain(p.name.toLowerCase());
    await expect(page.getByRole('main').getByRole('heading', { name: p.heading })).toBeVisible();
  }
  expect(lower).toContain('fazit');
});

test('REQ-6-AC4 Abschnitte folgen dem Mock', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const text = await mainText(page);
  const subtitle = text.search(INTRO.subtitle);
  const order = [
    INTRO.lead,
    INTRO.story,
    INTRO.quote,
    ...PERSPECTIVES.map((p) => p.body),
    CONCLUSION[0],
  ].map((phrase) => text.indexOf(phrase));
  const positions = [subtitle, ...order];
  expect(positions.every((pos) => pos >= 0), `alle Abschnitte gefunden: ${positions.join(', ')}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test('REQ-6-AC5 Beispiele stehen in Hinweiskästen, das Zitat in einem Zitatblock', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const main = page.getByRole('main');
  const boxes = main.getByRole('figure').or(main.getByRole('note')).or(main.getByRole('complementary'));
  const examples = [
    { example: INTRO.story, outside: INTRO.abundance },
    ...PERSPECTIVES.map((p) => ({ example: p.example, outside: p.body })),
  ];
  for (const { example, outside } of examples) {
    const box = boxes.filter({ hasText: example }).filter({ hasNotText: outside });
    await expect(box, example).toHaveCount(1);
    await expect(box, example).toBeVisible();
    await expect(box, example).toHaveAccessibleName(/\S/);
  }
  await expect(main.getByRole('blockquote').filter({ hasText: INTRO.quote })).toBeVisible();
});

test('REQ-6-AC6 Sprungmarken führen zu den fünf Perspektiven', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const main = page.getByRole('main');
  for (const p of PERSPECTIVES) {
    await main.getByRole('link', { name: new RegExp(p.name, 'i') }).first().click();
    await expect(main.getByText(p.body).first(), p.name).toBeInViewport();
  }
});

test('REQ-6-AC7 Interne Links führen zu ihren Zielen', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  await page.getByRole('main').getByRole('link', { name: 'Start', exact: true }).first().click();
  await expect(page).toHaveURL(/\/de\/?(#themen)?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto(DE);
  await page.getByRole('main').getByRole('link', { name: /Themenübersicht/i }).first().click();
  await expect(page).toHaveURL(/\/de\/?(#themen)?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto(DE);
  await page.getByRole('main').getByRole('link', { name: /KI Readiness/i }).first().click();
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('REQ-6-AC8 Darstellung passt sich Desktop und Mobil an', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const main = page.getByRole('main');
  const wide = (page.viewportSize()?.width ?? 0) > 850;
  for (const p of PERSPECTIVES) {
    const heading = main.getByRole('heading', { name: p.heading });
    const body = main.getByText(p.body).first();
    await body.scrollIntoViewIfNeeded();
    const h = await heading.boundingBox();
    const b = await body.boundingBox();
    expect(h && b, p.name).toBeTruthy();
    if (wide) expect(b!.x, `${p.name}: Text rechts neben der Überschrift`).toBeGreaterThanOrEqual(h!.x + h!.width - 1);
    else expect(b!.y, `${p.name}: Text unter der Überschrift`).toBeGreaterThanOrEqual(h!.y + h!.height - 1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'kein horizontaler Bildlauf').toBeLessThanOrEqual(0);
});

test('REQ-6-AC9 Englische Seite ist vollständig übersetzt', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const germanLength = (await ownText(page)).length;

  await page.goto(EN);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const all = await mainText(page);
  expect(all).not.toMatch(/not available in English|You are reading the/i);
  for (const phrase of GERMAN_PHRASES) expect(all, phrase).not.toContain(phrase);

  const own = await ownText(page);
  const lower = own.toLowerCase();
  for (const p of PERSPECTIVES) expect(lower, p.name).toContain(p.name.toLowerCase());
  expect(own).toContain(INTRO.quote);
  const german = own.match(
    /\b(und|der|das|nicht|wir|mit|ist|eine|auch|wenn|oder|für|über|sich|werden|Fazit|Beispiel)\b/gi,
  );
  expect(german ?? [], 'deutsche Wörter im englischen Inhalt').toEqual([]);
  expect(own.length, 'Umfang der Übersetzung').toBeGreaterThanOrEqual(germanLength * 0.7);
});

test('REQ-6-AC10 Sprachwechsel wechselt Seite und Bedienelemente', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  await expect(page.getByRole('main').getByText(INTRO.lead)).toBeVisible();

  await switchLanguage(page, 'English');
  await expect(page).toHaveURL(/\/en\/themen\/vibe-coding\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  await expect(main.getByRole('link', { name: 'Home', exact: true }).first()).toBeVisible();
  await expect(main.getByRole('link', { name: /AI Readiness/i }).first()).toBeVisible();
  await expect(main.getByText(INTRO.lead)).toHaveCount(0);

  await switchLanguage(page, 'Deutsch');
  await expect(page).toHaveURL(/\/de\/themen\/vibe-coding\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('main').getByText(INTRO.lead)).toBeVisible();
});

test('REQ-6-AC11 Deutscher Seitentext spricht mit du an', async ({ page }) => {
  await page.goto(DE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  await expect(page.getByRole('main').getByText(INTRO.lead)).toBeVisible();
  const own = await ownText(page);
  expect(own).toContain(CONCLUSION[2]);
  // Großgeschriebene Sie-Formen außerhalb eines Satzanfangs sind Sie-Anrede.
  const formal = own.match(/(?<![.!?:„“"»«]\s|^)\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/g);
  expect(formal ?? [], 'Sie-Anrede im Seitentext').toEqual([]);
});

// REQ-5 KI Readiness: Fähigkeitsstufe über die gesamte Auswahlbox auswählbar – Spezifikation: specs/REQ-5.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
// Im Projekt „mobil“ (Pixel 7, Touch) wird getippt, im Projekt „desktop“ geklickt.
import { devices, expect, test, type Locator, type Page } from '@playwright/test';

type Lang = 'de' | 'en';

const TEXT = {
  de: { start: 'Selbsteinschätzung starten', group: /^Reifegrad für /, level: 'Stufe', selected: 'Ausgewählt', chosen: 'Gewählt:', step: /Dimension (\d+) von/, next: 'Weiter', back: 'Zurück' },
  en: { start: 'Start self-assessment', group: /^Maturity level for /, level: 'Level', selected: 'Selected', chosen: 'Chosen:', step: /Dimension (\d+) of/, next: 'Next', back: 'Back' },
} as const;

/** Öffnet die erste Dimension der Selbsteinschätzung über die Startaktion und liefert die drei Stufenboxen. */
async function openFirstDimension(page: Page, lang: Lang = 'de') {
  await page.goto(`/${lang}/themen/ai-audit`);
  await page.getByRole('link', { name: TEXT[lang].start }).first().click();
  await expect(page.getByText(TEXT[lang].step)).toContainText(/ 1 /);
  const group = page.getByRole('group', { name: TEXT[lang].group });
  // Stufenboxen sind die Listeneinträge der Gruppe, die eine Auswahl enthalten (nicht die Prüffragen).
  const cards = group.getByRole('listitem').filter({ has: page.getByRole('radio') });
  await expect(cards).toHaveCount(3);
  return { group, cards };
}

/**
 * Klickt (Desktop) bzw. tippt (Touch) auf eine Stufenbox an einer Position relativ zu ihrer linken oberen Ecke.
 * Geklickt wird immer die Box selbst: Was technisch über dem Text liegt (z. B. eine unsichtbare Auswahlfläche),
 * ist für Nutzer nicht sichtbar und darf den Klick an dieser Stelle nicht verhindern.
 */
async function press(card: Locator, position?: { x: number; y: number }, touch = !!test.info().project.use.hasTouch) {
  if (touch) await card.tap({ position });
  else await card.click({ position });
}

/** Klickt bzw. tippt in der Box auf die Mitte eines sichtbaren Inhalts (Beschriftung, Beschreibung, Prüffrage). */
async function pressOn(card: Locator, inner: Locator, touch?: boolean) {
  await inner.scrollIntoViewIfNeeded();
  const c = await size(card);
  const i = await inner.boundingBox();
  if (!i) throw new Error('Inhalt ist nicht sichtbar');
  await press(card, { x: i.x - c.x + i.width / 2, y: i.y - c.y + i.height / 2 }, touch);
}

async function size(el: Locator) {
  const box = await el.boundingBox();
  if (!box) throw new Error('Element ist nicht sichtbar');
  return box;
}

const radio = (card: Locator) => card.getByRole('radio');
const description = (card: Locator) => card.getByRole('paragraph').first();
const questionsHeading = (card: Locator) => card.getByRole('heading', { level: 3 });
const questions = (card: Locator) => card.getByRole('list').getByRole('listitem');

/** Punkt in der freien Fläche zwischen der letzten Prüffrage und der Unterkante der Box (Mitte). */
async function freeAreaPoint(card: Locator) {
  const c = await size(card);
  const last = await questions(card).last().boundingBox();
  if (!last) throw new Error('Prüffragen sind nicht sichtbar');
  const bottomOfContent = last.y + last.height - c.y;
  return { x: c.width / 2, y: (bottomOfContent + c.height) / 2 };
}

/** Genau die Stufenbox mit Index `index` ist ausgewählt. */
async function expectOnlySelected(cards: Locator, index: number) {
  for (let i = 0; i < 3; i++) {
    if (i === index) await expect(radio(cards.nth(i))).toBeChecked();
    else await expect(radio(cards.nth(i))).not.toBeChecked();
  }
}

test('REQ-5-AC1 Klick auf die Beschriftung einer Stufenbox wählt die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await pressOn(cards.nth(1), cards.nth(1).getByText(/^Stufe 2$/));
  await expectOnlySelected(cards, 1);
  await pressOn(cards.nth(2), cards.nth(2).getByText(/^Stufe 3$/));
  await expectOnlySelected(cards, 2);
});

test('REQ-5-AC2 Klick auf den Beschreibungstext einer Stufenbox wählt die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await pressOn(cards.nth(1), description(cards.nth(1)));
  await expectOnlySelected(cards, 1);
  await pressOn(cards.nth(0), description(cards.nth(0)));
  await expectOnlySelected(cards, 0);
});

test('REQ-5-AC3 Klick auf die Prüffragen einer Stufenbox wählt die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await pressOn(cards.nth(2), questionsHeading(cards.nth(2)));
  await expectOnlySelected(cards, 2);
  await pressOn(cards.nth(1), questions(cards.nth(1)).first());
  await expectOnlySelected(cards, 1);
});

test('REQ-5-AC4 Klick auf die freie Innenfläche einer Stufenbox wählt die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await press(cards.nth(1), await freeAreaPoint(cards.nth(1)));
  await expectOnlySelected(cards, 1);
  await press(cards.nth(2), await freeAreaPoint(cards.nth(2)));
  await expectOnlySelected(cards, 2);
});

test('REQ-5-AC5 Klick in den Randbereich einer Stufenbox wählt die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  // Linker und rechter Rand jeweils 3 px innerhalb der Box auf Höhe des Beschreibungstexts, unterer Rand 3 px über der Unterkante.
  const atDescription = async (card: Locator, x: (w: number) => number) => {
    const c = await size(card);
    const d = await description(card).boundingBox();
    if (!d) throw new Error('Beschreibung ist nicht sichtbar');
    return { x: x(c.width), y: d.y - c.y + d.height / 2 };
  };
  await press(cards.nth(1), await atDescription(cards.nth(1), () => 3));
  await expectOnlySelected(cards, 1);
  await press(cards.nth(2), await atDescription(cards.nth(2), (w) => w - 3));
  await expectOnlySelected(cards, 2);
  const c0 = await size(cards.nth(0));
  await press(cards.nth(0), { x: c0.width / 2, y: c0.height - 3 });
  await expectOnlySelected(cards, 0);
});

test('REQ-5-AC6 Die über die Box gewählte Stufe ist sichtbar hervorgehoben', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await pressOn(cards.nth(1), description(cards.nth(1)));
  await expect(cards.nth(1).getByText(TEXT.de.selected, { exact: true })).toBeVisible();
  await expect(cards.nth(0).getByText(TEXT.de.selected, { exact: true })).toHaveCount(0);
  await expect(cards.nth(2).getByText(TEXT.de.selected, { exact: true })).toHaveCount(0);
  // Der Hinweis unter der Auswahl nennt die gewählte Stufe mit ihrem Namen aus der Box.
  const status = page.getByRole('status');
  await expect(status).toContainText(TEXT.de.chosen);
  const name = ((await status.innerText()).split(TEXT.de.chosen)[1] ?? '').trim().replace(/\.$/, '');
  expect(name.length).toBeGreaterThan(0);
  await expect(cards.nth(1).getByText(name, { exact: true })).toBeVisible();
});

test('REQ-5-AC7 Die über die Box gewählte Stufe wird als Antwort des Schritts übernommen', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await press(cards.nth(2), await freeAreaPoint(cards.nth(2)));
  await expectOnlySelected(cards, 2);
  await press(page.getByRole('button', { name: TEXT.de.next }));
  await expect(page.getByText(TEXT.de.step)).toContainText(/ 2 /);
  await press(page.getByRole('link', { name: TEXT.de.back, exact: true }));
  await expect(page.getByText(TEXT.de.step)).toContainText(/ 1 /);
  const again = page.getByRole('group', { name: TEXT.de.group }).getByRole('listitem').filter({ has: page.getByRole('radio') });
  await expectOnlySelected(again, 2);
});

test('REQ-5-AC8 Klick auf eine andere Stufenbox wechselt die Auswahl, genau eine Stufe bleibt gewählt', async ({ page }) => {
  const { group, cards } = await openFirstDimension(page);
  await pressOn(cards.nth(0), description(cards.nth(0)));
  await expectOnlySelected(cards, 0);
  await press(cards.nth(1), await freeAreaPoint(cards.nth(1)));
  await expectOnlySelected(cards, 1);
  await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
  await expect(group.getByText(TEXT.de.selected, { exact: true })).toHaveCount(1);
});

test('REQ-5-AC9 Antippen der Stufenbox wählt die Stufe auf einem Touch-Gerät', async ({ browser, baseURL }) => {
  // Unabhängig vom Projekt immer ein Mobilgerät mit Touch, damit das Kriterium in beiden Läufen geprüft wird.
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7'];
  const context = await browser.newContext({ ...pixel, baseURL, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  try {
    const page = await context.newPage();
    const { cards } = await openFirstDimension(page);
    await pressOn(cards.nth(1), description(cards.nth(1)), true);
    await expectOnlySelected(cards, 1);
    await press(cards.nth(2), await freeAreaPoint(cards.nth(2)), true);
    await expectOnlySelected(cards, 2);
  } finally {
    await context.close();
  }
});

test('REQ-5-AC10 In der englischen Fassung wählt ein Klick auf die Stufenbox die Stufe', async ({ page }) => {
  const { cards } = await openFirstDimension(page, 'en');
  await pressOn(cards.nth(1), description(cards.nth(1)));
  await expectOnlySelected(cards, 1);
  await expect(cards.nth(1).getByText(TEXT.en.selected, { exact: true })).toBeVisible();
  await press(cards.nth(2), await freeAreaPoint(cards.nth(2)));
  await expectOnlySelected(cards, 2);
});

test('REQ-5-AC11 Die Stufenauswahl ist mit der Tastatur bedienbar', async ({ page }) => {
  const { cards } = await openFirstDimension(page);
  await radio(cards.nth(0)).focus();
  await page.keyboard.press('Space');
  await expectOnlySelected(cards, 0);
  await page.keyboard.press('ArrowDown');
  await expectOnlySelected(cards, 1);
  await expect(radio(cards.nth(1))).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expectOnlySelected(cards, 2);
});

test('REQ-5-AC12 Stufen und Auswahlzustand sind für assistive Technologien erkennbar', async ({ page }) => {
  const { group, cards } = await openFirstDimension(page);
  // Genau eine Auswahl pro Stufe, kurz benannt; der Beschreibungstext ist Beschreibung, nicht Teil des Namens.
  await expect(group.getByRole('radio')).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const r = radio(cards.nth(i));
    const text = (await description(cards.nth(i)).innerText()).trim();
    await expect(r).toHaveAccessibleName(new RegExp(`^Stufe ${i + 1}\\b`));
    await expect(r).not.toHaveAccessibleName(new RegExp(text.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(r).toHaveAccessibleDescription(text);
  }
  await press(cards.nth(2), await freeAreaPoint(cards.nth(2)));
  await expect(group.getByRole('radio', { checked: true })).toHaveAccessibleName(/^Stufe 3\b/);
  await expect(group.getByRole('radio', { checked: false })).toHaveCount(2);
});

// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Contact.tsx app/frontend/src/lib/messageLength.ts
import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from '../support/fixtures';

// Anforderung #77: verbleibende Zeichen bei langen Kontaktnachrichten. Sollwerte aus dem Ticket:
// Grenze 5.000 Zeichen, Zähler in den letzten 500 Zeichen, Hinweis bei gekürztem Einfügen.
const a = (n: number) => 'a'.repeat(n);
const TEXT = {
  de: {
    path: '/de/kontakt',
    label: 'Nachricht',
    remaining: (n: number) => (n === 1 ? '1 Zeichen verbleibt' : `${n} Zeichen verbleiben`),
    truncated: 'Der eingefügte Text wurde gekürzt, weil eine Nachricht höchstens 5.000 Zeichen lang sein darf.',
  },
  en: {
    path: '/en/kontakt',
    label: 'Message',
    remaining: (n: number) => (n === 1 ? '1 character remaining' : `${n} characters remaining`),
    truncated: 'The pasted text was shortened because a message can be at most 5,000 characters long.',
  },
} as const;

const counter = (page: Page) => page.locator('.contact-counter');
const hint = (page: Page) => page.locator('.contact-truncated');

/** Setzt den Inhalt und stellt den Cursor ans Ende, wie nach dem Tippen. */
async function setText(field: Locator, text: string) {
  await field.fill(text);
  await field.press('Control+End');
}

/** Echtes Einfügen über die Zwischenablage (Strg+V), damit Browser und maxLength wie beim Besucher wirken. */
async function paste(page: Page, field: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await field.press('Control+V');
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('REQ-77-AC1: Zähler erscheint ab 4.500 Zeichen und verschwindet darunter und bei leerem Feld', async ({ page }) => {
  await page.goto('/de/kontakt');
  const field = page.getByLabel('Nachricht', { exact: true });
  await expect(counter(page), 'leeres Feld').toHaveCount(0);
  await setText(field, a(4499));
  await expect(counter(page), '4.499 Zeichen').toHaveCount(0);
  await field.pressSequentially('b');
  await expect(counter(page), '4.500 Zeichen').toHaveText('500 Zeichen verbleiben');
  await field.press('Backspace');
  await expect(counter(page), 'zurück auf 4.499').toHaveCount(0);
  await setText(field, '');
  await expect(counter(page), 'wieder leer').toHaveCount(0);
});

test('REQ-77-AC2: Restlänge folgt Tippen, Löschen und Einfügen bis null', async ({ page }) => {
  await page.goto('/de/kontakt');
  const field = page.getByLabel('Nachricht', { exact: true });
  await setText(field, a(4998));
  await expect(counter(page)).toHaveText('2 Zeichen verbleiben');
  await field.pressSequentially('b');
  await expect(counter(page), '4.999').toHaveText('1 Zeichen verbleibt');
  await field.pressSequentially('c');
  await expect(counter(page), '5.000').toHaveText('0 Zeichen verbleiben');
  await field.pressSequentially('d');
  expect((await field.inputValue()).length, 'bei 0 nimmt das Feld nichts mehr an').toBe(5000);
  await field.press('Backspace');
  await field.press('Backspace');
  await expect(counter(page), 'nach Löschen').toHaveText('2 Zeichen verbleiben');
  await paste(page, field, 'xy');
  await expect(counter(page), 'nach Einfügen').toHaveText('0 Zeichen verbleiben');
});

test('REQ-77-AC2: bei Zeilenumbrüchen und Emoji entspricht die Anzeige der tatsächlichen Kapazität', async ({ page }) => {
  await page.goto('/de/kontakt');
  const field = page.getByLabel('Nachricht', { exact: true });

  // Zeilenumbrüche: Anzeige 3, dann nimmt das Feld genau drei weitere Zeichen an.
  await setText(field, `${a(4987)}${'\n'.repeat(10)}`);
  await expect(counter(page)).toHaveText('3 Zeichen verbleiben');
  await field.press('Enter');
  await field.pressSequentially('xyz');
  await expect(counter(page), 'nach Umbruch und zwei Zeichen').toHaveText('0 Zeichen verbleiben');
  expect(await field.inputValue(), 'genau Umbruch + "xy" angenommen').toBe(`${a(4987)}${'\n'.repeat(11)}xy`);

  // Emoji belegt zwei Einheiten der Eingabegrenze: Anzeige 2, das Emoji passt, danach nichts mehr.
  await setText(field, a(4998));
  await expect(counter(page)).toHaveText('2 Zeichen verbleiben');
  await paste(page, field, '😀x');
  await expect(counter(page), 'nach Emoji').toHaveText('0 Zeichen verbleiben');
  expect(await field.inputValue()).toBe(`${a(4998)}😀`);
});

test('REQ-77-AC3: vollständig eingefügter Text ohne Hinweis, auch beim Ersetzen einer Auswahl', async ({ page }) => {
  await page.goto('/de/kontakt');
  const field = page.getByLabel('Nachricht', { exact: true });
  await setText(field, a(4900));
  const pasted = `${'z'.repeat(99)}!`;
  await paste(page, field, pasted);
  expect(await field.inputValue(), 'gesamter eingefügter Text').toBe(`${a(4900)}${pasted}`);
  await expect(counter(page)).toHaveText('0 Zeichen verbleiben');
  await expect(hint(page)).toHaveText('');

  // Auswahl von 10 Zeichen ersetzen: 110 eingefügte Zeichen passen genau.
  await setText(field, a(4900));
  await field.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(100, 110));
  const replacement = `${'r'.repeat(109)}!`;
  await paste(page, field, replacement);
  expect(await field.inputValue(), 'Auswahl ersetzt').toBe(`${a(100)}${replacement}${a(4790)}`);
  await expect(counter(page)).toHaveText('0 Zeichen verbleiben');
  await expect(hint(page)).toHaveText('');
});

test('REQ-77-AC4: gekürzter eingefügter Text zeigt sofort einen Hinweis am Feld', async ({ page }) => {
  await page.goto('/de/kontakt');
  const field = page.getByLabel('Nachricht', { exact: true });
  await setText(field, a(4900));
  await paste(page, field, 'z'.repeat(101));
  expect((await field.inputValue()).length).toBe(5000);
  await expect(counter(page)).toHaveText('0 Zeichen verbleiben');
  await expect(hint(page)).toHaveText(TEXT.de.truncated);
  await expect(hint(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vielen Dank für deine Nachricht' }), 'ohne Absenden').toHaveCount(0);

  // Tippen/Löschen ändert den Inhalt: Hinweis verschwindet.
  await field.press('Backspace');
  await expect(hint(page)).toHaveText('');

  // Mehr als 5.000 Zeichen in ein leeres Feld.
  await setText(field, '');
  await paste(page, field, a(5001));
  expect((await field.inputValue()).length).toBe(5000);
  await expect(hint(page)).toHaveText(TEXT.de.truncated);
  await expect(counter(page)).toHaveText('0 Zeichen verbleiben');
});

for (const lang of ['de', 'en'] as const) {
  test(`REQ-77-AC5: Zähler und Hinweis auf ${lang} in der Sprache, dem Feld zugeordnet, Fokus bleibt im Feld`, async ({ page }) => {
    const T = TEXT[lang];
    await page.goto(T.path);
    const field = page.getByLabel(T.label, { exact: true });
    await setText(field, a(4500));
    await expect(counter(page)).toHaveText(T.remaining(500));
    await expect(field).toHaveAccessibleDescription(T.remaining(500));
    await setText(field, a(4999));
    await expect(counter(page)).toHaveText(T.remaining(1));

    // Live-Region existiert bereits vor dem Einfügen, damit Screenreader die Änderung ausgeben.
    await setText(field, a(4900));
    const status = page.locator('[role="status"].contact-truncated');
    await expect(status).toHaveCount(1);
    await paste(page, field, a(101));
    await expect(status).toHaveText(T.truncated);
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription(`${T.remaining(0)} ${T.truncated}`);
  });
}

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test('REQ-77-AC5: Zähler und Hinweis auf 375 px lesbar ohne horizontalen Bildlauf', async ({ page }) => {
    await page.goto('/de/kontakt');
    const field = page.getByLabel('Nachricht', { exact: true });
    await setText(field, a(4900));
    await paste(page, field, a(101));
    for (const el of [counter(page), hint(page)]) {
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeInViewport({ ratio: 1 });
      const size = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(size, 'Schriftgröße').toBeGreaterThanOrEqual(14);
    }
    await expectNoHorizontalScroll(page);
  });
});

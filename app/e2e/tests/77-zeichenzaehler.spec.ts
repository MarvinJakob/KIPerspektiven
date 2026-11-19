// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Contact.tsx app/frontend/src/lib/messageLength.ts
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

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

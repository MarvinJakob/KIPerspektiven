// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Users.tsx app/frontend-redaktion/src/components/PasswordInput.tsx
import type { Locator, Page } from '@playwright/test';
import { AUTH, expect, test } from '../support/fixtures';

// Anforderung #6: Startpasswort beim Anlegen eines Benutzers maskieren und nur beim Gedrückthalten anzeigen.
// Beobachtbar ist die Maskierung am Feldtyp: `password` zeigt Punkte, `text` zeigt Klartext.
const PASSWORD = 'geheim-start-42';
const REVEAL = 'Passwort anzeigen, solange gedrückt';

test.use({ storageState: AUTH.admin });

const form = (page: Page) => {
  const password = page.getByLabel('Startpasswort', { exact: true });
  const reveal = page.getByRole('button', { name: REVEAL });
  return { password, reveal };
};
const masked = (field: Locator) => expect(field, 'Passwort ist maskiert').toHaveAttribute('type', 'password');
const plain = (field: Locator) => expect(field, 'Passwort ist im Klartext sichtbar').toHaveAttribute('type', 'text');

/** Mauszeiger über dem Icon gedrückt halten. */
const pressMouse = async (page: Page, reveal: Locator) => {
  await reveal.hover();
  await page.mouse.down();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/redaktion/benutzer');
  // Erst nach dem Laden der Kontenliste steht das Formular an seiner endgültigen Position. Sonst treffen
  // Mausaktionen auf Koordinaten des Icons womöglich eine Schaltfläche der nachgeladenen Liste (#64).
  await expect(page.getByRole('table')).toBeVisible();
});

test('REQ-6-AC2 REQ-6-AC3: Gedrückthalten mit der Maus zeigt das Passwort, Loslassen und Verlassen maskieren sofort', async ({ page }) => {
  const { password, reveal } = form(page);
  await password.fill(PASSWORD);

  await pressMouse(page, reveal);
  await plain(password);
  await expect(password).toHaveValue(PASSWORD);
  await page.mouse.up();
  await masked(password);

  // Zeiger verlässt bei gedrückter Taste den Iconbereich
  await pressMouse(page, reveal);
  await plain(password);
  await page.mouse.move(5, 5);
  await masked(password);
  await page.mouse.up();
  await masked(password);

  // Kurzer Klick schaltet keine dauerhafte Anzeige ein
  await reveal.click();
  await masked(password);
  await reveal.click();
  await masked(password);
});

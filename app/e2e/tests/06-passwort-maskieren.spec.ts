// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Users.tsx app/frontend-redaktion/src/components/PasswordInput.tsx
import type { Locator, Page } from '@playwright/test';
import { AUTH, expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test, uid } from '../support/fixtures';

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

/** Zählt Anfragen, die ein Konto anlegen würden. */
const watchCreate = (page: Page) => {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/admin/users') sent.push(r.postData() ?? '');
  });
  return sent;
};

/** Mauszeiger über dem Icon gedrückt halten. */
const pressMouse = async (page: Page, reveal: Locator) => {
  await reveal.hover();
  await page.mouse.down();
};

/**
 * Touch-Betätigung über Pointer Events, wie sie der Browser bei einem Finger auf dem Icon auslöst.
 * Verlässt der Finger das Icon, sendet der Browser `pointerout` und danach `pointerleave`.
 */
const touch = async (reveal: Locator, type: 'pointerdown' | 'pointerup' | 'pointercancel' | 'pointerleave') => {
  const init = { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0 };
  if (type === 'pointerleave') await reveal.dispatchEvent('pointerout', { ...init, bubbles: true });
  await reveal.dispatchEvent(type, { ...init, bubbles: type !== 'pointerleave' });
};

test.beforeEach(async ({ page }) => {
  await page.goto('/redaktion/benutzer');
});

test('REQ-6-AC1: getipptes und eingefügtes Startpasswort erscheint nur maskiert', async ({ page }) => {
  const { password } = form(page);
  await masked(password);
  await password.pressSequentially(PASSWORD);
  await masked(password);
  await expect(password).toHaveValue(PASSWORD);

  await password.fill('');
  await password.focus();
  await page.keyboard.insertText(PASSWORD); // entspricht dem Einfügen aus der Zwischenablage
  await expect(password).toHaveValue(PASSWORD);
  await masked(password);
  await expect(page.locator('body')).not.toContainText(PASSWORD);
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

test('REQ-6-AC2 REQ-6-AC3: Touch-Gedrückthalten zeigt das Passwort; Loslassen, Abbruch und Verlassen maskieren', async ({ page }) => {
  const { password, reveal } = form(page);
  await password.fill(PASSWORD);

  await touch(reveal, 'pointerdown');
  await plain(password);
  await touch(reveal, 'pointerup');
  await masked(password);

  await touch(reveal, 'pointerdown');
  await plain(password);
  await touch(reveal, 'pointercancel');
  await masked(password);

  await touch(reveal, 'pointerdown');
  await plain(password);
  await touch(reveal, 'pointerleave');
  await masked(password);
});

test('REQ-6-AC3: Fokusverlust des Fensters maskiert ein angezeigtes Passwort sofort', async ({ page }) => {
  const { password, reveal } = form(page);
  await password.fill(PASSWORD);
  await pressMouse(page, reveal);
  await plain(password);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await masked(password);
  await page.mouse.up();
  await masked(password);
});

test('REQ-6-AC4: Icon ist per Tastatur erreichbar, sichtbar fokussiert und zeigt das Passwort nur bei gehaltener Leertaste', async ({ page }) => {
  const { password, reveal } = form(page);
  await password.fill(PASSWORD);
  await password.focus();
  await page.keyboard.press('Tab');
  await expect(reveal).toBeFocused();
  await expectVisibleKeyboardFocus(page, reveal);
  // Deutscher zugänglicher Name in der deutschsprachigen Redaktionsoberfläche
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(reveal).toHaveAccessibleName(REVEAL);

  await page.keyboard.down(' ');
  await plain(password);
  await page.keyboard.up(' ');
  await masked(password);

  // Fokusverlust bei gehaltener Leertaste
  await page.keyboard.down(' ');
  await plain(password);
  await page.keyboard.press('Shift+Tab');
  await expect(password).toBeFocused();
  await masked(password);
  await page.keyboard.up(' ');
  await masked(password);

  // Enter schaltet keine dauerhafte Anzeige ein
  await reveal.focus();
  await page.keyboard.press('Enter');
  await masked(password);
});

test('REQ-6-AC5: wiederholtes Betätigen ändert den Wert nicht und sendet nichts; danach lässt sich das Konto mit dem Passwort anlegen', async ({ page, login }) => {
  const sent = watchCreate(page);
  const email = `passwort.${uid()}@example.test`;
  const { password, reveal } = form(page);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await password.fill(PASSWORD);

  for (let i = 0; i < 3; i++) {
    await pressMouse(page, reveal);
    await page.mouse.up();
    await touch(reveal, 'pointerdown');
    await touch(reveal, 'pointerup');
  }
  await reveal.focus();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(' ');
    await page.keyboard.press('Enter');
  }
  await expect(password).toHaveValue(PASSWORD);
  await masked(password);
  await expect(page.getByRole('status')).toBeEmpty();
  expect(sent, 'Betätigen des Icons sendet das Formular nicht ab').toHaveLength(0);

  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('status')).toContainText(`Konto ${email} angelegt.`);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0])).toEqual({ email, password: PASSWORD });
  const res = await login(email, PASSWORD);
  expect(res.status, 'neues Konto meldet sich mit dem eingegebenen Passwort an').toBe(200);
  await expect(password).toHaveValue('');
  await masked(password);
});

test('REQ-6-AC6: leeres Feld bleibt leer; Validierungsfehler und Eingaben bleiben beim Betätigen erhalten', async ({ page }) => {
  const sent = watchCreate(page);
  const { password, reveal } = form(page);
  const email = page.getByLabel('E-Mail-Adresse');

  await pressMouse(page, reveal);
  await expect(password).toHaveValue('');
  await page.mouse.up();
  await reveal.focus();
  await page.keyboard.press(' ');
  await expect(password).toHaveValue('');
  await masked(password);

  const address = `kurz.${uid()}@example.test`;
  await email.fill(address);
  await password.fill('kurz');
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  const error = page.getByRole('alert').filter({ hasText: 'mindestens 10 Zeichen' });
  await expect(error).toBeVisible();
  await masked(password);

  await pressMouse(page, reveal);
  await plain(password);
  await page.mouse.up();
  await expect(error).toBeVisible();
  await expect(email).toHaveValue(address);
  await expect(password).toHaveValue('kurz');
  await masked(password);
  expect(sent).toHaveLength(0);
});

/** Icon und Feld liegen sichtbar im Fenster und werden an ihrer Mitte nicht von anderen Elementen verdeckt. */
async function expectOperable(page: Page) {
  const { password, reveal } = form(page);
  for (const el of [password, reveal]) {
    // In die Fenstermitte scrollen: Die Höhe der Kontentabelle darüber hängt von parallel angelegten Konten ab (#40).
    await el.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(el).toBeInViewport({ ratio: 1 });
    const hit = await el.evaluate((node) => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === node || node.contains(top));
    });
    expect(hit, 'Element ist an seiner Mitte nicht überlagert').toBe(true);
  }
  const box = (await reveal.boundingBox())!;
  expect(box.width, 'Icon hat eine ausreichende Trefferfläche').toBeGreaterThanOrEqual(40);
  expect(box.height).toBeGreaterThanOrEqual(40);
  // Eingabetext läuft nicht unter das Icon
  const covered = await password.evaluate((input, btn) => {
    const i = input.getBoundingClientRect();
    const b = (btn as Element).getBoundingClientRect();
    const textEnd = i.right - parseFloat(getComputedStyle(input).paddingRight);
    return b.left < textEnd && b.right > i.left && b.top < i.bottom && b.bottom > i.top;
  }, await reveal.elementHandle());
  expect(covered, 'Textbereich des Feldes liegt nicht unter dem Icon').toBe(false);
  await expectNoHorizontalScroll(page);
}

test('REQ-6-AC7: Desktop 1280 px – Feld und Icon sind ohne Überlagerung bedienbar', async ({ page }) => {
  await expectOperable(page);
  const { password, reveal } = form(page);
  await password.fill(PASSWORD);
  await masked(password);
  await pressMouse(page, reveal);
  await plain(password);
  await page.mouse.up();
  await masked(password);
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('REQ-6-AC7: Mobil 375 px – Feld und Icon sind bedienbar; Touch-Halten zeigt, Antippen maskiert', async ({ page }) => {
    await expectOperable(page);
    const { password, reveal } = form(page);
    await password.fill(PASSWORD);
    await masked(password);
    await touch(reveal, 'pointerdown');
    await plain(password);
    await touch(reveal, 'pointerup');
    await masked(password);
    await reveal.tap();
    await masked(password);
    await expect(password).toHaveValue(PASSWORD);
  });
});

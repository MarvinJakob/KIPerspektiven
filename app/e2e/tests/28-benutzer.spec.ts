// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Users.tsx
import { ACCOUNTS, AUTH, expect, test, uid, type Session } from '../support/fixtures';

// Anforderung #28: Redaktionsbenutzer als Administrator verwalten.
interface User {
  id: number;
  email: string;
  displayName: string;
  roles: string[];
  active: boolean;
  createdAt: string;
}
const users = async (s: Session) => ((await (await s.get('/api/admin/users')).json()) as { items: User[] }).items;
const newEmail = () => `konto.${uid()}@example.test`;
const PASSWORD = 'startpass10';

test('REQ-28-AC1: nur Admin-Konten sehen die Kontenübersicht; Redaktion erhält 403, ohne Sitzung 401', async ({ request, editor, admin }) => {
  expect((await request.get('/api/admin/users')).status()).toBe(401);
  expect((await editor.get('/api/admin/users')).status()).toBe(403);
  const list = await users(admin);
  expect(list.find((u) => u.email === ACCOUNTS.admin.email)).toMatchObject({ roles: ['admin'], active: true });
  expect(list.find((u) => u.email === ACCOUNTS.editor.email)).toMatchObject({ roles: ['editor'], active: true });
});

test('REQ-28-AC7: die Kontenliste gibt keine Passwörter aus', async ({ admin }) => {
  const res = await admin.get('/api/admin/users');
  const body = await res.text();
  expect(body).not.toMatch(/password|argon2|hash/i);
  for (const u of await users(admin)) expect(Object.keys(u).sort()).toEqual(['active', 'createdAt', 'displayName', 'email', 'id', 'roles']);
});

test('REQ-28-AC3: ungültige oder belegte Adresse und zu kurzes Passwort legen kein Konto an', async ({ admin }) => {
  const before = (await users(admin)).length;
  const cases: [unknown, number][] = [
    [{ email: 'keine-adresse', password: PASSWORD, roles: ['editor'] }, 422],
    [{ email: ACCOUNTS.editor.email.toUpperCase(), password: PASSWORD, roles: ['editor'] }, 409],
    [{ email: newEmail(), password: '123456789', roles: ['editor'] }, 422],
  ];
  for (const [data, status] of cases) {
    const res = await admin.send('POST', '/api/admin/users', data);
    expect(res.status(), JSON.stringify(data)).toBe(status);
    expect(((await res.json()) as { message: string }).message.length).toBeGreaterThan(0);
  }
  expect((await users(admin)).length).toBe(before);
});

test('REQ-28-AC4 REQ-28-AC5: Deaktivieren beendet Sitzungen und sperrt die Anmeldung, Reaktivieren gibt sie wieder frei', async ({ admin, login }) => {
  const email = newEmail();
  const created = (await (await admin.send('POST', '/api/admin/users', { email, password: PASSWORD, roles: ['editor'] })).json()) as User;
  const { session } = await login(email, PASSWORD);
  expect((await session!.get('/api/admin/posts')).status()).toBe(200);

  const off = await admin.send('PATCH', `/api/admin/users/${created.id}`, { active: false });
  expect(((await off.json()) as User).active).toBe(false);
  expect((await session!.get('/api/auth/me')).status()).toBe(401);
  expect((await session!.get('/api/admin/posts')).status()).toBe(401);
  expect((await login(email, PASSWORD)).status).toBe(401);

  const on = await admin.send('PATCH', `/api/admin/users/${created.id}`, { active: true });
  expect(((await on.json()) as User).active).toBe(true);
  expect((await login(email, PASSWORD)).status).toBe(200);
});

test('REQ-28-AC6: das eigene Admin-Konto lässt sich auch per API nicht deaktivieren', async ({ admin }) => {
  const res = await admin.send('PATCH', `/api/admin/users/${admin.me.id}`, { active: false });
  expect(res.status()).toBe(422);
  expect((await users(admin)).find((u) => u.id === admin.me.id)?.active).toBe(true);
  expect((await admin.get('/api/auth/me')).status()).toBe(200);
});

test.describe('Oberfläche als Admin', () => {
  test.use({ storageState: AUTH.admin });

  test('REQ-28-AC1 REQ-28-AC2: Übersicht zeigt Konten; neues Konto wird aktiv mit Rolle Redaktion angelegt und kann sich anmelden', async ({ page, login }) => {
    const email = newEmail();
    await page.goto('/redaktion/benutzer');
    const adminRow = page.getByRole('row').filter({ hasText: ACCOUNTS.admin.email });
    await expect(adminRow).toContainText('Admin');
    await expect(adminRow).toContainText('Aktiv');
    await expect(adminRow.getByRole('button')).toHaveCount(0); // REQ-28-AC6: keine eigene Deaktivierung

    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Startpasswort').fill(PASSWORD);
    // Seit #64 wählt der Admin die Rollen ausdrücklich (REQ-64-AC1).
    await page.getByRole('group', { name: 'Rollen', exact: true }).getByLabel('Redakteur').check();
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('status')).toContainText(`Konto ${email} angelegt.`);
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row.getByRole('checkbox', { name: `${email}: Redakteur` })).toBeChecked();
    await expect(row).toContainText('Aktiv');

    const res = await login(email, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.session!.me.roles).toEqual(['editor']);
  });

  test('REQ-28-AC3: Fehlermeldung bei zu kurzem Passwort und belegter Adresse in der Oberfläche', async ({ page }) => {
    await page.goto('/redaktion/benutzer');
    await page.getByLabel('E-Mail-Adresse').fill(newEmail());
    await page.getByLabel('Startpasswort').fill('kurz');
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'mindestens 10 Zeichen' })).toBeVisible();

    await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.editor.email);
    await page.getByLabel('Startpasswort').fill(PASSWORD);
    await page.getByRole('group', { name: 'Rollen', exact: true }).getByLabel('Redakteur').check();
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ }).last()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: ACCOUNTS.editor.email })).toHaveCount(1);
  });

  test('REQ-28-AC4 REQ-28-AC5: Status in der Oberfläche umschalten', async ({ page, admin }) => {
    const email = newEmail();
    await admin.send('POST', '/api/admin/users', { email, password: PASSWORD, roles: ['editor'] });
    await page.goto('/redaktion/benutzer');
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: `${email} deaktivieren` }).click();
    await expect(row).toContainText('Deaktiviert');
    await expect(page.getByRole('status')).toContainText(`${email} ist deaktiviert.`);
    await row.getByRole('button', { name: `${email} reaktivieren` }).click();
    await expect(row).toContainText('Aktiv');
    expect((await users(admin)).find((u) => u.email === email)?.active).toBe(true);
  });

  test('REQ-28-AC7: Lade- und Änderungsfehler werden gemeldet, nicht als Erfolg dargestellt', async ({ page, admin }) => {
    const email = newEmail();
    await admin.send('POST', '/api/admin/users', { email, password: PASSWORD, roles: ['editor'] });
    await page.goto('/redaktion/benutzer');
    await page.route('**/api/admin/users/*', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: `${email} deaktivieren` }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Ändern ist gerade nicht möglich.' })).toBeVisible();
    await expect(row).toContainText('Aktiv');
    await expect(page.getByRole('status')).toBeEmpty();

    await page.route('**/api/admin/users', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Die Konten konnten nicht geladen werden.' })).toBeVisible();
  });

  test.describe('mobil', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
    test('REQ-28-AC8: Konto auf 375 px per Tastatur anlegen und deaktivieren', async ({ page, admin }) => {
      const email = newEmail();
      await page.goto('/redaktion/benutzer');
      await page.getByLabel('E-Mail-Adresse').focus();
      await page.keyboard.type(email);
      await page.keyboard.press('Tab');
      await page.keyboard.type(PASSWORD);
      // Rolle per Tastatur wählen (seit #64), dann aus dem Passwortfeld absenden
      await page.getByRole('group', { name: 'Rollen', exact: true }).getByLabel('Redakteur').focus();
      await page.keyboard.press('Space');
      await page.getByLabel('Startpasswort').focus();
      await page.keyboard.press('Enter');
      const toggle = page.getByRole('button', { name: `${email} deaktivieren` });
      await toggle.focus();
      await expect(toggle).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: `${email} reaktivieren` })).toBeVisible();
      expect((await users(admin)).find((u) => u.email === email)?.active).toBe(false);
    });
  });
});

test.describe('Oberfläche als Redaktion', () => {
  test.use({ storageState: AUTH.editor });
  test('REQ-28-AC1: Redaktionskonten erhalten keinen Zugriff auf die Benutzerverwaltung', async ({ page }) => {
    await page.goto('/redaktion/benutzer');
    await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0);
  });
});

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
});

// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Users.tsx app/frontend-redaktion/src/pages/Profile.tsx app/frontend-redaktion/src/pages/EditPost.tsx app/frontend-redaktion/src/pages/ConsultationRequests.tsx app/frontend-redaktion/src/components/Layout.tsx app/frontend/src/pages/Post.tsx
import { ACCOUNTS, AUTH, expect, fullText, pngImage, test, uid, type EditorPost, type Role, type Session } from '../support/fixtures';

// Anforderung #64: Redaktionskonten mit mehreren Rollen und Autorenprofilen.
// Kriterien und Rollentabelle: Spezifikation REQ-64 im Ticket.

interface User {
  id: number;
  email: string;
  displayName: string;
  roles: Role[];
  active: boolean;
  createdAt: string;
}
interface Profile {
  email: string;
  displayName: string;
  roles: Role[];
  avatar?: { src: string; width: number; height: number };
}
interface PublicPost {
  slug: string;
  lang: string;
  author?: { name: string; avatar?: { src: string } };
}

const PASSWORD = 'startpass10';
const newEmail = () => `konto64.${uid()}@example.test`;
const users = async (s: Session) => ((await (await s.get('/api/admin/users')).json()) as { items: User[] }).items;
const profile = async (s: Session) => (await (await s.get('/api/profile')).json()) as Profile;

/** Legt als Admin ein Konto mit den angegebenen Rollen an und meldet es an. */
async function account(admin: Session, login: (e: string, p: string) => Promise<{ status: number; session?: Session }>, roles: Role[]) {
  const email = newEmail();
  const res = await admin.send('POST', '/api/admin/users', { email, password: PASSWORD, roles });
  expect(res.status(), await res.text()).toBe(201);
  const user = (await res.json()) as User;
  const { session } = await login(email, PASSWORD);
  return { user, session: session!, email };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

test('REQ-64-AC1 REQ-64-AC2: Admin legt Konto mit mehreren Rollen an; Anmeldung nur mit der E-Mail-Adresse', async ({ admin, login }) => {
  const email = newEmail();
  const res = await admin.send('POST', '/api/admin/users', { email: email.toUpperCase(), password: PASSWORD, roles: ['marketing', 'editor'] });
  expect(res.status(), await res.text()).toBe(201);
  const created = (await res.json()) as User;
  expect(created).toMatchObject({ email, displayName: '', active: true });
  expect([...created.roles].sort()).toEqual(['editor', 'marketing']);
  expect((await users(admin)).find((u) => u.id === created.id)?.roles.sort()).toEqual(['editor', 'marketing']);

  const ok = await login(email, PASSWORD);
  expect(ok.status).toBe(200);
  expect(ok.session!.me.roles.sort()).toEqual(['editor', 'marketing']);
  // Der Anzeigename dient nicht zur Anmeldung.
  expect((await ok.session!.send('PATCH', '/api/profile', { displayName: `Name ${uid()}` })).status()).toBe(200);
  const name = (await profile(ok.session!)).displayName;
  expect((await login(name, PASSWORD)).status).toBe(401);
});

test('REQ-64-AC9: Autor wird zugeordnet und öffentlich ohne E-Mail-Adresse angezeigt, Änderungen sofort', async ({ admin, login, request }) => {
  const { session, user } = await account(admin, login, ['editor']);
  const name = `Autorin ${uid()}`;
  await session.send('PATCH', '/api/profile', { displayName: name });
  await session.upload('/api/profile/avatar', { name: 'a.png', mimeType: 'image/png', buffer: pngImage(48, 48, [20, 90, 200]) });

  const authors = ((await (await session.get('/api/admin/authors')).json()) as { items: { id: number; displayName: string }[] }).items;
  expect(authors.some((a) => a.id === user.id)).toBe(true);
  expect(authors.some((a) => a.id === admin.me.id)).toBe(true);

  const tag = uid();
  const created = await session.send('POST', '/api/admin/posts', { featured: false, topics: [], texts: [fullText('de', tag), fullText('en', tag)] });
  expect(created.status(), await created.text()).toBe(201);
  const post = (await created.json()) as EditorPost & { authorId?: number };
  expect(post.authorId, 'neuer Beitrag erhält das anlegende Konto als Autor').toBe(user.id);
  expect((await session.send('POST', `/api/admin/posts/${post.id}/publish`)).status()).toBe(200);

  try {
    for (const lang of ['de', 'en']) {
      const res = await request.get(`/api/posts/${post.slug}?lang=${lang}`);
      const raw = await res.text();
      expect(raw).not.toContain(user.email);
      const p = JSON.parse(raw) as PublicPost;
      expect(p.author?.name).toBe(name);
      expect(p.author?.avatar?.src).toMatch(/^\/media\//);
      expect(JSON.stringify(p.author)).not.toMatch(/email|@/);
    }

    // Profiländerung erscheint sofort
    const renamed = `Neu ${uid()}`;
    await session.send('PATCH', '/api/profile', { displayName: renamed });
    expect(((await (await request.get(`/api/posts/${post.slug}?lang=de`)).json()) as PublicPost).author?.name).toBe(renamed);

    // Ohne Anzeigenamen keine Autorenzeile
    await session.send('PATCH', '/api/profile', { displayName: '' });
    expect(((await (await request.get(`/api/posts/${post.slug}?lang=de`)).json()) as PublicPost).author).toBeUndefined();

    // Andere Zuordnung und „Kein Autor“
    expect((await session.send('PUT', `/api/admin/posts/${post.id}/author`, { authorId: admin.me.id })).status()).toBe(200);
    const reassigned = (await (await session.get(`/api/admin/posts/${post.id}`)).json()) as { authorId?: number };
    expect(reassigned.authorId).toBe(admin.me.id);
    expect((await session.send('PUT', `/api/admin/posts/${post.id}/author`, { authorId: null })).status()).toBe(200);
    expect(((await (await session.get(`/api/admin/posts/${post.id}`)).json()) as { authorId?: number }).authorId).toBeUndefined();
    expect(((await (await request.get(`/api/posts/${post.slug}?lang=de`)).json()) as PublicPost).author).toBeUndefined();

    // Reine Marketing-Konten sind keine wählbaren Autoren
    const mk = await account(admin, login, ['marketing']);
    expect((await session.send('PUT', `/api/admin/posts/${post.id}/author`, { authorId: mk.user.id })).status()).toBe(422);
  } finally {
    await session.send('DELETE', `/api/admin/posts/${post.id}`);
  }
});

// ---------------------------------------------------------------------------
// Oberfläche
// ---------------------------------------------------------------------------

/**
 * Sendet ein Formular mit Passwortprüfung ab und wiederholt es, solange das Backend wegen paralleler Argon2-Prüfungen
 * „ausgelastet“ meldet (503, Ticket #138). Das ist gewolltes Verhalten unter Last, kein Fehler dieses Tickets.
 */
async function submitWithRetry(page: import('@playwright/test').Page, path: string, submit: () => Promise<void>) {
  for (let i = 0; ; i++) {
    const res = page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() !== 'GET');
    await submit();
    if ((await res).status() !== 503 || i >= 10) return;
    await page.waitForTimeout(1000);
  }
}

const NAV = ['Beiträge', 'Statistik', 'Beratungsanfragen', 'Nachrichten', 'Benutzer', 'Profil'];
async function navLinks(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Redaktion' });
  // Profil steht für jedes Konto in der Navigation: erst danach ist sie vollständig gerendert.
  await nav.getByRole('link', { name: 'Profil', exact: true }).waitFor();
  const out: string[] = [];
  for (const name of NAV) if ((await nav.getByRole('link', { name, exact: true }).count()) > 0) out.push(name);
  return out;
}

test.describe('Oberfläche als Redakteur', () => {
  test.use({ storageState: AUTH.editor });
  test('REQ-64-AC4: Navigation ohne Statistik, Nachrichten, Beratungsanfragen und Benutzer; Direktaufrufe gesperrt', async ({ page }) => {
    await page.goto('/redaktion');
    expect(await navLinks(page)).toEqual(['Beiträge', 'Profil']);
    for (const path of ['statistik', 'nachrichten', 'beratungsanfragen', 'benutzer']) {
      const res = await page.goto(`/redaktion/${path}`);
      expect(res?.status(), path).toBe(403);
      await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
    }
  });
});

test.describe('Oberfläche als Admin', () => {
  test.use({ storageState: AUTH.admin });

  test('REQ-64-AC1 REQ-64-AC3: Konto mit Rollen anlegen und Rollen in der Liste ändern; eigene Admin-Rolle nicht abwählbar', async ({ page, admin }) => {
    const email = newEmail();
    await page.goto('/redaktion/benutzer');
    expect(await navLinks(page)).toEqual(NAV);
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Startpasswort').fill(PASSWORD);
    const roles = page.getByRole('group', { name: 'Rollen', exact: true });
    await roles.getByLabel('Redakteur').check();
    await roles.getByLabel('Marketing').check();
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('status')).toContainText(`Konto ${email} angelegt.`);
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row.getByRole('checkbox', { name: `${email}: Redakteur` })).toBeChecked();
    await expect(row.getByRole('checkbox', { name: `${email}: Marketing` })).toBeChecked();
    await expect(row.getByRole('checkbox', { name: `${email}: Admin` })).not.toBeChecked();

    await row.getByRole('checkbox', { name: `${email}: Redakteur` }).uncheck();
    await expect(page.getByRole('status')).toContainText(`Rollen von ${email} gespeichert.`);
    expect((await users(admin)).find((u) => u.email === email)?.roles).toEqual(['marketing']);

    const own = page.getByRole('row').filter({ hasText: ACCOUNTS.admin.email });
    await expect(own.getByRole('checkbox', { name: `${ACCOUNTS.admin.email}: Admin` })).toBeChecked();
    await expect(own.getByRole('checkbox', { name: `${ACCOUNTS.admin.email}: Admin` })).toBeDisabled();
  });
});

test.describe('Profil', () => {
  test('REQ-64-AC7 REQ-64-AC8: Anzeigename, Profilbild und Passwort im Profil pflegen', async ({ browser, baseURL, admin, login, ip }) => {
    const { email } = await account(admin, login, ['marketing']);
    const ctx = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
    const page = await ctx.newPage();
    try {
      await page.goto('/redaktion/anmelden');
      await page.getByLabel('E-Mail-Adresse').fill(email);
      await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
      await submitWithRetry(page, '/api/auth/login', () => page.keyboard.press('Enter'));
      await expect(page).toHaveURL(/\/redaktion\/statistik$/);

      await page.goto('/redaktion/profil');
      await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible();
      await expect(page.locator('main').getByText(email)).toBeVisible();
      await expect(page.getByRole('checkbox')).toHaveCount(0); // keine Rollenzuweisung im Profil

      const name = `Mobil ${uid()}`;
      const field = page.getByLabel('Anzeigename');
      await field.focus();
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Name gespeichert.' })).toBeVisible();

      const upload = page.getByLabel('Profilbild hochladen');
      await upload.focus();
      await expect(upload).toBeFocused();
      await upload.setInputFiles({ name: 'falsch.png', mimeType: 'image/png', buffer: Buffer.from('kein bild') });
      await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible();
      await expect(page.getByRole('img', { name: 'Ihr Profilbild' })).toHaveCount(0);
      await upload.setInputFiles({ name: 'bild.png', mimeType: 'image/png', buffer: pngImage(64, 64) });
      await expect(page.getByRole('status').filter({ hasText: 'Profilbild gespeichert.' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Ihr Profilbild' })).toBeVisible();

      await page.getByLabel('Aktuelles Passwort').fill('falsches-passwort');
      await page.getByLabel('Neues Passwort').fill('neues-passwort-64');
      await submitWithRetry(page, '/api/profile/password', () => page.getByLabel('Neues Passwort').press('Enter'));
      await expect(page.getByRole('alert').filter({ hasText: /aktuelle Passwort/ })).toBeVisible();
      await page.getByLabel('Aktuelles Passwort').fill(PASSWORD);
      await submitWithRetry(page, '/api/profile/password', () => page.getByLabel('Neues Passwort').press('Enter'));
      await expect(page.getByRole('status').filter({ hasText: 'Passwort geändert.' })).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('Anzeigename')).toHaveValue(name);
      await expect(page.getByRole('img', { name: 'Ihr Profilbild' })).toBeVisible();
      expect((await login(email, 'neues-passwort-64')).status).toBe(200);
    } finally {
      await ctx.close();
    }
  });
});

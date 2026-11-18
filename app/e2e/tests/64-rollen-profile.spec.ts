// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Users.tsx app/frontend-redaktion/src/pages/Profile.tsx app/frontend-redaktion/src/pages/EditPost.tsx app/frontend-redaktion/src/pages/ConsultationRequests.tsx app/frontend-redaktion/src/components/Layout.tsx app/frontend/src/pages/Post.tsx
import { ACCOUNTS, AUTH, expect, expectNoHorizontalScroll, fullText, pngImage, test, uid, type EditorPost, type Role, type Session } from '../support/fixtures';

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

/** Statuscodes der geschützten Bereiche für eine Sitzung (nur lesende Aufrufe). */
async function areaStatus(s: Session) {
  return {
    posts: (await s.get('/api/admin/posts')).status(),
    statistics: (await s.get('/api/admin/statistics/page-views?period=7d')).status(),
    messages: (await s.get('/api/admin/contact-messages')).status(),
    consultations: (await s.get('/api/admin/consultation-requests')).status(),
    users: (await s.get('/api/admin/users')).status(),
    profile: (await s.get('/api/profile')).status(),
  };
}

/** Legt öffentlich eine Beratungsanfrage an und liefert ihre ID aus Sicht eines lesenden Kontos. */
async function consultation(request: import('@playwright/test').APIRequestContext, reader: Session) {
  const email = `beratung64.${uid()}@example.org`;
  expect((await request.post('/api/consultation-requests', { data: { email, lang: 'de' } })).status()).toBe(204);
  const items = ((await (await reader.get('/api/admin/consultation-requests')).json()) as { items: { id: number; email: string }[] }).items;
  return items.find((r) => r.email === email)!;
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

test('REQ-64-AC1 REQ-64-AC2: leere, ungültige oder belegte Adresse und fehlende Rolle legen kein Konto an', async ({ admin }) => {
  const before = (await users(admin)).length;
  const cases: [unknown, number][] = [
    [{ email: '', password: PASSWORD, roles: ['editor'] }, 422],
    [{ email: 'anna.example.org', password: PASSWORD, roles: ['editor'] }, 422],
    [{ email: ACCOUNTS.marketing.email.toUpperCase(), password: PASSWORD, roles: ['editor'] }, 409],
    [{ email: newEmail(), password: PASSWORD, roles: [] }, 422],
    [{ email: newEmail(), password: PASSWORD, roles: ['chef'] }, 422],
  ];
  for (const [data, status] of cases) {
    const res = await admin.send('POST', '/api/admin/users', data);
    expect(res.status(), JSON.stringify(data)).toBe(status);
    expect(((await res.json()) as { message: string }).message.length, JSON.stringify(data)).toBeGreaterThan(0);
  }
  expect((await users(admin)).length).toBe(before);
});

test('REQ-64-AC1: ohne Admin-Rolle ist die Benutzerverwaltung über die API gesperrt', async ({ request, editor, marketing, admin }) => {
  expect((await request.get('/api/admin/users')).status()).toBe(401);
  for (const s of [editor, marketing]) {
    expect((await s.get('/api/admin/users')).status()).toBe(403);
    expect((await s.send('POST', '/api/admin/users', { email: newEmail(), password: PASSWORD, roles: ['admin'] })).status()).toBe(403);
    expect((await s.send('PATCH', `/api/admin/users/${s.me.id}`, { roles: ['admin'] })).status()).toBe(403);
    expect((await s.send('PATCH', `/api/admin/users/${admin.me.id}`, { active: false })).status()).toBe(403);
  }
  expect((await users(admin)).find((u) => u.id === admin.me.id)?.active).toBe(true);
});

test('REQ-64-AC1 REQ-64-AC3: Rollen ändern, Admin-Rolle vergeben, aber nie entziehen', async ({ admin, login }) => {
  const { user, session } = await account(admin, login, ['editor']);
  const patch = (id: number, data: unknown) => admin.send('PATCH', `/api/admin/users/${id}`, data);

  const changed = await patch(user.id, { roles: ['marketing'] });
  expect(changed.status(), await changed.text()).toBe(200);
  expect(((await changed.json()) as User).roles).toEqual(['marketing']);
  expect((await session.get('/api/admin/posts')).status()).toBe(403); // Rechte gelten sofort
  expect((await session.get('/api/admin/contact-messages')).status()).toBe(200);

  expect((await patch(user.id, { roles: [] })).status()).toBe(422);
  expect((await users(admin)).find((u) => u.id === user.id)?.roles).toEqual(['marketing']);

  const granted = await patch(user.id, { roles: ['admin', 'marketing'] });
  expect(granted.status()).toBe(200);
  expect((await session.get('/api/admin/users')).status()).toBe(200);

  for (const id of [user.id, admin.me.id]) {
    const res = await patch(id, { roles: ['editor', 'marketing'] });
    expect(res.status(), `Admin-Rolle von Konto ${id} entziehen`).toBe(422);
    expect(((await res.json()) as { message: string }).message).toMatch(/Admin/);
  }
  const list = await users(admin);
  expect(list.find((u) => u.id === user.id)?.roles).toContain('admin');
  expect(list.find((u) => u.id === admin.me.id)?.roles).toContain('admin');
  expect((await session.get('/api/admin/users')).status()).toBe(200);
});

test('REQ-64-AC3: Admin mit weiteren Rollen erreicht alle Bereiche und darf Beratungsanfragen löschen', async ({ admin, login, request }) => {
  const { session } = await account(admin, login, ['admin', 'marketing']);
  expect(await areaStatus(session)).toEqual({ posts: 200, statistics: 200, messages: 200, consultations: 200, users: 200, profile: 200 });
  const c = await consultation(request, session);
  expect((await session.send('DELETE', `/api/admin/consultation-requests/${c.id}`)).status()).toBe(204);
});

test('REQ-64-AC4: Redakteur erreicht nur Beiträge und Profil', async ({ admin, login }) => {
  const { session } = await account(admin, login, ['editor']);
  expect(await areaStatus(session)).toEqual({ posts: 200, statistics: 403, messages: 403, consultations: 403, users: 403, profile: 200 });
});

test('REQ-64-AC5: Marketing liest Statistik, Nachrichten und Beratungsanfragen, löscht aber nichts', async ({ admin, login, request }) => {
  const { session } = await account(admin, login, ['marketing']);
  expect(await areaStatus(session)).toEqual({ posts: 403, statistics: 200, messages: 200, consultations: 200, users: 403, profile: 200 });
  expect((await session.send('POST', '/api/admin/posts', { featured: false, topics: [], texts: [fullText('de', uid())] })).status()).toBe(403);
  const c = await consultation(request, session);
  expect((await session.send('DELETE', `/api/admin/consultation-requests/${c.id}`)).status()).toBe(403);
  const still = ((await (await session.get('/api/admin/consultation-requests')).json()) as { items: { id: number }[] }).items;
  expect(still.some((r) => r.id === c.id), 'Anfrage bleibt erhalten').toBe(true);
  await admin.send('DELETE', `/api/admin/consultation-requests/${c.id}`);
});

test('REQ-64-AC6: Redakteur und Marketing zusammen ohne Benutzerverwaltung und Löschen', async ({ admin, login, request }) => {
  const { session } = await account(admin, login, ['editor', 'marketing']);
  expect(await areaStatus(session)).toEqual({ posts: 200, statistics: 200, messages: 200, consultations: 200, users: 403, profile: 200 });
  const c = await consultation(request, session);
  expect((await session.send('DELETE', `/api/admin/consultation-requests/${c.id}`)).status()).toBe(403);
  await admin.send('DELETE', `/api/admin/consultation-requests/${c.id}`);
});

test('REQ-64-AC7: Passwortänderung gilt für die nächste Anmeldung; abgelehnte Änderung lässt das alte Passwort gültig', async ({ admin, login }) => {
  const { session, email } = await account(admin, login, ['marketing']);
  const other = (await login(email, PASSWORD)).session!;
  const change = (data: unknown) => session.send('PUT', '/api/profile/password', data);

  for (const data of [
    { currentPassword: 'falsches-passwort', newPassword: 'neues-passwort-64' },
    { currentPassword: PASSWORD, newPassword: 'kurz' },
  ]) {
    const res = await change(data);
    expect(res.status(), JSON.stringify(data)).toBe(422);
    expect(((await res.json()) as { message: string }).message.length).toBeGreaterThan(0);
  }
  expect((await login(email, PASSWORD)).status, 'altes Passwort gilt nach abgelehnter Änderung').toBe(200);

  expect((await change({ currentPassword: PASSWORD, newPassword: 'neues-passwort-64' })).status()).toBe(204);
  expect((await login(email, PASSWORD)).status, 'altes Passwort').toBe(401);
  expect((await login(email, 'neues-passwort-64')).status, 'neues Passwort').toBe(200);
  expect((await session.get('/api/auth/me')).status(), 'aktuelle Sitzung bleibt').toBe(200);
  expect((await other.get('/api/auth/me')).status(), 'andere Sitzung endet').toBe(401);
});

test('REQ-64-AC8: Anzeigename und Profilbild bleiben gespeichert; abgelehnter Upload ersetzt das Bild nicht', async ({ admin, login }) => {
  const { session, email } = await account(admin, login, ['editor']);
  const name = `Erika ${uid()}`;
  const saved = await session.send('PATCH', '/api/profile', { displayName: `  ${name}  `, roles: ['admin'] });
  expect(saved.status(), await saved.text()).toBe(200);
  expect((await session.send('PATCH', '/api/profile', { displayName: 'x'.repeat(81) })).status()).toBe(422);

  const up = await session.upload('/api/profile/avatar', { name: 'bild.png', mimeType: 'image/png', buffer: pngImage(64, 64) });
  expect(up.status(), await up.text()).toBe(200);
  const first = await profile(session);
  expect(first).toMatchObject({ email, displayName: name, roles: ['editor'] });
  expect(first.avatar?.src).toMatch(/^\/media\//);
  expect((await session.get(first.avatar!.src)).status()).toBe(200);

  const bad = await session.upload('/api/profile/avatar', { name: 'bild.png', mimeType: 'image/png', buffer: Buffer.from('kein bild') });
  expect(bad.status()).toBe(422);
  expect(((await bad.json()) as { message: string }).message.length).toBeGreaterThan(0);
  expect((await profile(session)).avatar?.src, 'bisheriges Bild bleibt').toBe(first.avatar!.src);
  // Rollen sind über das Profil nicht änderbar; fremde Profile gibt es nicht.
  expect((await users(admin)).find((u) => u.email === email)?.roles).toEqual(['editor']);
  expect((await session.get(`/api/profile/${admin.me.id}`)).status()).toBe(404);
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

test('REQ-64-AC10: bestehende Testkonten melden sich an und behalten ihre Rolle', async ({ editor, admin }) => {
  expect(editor.me.roles).toEqual(['editor']);
  expect(admin.me.roles).toEqual(['admin']);
  expect(await areaStatus(editor)).toEqual({ posts: 200, statistics: 403, messages: 403, consultations: 403, users: 403, profile: 200 });
  expect(await areaStatus(admin)).toEqual({ posts: 200, statistics: 200, messages: 200, consultations: 200, users: 200, profile: 200 });
});

// ---------------------------------------------------------------------------
// Oberfläche
// ---------------------------------------------------------------------------

const NAV = ['Beiträge', 'Statistik', 'Beratungsanfragen', 'Nachrichten', 'Benutzer', 'Profil'];
async function navLinks(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Redaktion' });
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

test.describe('Oberfläche als Marketing', () => {
  test.use({ storageState: AUTH.marketing });
  test('REQ-64-AC5: Navigation, gesperrte Beitragsseiten und Beratungsanfragen ohne Löschen', async ({ page, request, marketing, admin }) => {
    await page.goto('/redaktion/statistik');
    expect(await navLinks(page)).toEqual(['Statistik', 'Beratungsanfragen', 'Nachrichten', 'Profil']);
    for (const path of ['', 'beitraege/neu', 'benutzer']) {
      const res = await page.goto(`/redaktion/${path}`);
      expect(res?.status(), path || 'Beitragsliste').toBe(403);
      await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
    }
    const c = await consultation(request, marketing);
    await page.goto('/redaktion/beratungsanfragen');
    const row = page.getByRole('row').filter({ hasText: c.email });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
    await admin.send('DELETE', `/api/admin/consultation-requests/${c.id}`);
  });
});

test('REQ-64-AC5: Marketing landet nach der Anmeldung auf der Statistik', async ({ page }) => {
  await page.goto('/redaktion/anmelden');
  await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.marketing.email);
  await page.getByLabel('Passwort', { exact: true }).fill(ACCOUNTS.marketing.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/redaktion\/statistik$/);
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

  test('REQ-64-AC1: Anlegen ohne Rolle zeigt einen Fehler und legt nichts an', async ({ page, admin }) => {
    const email = newEmail();
    await page.goto('/redaktion/benutzer');
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Startpasswort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'mindestens eine Rolle' })).toBeVisible();
    expect((await users(admin)).some((u) => u.email === email)).toBe(false);
  });

  test('REQ-64-AC9: Autor im Editor wählen und auf der Beitragsseite DE/EN anzeigen', async ({ page, admin, request }) => {
    const name = `Admin ${uid()}`;
    await admin.send('PATCH', '/api/profile', { displayName: name });
    await admin.upload('/api/profile/avatar', { name: 'a.png', mimeType: 'image/png', buffer: pngImage(40, 40) });
    const tag = uid();
    const res = await admin.send('POST', '/api/admin/posts', { featured: false, topics: [], texts: [fullText('de', tag), fullText('en', tag)] });
    const post = (await res.json()) as EditorPost;
    try {
      await page.goto(`/redaktion/beitraege/${post.id}`);
      const select = page.getByLabel('Autor', { exact: true });
      await expect(select).toHaveValue(String(admin.me.id));
      await select.selectOption({ label: 'Kein Autor' });
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: /gespeichert/i }).first()).toBeVisible();
      expect(((await (await admin.get(`/api/admin/posts/${post.id}`)).json()) as { authorId?: number }).authorId).toBeUndefined();

      await select.selectOption(String(admin.me.id));
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect.poll(async () => ((await (await admin.get(`/api/admin/posts/${post.id}`)).json()) as { authorId?: number }).authorId).toBe(admin.me.id);
      expect((await admin.send('POST', `/api/admin/posts/${post.id}/publish`)).status()).toBe(200);

      for (const lang of ['de', 'en'] as const) {
        await page.goto(`/${lang}/blog/${post.slug}`);
        const author = page.locator('.post-author');
        await expect(author).toContainText(name);
        await expect(author.locator('img')).toHaveAttribute('src', /^\/media\//);
        await expect(page.locator('body')).not.toContainText(ACCOUNTS.admin.email);
      }
      expect(await (await request.get(`/api/posts/${post.slug}?lang=en`)).text()).not.toContain(ACCOUNTS.admin.email);
    } finally {
      await admin.send('DELETE', `/api/admin/posts/${post.id}`);
      await admin.send('PATCH', '/api/profile', { displayName: '' });
    }
  });
});

test.describe('Profil', () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    test(`REQ-64-AC7 REQ-64-AC8: Profil per Tastatur pflegen (${viewport.width} px)`, async ({ browser, baseURL, admin, login, ip }) => {
      const { email } = await account(admin, login, ['marketing']);
      const ctx = await browser.newContext({ baseURL, viewport, hasTouch: viewport.width < 768, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
      const page = await ctx.newPage();
      try {
        await page.goto('/redaktion/anmelden');
        await page.getByLabel('E-Mail-Adresse').fill(email);
        await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
        await page.keyboard.press('Enter');
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
        await page.getByLabel('Neues Passwort').press('Enter');
        await expect(page.getByRole('alert').filter({ hasText: /aktuelle Passwort/ })).toBeVisible();
        await page.getByLabel('Aktuelles Passwort').fill(PASSWORD);
        await page.getByLabel('Neues Passwort').press('Enter');
        await expect(page.getByRole('status').filter({ hasText: 'Passwort geändert.' })).toBeVisible();

        await page.reload();
        await expect(page.getByLabel('Anzeigename')).toHaveValue(name);
        await expect(page.getByRole('img', { name: 'Ihr Profilbild' })).toBeVisible();
        await expectNoHorizontalScroll(page);
        expect((await login(email, 'neues-passwort-64')).status).toBe(200);
      } finally {
        await ctx.close();
      }
    });
  }
});

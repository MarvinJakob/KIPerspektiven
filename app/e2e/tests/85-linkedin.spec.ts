// Abdeckung: app/backend/internal/service/social.go app/backend/internal/linkedin/linkedin.go app/backend/internal/http/social.go app/frontend-redaktion/src/pages/SocialMedia.tsx app/frontend-redaktion/src/pages/EditPost.tsx app/e2e/scripts/linkedin-stub.mjs
import type { APIRequestContext, Page } from '@playwright/test';
import { AUTH, expect, fullText, test, uid, type Session } from '../support/fixtures';

// Akzeptanztests zu Ticket #85 (Beiträge automatisch auf LinkedIn teilen) gegen das echte Backend und das
// LinkedIn-Testdouble scripts/linkedin-stub.mjs. Die Verbindung ist eine serverweite Einstellung; die Tests dieser
// Datei laufen deshalb nacheinander. Andere Specs, die währenddessen veröffentlichen, erzeugen höchstens zusätzliche
// Posts im Testdouble; die Prüfungen hier zählen nur Posts mit eigener Kennung.

// Port wie in playwright.config.ts; das Merge Gate verwendet den Standard 8091 (.github/workflows/tests.yml).
const STUB = `http://127.0.0.1:${process.env.E2E_LINKEDIN_PORT ?? 8091}`;
const STUB_TOKEN = 'e2e-linkedin-geheimes-token';
const SETTINGS = '/redaktion/einstellungen/social-media/linkedin';
const API = '/api/admin/social/linkedin';

interface StubPost {
  author: string;
  commentary: string;
  content?: { article?: { source: string; title: string } };
}

const stubMode = async (request: APIRequestContext, mode: { posts?: string; authorize?: string }) =>
  expect((await request.post(`${STUB}/__stub/mode`, { data: mode })).ok()).toBe(true);
const stubPosts = async (request: APIRequestContext, tag: string) =>
  ((await (await request.get(`${STUB}/__stub/posts`)).json()) as StubPost[]).filter((p) => p.commentary.includes(tag));

/** Verbindung über den OAuth-Ablauf herstellen (Browser des Admins) und Teilen einschalten. */
async function connectAndEnable(admin: Session, page: Page, lang: 'de' | 'en' = 'de') {
  await admin.send('DELETE', `${API}/connection`);
  await page.goto(SETTINGS);
  await page.getByRole('button', { name: 'Mit LinkedIn verbinden' }).click();
  await expect(page.getByText('E2E Profil')).toBeVisible();
  const res = await admin.send('PUT', API, { enabled: true, preferredLang: lang });
  expect(res.status(), await res.text()).toBe(200);
}

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ request }) => {
  await stubMode(request, { posts: 'ok', authorize: 'ok' });
});

test.describe('Rechte', () => {
  test('REQ-85-AC4: Redaktion und Marketing erreichen die Einstellungen weder als Seite noch per API', async ({ editor, marketing, browser, request }) => {
    for (const [session, state] of [
      [editor, AUTH.editor],
      [marketing, AUTH.marketing],
    ] as const) {
      expect((await session.get(API)).status()).toBe(403);
      expect((await session.send('PUT', API, { enabled: true, preferredLang: 'de' })).status()).toBe(403);
      expect((await session.send('POST', `${API}/authorize`)).status()).toBe(403);
      expect((await session.send('DELETE', `${API}/connection`)).status()).toBe(403);
      const ctx = await browser.newContext({ storageState: state });
      const page = await ctx.newPage();
      for (const path of ['/redaktion/einstellungen', '/redaktion/einstellungen/social-media', SETTINGS]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(403);
        await expect(page.getByRole('heading', { name: 'Keine Berechtigung' })).toBeVisible();
        await expect(page.getByLabel('Automatisch auf LinkedIn teilen')).toHaveCount(0);
      }
      await expect(page.getByRole('navigation', { name: 'Redaktion' }).getByRole('link', { name: 'Einstellungen' })).toHaveCount(0);
      await ctx.close();
    }
    expect((await request.get(API)).status()).toBe(401);
  });
});

test.describe('Einstellungen', () => {
  test.use({ storageState: AUTH.admin });

  test('REQ-85-AC2: ohne Verbindung lässt sich nichts einschalten, abgelehnte Autorisierung speichert nichts', async ({ admin, page, request }) => {
    expect((await admin.send('DELETE', `${API}/connection`)).status()).toBe(204);
    const put = await admin.send('PUT', API, { enabled: true, preferredLang: 'de' });
    expect(put.status()).toBe(422);
    expect((await put.json()).message).toMatch(/kein LinkedIn-Profil verbunden/);
    expect((await (await admin.get(API)).json()).enabled).toBe(false);

    await page.goto(SETTINGS);
    await expect(page.getByText('Nicht verbunden', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Automatisch auf LinkedIn teilen')).toBeDisabled();
    await expect(page.getByText(/kein LinkedIn-Profil verbunden/)).toBeVisible();

    await stubMode(request, { authorize: 'deny' });
    await page.getByRole('button', { name: 'Mit LinkedIn verbinden' }).click();
    await expect(page.getByRole('alert')).toContainText(/abgebrochen/i);
    await expect(page.getByText('Nicht verbunden', { exact: true })).toBeVisible();
    expect((await (await admin.get(API)).json()).connected).toBe(false);
    await stubMode(request, { authorize: 'ok' });

    // Manipulierter Rückruf mit fremdem state
    await page.goto(`${API}/callback?code=e2e-code&state=gefaelscht`);
    await expect(page).toHaveURL(new RegExp(SETTINGS));
    await expect(page.getByRole('alert')).toContainText(/ungültig/);
    expect((await (await admin.get(API)).json()).connected).toBe(false);
  });

  for (const width of [375, 1280]) {
    test(`REQ-85-AC1 AC3: per Tastatur verbinden, einschalten und Sprache wählen bei ${width}px`, async ({ admin, page }) => {
      expect((await admin.send('DELETE', `${API}/connection`)).status()).toBe(204);
      await page.setViewportSize({ width, height: 800 });
      // Jede Seite setzt nach dem Wechsel den Fokus auf ihre Überschrift (components/Layout.tsx, Page). Erst danach
      // weiter per Tastatur, sonst entzieht dieser Effekt dem gerade fokussierten Link den Fokus (Befund im CI-Lauf
      // 44387722921 bei 375 px).
      const keyboardTo = async (link: ReturnType<Page['getByRole']>, heading: string, url: RegExp) => {
        await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
        await link.focus();
        await expect(link).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(url);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      };
      await page.goto('/redaktion/benutzer');
      const nav = page.getByRole('navigation', { name: 'Redaktion' });
      if (width < 900) {
        // Schmale Ansicht (Ticket #103): die Navigation öffnet sich erst über die Schaltfläche „Navigation“.
        await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
        await page.getByRole('button', { name: 'Navigation', exact: true }).focus();
        await page.keyboard.press('Enter');
        const link = nav.getByRole('link', { name: 'Einstellungen' });
        await link.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/redaktion\/einstellungen$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
      } else {
        await keyboardTo(nav.getByRole('link', { name: 'Einstellungen' }), 'Einstellungen', /\/redaktion\/einstellungen$/);
      }
      await keyboardTo(page.getByRole('link', { name: 'Social Media' }), 'Social Media', /\/einstellungen\/social-media$/);
      await keyboardTo(page.getByRole('link', { name: /LinkedIn/ }), 'LinkedIn', new RegExp(`${SETTINGS}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

      await page.getByRole('button', { name: 'Mit LinkedIn verbinden' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('E2E Profil')).toBeVisible();
      await expect(page.getByText('Verbunden', { exact: true })).toBeVisible();
      await expect(page.getByText(/Autorisierung gültig bis/)).toBeVisible();

      const toggle = page.getByLabel('Automatisch auf LinkedIn teilen');
      await expect(toggle).toBeEnabled();
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(toggle).toBeChecked();
      const english = page.getByRole('radio', { name: 'Englisch' });
      await english.focus();
      await page.keyboard.press('Space');
      await expect(english).toBeChecked();
      await page.getByRole('button', { name: 'Einstellungen speichern' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();

      await page.reload();
      await expect(page.getByText('E2E Profil')).toBeVisible();
      await expect(page.getByText('Verbunden', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Automatisch auf LinkedIn teilen')).toBeChecked();
      await expect(page.getByRole('radio', { name: 'Englisch' })).toBeChecked();
      const s = await (await admin.get(API)).json();
      expect([s.enabled, s.preferredLang, s.profileName]).toEqual([true, 'en', 'E2E Profil']);
      await admin.send('PUT', API, { enabled: false, preferredLang: 'de' });
    });
  }

  test('REQ-85-AC5: Token und Secret erscheinen in keiner Antwort', async ({ admin, page, posts, request }) => {
    await connectAndEnable(admin, page);
    const html = await page.content();
    const responses = [
      await (await admin.get(API)).text(),
      await (await admin.send('PUT', API, { enabled: true, preferredLang: 'de' })).text(),
      html,
    ];
    await stubMode(request, { posts: 'reject401' });
    const tag = uid();
    const post = await posts.create({ texts: [fullText('de', tag)] });
    await posts.publish(post.id);
    await expect.poll(async () => (await (await admin.get(`/api/admin/posts/${post.id}`)).json()).linkedin?.state).toBe('failed');
    responses.push(await (await admin.get(`/api/admin/posts/${post.id}`)).text(), await (await admin.get('/api/admin/posts')).text());
    await stubMode(request, { posts: 'ok' });
    for (const r of responses) {
      expect(r).not.toContain(STUB_TOKEN);
      expect(r).not.toContain('e2e-linkedin-secret');
      expect(r).not.toContain('token expired');
    }
  });
});

test.describe('Teilen', () => {
  test.use({ storageState: AUTH.admin });

  test('REQ-85-AC6 AC7 AC8: sofortige Erstveröffentlichung teilt genau einmal mit Titel und Link', async ({ admin, page, posts, request, baseURL }) => {
    await connectAndEnable(admin, page, 'de');
    const tag = uid();
    const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
    await page.goto(`/redaktion/beitraege/${post.id}`);
    await page.getByRole('button', { name: 'Veröffentlichen', exact: true }).click();
    const linkedin = page.getByRole('region', { name: 'LinkedIn' });
    await expect(linkedin).toContainText('Geteilt', { timeout: 20_000 });
    const link = linkedin.getByRole('link', { name: /Post auf LinkedIn öffnen/ });
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:share:\d+\/$/);
    const sent = await stubPosts(request, tag);
    expect(sent).toHaveLength(1);
    const url = `${baseURL}/de/blog/${post.slug}`;
    expect(sent[0].author).toBe('urn:li:person:e2e-member');
    expect(sent[0].commentary).toBe(`Testbeitrag ${tag}\n\n${url}`);
    expect(sent[0].content?.article).toEqual({ source: url, title: `Testbeitrag ${tag}` });
    expect((await request.get(`/de/blog/${post.slug}`)).status()).toBe(200);
    await page.waitForTimeout(2_000);
    expect(await stubPosts(request, tag)).toHaveLength(1);

    // Bevorzugte Sprache Englisch (REQ-85-AC7)
    await admin.send('PUT', API, { enabled: true, preferredLang: 'en' });
    const tagEn = uid();
    const en = await posts.create({ texts: [fullText('de', tagEn), fullText('en', tagEn)] });
    await posts.publish(en.id);
    await expect.poll(async () => (await stubPosts(request, tagEn)).length, { timeout: 20_000 }).toBe(1);
    expect((await stubPosts(request, tagEn))[0].commentary).toBe(`Test post ${tagEn}\n\n${baseURL}/en/blog/${en.slug}`);
  });

  test('REQ-85-AC9: geplante Veröffentlichung teilt erst zum Termin, aufgehobener Termin nie', async ({ admin, editor, page, posts, request }) => {
    test.setTimeout(150_000);
    await connectAndEnable(admin, page, 'de');
    const tag = uid();
    const tagCancelled = uid();
    const post = await posts.create({ texts: [fullText('de', tag)] });
    const cancelled = await posts.create({ texts: [fullText('de', tagCancelled)] });
    const due = Math.ceil((Date.now() + 15_000) / 60_000) * 60_000;
    for (const p of [post, cancelled]) {
      const res = await editor.send('PUT', `/api/admin/posts/${p.id}/schedule`, { publishAt: new Date(due).toISOString() });
      expect(res.status(), await res.text()).toBe(200);
    }
    expect((await editor.send('DELETE', `/api/admin/posts/${cancelled.id}/schedule`)).ok()).toBe(true);
    expect(await stubPosts(request, tag)).toHaveLength(0);
    await expect.poll(async () => (await stubPosts(request, tag)).length, { timeout: 120_000, intervals: [2_000] }).toBe(1);
    expect(Date.now()).toBeGreaterThanOrEqual(due);
    expect((await request.get(`/de/blog/${post.slug}`)).status()).toBe(200);
    expect(await stubPosts(request, tagCancelled)).toHaveLength(0);
  });

  test('REQ-85-AC10 AC11: ausgeschaltet kein Post, Einschalten und erneutes Veröffentlichen teilen nicht nach', async ({ admin, editor, page, posts, request }) => {
    await connectAndEnable(admin, page, 'de');
    await admin.send('PUT', API, { enabled: false, preferredLang: 'de' });
    const tagOff = uid();
    const off = await posts.create({ texts: [fullText('de', tagOff)] });
    await posts.publish(off.id);
    await admin.send('PUT', API, { enabled: true, preferredLang: 'de' });
    const tag = uid();
    const shared = await posts.create({ texts: [fullText('de', tag)] });
    await posts.publish(shared.id);
    await expect.poll(async () => (await stubPosts(request, tag)).length, { timeout: 20_000 }).toBe(1);
    for (const p of [off, shared]) {
      expect((await editor.send('PUT', `/api/admin/posts/${p.id}`, { featured: false, topics: [], texts: [fullText('de', tag + p.id)] })).ok()).toBe(true);
      expect((await editor.send('POST', `/api/admin/posts/${p.id}/unpublish`)).ok()).toBe(true);
      await posts.publish(p.id);
    }
    await page.waitForTimeout(3_000);
    expect(await stubPosts(request, tagOff)).toHaveLength(0);
    expect(await stubPosts(request, tag)).toHaveLength(1);
    expect((await (await admin.get(`/api/admin/posts/${off.id}`)).json()).linkedin).toBeFalsy();
    await page.goto(`/redaktion/beitraege/${off.id}`);
    await expect(page.getByRole('region', { name: 'LinkedIn' })).toContainText('Nicht geteilt');
  });

  test('REQ-85-AC12: Ablehnung bleibt sichtbar, Beitrag öffentlich, Wiederholung teilt genau einmal', async ({ admin, page, posts, request }) => {
    await connectAndEnable(admin, page, 'de');
    await stubMode(request, { posts: 'reject401' });
    const tag = uid();
    const post = await posts.create({ texts: [fullText('de', tag)] });
    await posts.publish(post.id);
    await page.goto(`/redaktion/beitraege/${post.id}`);
    const linkedin = page.getByRole('region', { name: 'LinkedIn' });
    await expect(linkedin).toContainText('Fehlgeschlagen', { timeout: 20_000 });
    await expect(linkedin).toContainText(/abgelaufen/);
    expect((await request.get(`/de/blog/${post.slug}`)).status()).toBe(200);
    await stubMode(request, { posts: 'ok' });
    await linkedin.getByRole('button', { name: 'Erneut an LinkedIn senden' }).click();
    await expect(linkedin).toContainText('Geteilt', { timeout: 20_000 });
    expect(await stubPosts(request, tag)).toHaveLength(1);
  });

  test('REQ-85-AC13: unklarer Ausgang zeigt keinen Erfolg und bietet keine Wiederholung', async ({ admin, page, posts, request }) => {
    await connectAndEnable(admin, page, 'de');
    await stubMode(request, { posts: 'drop' });
    const tag = uid();
    const post = await posts.create({ texts: [fullText('de', tag)] });
    await posts.publish(post.id);
    await page.goto(`/redaktion/beitraege/${post.id}`);
    const linkedin = page.getByRole('region', { name: 'LinkedIn' });
    await expect(linkedin).toContainText('Ausgang unklar', { timeout: 30_000 });
    await expect(linkedin).toContainText(/prüfen/);
    await expect(linkedin).not.toContainText('Geteilt');
    await expect(linkedin.getByRole('button', { name: 'Erneut an LinkedIn senden' })).toHaveCount(0);
    expect((await admin.send('POST', `/api/admin/posts/${post.id}/linkedin/retry`)).status()).toBe(422);
    await stubMode(request, { posts: 'ok' });
    expect(await stubPosts(request, tag)).toHaveLength(1);
  });
});

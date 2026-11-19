// Abdeckung: app/backend/internal/service/social.go app/backend/internal/linkedin/linkedin.go app/backend/internal/http/social.go app/frontend-redaktion/src/pages/SocialMedia.tsx app/frontend-redaktion/src/pages/EditPost.tsx app/e2e/scripts/linkedin-stub.mjs
import type { APIRequestContext, Page } from '@playwright/test';
import { AUTH, expect, fullText, test, uid, type Session } from '../support/fixtures';

// Akzeptanztests zu Ticket #85 (Beiträge automatisch auf LinkedIn teilen) gegen das echte Backend und das
// LinkedIn-Testdouble scripts/linkedin-stub.mjs. Die Verbindung ist eine serverweite Einstellung; die Tests dieser
// Datei laufen deshalb nacheinander. Andere Specs, die währenddessen veröffentlichen, erzeugen höchstens zusätzliche
// Posts im Testdouble; die Prüfungen hier zählen nur Posts mit eigener Kennung.

// Port wie in playwright.config.ts; das Merge Gate verwendet den Standard 8091 (.github/workflows/tests.yml).
const STUB = `http://127.0.0.1:${process.env.E2E_LINKEDIN_PORT ?? 8091}`;
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

  test('REQ-85-AC1 AC3: Profil verbinden, Teilen einschalten und Sprache wählen', async ({ admin, page }) => {
    expect((await admin.send('DELETE', `${API}/connection`)).status()).toBe(204);
    // Jede Seite setzt nach dem Wechsel den Fokus auf ihre Überschrift (components/Layout.tsx, Page). Erst danach
    // weiter per Tastatur, sonst entzieht dieser Effekt dem gerade fokussierten Link den Fokus.
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
    await keyboardTo(nav.getByRole('link', { name: 'Einstellungen' }), 'Einstellungen', /\/redaktion\/einstellungen$/);
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
});

test.describe('Teilen', () => {
  test.use({ storageState: AUTH.admin });

  test('REQ-85-AC6 AC8: sofortige Erstveröffentlichung teilt den Beitrag mit Titel und Link', async ({ admin, page, posts, request, baseURL }) => {
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
  });
});

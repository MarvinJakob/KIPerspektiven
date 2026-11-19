// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/lib/page.ts app/frontend/src/pages/Home.tsx app/frontend/src/pages/Blog.tsx app/frontend/src/pages/Contact.tsx app/frontend/src/pages/Post.tsx app/frontend/src/pages/Profile.tsx app/frontend/src/pages/Legal.tsx app/frontend/src/pages/Topic.tsx app/frontend/src/pages/NotFound.tsx
import type { Page, Route } from '@playwright/test';
import { expect, fullText, test, uid } from '../support/fixtures';

// Anforderung #108: Der Browser-Tab beginnt mit „KI Perspektiven“, danach folgt der Seitenname.
// Sollwerte aus Ticket #108 (Akzeptanzkriterien und Tabelle „Seitennamen“ der Spezifikation).
// Unit-Tests: app/frontend/src/lib/page.test.tsx, app/backend/internal/web/meta_test.go.
const SITE = 'KI Perspektiven';

/** Seitenname je Adresse und Sprache; `''` steht für die Startseite ohne Seitennamen. */
const PAGES: { path: string; ac: string; de: string; en: string }[] = [
  { path: '', ac: 'REQ-108-AC2', de: '', en: '' },
  { path: '/blog', ac: 'REQ-108-AC1', de: 'News', en: 'News' },
  { path: '/kontakt', ac: 'REQ-108-AC1', de: 'Kontakt', en: 'Contact' },
  { path: '/profil', ac: 'REQ-108-AC1', de: 'Profil', en: 'Profile' },
  { path: '/themen/ai-audit', ac: 'REQ-108-AC1', de: 'KI Readiness', en: 'AI Readiness' },
  { path: '/impressum', ac: 'REQ-108-AC1', de: 'Impressum', en: 'Legal notice' },
  { path: '/datenschutz', ac: 'REQ-108-AC1', de: 'Datenschutz', en: 'Privacy' },
];

const tab = (name: string) => (name ? `${SITE} ${name}` : SITE);

/** Titel im ausgelieferten HTML, unverändert und ohne die Leerraumbereinigung des Browsers. */
async function htmlTitle(page: Page, url: string, status = 200) {
  const res = await page.request.get(url);
  expect(res.status(), url).toBe(status);
  const titles = [...(await res.text()).matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  expect(titles, `genau ein <title> in ${url}`).toHaveLength(1);
  return titles[0];
}

/** Hält die Antwort einer API-Adresse zurück, bis der Test sie freigibt. */
async function hold(page: Page, url: string | RegExp) {
  let release!: (how: (route: Route) => Promise<void>) => void;
  const decided = new Promise<(route: Route) => Promise<void>>((r) => (release = r));
  let seen!: () => void;
  const requested = new Promise<void>((r) => (seen = r));
  await page.route(url, async (route) => {
    seen();
    await (await decided)(route);
  });
  return { requested, release };
}

for (const lang of ['de', 'en'] as const) {
  test(`REQ-108-AC1 REQ-108-AC2 REQ-108-AC3: Direktaufruf zeigt „KI Perspektiven <Seitenname>“ in HTML und Tab (${lang})`, async ({ page }) => {
    for (const p of PAGES) {
      const url = `/${lang}${p.path}`;
      const soll = tab(p[lang]);
      expect(await htmlTitle(page, url), `${p.ac}, REQ-108-AC3: <title> im HTML von ${url}`).toBe(soll);
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page, `${p.ac}: Tab-Titel von ${url} nach dem Laden`).toHaveTitle(soll);
    }
  });

  test(`REQ-108-AC1 REQ-108-AC3: Fehlerseite zeigt ihren Titel in HTML und Tab (${lang})`, async ({ page }) => {
    const soll = lang === 'de' ? 'KI Perspektiven Seite nicht gefunden' : 'KI Perspektiven Page not found';
    const url = `/${lang}/blog/gibt-es-nicht-${uid()}`;
    expect(await htmlTitle(page, url, 404), 'REQ-108-AC3: <title> im HTML').toBe(soll);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lang === 'de' ? 'Seite nicht gefunden' : 'Page not found');
    await expect(page, 'REQ-108-AC1: Tab-Titel').toHaveTitle(soll);
  });
}

test('REQ-108-AC2 REQ-108-AC3: „/“ liefert „KI Perspektiven“ und zeigt es nach der Weiterleitung zur Startseite', async ({ page }) => {
  expect(await htmlTitle(page, '/')).toBe(SITE);
  await page.goto('/');
  await expect(page).toHaveURL(/\/de\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(SITE);
});

test('REQ-108-AC1 REQ-108-AC3: Beitrag und Themenseite zeigen ihren Inhaltstitel, im HTML wie im Tab', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  await posts.publish(post.id);

  for (const [lang, title] of [['de', `Testbeitrag ${tag}`], ['en', `Test post ${tag}`]] as const) {
    const url = `/${lang}/blog/${post.slug}`;
    const soll = `KI Perspektiven ${title}`;
    expect(await htmlTitle(page, url), `<title> im HTML von ${url}`).toBe(soll);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(tag);
    await expect(page, `Tab-Titel von ${url}`).toHaveTitle(soll);
  }

  // Themenseite: Inhaltstitel aus der API, unabhängig vom Seitentitel gelesen.
  for (const lang of ['de', 'en'] as const) {
    const topic = (await (await page.request.get(`/api/topics/vibe-coding?lang=${lang}`)).json()) as { title: string };
    expect(topic.title.trim(), 'Thementitel aus der API').not.toBe('');
    const soll = `KI Perspektiven ${topic.title}`;
    expect(await htmlTitle(page, `/${lang}/themen/vibe-coding`)).toBe(soll);
    await page.goto(`/${lang}/themen/vibe-coding`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(soll);
  }
});

test('REQ-108-AC1 REQ-108-AC3: Themenartikel und Readiness-Dimension zeigen ihren Inhaltstitel, im HTML wie im Tab', async ({ page, editor }) => {
  const title = `Themenartikel ${uid()}`;
  const created = await editor.send('POST', '/api/admin/articles', { status: 'draft', de: { title, blocks: [] } });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  try {
    const published = await editor.send('PUT', `/api/admin/articles/${id}`, { status: 'published', de: { title, blocks: [] } });
    expect(published.status(), await published.text()).toBe(200);
    const url = `/de/themenartikel/${id}`;
    expect(await htmlTitle(page, url), `<title> im HTML von ${url}`).toBe(`KI Perspektiven ${title}`);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page, `Tab-Titel von ${url}`).toHaveTitle(`KI Perspektiven ${title}`);
  } finally {
    await editor.send('DELETE', `/api/admin/articles/${id}`);
  }

  // Readiness-Dimension: Inhaltstitel aus der API, unabhängig vom Seitentitel gelesen.
  for (const lang of ['de', 'en'] as const) {
    const audit = (await (await page.request.get(`/api/audit?lang=${lang}`)).json()) as { dimensions: { slug: string; title: string }[] };
    const d = audit.dimensions[0];
    expect(d.title.trim(), 'Dimensionstitel aus der API').not.toBe('');
    const url = `/${lang}/themen/ai-audit/${d.slug}`;
    expect(await htmlTitle(page, url), `<title> im HTML von ${url}`).toBe(`KI Perspektiven ${d.title}`);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.title);
    await expect(page, `Tab-Titel von ${url}`).toHaveTitle(`KI Perspektiven ${d.title}`);
  }
});

test('REQ-108-AC3: beim Direktaufruf eines Beitrags wechselt der Tab-Titel während des Ladens nicht', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag)] });
  await posts.publish(post.id);
  const soll = `KI Perspektiven Testbeitrag ${tag}`;

  const api = await hold(page, new RegExp(`/api/posts/${post.slug}\\?`));
  await page.goto(`/de/blog/${post.slug}`);
  await api.requested;
  await expect(page, 'während die API noch lädt').toHaveTitle(soll);
  api.release((route) => route.continue());
  await expect(page.getByRole('heading', { level: 1 })).toContainText(tag);
  await expect(page, 'nach dem Laden').toHaveTitle(soll);
});

test('REQ-108-AC2 REQ-108-AC3: Sprachwechsel auf einem Beitrag zeigt beim Laden „KI Perspektiven“, danach den Titel in der gewählten Sprache', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  await posts.publish(post.id);

  await page.goto(`/de/blog/${post.slug}`);
  await expect(page).toHaveTitle(`KI Perspektiven Testbeitrag ${tag}`);

  const api = await hold(page, new RegExp(`/api/posts/${post.slug}\\?.*lang=en`));
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/blog/${post.slug}$`));
  await api.requested;
  await expect(page, 'REQ-108-AC2: englische Fassung lädt noch').toHaveTitle(SITE);
  api.release((route) => route.continue());
  await expect(page, 'REQ-108-AC3: englische Fassung geladen').toHaveTitle(`KI Perspektiven Test post ${tag}`);
});

test('REQ-108-AC2: führt das Laden beim internen Wechsel zur Fehlerseite, folgt auf „KI Perspektiven“ deren Titel', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  await posts.publish(post.id);

  await page.goto(`/de/blog/${post.slug}`);
  await expect(page).toHaveTitle(`KI Perspektiven Testbeitrag ${tag}`);

  // Die englische Fassung ist für diesen Test nicht mehr öffentlich: Die API antwortet mit 404.
  const api = await hold(page, new RegExp(`/api/posts/${post.slug}\\?.*lang=en`));
  await page.getByRole('button', { name: 'English' }).click();
  await api.requested;
  await expect(page, 'Antwort steht noch aus').toHaveTitle(SITE);
  api.release((route) => route.fulfill({ status: 404, json: { message: 'not found' } }));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page, 'Titel der Fehlerseite').toHaveTitle('KI Perspektiven Page not found');
});

test('REQ-108-AC3: interner Seiten- und Sprachwechsel zeigt den Titel der Zielseite in der gewählten Sprache', async ({ page }) => {
  await page.goto('/de/blog');
  await expect(page).toHaveTitle('KI Perspektiven News');

  const footer = page.locator('footer.site-footer');
  await footer.getByRole('link', { name: 'Kontakt', exact: true }).click();
  await expect(page).toHaveURL(/\/de\/kontakt$/);
  await expect(page, 'Seitenwechsel News → Kontakt').toHaveTitle('KI Perspektiven Kontakt');

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/kontakt$/);
  await expect(page, 'Sprachwechsel auf Kontakt').toHaveTitle('KI Perspektiven Contact');

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/profil$/);
  await expect(page, 'Seitenwechsel Contact → Profile').toHaveTitle('KI Perspektiven Profile');

  await page.getByRole('link', { name: 'KI Perspektiven – home' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page, 'Seitenwechsel zur Startseite').toHaveTitle(SITE);
});

test('REQ-108 Abgrenzung: Titel der Social-Media-Vorschau behalten die Form „<Seitentitel> · KI Perspektiven“', async ({ page }) => {
  for (const [url, social] of [
    ['/de/blog', 'News · KI Perspektiven'],
    ['/en/kontakt', 'Contact · KI Perspektiven'],
    ['/de', 'KI verstehen. Sinnvoll einsetzen. · KI Perspektiven'],
  ] as const) {
    const html = await (await page.request.get(url)).text();
    expect(html, `og:title von ${url}`).toContain(`<meta property="og:title" content="${social}">`);
    expect(html, `twitter:title von ${url}`).toContain(`<meta name="twitter:title" content="${social}">`);
  }
});

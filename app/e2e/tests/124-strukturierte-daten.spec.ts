// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/index.html app/frontend/public/vorschaubild-1200x630.png
import type { APIRequestContext } from '@playwright/test';
import { expect, fullText, pngImage, test, uid } from '../support/fixtures';

// Anforderung #124: strukturierte Daten (JSON-LD), Standard-Vorschaubild und Datumsangaben im HTML des Direktaufrufs.
// Sollwerte aus den Akzeptanzkriterien und Entscheidungen E1/E2 im Ticket #124, Seitennamen aus der Tabelle in #108.
// Unit-Tests: app/backend/internal/web/structured_test.go.
const SITE = 'KI Perspektiven';
const IMAGE = '/vorschaubild-1200x630.png';
const ALT = { de: 'Logo von KI Perspektiven', en: 'KI Perspektiven logo' } as const;
type Lang = 'de' | 'en';
type Json = Record<string, unknown>;

const unescape = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Erste HTML-Antwort einer Adresse, ausgewertet ohne Browser und ohne JavaScript. */
async function head(request: APIRequestContext, url: string, status = 200) {
  const res = await request.get(url);
  expect(res.status(), url).toBe(status);
  const html = await res.text();
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)">/g)) meta[m[1]] = unescape(m[2]);
  const title = unescape(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const canonical = unescape(html.match(/<link rel="canonical" href="([^"]*)">/)?.[1] ?? '');
  const hreflang = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]*)">/g)].map((m) => `${m[1]} ${m[2]}`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return { html, meta, title, canonical, hreflang, blocks, count: html.split('application/ld+json').length - 1 };
}

/** Der einzige JSON-LD-Block der Seite als gültiges JSON. */
function one(h: Awaited<ReturnType<typeof head>>, hint: string): Json {
  expect(h.count, `${hint}: genau ein JSON-LD-Block`).toBe(1);
  expect(h.blocks, `${hint}: genau ein JSON-LD-Block`).toHaveLength(1);
  const ld = JSON.parse(h.blocks[0]) as Json;
  expect(ld['@context'], `${hint}: @context`).toBe('https://schema.org');
  return ld;
}

const website = (base: string, lang: Lang) => ({ '@type': 'WebSite', name: SITE, url: `${base}/${lang}`, inLanguage: lang });

function expectDefaultImage(h: Awaited<ReturnType<typeof head>>, base: string, lang: Lang, hint: string) {
  expect(
    {
      'og:image': h.meta['og:image'],
      'twitter:image': h.meta['twitter:image'],
      'og:image:width': h.meta['og:image:width'],
      'og:image:height': h.meta['og:image:height'],
      'og:image:alt': h.meta['og:image:alt'],
      'twitter:card': h.meta['twitter:card'],
    },
    `REQ-124-AC5: Standard-Vorschaubild auf ${hint}`,
  ).toEqual({
    'og:image': base + IMAGE,
    'twitter:image': base + IMAGE,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': ALT[lang],
    'twitter:card': 'summary_large_image',
  });
}

test('REQ-124-AC1 REQ-124-AC5: Startseite beschreibt die Website und nennt das Standard-Vorschaubild', async ({ request, baseURL }) => {
  for (const lang of ['de', 'en'] as const) {
    const h = await head(request, `/${lang}`);
    const ld = one(h, `/${lang}`);
    expect(ld, `REQ-124-AC1: WebSite auf /${lang}`).toMatchObject(website(baseURL!, lang));
    expect(ld.url, 'REQ-124-AC1: url entspricht canonical').toBe(h.canonical);
    expect(h.title, 'REQ-124-AC11: Tab-Titel unverändert').toBe(SITE);
    expectDefaultImage(h, baseURL!, lang, `/${lang}`);
  }
});

test('REQ-124-AC5: Das Standard-Vorschaubild ist ohne Anmeldung als PNG mit 1200 × 630 Pixeln abrufbar', async ({ request, baseURL }) => {
  const res = await request.get(baseURL + IMAGE);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  const png = await res.body();
  expect(png.subarray(1, 4).toString('ascii'), 'PNG-Signatur').toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)], 'Breite und Höhe aus dem PNG-Kopf').toEqual([1200, 630]);
});

test('REQ-124-AC10 REQ-124-AC8 REQ-124-AC11: übrige indexierbare Seiten sind WebPage mit vorhandenem Seitennamen und Meta-Beschreibung', async ({ request, baseURL }) => {
  const dimension = ((await (await request.get('/api/audit?lang=de')).json()) as { dimensions: { slug: string }[] }).dimensions[0].slug;
  const topicTitle = async (lang: Lang) => ((await (await request.get(`/api/topics/vibe-coding?lang=${lang}`)).json()) as { title: string }).title;
  // Die API nennt die Sprache der angezeigten Fassung: Fehlt eine Übersetzung, gilt die vorhandene (REQ-124-AC8).
  const dimensionIn = async (lang: Lang) => (await (await request.get(`/api/audit/dimensions/${dimension}?lang=${lang}`)).json()) as { title: string; lang: Lang };
  const [dimDe, dimEn] = [await dimensionIn('de'), await dimensionIn('en')];
  expect(['de', 'en'], 'Sprache der Dimension aus der API').toEqual(expect.arrayContaining([dimDe.lang, dimEn.lang]));
  // shown: Sprache der angezeigten Fassung (REQ-124-AC8); name: Seitenname laut Tabelle in #108.
  const pages: { path: string; lang: Lang; shown: Lang; name: string }[] = [
    { path: '/blog', lang: 'de', shown: 'de', name: 'News' },
    { path: '/blog', lang: 'en', shown: 'en', name: 'News' },
    { path: '/kontakt', lang: 'de', shown: 'de', name: 'Kontakt' },
    { path: '/kontakt', lang: 'en', shown: 'en', name: 'Contact' },
    { path: '/ki-einsatzfelder', lang: 'de', shown: 'de', name: 'Wofür KI heute eingesetzt wird' },
    { path: '/ki-einsatzfelder', lang: 'en', shown: 'en', name: 'What AI is used for today' },
    { path: '/ki-verstehen', lang: 'de', shown: 'de', name: 'KI verstehen' },
    { path: '/ki-verstehen', lang: 'en', shown: 'de', name: 'KI verstehen' },
    { path: '/impressum', lang: 'de', shown: 'de', name: 'Impressum' },
    { path: '/datenschutz', lang: 'en', shown: 'en', name: 'Privacy' },
    { path: '/themen/ai-audit', lang: 'de', shown: 'de', name: 'KI Readiness' },
    { path: '/themen/ai-audit', lang: 'en', shown: 'en', name: 'AI Readiness' },
    { path: '/themen/vibe-coding', lang: 'de', shown: 'de', name: await topicTitle('de') },
    { path: '/themen/vibe-coding', lang: 'en', shown: 'en', name: await topicTitle('en') },
    { path: `/themen/ai-audit/${dimension}`, lang: 'de', shown: dimDe.lang, name: dimDe.title },
    { path: `/themen/ai-audit/${dimension}`, lang: 'en', shown: dimEn.lang, name: dimEn.title },
  ];
  for (const p of pages) {
    const url = `/${p.lang}${p.path}`;
    const h = await head(request, url);
    const ld = one(h, url);
    expect(p.name.trim(), `Seitenname von ${url}`).not.toBe('');
    expect(h.meta.description.trim(), `Meta-Beschreibung von ${url}`).not.toBe('');
    expect(ld, `REQ-124-AC10: WebPage auf ${url}`).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: p.name,
      description: h.meta.description,
      url: `${baseURL}/${p.shown}${p.path}`,
      inLanguage: p.shown,
      isPartOf: website(baseURL!, p.shown),
    });
    expect(ld.url, `REQ-124-AC8: url entspricht canonical auf ${url}`).toBe(h.canonical);
    // REQ-124-AC11: Der Seitenname der strukturierten Daten ist der vorhandene Seitenname aus dem Tab-Titel.
    expect(h.title, `REQ-124-AC11: Tab-Titel von ${url} unverändert`).toBe(`${SITE} ${p.name}`);
    expect(h.meta['og:description'], `REQ-124-AC11: og:description von ${url}`).toBe(h.meta.description);
    expectDefaultImage(h, baseURL!, p.shown, url);
  }
  // REQ-124-AC8: Für KI verstehen wird keine englische Fassung behauptet.
  const only = await head(request, '/en/ki-verstehen');
  expect(only.hreflang, 'hreflang von /en/ki-verstehen').toEqual([`de ${baseURL}/de/ki-verstehen`, `x-default ${baseURL}/de/ki-verstehen`]);
});

test('REQ-124-AC4 REQ-124-AC5: Profilseite ist ProfilePage mit der Person Marvin Jakob', async ({ request, baseURL }) => {
  for (const lang of ['de', 'en'] as const) {
    const h = await head(request, `/${lang}/profil`);
    const ld = one(h, `/${lang}/profil`);
    expect(ld['@type']).toBe('ProfilePage');
    expect(ld.mainEntity, `REQ-124-AC4: mainEntity auf /${lang}/profil`).toEqual({ '@type': 'Person', name: 'Marvin Jakob', url: `${baseURL}/${lang}/profil` });
    expect(h.canonical).toBe(`${baseURL}/${lang}/profil`);
    expect(JSON.stringify(ld), 'REQ-124-AC2: kein Typ Organization').not.toContain('Organization');
    expectDefaultImage(h, baseURL!, lang, `/${lang}/profil`);
  }
});

test('REQ-124-AC2 REQ-124-AC3 REQ-124-AC8 REQ-124-AC9: Beitrag ohne Titelbild ist BlogPosting mit Daten aus der API, auch mit Sonderzeichen', async ({ page, request, posts, baseURL }) => {
  const tag = uid();
  // Nur deutsche Fassung; Titel und Zusammenfassung mit Anführungszeichen, <, > und </script> (REQ-124-AC9).
  const text = {
    ...fullText('de', tag),
    title: `"Zitat" <b>fett</b> </script><script>window.__req124 = 1</script> & ${tag}`,
    summary: `Kurz: </SCRIPT> "a" > b < c ${tag}`,
  };
  const post = await posts.create({ texts: [text] });
  await posts.publish(post.id);
  const api = (await (await request.get(`/api/posts/${post.slug}?lang=de`)).json()) as { title: string; summary: string; publishedAt: string; updatedAt: string };
  expect(api.title).toBe(text.title);
  expect(api.publishedAt, 'publishedAt aus der API ist ISO 8601').toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  expect(api.updatedAt, 'updatedAt aus der API ist ISO 8601').toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);

  const person = { '@type': 'Person', name: 'Marvin Jakob', url: `${baseURL}/de/profil` };
  // Auch unter /en/… wird die deutsche Fassung angezeigt und beschrieben (REQ-124-AC8).
  for (const lang of ['de', 'en'] as const) {
    const url = `/${lang}/blog/${post.slug}`;
    const h = await head(request, url);
    const ld = one(h, url);
    expect(ld, `REQ-124-AC2: BlogPosting auf ${url}`).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: text.title,
      description: text.summary,
      datePublished: api.publishedAt,
      dateModified: api.updatedAt,
      inLanguage: 'de',
      mainEntityOfPage: `${baseURL}/de/blog/${post.slug}`,
      image: baseURL + IMAGE,
      author: person,
      publisher: person,
    });
    expect(ld.mainEntityOfPage, 'REQ-124-AC8: mainEntityOfPage entspricht canonical').toBe(h.canonical);
    expect(h.hreflang.some((x) => x.startsWith('en ')), 'REQ-124-AC8: keine englische Fassung behauptet').toBe(false);
    expect(h.meta['article:published_time'], 'REQ-124-AC3').toBe(api.publishedAt);
    expect(h.meta['article:modified_time'], 'REQ-124-AC3').toBe(api.updatedAt);
    expect(h.title, 'REQ-124-AC11: Tab-Titel unverändert').toBe(`${SITE} ${text.title}`);
    expectDefaultImage(h, baseURL!, 'de', url);
    // REQ-124-AC9: Der Block endet erst an seinem eigenen schließenden Tag.
    expect(h.blocks[0], 'REQ-124-AC9: kein „<“ im JSON-LD-Block').not.toContain('<');
  }

  // REQ-124-AC9 im Browser: genau ein Block, als JSON lesbar, und der Text aus dem Titel wurde nicht ausgeführt.
  await page.goto(`/de/blog/${post.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(tag);
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  expect((JSON.parse((await scripts.textContent())!) as Json).headline).toBe(text.title);
  expect(await page.evaluate(() => (window as unknown as { __req124?: number }).__req124), 'Text aus dem Titel wurde nicht als Skript ausgeführt').toBeUndefined();
});

test('REQ-124-AC6 REQ-124-AC2: Titelbild des Beitrags hat Vorrang vor dem Standard-Vorschaubild', async ({ request, posts, editor, baseURL }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  const up = await editor.upload(`/api/admin/posts/${post.id}/cover`, { name: 'cover.png', mimeType: 'image/png', buffer: pngImage(64, 48) });
  expect(up.status(), await up.text()).toBe(200);
  // Zum Veröffentlichen verlangt die Redaktion einen Alternativtext des Titelbilds je Fassung.
  const save = await editor.send('PUT', `/api/admin/posts/${post.id}`, {
    featured: false,
    topics: [],
    texts: [
      { ...fullText('de', tag), coverAlt: `Testbild ${tag}` },
      { ...fullText('en', tag), coverAlt: `Test image ${tag}` },
    ],
  });
  expect(save.status(), await save.text()).toBe(200);
  await posts.publish(post.id);

  for (const lang of ['de', 'en'] as const) {
    const url = `/${lang}/blog/${post.slug}`;
    const h = await head(request, url);
    const cover = h.meta['og:image'];
    expect(cover, `REQ-124-AC6: og:image auf ${url} ist eine absolute Adresse`).toMatch(new RegExp(`^${baseURL}/`));
    expect(cover, 'REQ-124-AC6: nicht das Standard-Vorschaubild').not.toBe(baseURL + IMAGE);
    expect(h.html, 'REQ-124-AC6: Standard-Vorschaubild wird nicht genannt').not.toContain(IMAGE);
    expect(h.meta['twitter:image']).toBe(cover);
    expect(h.meta['twitter:card']).toBe('summary_large_image');
    const image = await request.get(cover);
    expect(image.status(), 'Titelbild ist abrufbar').toBe(200);
    expect(image.headers()['content-type']).toMatch(/^image\//);
    const ld = one(h, url);
    expect(ld, 'REQ-124-AC2: image nennt das Titelbild, Sprache und Profil der angezeigten Fassung').toMatchObject({
      '@type': 'BlogPosting',
      headline: fullText(lang, tag).title,
      description: fullText(lang, tag).summary,
      image: cover,
      inLanguage: lang,
      mainEntityOfPage: `${baseURL}/${lang}/blog/${post.slug}`,
      author: { '@type': 'Person', name: 'Marvin Jakob', url: `${baseURL}/${lang}/profil` },
      publisher: { '@type': 'Person', name: 'Marvin Jakob', url: `${baseURL}/${lang}/profil` },
    });
  }
});

test('REQ-124-AC7: nicht indexierbare Seiten bleiben ohne strukturierte Daten, mit noindex und bisherigem Statuscode', async ({ request, posts, editor }) => {
  const tag = uid();
  const draft = await posts.create({ texts: [fullText('de', `entwurf-${tag}`)] });
  const planned = await posts.create({ texts: [fullText('de', `geplant-${tag}`)] });
  const at = new Date(Date.now() + 24 * 3600_000).toISOString();
  expect((await editor.send('PUT', `/api/admin/posts/${planned.id}/schedule`, { publishAt: at })).status()).toBe(200);

  const cases: [string, number][] = [
    ['/de/gibt-es-nicht', 404],
    ['/en/gibt-es-nicht', 404],
    [`/de/blog/${draft.slug}`, 404],
    [`/de/blog/${planned.slug}`, 404],
    ['/de/themen/ai-audit/auswertung', 200],
    ['/en/themen/ai-audit/auswertung', 200],
  ];
  for (const [url, status] of cases) {
    const h = await head(request, url, status);
    expect(h.count, `REQ-124-AC7: kein JSON-LD-Block auf ${url}`).toBe(0);
    expect(h.meta.robots, `REQ-124-AC7: noindex auf ${url}`).toBe('noindex');
  }
});

test('REQ-124-AC10 (S1): veröffentlichter Themenartikel ist WebPage mit seinem Titel', async ({ editor, request, baseURL }) => {
  const title = `Thema ${uid()}`;
  const de = { title, subtitle: 'Unterzeile für die Beschreibung', blocks: [{ kind: 'paragraph', text: 'Anfang' }] };
  const created = await editor.send('POST', '/api/admin/articles', { de, status: 'draft' });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  try {
    expect((await editor.send('PUT', `/api/admin/articles/${id}`, { de, status: 'published' })).ok()).toBe(true);
    const url = `/de/themenartikel/${id}`;
    const h = await head(request, url);
    expect(one(h, url)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: 'Unterzeile für die Beschreibung',
      url: baseURL + url,
      inLanguage: 'de',
      isPartOf: website(baseURL!, 'de'),
    });
    expect(h.meta.description).toBe('Unterzeile für die Beschreibung');
    expectDefaultImage(h, baseURL!, 'de', url);
  } finally {
    await editor.send('DELETE', `/api/admin/articles/${id}`);
  }
});

test('REQ-124-AC11: sichtbarer Inhalt und Kopfangaben der Startseite bleiben beim Direktaufruf erhalten', async ({ page, request, baseURL }) => {
  // Sollwerte: Messung der Produktionsseite vom 20.11.2026 vor der Umsetzung (Ticket #124, Spezifikation).
  const soll = {
    de: { desc: 'Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.', social: 'KI verstehen. Sinnvoll einsetzen. · KI Perspektiven' },
    en: { desc: 'Practical knowledge for the professional use of AI. With a clear view of benefits, limits and responsibility.', social: 'Understand AI. Use it wisely. · KI Perspektiven' },
  } as const;
  for (const lang of ['de', 'en'] as const) {
    const h = await head(request, `/${lang}`);
    expect(
      { title: h.title, desc: h.meta.description, canonical: h.canonical, hreflang: h.hreflang, ogTitle: h.meta['og:title'], ogDesc: h.meta['og:description'] },
      `Kopfangaben von /${lang}`,
    ).toEqual({
      title: SITE,
      desc: soll[lang].desc,
      canonical: `${baseURL}/${lang}`,
      hreflang: [`de ${baseURL}/de`, `en ${baseURL}/en`, `x-default ${baseURL}/de`],
      ogTitle: soll[lang].social,
      ogDesc: soll[lang].desc,
    });
    // Im Browser kommt kein sichtbares Element hinzu: Der JSON-LD-Block steht im <head>, das Vorschaubild erscheint nicht.
    await page.goto(`/${lang}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('head script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('body script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator(`img[src*="vorschaubild"]`)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(ALT[lang]);
  }
});

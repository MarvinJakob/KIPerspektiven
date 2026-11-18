import { expect, expectNoHorizontalScroll, fullText, pngImage, test, uid } from '../support/fixtures';

// Anforderung #20: Veröffentlichte Blogbeiträge aufrufen und lesen.
interface Summary {
  slug: string;
  publishedAt: string;
}

test('REQ-20-AC1: Übersicht zeigt nur veröffentlichte Beiträge, neueste zuerst, mit Links zur Detailseite', async ({ page, request }) => {
  const items = ((await (await request.get('/api/posts?lang=de')).json()) as { items: Summary[] }).items;
  expect(items.length).toBeGreaterThan(1);
  const dates = items.map((p) => Date.parse(p.publishedAt));
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  // Der Entwurf aus den Testdaten fehlt
  expect(items.map((p) => p.slug)).not.toContain('entwurf-ki-in-der-datenanalyse');

  await page.goto('/de/blog');
  const links = page.locator('main a.post-row');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  // Die Oberfläche folgt der Reihenfolge der veröffentlichten Beiträge
  expect(hrefs.filter((h) => items.some((p) => h === `/de/blog/${p.slug}`))).toEqual(
    items.filter((p) => hrefs.includes(`/de/blog/${p.slug}`)).map((p) => `/de/blog/${p.slug}`),
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(items.length);
});

test('REQ-20-AC2: Beitragsseite zeigt Titel, Inhalt, Datum, Lesezeit, Titelbild und Themen', async ({ page, posts, editor }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag)], topics: ['softwareentwicklung'] });
  const up = await editor.upload(`/api/admin/posts/${post.id}/cover`, { name: 'cover.png', mimeType: 'image/png', buffer: pngImage(64, 48) });
  expect(up.status(), await up.text()).toBe(200);
  const save = await editor.send('PUT', `/api/admin/posts/${post.id}`, {
    featured: false,
    topics: ['softwareentwicklung'],
    texts: [{ ...fullText('de', tag), coverAlt: `Testbild ${tag}` }],
  });
  expect(save.status(), await save.text()).toBe(200);
  await posts.publish(post.id);

  await page.goto(`/de/blog/${post.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Testbeitrag ${tag}`);
  await expect(page.locator('main')).toContainText(`Beitragstext ${tag}`);
  await expect(page.locator('main time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  await expect(page.locator('main')).toContainText(/\d+ Min\. Lesezeit/);
  const cover = page.getByRole('img', { name: `Testbild ${tag}` });
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('main a[href="/de/themen/softwareentwicklung"]').first()).toBeVisible();
});

test('REQ-20-AC3: Entwürfe, noch nicht fällige Beiträge und unbekannte Kürzel bleiben unsichtbar', async ({ page, request, posts, editor }) => {
  const tag = uid();
  const draft = await posts.create({ texts: [fullText('de', `entwurf-${tag}`)] });
  const planned = await posts.create({ texts: [fullText('de', `geplant-${tag}`)] });
  const at = new Date(Date.now() + 24 * 3600_000).toISOString();
  expect((await editor.send('PUT', `/api/admin/posts/${planned.id}/schedule`, { publishAt: at })).status()).toBe(200);

  const list = await (await request.get('/api/posts?lang=de')).text();
  for (const p of [draft, planned]) {
    expect((await request.get(`/api/posts/${p.slug}?lang=de`)).status()).toBe(404);
    expect(list).not.toContain(p.slug);
    const html = await request.get(`/de/blog/${p.slug}`);
    expect(await html.text()).not.toContain(tag);
  }
  await page.goto(`/de/blog/${draft.slug}`);
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(tag);
  await page.goto(`/de/blog/gibt-es-nicht-${tag}`);
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
});

test('REQ-20-AC4 REQ-24-AC5: Beitrag ohne Übersetzung erscheint in der anderen Sprache mit Hinweis', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag)] });
  await posts.publish(post.id);
  await page.goto(`/en/blog/${post.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Testbeitrag ${tag}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('lang', 'de');
  await expect(page.locator('main')).toContainText('This article is not available in English. You are reading the German version.');
});

test('REQ-20-AC5: leere Übersicht und Ladefehler mit erneutem Versuch', async ({ page }) => {
  await page.route('**/api/posts?*', (r) => r.fulfill({ json: { items: [] } }));
  await page.goto('/de/blog');
  await expect(page.getByRole('heading', { name: 'Noch keine Beiträge' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Bisher ist noch kein Beitrag erschienen.');

  await page.unrouteAll();
  let fail = true;
  await page.route('**/api/posts?*', (r) => (fail ? r.fulfill({ status: 500, json: { message: 'kaputt' } }) : r.continue()));
  await page.goto('/en/blog');
  await expect(page.getByRole('alert')).toContainText('Content could not be loaded');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('main a.post-row').first()).toBeVisible();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`${viewport.width} px`, () => {
    test.use({ viewport });
    test(`REQ-20-AC6: Blog und Beitrag bleiben lesbar und bedienbar (${viewport.width} px)`, async ({ page }) => {
      // Beitrag aus den Testdaten, damit parallel angelegte Beiträge den Ablauf nicht beeinflussen
      const first = { slug: 'ki-veraendert-softwareteams' };
      await page.goto('/de/blog');
      await expect(page.locator('main a.post-row').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      // Tastatur: der erste Beitrag ist per Fokus und Enter erreichbar
      await page.locator(`main a[href="/de/blog/${first.slug}"]`).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/de/blog/${first.slug}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
      for (const img of await page.locator('main img').all()) {
        const box = await img.boundingBox();
        if (box) expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
    });
  });
}

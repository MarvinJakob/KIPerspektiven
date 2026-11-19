// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Posts.tsx app/frontend-redaktion/src/pages/EditPost.tsx
import { AUTH, expect, fullText, pngImage, test, uid, type EditorPost } from '../support/fixtures';

// Anforderung #21: Blogbeiträge im geschützten Redaktionssystem verwalten.

test('REQ-21-AC1: ohne Sitzung verlangt die Oberfläche eine Anmeldung und die API verweigert den Zugriff', async ({ page, request, editor, admin }) => {
  await page.goto('/redaktion');
  await expect(page).toHaveURL(/\/redaktion\/anmelden$/);
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();

  expect((await request.get('/api/admin/posts')).status()).toBe(401);
  expect((await request.post('/api/admin/posts', { data: { featured: false, topics: [], texts: [] } })).status()).toBe(401);
  // Rollen editor und admin dürfen Beiträge verwalten
  expect((await editor.get('/api/admin/posts')).status()).toBe(200);
  expect((await admin.get('/api/admin/posts')).status()).toBe(200);
});

test.describe('angemeldet in der Oberfläche', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-21-AC2: Entwurf mit Titel speichern, „In Arbeit“ in der Liste, öffentlich unsichtbar, Eingaben bleiben', async ({ page, request, editor }) => {
    const title = `Entwurf ${uid()}`;
    await page.goto('/redaktion/beitraege/neu');
    await page.getByLabel('Titel', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert. Der Beitrag bleibt „In Arbeit“.' })).toBeVisible();
    await expect(page).toHaveURL(/\/redaktion\/beitraege\/\d+$/);
    const id = Number(page.url().split('/').pop());

    try {
      await page.reload();
      await expect(page.getByLabel('Titel', { exact: true })).toHaveValue(title);
      await page.goto('/redaktion');
      const row = page.getByRole('row').filter({ hasText: title });
      await expect(row).toContainText('In Arbeit');

      const post = (await (await editor.get(`/api/admin/posts/${id}`)).json()) as EditorPost;
      expect(post.status).toBe('draft');
      expect((await request.get(`/api/posts/${post.slug}?lang=de`)).status()).toBe(404);
    } finally {
      await editor.send('DELETE', `/api/admin/posts/${id}`);
    }
  });

  test('REQ-21-AC7: Titelbild in der Oberfläche hochladen; unzulässige Datei wird mit Meldung abgelehnt', async ({ page, posts }) => {
    const post = await posts.create({ texts: [fullText('de', uid())] });
    await page.goto(`/redaktion/beitraege/${post.id}`);
    await page.getByLabel('Bild hochladen').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('kein Bild') });
    await expect(page.getByRole('alert')).toContainText('Dieser Dateityp wird nicht unterstützt');

    await page.getByLabel('Bild hochladen').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: pngImage(40, 30) });
    await expect(page.getByRole('status').filter({ hasText: 'Titelbild gespeichert.' })).toBeVisible();
    const preview = page.locator('img.cover-preview');
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  });
});

test('REQ-21-AC3: Sprachfassungen bleiben getrennt, Kürzel entstehen aus dem Titel und Kollisionen werden aufgelöst', async ({ editor, posts }) => {
  const tag = uid();
  const de = { lang: 'de' as const, title: `Gleicher Titel ${tag}`, summary: 'Deutsch kurz', bodyMarkdown: 'Deutscher Text' };
  const en = { lang: 'en' as const, title: `English ${tag}`, summary: 'English short', bodyMarkdown: 'English text' };
  const a = await posts.create({ texts: [de, en], topics: ['softwareentwicklung'] });
  const b = await posts.create({ texts: [de] });

  expect(a.slug).toBe(`gleicher-titel-${tag}`);
  expect(b.slug).not.toBe(a.slug);
  expect(b.slug.startsWith(a.slug)).toBe(true);

  const loaded = (await (await editor.get(`/api/admin/posts/${a.id}`)).json()) as EditorPost;
  expect(loaded.topics).toEqual(['softwareentwicklung']);
  expect(loaded.texts.find((t) => t.lang === 'de')).toMatchObject(de);
  expect(loaded.texts.find((t) => t.lang === 'en')).toMatchObject(en);

  // Ändern einer Fassung lässt die andere unverändert
  const res = await editor.send('PUT', `/api/admin/posts/${a.id}`, {
    featured: false,
    topics: [],
    slug: a.slug,
    texts: [{ ...de, title: `Neu ${tag}` }, en],
  });
  expect(res.status(), await res.text()).toBe(200);
  const after = (await res.json()) as EditorPost;
  expect(after.texts.find((t) => t.lang === 'en')).toMatchObject(en);
  expect(after.topics).toEqual([]);
  // Ausdrücklich vergebenes, bereits belegtes Kürzel wird abgelehnt
  expect((await editor.send('PUT', `/api/admin/posts/${b.id}`, { featured: false, topics: [], slug: a.slug, texts: [de] })).status()).toBe(409);
});

test('REQ-21-AC4: vollständiger Beitrag wird öffentlich, unvollständiger mit Meldung abgelehnt', async ({ editor, posts, request }) => {
  const tag = uid();
  const complete = await posts.create({ texts: [fullText('de', tag)] });
  const incomplete = await posts.create({ texts: [{ lang: 'de', title: `Ohne Text ${tag}`, summary: 'kurz', bodyMarkdown: '' }] });

  await posts.publish(complete.id);
  expect((await request.get(`/api/posts/${complete.slug}?lang=de`)).status()).toBe(200);

  const res = await editor.send('POST', `/api/admin/posts/${incomplete.id}/publish`);
  expect(res.status()).toBe(422);
  expect(((await res.json()) as { message: string }).message.length).toBeGreaterThan(0);
  const kept = (await (await editor.get(`/api/admin/posts/${incomplete.id}`)).json()) as EditorPost;
  expect(kept.status).toBe('draft');
  expect(kept.texts[0]).toMatchObject({ title: `Ohne Text ${tag}`, summary: 'kurz' });
  expect((await request.get(`/api/posts/${incomplete.slug}?lang=de`)).status()).toBe(404);
});

// REQ-21-AC5 (geplante Veröffentlichung) prüfen seit #94 die Go-Tests in app/backend/internal/service/editorial_test.go
// (Termin in der Vergangenheit, Veröffentlichung zum Termin) und der Fidelity-Test REQ-84-AC2 AC3 AC4 in 84-minuten.spec.ts
// (automatische Veröffentlichung im regulären Betrieb über die öffentliche Schnittstelle).

test('REQ-21-AC6: Zurücknehmen entfernt den Beitrag öffentlich, er bleibt bearbeitbar und behält sein erstes Datum', async ({ editor, posts, request }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag)] });
  const first = await posts.publish(post.id);

  const res = await editor.send('POST', `/api/admin/posts/${post.id}/unpublish`);
  expect(res.status()).toBe(200);
  expect(((await res.json()) as EditorPost).status).toBe('draft');
  expect((await request.get(`/api/posts/${post.slug}?lang=de`)).status()).toBe(404);
  expect(await (await request.get('/api/posts?lang=de')).text()).not.toContain(post.slug);

  const edit = await editor.send('PUT', `/api/admin/posts/${post.id}`, { featured: false, topics: [], slug: post.slug, texts: [{ ...fullText('de', tag), title: `Überarbeitet ${tag}` }] });
  expect(edit.status()).toBe(200);

  const again = await posts.publish(post.id);
  expect(again.publishedAt).toBe(first.publishedAt);
  const pub = (await (await request.get(`/api/posts/${post.slug}?lang=de`)).json()) as { title: string; publishedAt: string };
  expect(pub.title).toBe(`Überarbeitet ${tag}`);
  expect(pub.publishedAt).toBe(first.publishedAt);
});

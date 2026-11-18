// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/Posts.tsx app/frontend-redaktion/src/pages/EditPost.tsx
import { ACCOUNTS, AUTH, expect, expectNoHorizontalScroll, fullText, pngImage, test, uid, type EditorPost } from '../support/fixtures';

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

  test('REQ-21-AC4: unvollständige Veröffentlichung zeigt eine Fehlermeldung und erhält die Eingaben', async ({ page, editor, request }) => {
    const title = `Unvollständig ${uid()}`;
    await page.goto('/redaktion/beitraege/neu');
    await page.getByLabel('Titel', { exact: true }).fill(title);
    await page.getByLabel('Kurztext').fill('Nur ein Kurztext');
    await page.getByRole('button', { name: 'Veröffentlichen' }).click();
    await expect(page.getByRole('alert')).not.toBeEmpty();
    await expect(page.getByLabel('Titel', { exact: true })).toHaveValue(title);
    await expect(page.getByLabel('Kurztext')).toHaveValue('Nur ein Kurztext');

    const list = (await (await editor.get('/api/admin/posts')).json()) as { items: { id: number; title: string; status: string; slug: string }[] };
    const saved = list.items.find((p) => p.title === title);
    if (saved) {
      expect(saved.status).toBe('draft');
      expect((await request.get(`/api/posts/${saved.slug}?lang=de`)).status()).toBe(404);
      await editor.send('DELETE', `/api/admin/posts/${saved.id}`);
    }
  });

  test('REQ-21-AC5: nicht existierende Ortszeiten werden abgelehnt, doppeldeutige verlangen eine Auswahl', async ({ page, posts }) => {
    const post = await posts.create({ texts: [fullText('de', uid())] });
    await page.goto(`/redaktion/beitraege/${post.id}`);
    const input = page.getByLabel('Datum und Uhrzeit');
    const save = page.getByRole('button', { name: 'Zeitpunkt speichern' });

    // Umstellung auf Sommerzeit: 28.03.2027, 02:00–03:00 Uhr gibt es in Europe/Berlin nicht
    await input.fill('2027-03-28T02:30');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('wegen der Umstellung auf Sommerzeit nicht');

    // Umstellung auf Winterzeit: 31.10.2027, 02:30 Uhr gibt es zweimal
    await input.fill('2027-10-31T02:30');
    const choice = page.getByRole('group', { name: /zweimal/ });
    await expect(choice.getByRole('radio')).toHaveCount(2);
    await save.click();
    await expect(page.getByRole('alert')).toContainText('Bitte wählen Sie, welche gemeint ist.');
    await choice.getByRole('radio').first().check();
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Geplant:' })).toBeVisible();
    // Erstes Mal 02:30 Sommerzeit = 00:30 UTC
    await expect.poll(async () => ((await (await page.request.get(`/api/admin/posts/${post.id}`)).json()) as EditorPost).scheduledAt).toBe(
      '2027-10-31T00:30:00Z',
    );
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

  test('REQ-21-AC8: ungespeicherte Änderungen warnen beim Verlassen, Speicherfehler und abgelaufene Sitzung werden gemeldet', async ({ page, posts }) => {
    const post = await posts.create({ texts: [fullText('de', uid())] });
    await page.goto(`/redaktion/beitraege/${post.id}`);
    await page.getByLabel('Titel', { exact: true }).fill('Geänderter Titel');

    // Verlassen löst die Warnung des Browsers aus; nach dem Bestätigen wird die Seite neu geladen.
    const dialog = new Promise<string>((resolve) => page.once('dialog', (d) => (resolve(d.type()), void d.accept())));
    await page.reload();
    expect(await dialog).toBe('beforeunload');
    // Ohne Änderungen warnt die Seite nicht.
    let warned = false;
    page.on('dialog', (d) => ((warned = true), void d.accept()));
    await page.getByLabel('Titel', { exact: true }).waitFor();
    await page.reload();
    expect(warned).toBe(false);
    await page.getByLabel('Titel', { exact: true }).fill('Geänderter Titel');

    await page.route(`**/api/admin/posts/${post.id}`, (r) => (r.request().method() === 'PUT' ? r.fulfill({ status: 500, json: { message: 'x' } }) : r.continue()));
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Speichern ist gerade nicht möglich. Bitte erneut versuchen.');

    // Der Beitrag wurde nicht verändert
    const stored = (await (await page.request.get(`/api/admin/posts/${post.id}`)).json()) as EditorPost;
    expect(stored.texts[0].title).toBe(post.texts[0].title);
  });

  test.describe('mobil', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('REQ-21-AC8: veröffentlichter Beitrag mit Titelbild passt auf 375 px ohne horizontalen Bildlauf (Bug #33)', async ({ page, posts, editor }) => {
      const tag = uid();
      const post = await posts.create({ texts: [fullText('de', tag)] });
      expect((await editor.upload(`/api/admin/posts/${post.id}/cover`, { name: 'c.png', mimeType: 'image/png', buffer: pngImage(64, 48) })).status()).toBe(200);
      expect((await editor.send('PUT', `/api/admin/posts/${post.id}`, { featured: false, topics: [], slug: post.slug, texts: [{ ...fullText('de', tag), coverAlt: 'Bild' }] })).status()).toBe(200);
      await posts.publish(post.id);

      await page.goto(`/redaktion/beitraege/${post.id}`);
      await expect(page.getByRole('button', { name: 'Veröffentlichung zurücknehmen' })).toBeVisible();
      await expectNoHorizontalScroll(page);
      for (const el of [page.getByRole('button', { name: 'Veröffentlichung zurücknehmen' }), page.getByRole('button', { name: 'Bild entfernen' })]) {
        const box = (await el.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(375);
      }
    });

    test('REQ-21-AC8: Beitrag auf 375 px nur mit der Tastatur anlegen, speichern und alle Aktionen erreichen', async ({ page, editor }) => {
      const title = `Mobil ${uid()}`;
      await page.goto('/redaktion');
      await page.getByRole('link', { name: 'Neuer Beitrag' }).focus();
      await page.keyboard.press('Enter');
      await page.getByLabel('Titel', { exact: true }).focus();
      await page.keyboard.type(title);
      await page.keyboard.press('Enter'); // sendet das Formular
      await expect(page).toHaveURL(/\/redaktion\/beitraege\/\d+$/);
      const id = Number(page.url().split('/').pop());
      try {
        await expect(page.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();
        for (const el of [page.getByRole('button', { name: 'Veröffentlichen' }), page.getByRole('button', { name: 'Zeitpunkt speichern' }), page.getByLabel('Bild hochladen')]) {
          await el.scrollIntoViewIfNeeded();
          await expect(el).toBeInViewport();
          await expect(el).toBeEnabled();
        }
        await expectNoHorizontalScroll(page); // Bug #33
      } finally {
        await editor.send('DELETE', `/api/admin/posts/${id}`);
      }
    });
  });
});

test('REQ-21-AC8: abgelaufene Sitzung führt beim Speichern sichtbar zur erneuten Anmeldung', async ({ page, posts, login }) => {
  const post = await posts.create({ texts: [fullText('de', uid())] });
  // Eigene Sitzung, damit die gemeinsam genutzte Testsitzung gültig bleibt
  const { session } = await login(ACCOUNTS.editor.email, ACCOUNTS.editor.password);
  await page.context().addCookies((await session!.ctx.storageState()).cookies);
  await page.goto(`/redaktion/beitraege/${post.id}`);
  await page.getByLabel('Titel', { exact: true }).fill('Nach Ablauf');
  expect((await session!.send('POST', '/api/auth/logout')).status()).toBe(204);

  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  const stored = (await (await session!.ctx.get('/api/auth/me')).status());
  expect(stored).toBe(401);

  await page.getByLabel('E-Mail-Adresse').fill(ACCOUNTS.editor.email);
  await page.getByLabel('Passwort').fill(ACCOUNTS.editor.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
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

test('REQ-21-AC7: Titelbild bis 5 MB hochladen, ersetzen und entfernen; unzulässige Dateien werden abgelehnt', async ({ editor, posts }) => {
  const post = await posts.create({ texts: [fullText('de', uid())] });
  const url = `/api/admin/posts/${post.id}/cover`;

  const up = await editor.upload(url, { name: 'a.png', mimeType: 'image/png', buffer: pngImage(32, 24) });
  expect(up.status(), await up.text()).toBe(200);
  const firstSrc = ((await up.json()) as EditorPost).cover!.src;

  const replaced = await editor.upload(url, { name: 'b.png', mimeType: 'image/png', buffer: pngImage(48, 24, [10, 60, 120]) });
  expect(replaced.status()).toBe(200);
  const secondSrc = ((await replaced.json()) as EditorPost).cover!.src;
  expect(secondSrc).not.toBe(firstSrc);
  expect(((await (await editor.get(`/api/admin/posts/${post.id}`)).json()) as EditorPost).cover!.src).toBe(secondSrc);

  const text = await editor.upload(url, { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('kein Bild') });
  expect(text.status()).toBe(422);
  expect(((await text.json()) as { message: string }).message.length).toBeGreaterThan(0);
  const tooBig = await editor.upload(url, { name: 'gross.png', mimeType: 'image/png', buffer: Buffer.concat([pngImage(), Buffer.alloc(5 * 1024 * 1024)]) });
  expect([413, 422]).toContain(tooBig.status());
  // Abgelehnte Dateien ändern den gespeicherten Stand nicht
  expect(((await (await editor.get(`/api/admin/posts/${post.id}`)).json()) as EditorPost).cover!.src).toBe(secondSrc);

  const removed = await editor.send('DELETE', url);
  expect(removed.status()).toBe(200);
  expect(((await (await editor.get(`/api/admin/posts/${post.id}`)).json()) as EditorPost).cover).toBeUndefined();
});

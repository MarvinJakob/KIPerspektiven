// Abdeckung: app/frontend-redaktion/src/pages/EditPost.tsx app/backend/internal/service/editorial.go
import { AUTH, expect, fullText, test, uid } from '../support/fixtures';

test.describe('Zeitpunkt im Editor', () => {
  test.use({ storageState: AUTH.editor });

  for (const width of [375, 1280]) {
    test(`REQ-84-AC1: Minute und gewählte Zeitzone bei ${width}px wieder öffnen`, async ({ page, posts }) => {
      await page.setViewportSize({ width, height: 800 });
      const post = await posts.create({ texts: [fullText('de', uid())] });
      await page.goto(`/redaktion/beitraege/${post.id}`);
      const input = page.getByLabel('Datum und Uhrzeit');
      await input.fill('2030-10-27T02:37');
      const winter = page.getByRole('radio', { name: /zweites Mal/ });
      await winter.focus();
      await page.keyboard.press('Space');
      const save = page.getByRole('button', { name: 'Zeitpunkt speichern' });
      await save.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Geplant:' })).toContainText('01:37 UTC');
      await page.reload();
      await expect(input).toHaveValue('2030-10-27T02:37');
      await expect(page.getByText(/Geplant für .*01:37 UTC/)).toBeVisible();
      await expect(winter).toBeChecked();
    });
  }

  test('REQ-84-AC4 AC5: Termin ändern, ungültigen Versuch abweisen und Termin entfernen', async ({ page, editor, posts }) => {
    const post = await posts.create({ texts: [fullText('de', uid())] });
    const url = `/api/admin/posts/${post.id}`;
    await page.goto(`/redaktion/beitraege/${post.id}`);
    const input = page.getByLabel('Datum und Uhrzeit');
    await input.fill('2030-01-17T10:37');
    await page.getByRole('button', { name: 'Zeitpunkt speichern' }).click();
    const change = page.getByRole('button', { name: 'Zeitpunkt ändern' });
    await expect(change).toBeVisible();
    await input.fill('2030-01-17T10:38');
    await change.click();
    // Erst nach der Bestätigung in der Oberfläche weiter: Die Antwort setzt das Eingabefeld auf den gespeicherten
    // Zeitpunkt zurück und würde eine schon getippte neue Eingabe überschreiben (Befund im CI-Lauf 44343394571).
    await expect(page.getByRole('status').filter({ hasText: 'Geplant:' })).toContainText('09:38 UTC');
    await expect.poll(async () => (await (await editor.get(url)).json()).scheduledAt).toBe('2030-01-17T09:38:00Z');
    await input.fill('2000-01-01T12:00');
    await change.click();
    await expect(page.getByRole('alert')).toContainText('Vergangenheit');
    expect((await (await editor.get(url)).json()).scheduledAt).toBe('2030-01-17T09:38:00Z');
    await page.getByRole('button', { name: 'Zeitpunkt entfernen' }).click();
    await expect(input).toHaveValue('');
    await page.getByLabel('Kurztext').fill('');
    await input.fill('2030-01-17T10:37');
    await page.getByRole('button', { name: 'Zeitpunkt speichern' }).click();
    await expect(page.getByRole('alert')).toContainText(/Kurztext|vollständig/i);
    expect((await (await editor.get(url)).json()).scheduledAt).toBeFalsy();
  });
});

test('REQ-84-AC2 AC3 AC4: Geänderte Minute gilt öffentlich, aufgehobener Termin bleibt verborgen', async ({ editor, posts, request, page }) => {
  // Die Zeitregeln (Minute, Termin als Datum, geänderter und aufgehobener Termin) prüfen mit gesteuerter Uhr die Go-Tests
  // in app/backend/internal/service/editorial_test.go. Hier zählt der reguläre Betrieb: Der Hintergrundjob läuft alle 15 s.
  // Ein Termin wenige Sekunden in der Zukunft genügt dafür; das Warten auf eine volle Minute kostete bis zu 75 s (#94).
  test.setTimeout(90_000); // Ein nicht übernommener geänderter Termin soll an der Sichtbarkeitsprüfung scheitern, nicht am Testzeitlimit.
  const topic = 'softwareentwicklung';
  const makePost = () => posts.create({ texts: [fullText('de', uid()), fullText('en', uid())], topics: [topic] });
  const post = await makePost();
  const cancelled = await makePost();
  // Ganze Sekunde mit 5 s Vorlauf für die Prüfungen vor dem Termin; der Server speichert Termine sekundengenau.
  const due = Math.ceil((Date.now() + 5_000) / 1_000) * 1_000;
  const schedule = async (id: number, time: number) => {
    const response = await editor.send('PUT', `/api/admin/posts/${id}/schedule`, { publishAt: new Date(time).toISOString() });
    expect(response.status(), await response.text()).toBe(200);
  };
  await schedule(post.id, due + 60_000);
  await schedule(post.id, due);
  await schedule(cancelled.id, due);
  expect((await editor.send('DELETE', `/api/admin/posts/${cancelled.id}/schedule`)).ok()).toBe(true);
  for (const lang of ['de', 'en']) {
    for (const path of [`/api/posts?lang=${lang}`, `/api/topics/${topic}?lang=${lang}`, '/sitemap.xml']) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain(post.slug);
    }
    for (const path of [`/${lang}/blog/${post.slug}`, `/api/posts/${post.slug}?lang=${lang}`]) {
      expect((await request.get(path)).status()).toBe(404);
    }
  }
  expect(Date.now(), 'Prüfungen vor dem Termin abgeschlossen').toBeLessThan(due);
  await expect.poll(async () => (await request.get(`/api/posts/${post.slug}?lang=de`)).status(), {
    timeout: due + 60_000 - Date.now(), intervals: [1000],
  }).toBe(200);
  const firstVisible = Date.now();
  expect(firstVisible).toBeGreaterThanOrEqual(due);
  expect(firstVisible).toBeLessThan(due + 60_000);
  const published = await (await editor.get(`/api/admin/posts/${post.id}`)).json();
  expect(Date.parse(published.publishedAt)).toBe(due);
  for (const lang of ['de', 'en']) {
    await page.goto(`/${lang}/blog`);
    const link = page.locator(`main a[href="/${lang}/blog/${post.slug}"]`).first();
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.texts.find(t => t.lang === lang)!.title);
    expect((await request.get(`/${lang}/blog/${cancelled.slug}`)).status()).toBe(404);
  }
});


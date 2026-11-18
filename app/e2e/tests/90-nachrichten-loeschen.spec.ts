// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend-redaktion/src/pages/ContactMessages.tsx app/frontend-redaktion/src/api/contactMessages.ts
import type { APIRequestContext } from '@playwright/test';
import { AUTH, expect, test, uid, type Session } from '../support/fixtures';

// Anforderung #90: einzelne Kontaktnachrichten in der Redaktion löschen (REQ-90-AC2, REQ-90-AC3).
// Die fristgerechte automatische Löschung prüfen die Go-Tests in internal/service/retention_test.go.
interface Message {
  id: number;
  name: string;
}
const inbox = async (s: Session) => ((await (await s.get('/api/admin/contact-messages')).json()) as { items: Message[] }).items;

async function send(request: APIRequestContext, name: string) {
  const data = { name, email: `${uid()}@example.org`, message: `Nachricht von ${name}`, lang: 'de' };
  expect((await request.post('/api/contact-messages', { data })).status()).toBe(204);
}

async function idOf(s: Session, name: string) {
  const m = (await inbox(s)).find((x) => x.name === name);
  expect(m, `Nachricht ${name} gespeichert`).toBeDefined();
  return m!.id;
}

test('REQ-90-AC3: Löschendpunkt ohne Anmeldung 401, ohne CSRF-Token 403; die Nachricht bleibt gespeichert', async ({ request, marketing }) => {
  const name = `Bleibt ${uid()}`;
  await send(request, name);
  const id = await idOf(marketing, name);

  expect((await request.delete(`/api/admin/contact-messages/${id}`)).status()).toBe(401);
  expect((await marketing.ctx.delete(`/api/admin/contact-messages/${id}`)).status()).toBe(403);
  expect((await marketing.ctx.delete(`/api/admin/contact-messages/${id}`, { headers: { 'X-CSRF-Token': 'falsch' } })).status()).toBe(403);
  expect((await inbox(marketing)).some((m) => m.id === id)).toBe(true);
});

test('REQ-90-AC2: Marketing und Admin löschen genau eine Nachricht, Redakteur erhält 403, erneutes Löschen 404', async ({ request, marketing, admin, editor }) => {
  const tag = uid();
  for (const n of ['A', 'B', 'C']) await send(request, `${n} ${tag}`);
  const [a, b, c] = [await idOf(admin, `A ${tag}`), await idOf(admin, `B ${tag}`), await idOf(admin, `C ${tag}`)];

  expect((await editor.send('DELETE', `/api/admin/contact-messages/${a}`)).status()).toBe(403);
  expect((await marketing.send('DELETE', `/api/admin/contact-messages/${a}`)).status()).toBe(204);
  expect((await admin.send('DELETE', `/api/admin/contact-messages/${b}`)).status()).toBe(204);
  expect((await admin.send('DELETE', `/api/admin/contact-messages/${b}`)).status()).toBe(404);

  const mine = (await inbox(admin)).filter((m) => m.name.endsWith(tag));
  expect(mine.map((m) => m.id)).toEqual([c]);
});

test.describe('Löschen in der Nachrichtenliste', () => {
  test.use({ storageState: AUTH.marketing });

  test('REQ-90-AC2: Löschen nach Bestätigung entfernt die Nachricht aus Liste und Datenbank, Abbrechen behält sie', async ({ page, request, marketing }) => {
    const tag = uid();
    const [gone, kept] = [`Weg ${tag}`, `Da ${tag}`];
    await send(request, kept);
    await send(request, gone);
    await page.goto('/redaktion/nachrichten');
    const item = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });

    await item(gone).getByRole('button', { name: `Nachricht von ${gone} löschen` }).click();
    await expect(item(gone).getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await item(gone).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(item(gone)).toBeVisible();
    expect((await inbox(marketing)).some((m) => m.name === gone)).toBe(true);

    await item(gone).getByRole('button', { name: `Nachricht von ${gone} löschen` }).click();
    await item(gone).getByRole('button', { name: `Nachricht von ${gone} endgültig löschen` }).click();
    await expect(page.getByRole('status')).toHaveText(`Die Nachricht von ${gone} wurde gelöscht.`);
    await expect(item(gone)).toHaveCount(0);
    await expect(item(kept)).toBeVisible();
    const names = (await inbox(marketing)).map((m) => m.name);
    expect(names).not.toContain(gone);
    expect(names).toContain(kept);
  });

  test('REQ-90-AC2: ein Löschfehler wird angezeigt, die Nachricht bleibt in der Liste', async ({ page, request, marketing }) => {
    const name = `Fehler ${uid()}`;
    await send(request, name);
    await page.goto('/redaktion/nachrichten');
    await page.route('**/api/admin/contact-messages/*', (r) => r.fulfill({ status: 500, json: { message: 'x' } }));
    const item = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
    await item.getByRole('button', { name: `Nachricht von ${name} löschen` }).click();
    await item.getByRole('button', { name: `Nachricht von ${name} endgültig löschen` }).click();
    await expect(page.getByRole('alert').filter({ hasText: `Die Nachricht von ${name} wurde nicht gelöscht.` })).toBeVisible();
    await expect(item).toBeVisible();
    expect((await inbox(marketing)).some((m) => m.name === name)).toBe(true);
  });
});

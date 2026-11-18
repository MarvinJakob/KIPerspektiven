import { test as setup, expect } from '@playwright/test';
import { ACCOUNTS, AUTH, loginWithRetry, randomIp } from './fixtures';

// Meldet die Testkonten einmal pro Lauf an. Die Tests verwenden diese Sitzungen wieder,
// statt sich jedes Mal anzumelden (Argon2-Prüfungen sind bewusst langsam und begrenzt, Ticket #138).
for (const role of ['editor', 'admin', 'marketing'] as const) {
  setup(`Sitzung ${role}`, async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });
    const res = await loginWithRetry(ctx, ACCOUNTS[role].email, ACCOUNTS[role].password);
    expect(res.status(), await res.text()).toBe(200);
    await ctx.storageState({ path: AUTH[role] });
    await ctx.dispose();
  });
}

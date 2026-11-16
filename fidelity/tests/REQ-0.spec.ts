// REQ-0 Grundfunktion – Spezifikation: specs/REQ-0.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test } from '@playwright/test';

test('REQ-0-AC1 Healthcheck antwortet mit 200', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
});

test('REQ-0-AC2 Startseite lädt mit Hauptüberschrift', async ({ page }) => {
  const response = await page.goto('/de');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
});

test('REQ-0-AC3 Unbekannter Pfad liefert 404', async ({ request }) => {
  const response = await request.get('/de/gibt-es-nicht-4711');
  expect(response.status()).toBe(404);
});

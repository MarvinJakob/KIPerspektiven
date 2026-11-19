// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Profile.tsx app/frontend/src/pages/Legal.tsx
import { expect, test } from '../support/fixtures';

test('REQ-17-AC1: /de/profil und /en/profil zeigen ohne Anmeldung das Profil in der jeweiligen Sprache', async ({ page }) => {
  for (const lang of ['de', 'en'] as const) {
    await page.goto(`/${lang}/profil`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marvin Jakob');
    await expect(page.getByRole('heading', { level: 2, name: lang === 'de' ? 'Beratungsangebote' : /consulting|services|offer/i })).toBeVisible();
  }
});

test('REQ-17-AC3: Einstieg führt zu den Angeboten, LinkedIn und E-Mail nutzen die hinterlegten Ziele', async ({ page }) => {
  await page.goto('/de/profil');
  await page.getByRole('link', { name: 'Beratungsangebote entdecken' }).click();
  await expect(page.getByRole('heading', { name: 'Beratungsangebote' })).toBeInViewport();

  const linkedin = page.getByRole('link', { name: /LinkedIn/ });
  await expect(linkedin).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/in\/marvin-jakob-/);
  await expect(linkedin).toHaveAttribute('target', '_blank');
  // Kontaktadresse aus dem Impressum (Quelle der Mailadresse laut Persona-Umsetzung)
  const mail = page.getByRole('link', { name: 'Mail' });
  const href = await mail.getAttribute('href');
  expect(href).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]+$/);
  await page.goto('/de/impressum');
  await expect(page.locator('main')).toContainText(href!.replace('mailto:', ''));
});

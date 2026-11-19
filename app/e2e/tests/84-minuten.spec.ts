// Abdeckung: app/frontend-redaktion/src/pages/EditPost.tsx app/backend/internal/service/editorial.go
import { AUTH, expect, fullText, test, uid } from '../support/fixtures';

test.describe('Zeitpunkt im Editor', () => {
  test.use({ storageState: AUTH.editor });

  test('REQ-84-AC1: Minute und gewählte Zeitzone bleiben nach Speichern und Wiederöffnen erhalten', async ({ page, posts }) => {
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
});

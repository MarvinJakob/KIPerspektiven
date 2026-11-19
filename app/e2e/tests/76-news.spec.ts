// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Blog.tsx app/frontend/src/pages/Post.tsx app/frontend/src/pages/Topic.tsx app/frontend/src/components/Header.tsx
import { expect, fullText, test, uid } from '../support/fixtures';

// Anforderung #76: Öffentlichen Blog in „News“ umbenennen.
// Sollwerte aus Ticket #76; Unit-Tests: app/frontend/src/i18n/news.test.tsx, app/backend/internal/web/meta_test.go.
const SOLL = {
  de: { nav: 'Hauptnavigation', back: 'Zurück zu News' },
  en: { nav: 'Main navigation', back: 'Back to News' },
} as const;
// Die Form des Tab-Titels legt seit Anforderung #108 REQ-108-AC1 fest; der Seitenname bleibt „News“.
const TITLE = 'KI Perspektiven News';

for (const lang of ['de', 'en'] as const) {
  const s = SOLL[lang];

  test(`REQ-76-AC1 REQ-76-AC3: Desktop-Navigation „News“ öffnet die Übersicht mit Überschrift und Titel „News“ (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/kontakt`);
    const link = page.getByRole('navigation', { name: s.nav }).getByRole('link', { name: 'News', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveText('News');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
    await expect(page).toHaveTitle(TITLE);
    await expect(link).toHaveAttribute('aria-current', 'page');
  });
}

test('REQ-76-AC2 REQ-76-AC4: bestehende Beitragsadressen bleiben erreichbar, Rücklink heißt „Zurück zu News“ bzw. „Back to News“', async ({ page, request, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  await posts.publish(post.id);

  for (const lang of ['de', 'en'] as const) {
    // Direktaufruf der bisherigen Adressen: Server liefert Übersicht und Beitrag weiterhin aus.
    const overview = await request.get(`/${lang}/blog`);
    expect(overview.status(), `/${lang}/blog`).toBe(200);
    expect(await overview.text()).toContain(`<title>${TITLE}</title>`);
    expect((await request.get(`/${lang}/blog/${post.slug}`)).status(), `/${lang}/blog/${post.slug}`).toBe(200);

    await page.goto(`/${lang}/blog/${post.slug}`);
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog/${post.slug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(tag);
    const back = page.getByRole('link', { name: SOLL[lang].back });
    await expect(back).toHaveText(SOLL[lang].back);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
  }
});

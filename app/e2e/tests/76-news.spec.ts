// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Blog.tsx app/frontend/src/pages/Post.tsx app/frontend/src/pages/Topic.tsx app/frontend/src/components/Header.tsx
import { expect, fullText, test, uid } from '../support/fixtures';

// Anforderung #76: Öffentlichen Blog in „News“ umbenennen.
// Sollwerte aus Ticket #76; Unit-Tests: app/frontend/src/i18n/news.test.tsx, app/backend/internal/web/meta_test.go.
const SOLL = {
  de: { nav: 'Hauptnavigation', menu: 'Menü', site: 'Website', back: 'Zurück zu News', cta: 'Zu News', empty: 'Noch keine Beiträge' },
  en: { nav: 'Main navigation', menu: 'Menu', site: 'Website', back: 'Back to News', cta: 'Go to News', empty: 'No articles yet' },
} as const;
const TITLE = 'News · KI Perspektiven';

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

  test(`REQ-76-AC1: mobil heißt der Menülink „News“ und öffnet per Tastatur die Übersicht (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${lang}/kontakt`);
    await page.getByRole('button', { name: s.menu }).click();
    const link = page.getByRole('navigation', { name: s.nav }).getByRole('link', { name: 'News', exact: true });
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
  });

  test(`REQ-76-AC2: Fußzeilenlink „News“ führt zur Übersicht (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/kontakt`);
    const link = page.locator('footer.site-footer').getByRole('navigation', { name: s.site }).getByRole('link', { name: 'News', exact: true });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
  });

  test(`REQ-76-AC3: leere Übersicht behält Überschrift und Titel „News“ (${lang})`, async ({ page }) => {
    await page.route('**/api/posts?*', (r) => r.fulfill({ json: { items: [] } }));
    await page.goto(`/${lang}/blog`);
    await expect(page.getByRole('heading', { name: s.empty })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
    await expect(page).toHaveTitle(TITLE);
  });

  test(`REQ-76-AC2: Leerzustand einer Themenseite verlinkt mit „News“ auf die Übersicht (${lang})`, async ({ page, request }) => {
    const slug = `news-leer-${uid()}`;
    const base = await (await request.get(`/api/topics/ai-audit?lang=${lang}`)).json();
    await page.route(`**/api/topics/${slug}?*`, (r) => r.fulfill({ json: { ...base, slug, posts: [] } }));
    await page.goto(`/${lang}/themen/${slug}`);
    await expect(page.getByRole('heading', { name: s.empty })).toBeVisible();
    const cta = page.locator('main').getByRole('link', { name: s.cta });
    await expect(cta).toHaveText(s.cta);
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('News');
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

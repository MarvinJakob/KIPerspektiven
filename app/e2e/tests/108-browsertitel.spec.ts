// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/lib/page.ts app/frontend/src/pages/Home.tsx app/frontend/src/pages/Blog.tsx app/frontend/src/pages/Contact.tsx app/frontend/src/pages/Post.tsx app/frontend/src/pages/Profile.tsx app/frontend/src/pages/Legal.tsx app/frontend/src/pages/Topic.tsx app/frontend/src/pages/NotFound.tsx
import type { Page } from '@playwright/test';
import { expect, fullText, test, uid } from '../support/fixtures';

// Anforderung #108: Der Browser-Tab beginnt mit „KI Perspektiven“, danach folgt der Seitenname.
// Sollwerte aus Ticket #108 (Akzeptanzkriterien und Tabelle „Seitennamen“ der Spezifikation).
// Ladezustände, Fehlerseite und Social-Media-Titel prüfen die Unit-Tests app/frontend/src/lib/page.test.tsx und
// app/backend/internal/web/meta_test.go.
const SITE = 'KI Perspektiven';

/** Seitenname je Adresse und Sprache; `''` steht für die Startseite ohne Seitennamen. */
const PAGES: { path: string; ac: string; de: string; en: string }[] = [
  { path: '', ac: 'REQ-108-AC2', de: '', en: '' },
  { path: '/blog', ac: 'REQ-108-AC1', de: 'News', en: 'News' },
  { path: '/kontakt', ac: 'REQ-108-AC1', de: 'Kontakt', en: 'Contact' },
  { path: '/profil', ac: 'REQ-108-AC1', de: 'Profil', en: 'Profile' },
  { path: '/themen/ai-audit', ac: 'REQ-108-AC1', de: 'KI Readiness', en: 'AI Readiness' },
  { path: '/impressum', ac: 'REQ-108-AC1', de: 'Impressum', en: 'Legal notice' },
  { path: '/datenschutz', ac: 'REQ-108-AC1', de: 'Datenschutz', en: 'Privacy' },
];

const tab = (name: string) => (name ? `${SITE} ${name}` : SITE);

/** Titel im ausgelieferten HTML, unverändert und ohne die Leerraumbereinigung des Browsers. */
async function htmlTitle(page: Page, url: string, status = 200) {
  const res = await page.request.get(url);
  expect(res.status(), url).toBe(status);
  const titles = [...(await res.text()).matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  expect(titles, `genau ein <title> in ${url}`).toHaveLength(1);
  return titles[0];
}

for (const lang of ['de', 'en'] as const) {
  test(`REQ-108-AC1 REQ-108-AC2 REQ-108-AC3: Direktaufruf zeigt „KI Perspektiven <Seitenname>“ in HTML und Tab (${lang})`, async ({ page }) => {
    for (const p of PAGES) {
      const url = `/${lang}${p.path}`;
      const soll = tab(p[lang]);
      expect(await htmlTitle(page, url), `${p.ac}, REQ-108-AC3: <title> im HTML von ${url}`).toBe(soll);
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page, `${p.ac}: Tab-Titel von ${url} nach dem Laden`).toHaveTitle(soll);
    }
  });
}

test('REQ-108-AC1 REQ-108-AC3: Beitrag und Themenseite zeigen ihren Inhaltstitel, im HTML wie im Tab', async ({ page, posts }) => {
  const tag = uid();
  const post = await posts.create({ texts: [fullText('de', tag), fullText('en', tag)] });
  await posts.publish(post.id);

  for (const [lang, title] of [['de', `Testbeitrag ${tag}`], ['en', `Test post ${tag}`]] as const) {
    const url = `/${lang}/blog/${post.slug}`;
    const soll = `KI Perspektiven ${title}`;
    expect(await htmlTitle(page, url), `<title> im HTML von ${url}`).toBe(soll);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(tag);
    await expect(page, `Tab-Titel von ${url}`).toHaveTitle(soll);
  }

  // Themenseite: Inhaltstitel aus der API, unabhängig vom Seitentitel gelesen.
  for (const lang of ['de', 'en'] as const) {
    const topic = (await (await page.request.get(`/api/topics/vibe-coding?lang=${lang}`)).json()) as { title: string };
    expect(topic.title.trim(), 'Thementitel aus der API').not.toBe('');
    const soll = `KI Perspektiven ${topic.title}`;
    expect(await htmlTitle(page, `/${lang}/themen/vibe-coding`)).toBe(soll);
    await page.goto(`/${lang}/themen/vibe-coding`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(soll);
  }
});

test('REQ-108-AC3: interner Seiten- und Sprachwechsel zeigt den Titel der Zielseite in der gewählten Sprache', async ({ page }) => {
  await page.goto('/de/blog');
  await expect(page).toHaveTitle('KI Perspektiven News');

  const footer = page.locator('footer.site-footer');
  await footer.getByRole('link', { name: 'Kontakt', exact: true }).click();
  await expect(page).toHaveURL(/\/de\/kontakt$/);
  await expect(page, 'Seitenwechsel News → Kontakt').toHaveTitle('KI Perspektiven Kontakt');

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/kontakt$/);
  await expect(page, 'Sprachwechsel auf Kontakt').toHaveTitle('KI Perspektiven Contact');

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/profil$/);
  await expect(page, 'Seitenwechsel Contact → Profile').toHaveTitle('KI Perspektiven Profile');

  await page.getByRole('link', { name: 'KI Perspektiven – home' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page, 'Seitenwechsel zur Startseite').toHaveTitle(SITE);
});

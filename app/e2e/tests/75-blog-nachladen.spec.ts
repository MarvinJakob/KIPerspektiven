// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Blog.tsx app/frontend/src/api/client.ts app/backend/internal/service/public.go app/backend/internal/http/api.go app/backend/internal/store/queries.sql
import type { Page, Response } from '@playwright/test';
import { expect, fullText, test, uid } from '../support/fixtures';

// Ticket #75: Blogbeiträge portionsweise laden und beim Scrollen nachladen.
// Browser mit echtem Backend. Der Test legt 21 eigene Beiträge an, damit sicher mehr als eine Portion
// (20) existiert – unabhängig von Beiträgen paralleler Tests.

interface Page1 {
  items: { slug: string }[];
  nextCursor?: string;
}

const isFeed = (r: Response) => {
  const u = new URL(r.url());
  return u.pathname === '/api/posts' && !u.searchParams.has('featured');
};

async function openBlog(page: Page) {
  const cursors: (string | null)[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/posts' && !u.searchParams.has('featured')) cursors.push(u.searchParams.get('cursor'));
  });
  const first = page.waitForResponse(isFeed);
  await page.goto('/de/blog');
  const body = (await (await first).json()) as Page1;
  return { body, cursors };
}

for (const [name, viewport] of [
  ['Desktop', { width: 1280, height: 800 }],
  ['Mobil', { width: 375, height: 812 }],
] as const) {
  test(`REQ-75-AC1 REQ-75-AC3: ${name} zeigt 20 Beiträge und lädt beim Scrollen ans Listenende nach`, async ({ page, posts }) => {
    test.setTimeout(60_000);
    const tag = uid();
    for (let i = 0; i < 21; i++) {
      const p = await posts.create({ texts: [fullText('de', `${tag}-${i}`)] });
      await posts.publish(p.id);
    }
    await page.setViewportSize(viewport);
    const { body, cursors } = await openBlog(page);

    // AC1: erster Abruf ohne Fortsetzung, genau 20 Einträge und Hinweis auf weitere
    expect(body.items).toHaveLength(20);
    expect(body.nextCursor, 'nextCursor bei mehr als 20 Beiträgen').toBeTruthy();
    const rows = page.locator('main a.post-row');
    await expect(rows).toHaveCount(20);
    const hrefs = await rows.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(body.items.map((p) => `/de/blog/${p.slug}`));
    expect(cursors, 'ohne Listenende kein Folgeabruf').toEqual([null]);

    // AC3: Scrollen ans Ende fordert die nächste Portion an und hängt sie unten an
    const next = page.waitForResponse((r) => isFeed(r) && new URL(r.url()).searchParams.get('cursor') === body.nextCursor);
    await rows.last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    const more = (await (await next).json()) as Page1;
    expect(more.items.length).toBeGreaterThan(0);
    await expect(rows).toHaveCount(20 + more.items.length);
    const after = await rows.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(after.slice(0, 20), 'bisherige Beiträge bleiben in Reihenfolge').toEqual(hrefs);
    expect(new Set(after).size, 'jeder Beitrag genau einmal').toBe(after.length);
    expect(cursors.filter((c) => c === body.nextCursor), 'Portion genau einmal angefordert').toHaveLength(1);
  });
}

// REQ-2 Themenseite Vibe Coding mit Harness-Grafik – Spezifikation: specs/REQ-2.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  { url: '/de/themen/vibe-coding', body: 'Damit sie über mehrere Arbeitsschritte verlässlich vorankommt', example: 'Schlägt eine Prüfung fehl', foreign: /\b(the|and|into)\b/i },
  { url: '/en/themen/vibe-coding', body: 'To make reliable progress across several steps', example: 'If a check fails', foreign: /\b(und|der|die|das)\b/i },
];

/** Abschnitt „Harness Engineering“: der Bereich, der den ersten Absatz der Perspektive enthält. */
async function harnessSection(page: Page, body: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Vibe Coding/);
  const section = page.getByRole('main').locator('section').filter({ hasText: body }).last();
  await section.scrollIntoViewIfNeeded();
  return section;
}

test('REQ-2-AC1 Harness-Grafik steht geladen und beschrieben im Abschnitt Harness Engineering', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.url);
    const section = await harnessSection(page, p.body);
    const img = section.getByRole('img');
    await expect(img, p.url).toHaveCount(1);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { message: `${p.url}: Grafik geladen` }).toBeGreaterThan(0);
    const alt = (await img.getAttribute('alt')) ?? '';
    for (const term of ['Harness', 'Skill', 'Tool', 'Context', 'Model']) expect(alt, `${p.url}: Alternativtext nennt ${term}`).toMatch(new RegExp(`\\b${term}`, 'i'));
    expect(alt, `${p.url}: Alternativtext in der Seitensprache`).not.toMatch(p.foreign);
    const first = await section.getByText(p.body).first().boundingBox();
    const example = await section.getByText(p.example).first().boundingBox();
    const box = await img.boundingBox();
    expect(first && example && box, p.url).toBeTruthy();
    expect(box!.y, `${p.url}: Grafik unter dem ersten Absatz`).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
    expect(box!.y + box!.height, `${p.url}: Grafik über dem Beispiel`).toBeLessThanOrEqual(example!.y + 1);
  }
});

test('REQ-2-AC2 Harness-Grafik öffnet sich in voller Größe', async ({ page, request }) => {
  await page.goto(PAGES[0].url);
  const section = await harnessSection(page, PAGES[0].body);
  const link = section.getByRole('link').filter({ has: page.getByRole('img') });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAccessibleName(/\S/);
  await expect(link).toHaveAttribute('target', '_blank');
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] ?? '').toMatch(/^image\//);
});

test('REQ-2-AC3 Harness-Grafik passt in die Textspalte, kein horizontaler Bildlauf', async ({ page }) => {
  await page.goto(PAGES[0].url);
  const section = await harnessSection(page, PAGES[0].body);
  const img = section.getByRole('img');
  await img.scrollIntoViewIfNeeded();
  const column = await section.getByText(PAGES[0].body).first().boundingBox();
  const box = await img.boundingBox();
  expect(column && box).toBeTruthy();
  expect(box!.x, 'linke Kante in der Textspalte').toBeGreaterThanOrEqual(column!.x - 1);
  expect(box!.x + box!.width, 'rechte Kante in der Textspalte').toBeLessThanOrEqual(column!.x + column!.width + 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'kein horizontaler Bildlauf').toBeLessThanOrEqual(0);
});

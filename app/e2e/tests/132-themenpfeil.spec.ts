// Abdeckung: app/frontend/src/pages/Home.tsx
import type { Locator, Page } from '@playwright/test';
import { expect, test, uid } from '../support/fixtures';

// Anforderung #132: Der Pfeil am rechten Rand eines Themenblocks der Startseite öffnet den Artikel.
// Sollwerte aus dem Ticket: Ziele `/themen/<slug>` und `/themenartikel/<id>` in der Sprache der Seite,
// Link-Zeiger und orange Fläche (--brand) über dem Pfeil, genau ein Link je Block.
// Die Tests bewegen und klicken die Maus über Koordinaten. So entscheidet wie beim Besucher der Browser,
// welches Element den Klick erhält.

const TOPIC = {
  slug: 'softwareentwicklung',
  question: { de: 'Wenn KI uns die langweilige Arbeit abnimmt, wird Softwareentwicklung endlich kreativer?' },
} as const;
const api = '/api/admin/articles';

const rows = (page: Page) => page.locator('#themen-liste > li');
const arrowOf = (row: Locator) => row.locator('.home-topic-go');

async function center(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('Element ist nicht sichtbar');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** Bewegt den Zeiger wie ein Besucher erst auf die Stelle und klickt dann dort. */
async function clickAt(page: Page, point: { x: number; y: number }) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}

/** Startseite ohne redaktionelle Themenartikel: genau die zwei fest hinterlegten Blöcke. */
async function openHome(page: Page, lang: 'de' | 'en' = 'de') {
  await page.route('**/api/articles?*', (route) => route.fulfill({ json: { items: [] } }));
  await page.goto(`/${lang}`);
  await expect(rows(page)).toHaveCount(2);
}

for (const width of [1280, 800]) {
  test(`REQ-132-AC1: Klick auf den Pfeil eines Themenblocks öffnet das Ziel der Frage (Breite ${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openHome(page);
    const row = rows(page).first();
    const target = await row.getByRole('link', { name: TOPIC.question.de }).getAttribute('href');
    expect(target).toBe(`/de/themen/${TOPIC.slug}`);
    await expect(arrowOf(row)).toBeVisible();
    await clickAt(page, await center(arrowOf(row)));
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('REQ-132-AC2: Klick auf den Pfeil eines redaktionellen Themenartikels öffnet dessen Seite', async ({ editor, page }) => {
  const title = 'Themenartikel ' + uid();
  const de = { title, subtitle: 'Unterzeile', blocks: [{ kind: 'paragraph', text: 'Inhalt' }] };
  const created = await editor.send('POST', api, { de, status: 'draft' });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  try {
    expect((await editor.send('PUT', `${api}/${id}`, { de, status: 'published' })).ok()).toBe(true);
    await page.goto('/de');
    const row = rows(page).filter({ has: page.getByRole('link', { name: title }) });
    await expect(row).toHaveCount(1);
    await clickAt(page, await center(arrowOf(row)));
    await expect(page).toHaveURL(new RegExp(`/de/themenartikel/${id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  } finally {
    await editor.send('DELETE', `${api}/${id}`);
  }
});

test('REQ-132-AC3: über dem Pfeil erscheint der Link-Zeiger, der Pfeil bleibt orange hervorgehoben', async ({ page }) => {
  await openHome(page);
  const arrow = arrowOf(rows(page).first());
  const brand = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.backgroundColor = 'var(--brand)';
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(brand, 'Unternehmensfarbe ist definiert').not.toBe('rgba(0, 0, 0, 0)');
  await expect(arrow, 'ohne Zeiger ist der Pfeil nicht hervorgehoben').not.toHaveCSS('background-color', brand);

  const { box } = await center(arrow);
  const y = box.y + box.height / 2;
  // Mitte, linke und rechte Hälfte des Kreises: Der Zustand darf beim Bewegen auf dem Pfeil nicht wechseln.
  for (const x of [box.x + box.width / 2, box.x + box.width * 0.25, box.x + box.width * 0.75]) {
    await page.mouse.move(x, y, { steps: 4 });
    await expect(arrow).toHaveCSS('background-color', brand);
    const cursor = await page.evaluate(([px, py]) => getComputedStyle(document.elementFromPoint(px, py)!).cursor, [x, y]);
    expect(cursor, `Zeiger an x=${Math.round(x)}`).toBe('pointer');
  }
});

test('REQ-132-AC4: auf der englischen Startseite öffnet der Pfeil die englische Fassung', async ({ page }) => {
  await openHome(page, 'en');
  await clickAt(page, await center(arrowOf(rows(page).first())));
  await expect(page).toHaveURL(new RegExp(`/en/themen/${TOPIC.slug}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('REQ-132-AC5: je Block genau ein Link und genau ein Fokusstopp', async ({ page }) => {
  await openHome(page);
  for (const row of await rows(page).all()) {
    await expect(row.getByRole('link')).toHaveCount(1);
    await expect(row.getByRole('button')).toHaveCount(0);
  }
  const first = rows(page).nth(0).getByRole('link');
  const second = rows(page).nth(1).getByRole('link');
  await first.focus();
  await page.keyboard.press('Tab');
  await expect(second, 'ein Tab führt vom ersten direkt zum zweiten Block').toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const stillInList = await page.evaluate(() => !!document.activeElement?.closest('#themen-liste'));
  expect(stillInList, 'nach dem letzten Block verlässt der Fokus die Liste').toBe(false);
});

test('REQ-132-AC6: Klick auf Nummer, Rubrik, Frage, Beschreibung und freie Fläche öffnet weiterhin die Zielseite', async ({ page }) => {
  await openHome(page);
  const row = rows(page).first();
  const spots: Record<string, () => Promise<{ x: number; y: number }>> = {
    Nummer: () => center(row.locator('.topic-number')),
    Rubrik: () => center(row.locator('.home-topic-kicker')),
    Frage: () => center(row.getByRole('link')),
    Beschreibung: () => center(row.locator('.home-topic-copy > p:last-child')),
    'freie Fläche': async () => {
      const { box } = await center(row);
      return { x: box.x + box.width - 8, y: box.y + box.height - 8 };
    },
  };
  for (const [name, spot] of Object.entries(spots)) {
    await test.step(name, async () => {
      await page.goto('/de');
      await expect(rows(page)).toHaveCount(2);
      await clickAt(page, await spot());
      await expect(page).toHaveURL(new RegExp(`/de/themen/${TOPIC.slug}$`));
    });
  }
});

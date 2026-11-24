// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Post.tsx app/frontend/src/pages/Blog.tsx app/frontend/src/components/PostRow.tsx
import type { Locator, Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, fullText, pngImage, test, uid, type EditorPost, type Session } from '../support/fixtures';

// Anforderung #138: Ein News-Beitrag nutzt auf dem Desktop den Inhaltsrahmen der Seite und zeigt ohne Titelbild
// keinen Platzhalter. Browser mit echtem Backend. Sollwerte aus dem Ticket: Inhaltsrahmen höchstens 1240 px,
// sonst Fensterbreite abzüglich 96 px; Seitentitel bei 1600 px Fensterbreite 56 px; mobil 20 px Rand je Seite.

type Posts = { create(input: { texts: ReturnType<typeof fullText>[]; topics?: string[] }): Promise<EditorPost>; publish(id: number): Promise<EditorPost> };

const LONG_TITLE = 'Anpfiff für KI-Agenten: Die cimt Heimspiel KI Tour im Deutsche Bank Park';
const paragraph = (tag: string) =>
  `Beitragstext ${tag}: Im Stadion wird normalerweise über Abseits gestritten. An diesem Tag geht es um eine andere strittige Frage, ` +
  'nämlich wie KI-Agenten aus der hübschen Demo in den echten Betrieb kommen und was dafür in Organisation und Technik nötig ist. ' +
  'Der Absatz ist bewusst lang, damit er auch im breiten Inhaltsrahmen über mehr als eine Zeile läuft.';

/** Veröffentlichter Beitrag mit langem Titel, optional mit Titelbild. */
async function publishPost(posts: Posts, editor: Session, tag: string, withCover: boolean) {
  const text = { ...fullText('de', tag), title: `${LONG_TITLE} ${tag}`, bodyMarkdown: `${paragraph(tag)}\n\nZweiter Absatz ${tag}.` };
  const post = await posts.create({ texts: [text] });
  if (withCover) {
    const up = await editor.upload(`/api/admin/posts/${post.id}/cover`, { name: 'cover.png', mimeType: 'image/png', buffer: pngImage(64, 48) });
    expect(up.status(), await up.text()).toBe(200);
    const save = await editor.send('PUT', `/api/admin/posts/${post.id}`, { featured: false, topics: [], texts: [{ ...text, coverAlt: `Titelbild ${tag}` }] });
    expect(save.status(), await save.text()).toBe(200);
  }
  await posts.publish(post.id);
  return post;
}

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  expect(b, 'Element ist sichtbar').not.toBeNull();
  return b!;
};

/** Breite und linke Kante des Inhaltsrahmens laut Ticket für das aktuelle Fenster. */
async function frame(page: Page) {
  const client = await page.evaluate(() => document.documentElement.clientWidth);
  const width = Math.min(1240, client - 96);
  return { width, left: (client - width) / 2 };
}

const head = (page: Page) => page.locator('main article header');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const bodyText = (page: Page, tag: string) => page.locator('main article p', { hasText: `Beitragstext ${tag}` });

for (const viewport of [{ width: 1600, height: 900 }, { width: 1280, height: 800 }]) {
  test(`REQ-138-AC1: Kopf und Text sind bei ${viewport.width} px so breit wie der Inhaltsrahmen`, async ({ page, posts, editor }) => {
    const tag = uid();
    const post = await publishPost(posts, editor, tag, false);
    await page.setViewportSize(viewport);
    await page.goto(`/de/blog/${post.slug}`);
    await expect(title(page)).toHaveText(`${LONG_TITLE} ${tag}`);
    const want = await frame(page);

    for (const [name, locator] of [['Kopf', head(page)], ['Titel', title(page)], ['Beitragstext', bodyText(page, tag)]] as const) {
      const b = await box(locator);
      expect(Math.abs(b.width - want.width), `${name}: Breite ${b.width} px statt ${want.width} px`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.x - want.left), `${name}: linke Kante ${b.x} px statt ${want.left} px`).toBeLessThanOrEqual(1);
    }
    await expectNoHorizontalScroll(page);

    // Vergleich mit der Beitragsliste der News-Übersicht: gleicher Rahmen
    const postHead = await box(head(page));
    await page.goto('/de/blog');
    const list = await box(page.locator('main ul').first());
    expect(Math.abs(list.width - postHead.width), `Liste ${list.width} px, Beitragskopf ${postHead.width} px`).toBeLessThanOrEqual(1);
    expect(Math.abs(list.x - postHead.x)).toBeLessThanOrEqual(1);
  });
}

test('REQ-138-AC2: Beitragskopf ohne Hintergrundfläche und mit der Schriftgröße der Seitentitel', async ({ page, posts, editor }) => {
  const tag = uid();
  const post = await publishPost(posts, editor, tag, false);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/de/blog/${post.slug}`);
  await expect(title(page)).toHaveText(`${LONG_TITLE} ${tag}`);

  const background = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  const fontSize = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
  expect(await background(head(page)), 'Beitragskopf hat keine eigene Fläche').toBe('rgba(0, 0, 0, 0)');
  expect(await fontSize(title(page))).toBe('56px');
  // Der lange Titel steht im breiten Rahmen auf höchstens drei Zeilen (zuvor sieben Zeilen in 112 px).
  const lineHeight = await title(page).evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect((await box(title(page))).height / lineHeight).toBeLessThanOrEqual(3.05);

  // Seitentitel der News-Übersicht als Vergleichswert
  await page.goto('/de/blog');
  expect(await fontSize(title(page)), 'Seitentitel der News-Übersicht').toBe('56px');

  // Der Kopf redaktioneller Themenartikel (#61) bleibt unverändert: Fläche über die volle Breite, Titel 112 px.
  await page.goto('/de/themen/softwareentwicklung');
  const topicHead = page.locator('main article header');
  await expect(topicHead.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await background(topicHead), 'Themenartikel behält die Kopffläche').not.toBe('rgba(0, 0, 0, 0)');
  expect(await fontSize(topicHead.getByRole('heading', { level: 1 }))).toBe('112px');
  const client = await page.evaluate(() => document.documentElement.clientWidth);
  expect((await box(topicHead)).width).toBe(client);
});

test('REQ-138-AC3: Titelbild steht zwischen Kopf und Text in der Breite des Inhaltsrahmens', async ({ page, posts, editor }) => {
  const tag = uid();
  const post = await publishPost(posts, editor, tag, true);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/de/blog/${post.slug}`);
  const cover = page.getByRole('img', { name: `Titelbild ${tag}` });
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  const want = await frame(page);
  const image = await box(cover);
  expect(Math.abs(image.width - want.width), `Titelbild ${image.width} px statt ${want.width} px`).toBeLessThanOrEqual(1);
  expect(Math.abs(image.x - want.left)).toBeLessThanOrEqual(1);
  const header = await box(head(page));
  const text = await box(bodyText(page, tag));
  expect(image.y, 'Titelbild unter dem Kopf').toBeGreaterThanOrEqual(header.y + header.height);
  expect(text.y, 'Text unter dem Titelbild').toBeGreaterThanOrEqual(image.y + image.height);
  await expectNoHorizontalScroll(page);
});

test('REQ-138-AC4: Ohne Titelbild folgt der Text direkt auf den Kopf, ohne Bild oder Platzhalter', async ({ page, posts, editor }) => {
  const tag = uid();
  const post = await publishPost(posts, editor, tag, false);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/de/blog/${post.slug}`);
  await expect(bodyText(page, tag)).toBeVisible();

  const header = await box(head(page));
  const text = await box(bodyText(page, tag));
  const gap = text.y - (header.y + header.height);
  // Zuvor lagen hier 40 px Abstand, eine 446 px hohe Platzhaltergrafik und weitere 40 px.
  expect(gap, `Abstand zwischen Kopf und Text: ${gap} px`).toBeGreaterThanOrEqual(0);
  expect(gap, `Abstand zwischen Kopf und Text: ${gap} px`).toBeLessThanOrEqual(64);
  // Sichtbare Bilder oder Grafiken zwischen Kopf und Text gibt es nicht.
  const between = await page.evaluate(
    ([top, bottom]) =>
      [...document.querySelectorAll('main article img, main article svg, main article [aria-hidden="true"]')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.top >= top && r.bottom <= bottom).length,
    [header.y + header.height, text.y],
  );
  expect(between).toBe(0);
});

/** Lädt in der News-Übersicht nach, bis die Zeile des Beitrags erscheint (parallele Tests legen ebenfalls Beiträge an). */
async function rowOf(page: Page, slug: string) {
  const row = page.locator(`main a[href="/de/blog/${slug}"]`);
  await expect(async () => {
    if ((await row.count()) === 0) {
      await page.keyboard.press('End');
      const more = page.getByRole('button', { name: 'Weitere Beiträge laden' });
      if (await more.isVisible()) await more.click();
    }
    await expect(row).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await row.scrollIntoViewIfNeeded();
  return row;
}

test('REQ-138-AC5: Beitragszeile ohne Titelbild zeigt kein Vorschaubild, mit Titelbild wie bisher', async ({ page, posts, editor }) => {
  const tag = uid();
  const plain = await publishPost(posts, editor, uid(), false);
  const pictured = await publishPost(posts, editor, tag, true);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/de/blog');

  const plainRow = await rowOf(page, plain.slug);
  await expect(plainRow.locator('img, svg')).toHaveCount(0);
  const rowBox = await box(plainRow);
  const heading = await box(plainRow.getByRole('heading'));
  // Der Text nutzt die volle Zeilenbreite: links und rechts bleibt nur der Innenabstand der Karte.
  expect(heading.x - rowBox.x, 'linker Innenabstand ohne Bildspalte').toBeLessThanOrEqual(40);
  expect(rowBox.width - heading.width, 'Titel über die Zeilenbreite').toBeLessThanOrEqual(80);
  const want = await frame(page);
  expect(Math.abs(rowBox.width - want.width)).toBeLessThanOrEqual(1);

  const picturedRow = await rowOf(page, pictured.slug);
  const thumb = picturedRow.getByRole('img', { name: `Titelbild ${tag}` });
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const thumbBox = await box(thumb);
  const picturedHeading = await box(picturedRow.getByRole('heading'));
  expect(Math.abs(thumbBox.width - 136), `Vorschaubild ${thumbBox.width} px statt wie bisher 136 px`).toBeLessThanOrEqual(1);
  expect(picturedHeading.x, 'Text steht rechts neben dem Vorschaubild').toBeGreaterThanOrEqual(thumbBox.x + thumbBox.width);
  await expectNoHorizontalScroll(page);
});

test('REQ-138-AC6: Mobil bleiben 20 px Rand je Seite und kein horizontaler Bildlauf', async ({ page, posts, editor }) => {
  const tag = uid();
  const post = await publishPost(posts, editor, tag, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/de/blog/${post.slug}`);
  await expect(title(page)).toHaveText(`${LONG_TITLE} ${tag}`);
  const cover = page.getByRole('img', { name: `Titelbild ${tag}` });
  await expect(cover).toBeVisible();

  const client = await page.evaluate(() => document.documentElement.clientWidth);
  for (const [name, locator] of [['Kopf', head(page)], ['Titelbild', cover], ['Beitragstext', bodyText(page, tag)]] as const) {
    const b = await box(locator);
    expect(Math.abs(b.x - 20), `${name}: linker Rand ${b.x} px`).toBeLessThanOrEqual(1);
    expect(Math.abs(client - (b.x + b.width) - 20), `${name}: rechter Rand ${client - (b.x + b.width)} px`).toBeLessThanOrEqual(1);
  }
  await expectNoHorizontalScroll(page);
});

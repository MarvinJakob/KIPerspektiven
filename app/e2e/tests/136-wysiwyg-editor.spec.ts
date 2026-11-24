// Abdeckung: app/frontend-redaktion/src/pages/Articles.tsx app/frontend/src/components/ArticleView.tsx app/frontend/src/pages/Topic.tsx app/backend/internal/service/articles.go
import type { Locator, Page } from '@playwright/test';
import { AUTH, expect, pngImage, test, uid, type Session } from '../support/fixtures';

// Anforderung #136: aktuelle Artikel im WYSIWYG-Editor mit Werkzeugleiste.
// Sollwerte: Spezifikation REQ-136 und die Inhalte der Artikel aus #18 und #19.
const api = '/api/admin/articles';
const editorial = '/redaktion/themenartikel';
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const plain = (s: string) => s.replace(/­/g, '').replace(/\s+/g, ' ').trim();

interface Summary { id: number; title: string }
const imported = async (editor: Session) => {
  const { items } = (await (await editor.get(api)).json()) as { items: Summary[] };
  const bySlug: Record<string, any> = {};
  for (const item of items) {
    const article = await (await editor.get(`${api}/${item.id}`)).json();
    if (article.topicSlug) bySlug[article.topicSlug] = article;
  }
  return bySlug;
};

test('REQ-136-AC1/AC4: beide Artikel liegen in der Redaktion und bleiben unter ihrer Themenadresse erreichbar', async ({ editor, request, page }) => {
  const articles = await imported(editor);
  expect(Object.keys(articles).sort()).toEqual(['softwareentwicklung', 'vibe-coding']);
  expect(plain(articles['softwareentwicklung'].de.title)).toBe('KI in der Softwareentwicklung');
  expect(articles['softwareentwicklung'].en.title).toBe('AI in Software Development');
  expect([articles['vibe-coding'].de.title, articles['vibe-coding'].en.title]).toEqual(['Vibe Coding', 'Vibe Coding']);
  for (const lang of ['de', 'en']) {
    const listed = ((await (await request.get(`/api/articles?lang=${lang}`)).json()) as { items: Summary[] }).items.map((i) => i.id);
    for (const [slug, article] of Object.entries(articles)) {
      expect(listed, 'kein zweiter Eintrag in Navigation und Startseite').not.toContain(article.id);
      const res = await request.get(`/api/topics/${slug}/article?lang=${lang}`);
      expect(res.status()).toBe(200);
      expect((await res.json()).content.title).toBe(article[lang].title);
    }
  }
  expect((await request.get('/api/topics/ai-audit/article?lang=de')).status()).toBe(404);
  // Verweise von Startseite und Footer führen weiter zur Themenadresse und dort zum Artikel.
  await page.goto('/de');
  await page.locator('footer a[href="/de/themen/vibe-coding"]').click();
  await expect(page).toHaveURL(/\/de\/themen\/vibe-coding$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vibe Coding');
  await expect(page.locator('#vc-prompt')).toContainText('Prompt Engineering');
});

test('REQ-136-AC2/AC3/AC15: Kopf, Aufbau und Gestaltung der überführten Artikel auf Desktop und mobil', async ({ page }) => {
  const head = {
    'vibe-coding': { de: ['Vibe Coding', 'Stand: 16. November 2026', 'ca. 9 Min. Lesezeit'], en: ['Vibe Coding', 'Updated: 16 November 2026', 'approx. 10 min read'] },
    softwareentwicklung: { de: ['KI in der Softwareentwicklung', 'Stand: 16. November 2026', 'ca. 4 Min. Lesezeit'], en: ['AI in Software Development', 'Updated: 16 November 2026', 'approx. 4 min read'] },
  } as const;
  for (const [slug, langs] of Object.entries(head)) {
    for (const [lang, [title, stand, time]] of Object.entries(langs)) {
      await page.goto(`/${lang}/themen/${slug}`);
      await expect.poll(async () => plain(await page.getByRole('heading', { level: 1 }).innerText())).toBe(title);
      const byline = page.locator('.article-head .byline');
      await expect(byline.locator('strong')).toHaveText('Marvin Jakob');
      await expect(byline.locator('time')).toHaveText(stand);
      await expect(byline).toContainText(time);
    }
  }
  const columns = (l: Locator) => l.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/de/themen/vibe-coding');
  // Magazin: fünf nummerierte Abschnitte zweispaltig auf abgesetzter Fläche, Übersicht mit fünf Sprungzielen, Fazit-Box.
  await expect(page.locator('.vc-perspectives > section.vc-perspective')).toHaveCount(5);
  await expect(page.locator('.vc-number')).toHaveText(['01', '02', '03', '04', '05']);
  expect(await columns(page.locator('#vc-prompt'))).toBe(2);
  await expect(page.locator('.vc-index a')).toHaveCount(5);
  // Die Einträge der Übersicht behalten die Textfarbe; nur Links im Fließtext sind farbig.
  const color = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);
  expect(await color(page.locator('.vc-index a strong').first())).toBe(await color(page.locator('.article-head h1')));
  await expect(page.locator('figure.vc-example')).toHaveCount(6);
  await expect(page.locator('blockquote.vc-quote')).toHaveText('Humans should review ideas, not code.');
  await expect(page.locator('section.vc-conclusion .eyebrow')).toHaveText('Fazit');
  const frame = await page.locator('#vc-harness figure.article-figure').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(frame, 'Grafik auf heller Fläche (#41)').toBe('rgb(255, 255, 255)');
  expect(await noOverflow()).toBe(true);

  await page.goto('/de/themen/softwareentwicklung');
  // Breiter Lesefluss: Einleitung, Verweis, Zitatüberschrift, zwei Grafiken, Meinungsaufruf.
  await expect(page.locator('.article-body > section')).toHaveCount(5);
  await expect(page.locator('.article-body p.article-lead')).toHaveCount(1);
  await expect(page.locator('a.related-link')).toHaveAttribute('href', '/de/themen/vibe-coding');
  await expect(page.locator('h2.quote-heading')).toContainText('„Das ist der Weg!“');
  await expect(page.locator('h2.quote-heading small')).toHaveText('– Din Djarin');
  await expect(page.locator('.article-body figure.article-figure img')).toHaveCount(2);
  await expect(page.locator('section.opinion a')).toHaveAttribute('href', '/de/kontakt');
  expect(await columns(page.locator('section.opinion'))).toBe(3);
  const body = await page.locator('.article-body').boundingBox();
  expect(body!.width, 'voller Inhaltsrahmen (#57)').toBeGreaterThan(1000);
  expect(await noOverflow()).toBe(true);

  await page.setViewportSize({ width: 375, height: 800 });
  for (const slug of ['softwareentwicklung', 'vibe-coding']) {
    await page.goto(`/de/themen/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await noOverflow(), slug).toBe(true);
    await expect(page.locator('nav.toc .toc-toggle'), 'mobiles Inhaltsverzeichnis (#98)').toBeVisible();
  }
  expect(await columns(page.locator('#vc-prompt'))).toBe(1);
});

test('REQ-136-AC9/AC10: Backend weist unzulässige Linkziele und fremde Bildadressen ab', async ({ editor }) => {
  const send = (blocks: unknown[]) => editor.send('POST', api, { status: 'draft', de: { title: 'Prüfung ' + uid(), blocks } });
  for (const blocks of [
    [{ kind: 'paragraph', text: 'Hier', spans: [{ start: 0, end: 4, href: 'javascript:alert(1)' }] }],
    [{ kind: 'related', label: 'L', text: 'T', href: '//example.org' }],
    [{ kind: 'image', src: 'https://example.org/x.png', alt: 'Bild' }],
  ]) {
    const res = await send(blocks);
    expect(res.status(), JSON.stringify(blocks)).toBe(422);
    expect((await res.json()).message).not.toBe('');
  }
});

test.describe('Redaktionsoberfläche', () => {
  test.use({ storageState: AUTH.editor });

  const content = (page: Page) => page.getByRole('textbox', { name: 'Artikelinhalt' });
  const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatierung' });
  const tool = (page: Page, name: string) => toolbar(page).getByRole('button', { name, exact: true });
  const save = async (page: Page, name = 'Speichern') => {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('status')).toContainText('gespeichert');
  };
  const articleId = async (page: Page) => {
    await expect(page).toHaveURL(/themenartikel\/\d+$/);
    return page.url().split('/').pop()!;
  };
  /** Setzt die Schreibmarke in einen leeren Absatz am Ende des Dokuments; ein beschriebener Absatz erhält einen neuen. */
  const toEnd = async (page: Page) => {
    const last = content(page).locator(':scope > p').last();
    await last.click();
    await page.keyboard.press(`${mod}+End`);
    if ((await last.innerText()).trim()) await page.keyboard.press('Enter');
  };
  const insert = (page: Page, element: string) => toolbar(page).getByLabel('Element einfügen').selectOption({ label: element });
  const slot = (block: Locator, role: string) => block.locator(`[data-role="${role}"]`);

  test('REQ-136-AC1/AC6: überführter Artikel öffnet sich formatiert in beiden Sprachfassungen', async ({ page, editor }) => {
    const { 'vibe-coding': vc } = await imported(editor);
    await page.goto(editorial);
    await expect(page.getByRole('link', { name: /KI in der Software.?entwicklung/ })).toBeVisible();
    await page.getByRole('link', { name: 'Vibe Coding', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`themenartikel/${vc.id}$`));
    await expect(page.getByLabel('Titel', { exact: true })).toHaveValue('Vibe Coding');
    await expect(page.getByLabel('Untertitel')).toHaveValue(/^Willkommen beim Vibe Coding/);
    await expect(page.getByLabel('Layout')).toHaveValue('magazine');
    await expect(page.getByText('/de/themen/vibe-coding')).toBeVisible();
    const doc = content(page);
    // WYSIWYG: Abschnitte, Beispielkästen, Kernaussage, Grafik und Fazit-Box erscheinen als gestaltete Elemente.
    await expect(doc.locator('section[data-kind="section"]')).toHaveCount(5);
    await expect(slot(doc.locator('section[data-kind="section"]').first(), 'eyebrow')).toHaveText('Prompt Engineering');
    await expect(doc.locator('[data-kind="example"]')).toHaveCount(6);
    await expect(doc.locator('blockquote[data-kind="statement"]')).toHaveText('Humans should review ideas, not code.');
    await expect(doc.locator('img[src="/artikelbild-harness.png"]')).toBeVisible();
    await expect(slot(doc.locator('[data-kind="conclusion"]'), 'eyebrow')).toHaveText('Fazit');
    await page.getByLabel('Sprachfassung').selectOption('en');
    await expect(page.getByLabel('Untertitel')).toHaveValue(/^Welcome to Vibe Coding/);
    await expect(slot(content(page).locator('[data-kind="conclusion"]'), 'eyebrow')).toHaveText('Conclusion');
  });

  test('REQ-136-AC5/AC12: Öffnen und Speichern ohne Änderung lässt den gespeicherten Inhalt gleich', async ({ page, editor }) => {
    const articles = await imported(editor);
    const legacy = { title: 'Bestand ' + uid(), subtitle: 'Unterzeile', blocks: [
      { kind: 'paragraph', text: 'Anfang\nzweite Zeile' }, { kind: 'h1', text: 'Abschnitt' }, { kind: 'h2', text: 'Teil' }, { kind: 'h3', text: 'Detail' },
      { kind: 'info', text: 'Merksatz' }, { kind: 'quote', text: 'Wortlaut', attribution: 'Ada' },
      { kind: 'ordered', items: [{ title: 'A', description: 'Eins' }, { title: 'B' }] }, { kind: 'unordered', items: [{ title: 'C' }] },
    ] };
    // Kopien der überführten Artikel: Die Originale bleiben für parallele Tests unverändert.
    const cases = [
      { de: { ...articles['vibe-coding'].de, title: 'Kopie ' + uid() }, en: articles['vibe-coding'].en },
      { de: { ...articles['softwareentwicklung'].de, title: 'Kopie ' + uid() }, en: articles['softwareentwicklung'].en },
      { de: legacy },
    ];
    for (const body of cases) {
      const created = await editor.send('POST', api, { ...body, status: 'draft' });
      expect(created.status()).toBe(201);
      const { id } = await created.json();
      try {
        await page.goto(`${editorial}/${id}`);
        await expect(content(page)).toContainText(body.de.blocks[0].text.split('\n')[0]);
        if (body.en) {
          // Auch die zweite Fassung einmal anzeigen, bevor gespeichert wird.
          await page.getByLabel('Sprachfassung').selectOption('en');
          await expect(page.getByLabel('Titel', { exact: true })).toHaveValue(body.en.title);
        }
        await save(page);
        const stored = await (await editor.get(`${api}/${id}`)).json();
        expect(stored.de).toEqual(body.de);
        expect(stored.en).toEqual(body.en);
      } finally {
        await editor.send('DELETE', `${api}/${id}`);
      }
    }
  });

  test('REQ-136-AC6–AC10/AC13: Schreiben und Formatieren mit Werkzeugleiste und Tastenkürzeln', async ({ page, editor }) => {
    await page.goto(editorial + '/neu');
    const title = 'WYSIWYG ' + uid();
    await page.getByLabel('Titel', { exact: true }).fill(title);
    const doc = content(page);
    // REQ-136-AC7: Elemente der Werkzeugleiste in ihrer Reihenfolge.
    await expect(toolbar(page).getByRole('button')).toHaveText([
      'Fett', 'Kursiv', 'Unterstrichen', 'Link', 'Bild', 'Aufzählung', 'Nummerierte Liste', 'Zitat', 'Infobox', 'Element entfernen', 'Rückgängig', 'Wiederholen',
    ], { useInnerText: false });
    await expect(toolbar(page).getByLabel('Stil')).toBeVisible();
    await expect(toolbar(page).getByLabel('Element einfügen')).toBeVisible();

    await doc.click();
    await page.keyboard.type('Kopfzeile');
    await toolbar(page).getByLabel('Stil').selectOption({ label: 'Überschrift 1' });
    await expect(doc.locator('h2')).toHaveText('Kopfzeile');
    await doc.locator('h2').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(toolbar(page).getByLabel('Stil')).toHaveValue('paragraph');
    await page.keyboard.type('Normal ');
    await page.keyboard.press(`${mod}+b`);
    await expect(tool(page, 'Fett')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.type('fett');
    await page.keyboard.press(`${mod}+b`);
    await expect(tool(page, 'Fett')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.type(' ');
    await tool(page, 'Kursiv').click();
    await expect(tool(page, 'Kursiv')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.type('kursiv');
    await page.keyboard.press(`${mod}+i`);
    await page.keyboard.type(' ');
    await page.keyboard.press(`${mod}+u`);
    await expect(tool(page, 'Unterstrichen')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.type('unter');
    // Tastaturbedienung der Leiste: Schaltfläche fokussieren und mit der Eingabetaste auslösen.
    await tool(page, 'Unterstrichen').focus();
    await page.keyboard.press('Enter');
    await expect(tool(page, 'Unterstrichen')).toHaveAttribute('aria-pressed', 'false');
    // Die Schreibmarke steht danach wieder im Text.
    await page.keyboard.type(' Linktext');
    await page.keyboard.press(`Shift+${mod}+ArrowLeft`);

    // REQ-136-AC9: unzulässige Adresse ergibt eine Meldung und keinen Link.
    await tool(page, 'Link').click();
    await page.getByLabel('Linkadresse').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();
    await expect(page.getByRole('alert')).toContainText('https://');
    await expect(doc.locator('a')).toHaveCount(0);
    await page.getByLabel('Linkadresse').fill('https://example.org/ziel');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();
    await expect(doc.locator('a[href="https://example.org/ziel"]')).toHaveText('Linktext');
    await expect(doc.locator('strong')).toHaveText('fett');
    await expect(doc.locator('em')).toHaveText('kursiv');
    await expect(doc.locator('u')).toHaveText('unter');

    // Rückgängig und Wiederholen per Tastenkürzel und Schaltfläche.
    await toEnd(page);
    await page.keyboard.type('Tippfehler');
    await expect(doc).toContainText('Tippfehler');
    await page.keyboard.press(`${mod}+z`);
    await expect(doc).not.toContainText('Tippfehler');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect(doc).toContainText('Tippfehler');
    await tool(page, 'Rückgängig').click();
    await expect(doc).not.toContainText('Tippfehler');
    await tool(page, 'Wiederholen').click();
    await expect(doc).toContainText('Tippfehler');
    await tool(page, 'Rückgängig').click();

    await toEnd(page);
    await tool(page, 'Aufzählung').click();
    await page.keyboard.type('Punkt A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Punkt B');
    await expect(doc.locator('ul > li')).toHaveCount(2);
    await toEnd(page);
    await tool(page, 'Nummerierte Liste').click();
    await page.keyboard.type('Schritt 1');
    await expect(doc.locator('ol > li')).toHaveText('Schritt 1');
    await toEnd(page);
    await tool(page, 'Zitat').click();
    await page.keyboard.type('Ein Zitat');
    const quote = doc.locator('[data-kind="quote"]');
    await slot(quote, 'source').click();
    await page.keyboard.type('Ada');
    await expect(quote.locator('blockquote')).toHaveText('Ein Zitat');
    await toEnd(page);
    await tool(page, 'Infobox').click();
    await page.keyboard.type('Merksatz');
    await expect(doc.locator('aside')).toHaveText('Merksatz');

    // REQ-136-AC10: abgelehnter Upload meldet sich verständlich, Eingaben bleiben erhalten.
    await toEnd(page);
    await page.getByLabel('Bilddatei').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('kein Bild') });
    await expect(page.getByRole('alert')).toContainText('Dateityp');
    await expect(doc.locator('aside')).toHaveText('Merksatz');
    await expect(doc.locator('img')).toHaveCount(0);
    await page.getByLabel('Bilddatei').setInputFiles({ name: 'bild.png', mimeType: 'image/png', buffer: pngImage() });
    const figure = doc.locator('figure[data-kind="image"]');
    await expect(figure.locator('img')).toBeVisible();
    // Ohne Alternativtext wird nicht gespeichert.
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Alternativtext');
    await expect(page).toHaveURL(/themenartikel\/neu$/);
    await figure.getByLabel('Alternativtext').fill('Grafik');
    await figure.getByLabel('Bildunterschrift').fill('Skizze');

    // REQ-136-AC7: Die Leiste bleibt beim Scrollen durch den Artikel sichtbar.
    await page.setViewportSize({ width: 1280, height: 420 });
    await figure.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 2000);
    await expect(tool(page, 'Fett')).toBeInViewport();
    await page.setViewportSize({ width: 1280, height: 800 });

    await save(page, 'Veröffentlichen');
    const id = await articleId(page);
    try {
      const stored = await (await editor.get(`${api}/${id}`)).json();
      const image = stored.de.blocks.find((b: { kind: string }) => b.kind === 'image');
      expect(image.src).toMatch(/^\/media\/[0-9a-f]{32}-960\.(jpg|png)$/);
      expect(stored.de.blocks).toEqual([
        { kind: 'h1', text: 'Kopfzeile' },
        { kind: 'paragraph', text: 'Normal fett kursiv unter Linktext', spans: [
          { start: 7, end: 11, bold: true }, { start: 12, end: 18, italic: true }, { start: 19, end: 24, underline: true },
          { start: 25, end: 33, href: 'https://example.org/ziel' },
        ] },
        { kind: 'unordered', items: [{ title: 'Punkt A' }, { title: 'Punkt B' }] },
        { kind: 'ordered', items: [{ title: 'Schritt 1' }] },
        { kind: 'quote', text: 'Ein Zitat', attribution: 'Ada' },
        { kind: 'info', text: 'Merksatz' },
        { ...image, alt: 'Grafik', caption: 'Skizze' },
      ]);
      // REQ-136-AC8: Nach erneutem Öffnen und öffentlich ist die Formatierung erhalten.
      await page.reload();
      await expect(content(page).locator('a[href="https://example.org/ziel"]')).toHaveText('Linktext');
      await expect(content(page).locator('figure[data-kind="image"]').getByLabel('Alternativtext')).toHaveValue('Grafik');
      await page.goto(`/de/themenartikel/${id}`);
      const article = page.locator('main article');
      await expect(article.locator('h2')).toHaveText('Kopfzeile');
      await expect(article.locator('p strong')).toHaveText('fett');
      await expect(article.locator('p em')).toHaveText('kursiv');
      await expect(article.locator('p u')).toHaveText('unter');
      await expect(article.locator('p a[href="https://example.org/ziel"]')).toHaveText('Linktext');
      await expect(article.locator('ul > li')).toHaveText(['Punkt A', 'Punkt B']);
      await expect(article.locator('ol > li')).toHaveText('Schritt 1');
      await expect(article.locator('blockquote')).toHaveText('Ein Zitat');
      await expect(article.locator('aside')).toHaveText('Merksatz');
      await expect(article.getByRole('img', { name: 'Grafik' })).toBeVisible();
      await expect(article.locator('figcaption').filter({ hasText: 'Skizze' })).toBeVisible();
    } finally {
      await editor.send('DELETE', `${api}/${id}`);
    }
  });

  test('REQ-136-AC9/AC11: Layout-Elemente einfügen, Link ändern und entfernen', async ({ page, editor }) => {
    await page.goto(editorial + '/neu');
    await page.getByLabel('Titel', { exact: true }).fill('Layout ' + uid());
    await page.getByLabel('Layout').selectOption({ label: 'Magazin' });
    const doc = content(page);
    await doc.click();
    await page.keyboard.type('Vorspann');
    await toolbar(page).getByLabel('Stil').selectOption({ label: 'Einleitung' });
    await expect(doc.locator('p.article-lead')).toHaveText('Vorspann');

    const fill = async (block: Locator, values: Record<string, string>) => {
      for (const [role, value] of Object.entries(values)) {
        await slot(block, role).click();
        await page.keyboard.type(value);
      }
    };
    await toEnd(page);
    await insert(page, 'Abschnittsübersicht');
    await toEnd(page);
    await insert(page, 'Nummerierter Abschnitt');
    await fill(doc.locator('[data-kind="section"]').first(), { eyebrow: 'Erstens', heading: 'Erste Überschrift', body: 'Inhalt eins' });
    await toEnd(page);
    await insert(page, 'Nummerierter Abschnitt');
    await fill(doc.locator('[data-kind="section"]').nth(1), { eyebrow: 'Zweitens', heading: 'Zweite Überschrift', body: 'Inhalt zwei' });
    // Die Übersicht im Editor nennt die Abschnitte fortlaufend nummeriert.
    await expect(doc.locator('[data-kind="outline"] li')).toHaveText(['01 Erstens Erste Überschrift', '02 Zweitens Zweite Überschrift']);
    await toEnd(page);
    await insert(page, 'Beispielkasten');
    await fill(doc.locator('[data-kind="example"]'), { label: 'Beispiel', text: 'Ein Fall' });
    await toEnd(page);
    await insert(page, 'Kernaussage');
    await page.keyboard.type('Wird entfernt');
    await expect(doc.locator('[data-kind="statement"]')).toHaveCount(1);
    await tool(page, 'Element entfernen').click();
    await expect(doc.locator('[data-kind="statement"]')).toHaveCount(0);
    await toEnd(page);
    await insert(page, 'Kernaussage');
    await page.keyboard.type('Merke');
    await toEnd(page);
    await insert(page, 'Verweis');
    const related = doc.locator('[data-kind="related"]');
    await fill(related, { label: 'Weiterlesen', title: 'Zum Thema' });
    await tool(page, 'Link').click();
    await page.getByLabel('Linkadresse').fill('/de/themen/vibe-coding');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();
    await toEnd(page);
    await insert(page, 'Zitatüberschrift');
    await fill(doc.locator('[data-kind="quoteheading"]'), { text: '„So!“', source: '– Quelle' });
    await toEnd(page);
    await insert(page, 'Fazit-Box');
    await fill(doc.locator('[data-kind="conclusion"]'), { eyebrow: 'Fazit', heading: 'Schluss', body: 'Ende' });
    await toEnd(page);
    await insert(page, 'Aufruf');
    const cta = doc.locator('[data-kind="cta"]');
    await fill(cta, { heading: 'Frage?', text: 'Schreib mir.', button: 'Zum Formular' });
    await tool(page, 'Link').click();
    await page.getByLabel('Linkadresse').fill('/de/kontakt');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();

    // Link im Fließtext setzen, ändern und wieder entfernen.
    await doc.locator('p.article-lead').click();
    await page.keyboard.press('End');
    await page.keyboard.press(`Shift+${mod}+ArrowLeft`);
    await tool(page, 'Link').click();
    await page.getByLabel('Linkadresse').fill('mailto:info@example.org');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();
    await expect(doc.locator('p.article-lead a')).toHaveAttribute('href', 'mailto:info@example.org');
    await doc.locator('p.article-lead a').click();
    await tool(page, 'Link').click();
    await expect(page.getByLabel('Linkadresse')).toHaveValue('mailto:info@example.org');
    await page.getByLabel('Linkadresse').fill('/de/blog');
    await page.getByRole('button', { name: 'Link übernehmen' }).click();
    await expect(doc.locator('p.article-lead a')).toHaveAttribute('href', '/de/blog');
    await doc.locator('p.article-lead a').click();
    await tool(page, 'Link').click();
    await page.getByRole('button', { name: 'Link entfernen' }).click();
    await expect(doc.locator('p.article-lead a')).toHaveCount(0);

    await save(page, 'Veröffentlichen');
    const id = await articleId(page);
    try {
      const stored = await (await editor.get(`${api}/${id}`)).json();
      expect(stored.de.layout).toBe('magazine');
      expect(stored.de.blocks).toEqual([
        { kind: 'lead', text: 'Vorspann' }, { kind: 'outline' },
        { kind: 'section', eyebrow: 'Erstens', text: 'Erste Überschrift', blocks: [{ kind: 'paragraph', text: 'Inhalt eins' }] },
        { kind: 'section', eyebrow: 'Zweitens', text: 'Zweite Überschrift', blocks: [{ kind: 'paragraph', text: 'Inhalt zwei' }] },
        { kind: 'example', label: 'Beispiel', text: 'Ein Fall' }, { kind: 'statement', text: 'Merke' },
        { kind: 'related', label: 'Weiterlesen', text: 'Zum Thema', href: '/de/themen/vibe-coding' },
        { kind: 'quoteheading', text: '„So!“', attribution: '– Quelle' },
        { kind: 'conclusion', eyebrow: 'Fazit', text: 'Schluss', blocks: [{ kind: 'paragraph', text: 'Ende' }] },
        { kind: 'cta', text: 'Frage?', description: 'Schreib mir.', label: 'Zum Formular', href: '/de/kontakt' },
      ]);
      await page.goto(`/de/themenartikel/${id}`);
      await expect(page.locator('.vc-number')).toHaveText(['01', '02']);
      await expect(page.locator('.vc-index a')).toHaveText([/01\s*Erstens\s*Erste Überschrift/, /02\s*Zweitens\s*Zweite Überschrift/]);
      await page.locator('.vc-index a').nth(1).click();
      await expect(page.locator('section.vc-perspective').nth(1)).toBeFocused();
      await expect(page.locator('figure.vc-example figcaption')).toHaveText('Beispiel');
      await expect(page.locator('blockquote.vc-quote')).toHaveText('Merke');
      await expect(page.locator('a.related-link')).toHaveAttribute('href', '/de/themen/vibe-coding');
      await expect(page.locator('h2.quote-heading small')).toHaveText('– Quelle');
      await expect(page.locator('section.vc-conclusion h2')).toHaveText('Schluss');
      await expect(page.locator('section.opinion a')).toHaveAttribute('href', '/de/kontakt');
      await page.locator('a.related-link').click();
      await expect(page).toHaveURL(/\/de\/themen\/vibe-coding$/);
    } finally {
      await editor.send('DELETE', `${api}/${id}`);
    }
  });

  test('REQ-136-AC13: Werkzeugleiste auf 375 px ohne horizontales Scrollen, mit Namen und Zustand', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(editorial + '/neu');
    await content(page).click();
    await page.keyboard.type('Mobil');
    const buttons = toolbar(page).getByRole('button');
    await expect(buttons).toHaveCount(12);
    for (const button of await buttons.all()) {
      await expect(button).toBeVisible();
      expect((await button.getAttribute('aria-label')) ?? (await button.innerText())).not.toBe('');
      const box = (await button.boundingBox())!;
      expect(box.x >= 0 && box.x + box.width <= 375, 'Schaltfläche liegt im sichtbaren Bereich').toBe(true);
    }
    for (const name of ['Fett', 'Kursiv', 'Unterstrichen', 'Aufzählung', 'Nummerierte Liste']) {
      await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'false');
    }
    await tool(page, 'Aufzählung').click();
    await expect(tool(page, 'Aufzählung')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('REQ-136-AC14: Warnung vor dem Verlassen mit ungespeicherten Änderungen', async ({ page }) => {
    await page.goto(editorial + '/neu');
    await expect(content(page)).toBeVisible();
    // Ohne Änderung lädt die Seite ohne Rückfrage neu.
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs++; void d.dismiss(); });
    await page.reload();
    await expect(content(page)).toBeVisible();
    expect(dialogs).toBe(0);
    await content(page).click();
    await page.keyboard.type('Ungespeichert');
    const asked = page.waitForEvent('dialog');
    void page.reload().catch(() => {});
    expect((await asked).type()).toBe('beforeunload');
    await expect(content(page)).toContainText('Ungespeichert');
  });
});

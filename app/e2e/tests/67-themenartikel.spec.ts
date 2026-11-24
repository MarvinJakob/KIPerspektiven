// Abdeckung: app/frontend-redaktion/src/pages/Articles.tsx app/frontend/src/components/ArticleBlocks.tsx app/frontend/src/components/ArticleView.tsx app/backend/internal/service/articles.go
import { AUTH, expect, pngImage, test, uid } from '../support/fixtures';

const api = '/api/admin/articles';
const editorial = '/redaktion/themenartikel';

test('REQ-67-AC5–AC9/AC11/AC12: Inhalt und Sprachfassung bleiben erhalten, öffentliche Einstiege folgen dem Status', async ({ editor, page, request }) => {
  const image = await editor.upload(api + '/media', { name: 'bild.png', mimeType: 'image/png', buffer: pngImage() });
  expect(image.status()).toBe(200);
  const { src } = await image.json();
  const title = 'Thema ' + uid();
  const de = { title, subtitle: 'Unterzeile', blocks: [
    { kind: 'paragraph', text: 'Anfang' }, { kind: 'h1', text: 'Abschnitt' }, { kind: 'h2', text: 'Teil' },
    { kind: 'h3', text: 'Detail' }, { kind: 'image', src, alt: 'Grafik', caption: 'Skizze' },
    { kind: 'info', text: 'Merksatz' }, { kind: 'quote', text: 'Wortlaut', attribution: 'Ada' },
    { kind: 'ordered', items: [{ title: 'A', description: 'Eins' }, { title: 'B' }] },
    { kind: 'unordered', items: [{ title: 'C' }] },
  ] };
  expect((await editor.send('POST', api, { de: { title, blocks: [{ kind:'image', src, alt:'  ' }] }, status:'draft' })).status()).toBe(422);
  const created = await editor.send('POST', api, { de, status:'draft' });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const path = api + '/' + id, url = '/de/themenartikel/' + id;
  const checkDiscovery = async (visible: boolean) => {
    await page.goto('/de');
    await page.getByRole('button', { name:'Themen', exact:true }).click();
    for (const scope of [page.locator('header'), page.locator('#themen')]) {
      await expect(scope.locator('a[href="' + url + '"]')).toHaveCount(visible ? 1 : 0);
    }
  };
  try {
    expect((await request.get(url)).status()).toBe(404);
    await checkDiscovery(false);
    expect((await editor.send('PUT', path, { de, status: 'published' })).ok()).toBe(true);
    expect((await (await editor.get(path)).json()).de).toEqual(de);
    await checkDiscovery(true);
    await page.locator('#themen').getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level:1 })).toHaveText(title);
    await expect(page.locator('article')).toContainText('Unterzeile');
    await expect(page.getByRole('img', { name:'Grafik' })).toBeVisible();
    await expect(page.locator('figure').filter({has:page.locator('img')}).locator('figcaption')).toHaveText('Skizze');
    await expect(page.locator('article aside')).toHaveText('Merksatz');
    await expect(page.locator('article blockquote')).toContainText('Wortlaut');
    await page.goto('/en/themenartikel/' + id);
    await expect(page.getByRole('heading', {level:1})).toHaveText(title);
    await expect(page.getByText(/German|Deutsch/i).filter({visible:true}).first()).toBeVisible();
    const en = { title: 'Article ' + uid(), blocks: [] };
    expect((await editor.send('PUT', path, { de, en, status:'published' })).ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', {level:1})).toHaveText(en.title);
    await expect(page.getByText('Unterzeile')).toHaveCount(0);
    expect((await editor.send('PUT', path, { de, status:'draft' })).ok()).toBe(true);
    expect((await request.get(url)).status()).toBe(404);
    await checkDiscovery(false);
    expect((await editor.send('PUT', path, { de, status:'published' })).ok()).toBe(true);
    expect((await editor.send('DELETE', path)).status()).toBe(204);
    expect((await request.get(url)).status()).toBe(404);
    await checkDiscovery(false);
  } finally { await editor.send('DELETE', path); }
});

test('REQ-67-AC10: direkte Aktionen ohne Sitzung gesperrt', async ({ request }) => {
  for (const [method, path] of [['GET',api],['GET',api+'/1'],['POST',api],['PUT',api+'/1'],['DELETE',api+'/1'],['PUT',api+'/media'],['GET','/api/admin/authors']]) {
    expect((await request.fetch(path,{method})).status(), method+' '+path).toBe(401);
  }
  for (const path of [editorial, editorial+'/neu', editorial+'/1']) {
    const res = await request.get(path,{maxRedirects:0});
    expect(res.headers().location).toContain('/redaktion/anmelden');
  }
});

test.describe('Redaktionsoberfläche', () => {
  test.use({storageState: AUTH.editor});
  test('REQ-67-AC4–AC12: Inhalt im Editor verfassen und beide Fassungen veröffentlichen', async ({page,editor,admin}) => {
    await page.goto(editorial+'/neu');
    const title = 'Redaktion '+uid();
    await page.getByLabel('Titel',{exact:true}).fill(title);
    await page.getByLabel('Autor').selectOption(String(admin.me.id));
    // Seit #136 entsteht der Inhalt im WYSIWYG-Editor; die Werkzeugleiste ist per Tastatur bedienbar (REQ-67-AC10).
    const content = page.getByRole('textbox', { name: 'Artikelinhalt' });
    const tool = (name: string) => page.getByRole('toolbar', { name: 'Formatierung' }).getByRole('button', { name, exact: true });
    await content.click();
    await tool('Zitat').press('Enter');
    await page.keyboard.type('Ein Zitat');
    await content.locator('[data-kind="quote"] [data-role="source"]').click();
    await page.keyboard.type('Ada');
    await content.locator(':scope > p').last().click();
    await tool('Infobox').press('Enter');
    await page.keyboard.type('Merken');
    await content.locator(':scope > p').last().click();
    await tool('Nummerierte Liste').press('Enter');
    // Der Zeilenumbruch im Eintrag trennt Eintragstitel und Kurzbeschreibung.
    await page.keyboard.type('Eintrag A');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Beschreibung A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Eintrag B');
    await page.getByLabel('Sprachfassung').selectOption('en');
    await page.getByLabel('Titel',{exact:true}).fill('English '+title);
    await page.getByRole('button',{name:'Veröffentlichen',exact:true}).press('Enter');
    await expect(page).toHaveURL(/themenartikel\/\d+$/);
    const id = page.url().split('/').pop();
    try {
      const data = await (await editor.get(api+'/'+id)).json();
      expect(data.authorId).toBe(admin.me.id);
      expect(data.de.blocks).toEqual([
        {kind:'quote',text:'Ein Zitat',attribution:'Ada'}, {kind:'info',text:'Merken'},
        {kind:'ordered',items:[{title:'Eintrag A',description:'Beschreibung A'},{title:'Eintrag B'}]},
      ]);
      expect(data.en.title).toBe('English '+title);
      await page.getByRole('button',{name:'Zurücknehmen'}).press('Enter');
      await expect(page.getByRole('status')).toContainText('gespeichert');
      expect((await page.request.get('/de/themenartikel/'+id)).status()).toBe(404);
      await page.getByRole('button',{name:'Löschen',exact:true}).press('Enter');
      await page.getByRole('button',{name:'Endgültig löschen'}).press('Enter');
      await expect(page).toHaveURL(/\/redaktion\/themenartikel$/);
      await expect(page.getByRole('link',{name:title})).toHaveCount(0);
    } finally { await editor.send('DELETE',api+'/'+id); }
  });
});

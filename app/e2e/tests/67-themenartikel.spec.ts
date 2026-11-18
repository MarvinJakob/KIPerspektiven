// Abdeckung: app/frontend-redaktion/src/pages/Articles.tsx app/frontend/src/components/ArticleBlocks.tsx app/backend/internal/service/articles.go
import { AUTH, expect, expectNoHorizontalScroll, pngImage, test, uid } from '../support/fixtures';

const api = '/api/admin/articles';
const editorial = '/redaktion/themenartikel';
const draft = (title: string) => ({ status: 'draft', de: { title, blocks: [] } });

test('REQ-67-AC2/AC3/AC4: atomare Titel- und Autorenprüfung, bestehende deaktivierte Zuordnung', async ({ admin, editor, page }) => {
  for (const title of ['', '   ']) expect((await editor.send('POST', api, draft(title))).status()).toBe(422);
  const b = await admin.send('POST', '/api/admin/users', { email: uid() + '@example.test', password: 'startpass10', roles: ['editor'] });
  expect(b.status()).toBe(201);
  const author = await b.json();
  const body = draft('Autor ' + uid());
  const created = await editor.send('POST', api, body);
  expect(created.status()).toBe(201);
  const article = await created.json();
  const path = api + '/' + article.id;
  try {
    expect(article.authorId).toBe(editor.me.id);
    expect((await editor.send('PUT', path, { ...body, authorId: author.id })).status()).toBe(200);
    expect((await admin.send('PATCH', '/api/admin/users/' + author.id, { active: false })).ok()).toBe(true);
    expect((await editor.send('PUT', path, { ...draft('Bearbeitet'), authorId: author.id })).ok()).toBe(true);
    expect((await (await editor.get(path)).json()).authorId).toBe(author.id);
    await page.context().addCookies((await editor.ctx.storageState()).cookies);
    await page.goto(editorial + '/' + article.id);
    await expect(page.getByLabel('Autor').locator('option:checked')).toContainText(/deaktiviert/i);
    expect((await editor.send('PUT', path, { ...body, authorId: admin.me.id })).ok()).toBe(true);
    expect((await editor.send('PUT', path, { ...draft('Verwerfen'), authorId: author.id })).status()).toBe(422);
    expect(await (await editor.get(path)).json()).toMatchObject({ de: { title: body.de.title }, authorId: admin.me.id });
    expect((await (await editor.get('/api/admin/authors')).json()).items.map((a: {id:number}) => a.id)).not.toContain(author.id);
  } finally { await editor.send('DELETE', path); }
});

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
  test('REQ-67-AC4–AC12: Bausteine im Editor anordnen und beide Fassungen veröffentlichen', async ({page,editor,admin}) => {
    await page.goto(editorial+'/neu');
    const title = 'Redaktion '+uid();
    await page.getByLabel('Titel',{exact:true}).fill(title);
    await page.getByLabel('Autor').selectOption(String(admin.me.id));
    const add = async (kind: string) => {
      await page.getByLabel('Baustein',{exact:true}).selectOption(kind);
      await page.getByRole('button',{name:'Baustein hinzufügen'}).press('Enter');
      return page.locator('.article-block-editor > fieldset').last();
    };
    const info = await add('info');
    await info.getByLabel('Text',{exact:true}).fill('Merken');
    const quote = await add('quote');
    await quote.getByLabel('Text',{exact:true}).fill('Ein Zitat');
    await quote.getByLabel('Zuschreibung').fill('Ada');
    await quote.getByRole('button',{name:'Nach oben'}).press('Enter');
    const list = await add('ordered');
    await list.getByLabel('Eintragstitel').fill('Eintrag A');
    await list.getByLabel('Kurzbeschreibung').fill('Beschreibung A');
    await list.getByRole('button',{name:'Eintrag hinzufügen'}).press('Enter');
    await list.getByLabel('Eintragstitel').last().fill('Eintrag B');
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
  for (const width of [375,1280]) {
    test('REQ-67-AC1/AC2/AC3/AC6/AC10: per Tastatur anlegen, nach Uploadfehler bearbeiten und wieder öffnen bei '+width+' px', async ({page,editor}) => {
      await page.setViewportSize({width,height:800});
      const title = 'Entwurf '+uid();
      await page.goto(editorial);
      await page.getByRole('link',{name:'Themenartikel anlegen'}).press('Enter');
      await expect(page.getByLabel('Autor')).toHaveValue(String(editor.me.id));
      await page.getByLabel('Titel',{exact:true}).fill('   ');
      await page.getByRole('button',{name:'Speichern',exact:true}).press('Enter');
      await expect(page.getByLabel('Titel',{exact:true})).toHaveAttribute('aria-invalid','true');
      await page.getByLabel('Titel',{exact:true}).fill(title);
      await page.getByLabel('Baustein').selectOption('image');
      await page.getByRole('button',{name:'Baustein hinzufügen'}).press('Enter');
      await page.getByLabel('Bilddatei').setInputFiles({name:'falsch.txt',mimeType:'text/plain',buffer:Buffer.from('Text')});
      await expect(page.getByRole('alert')).toContainText(/Dateityp|JPEG/);
      await expect(page.getByLabel('Titel',{exact:true})).toHaveValue(title);
      await page.getByLabel('Bilddatei').setInputFiles({name:'bild.png',mimeType:'image/png',buffer:pngImage()});
      await expect(page.locator('fieldset img')).toBeVisible();
      await page.getByLabel('Alternativtext').fill('Schaltplan');
      await expectNoHorizontalScroll(page);
      await page.getByRole('button',{name:'Speichern',exact:true}).press('Enter');
      await expect(page).toHaveURL(/themenartikel\/\d+$/);
      const path = api+'/'+page.url().split('/').pop();
      try {
        await page.goto(editorial);
        await page.getByRole('link',{name:title,exact:true}).press('Enter');
        await expect(page.getByLabel('Alternativtext')).toHaveValue('Schaltplan');
        await page.getByLabel('Untertitel',{exact:true}).fill('Neu');
        await page.getByRole('button',{name:'Speichern',exact:true}).press('Enter');
        await expect(page.getByRole('status')).toContainText('gespeichert');
        await page.reload();
        await expect(page.getByLabel('Untertitel',{exact:true})).toHaveValue('Neu');
      } finally { await editor.send('DELETE',path); }
    });
  }
});

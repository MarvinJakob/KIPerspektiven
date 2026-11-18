// Abdeckung: app/backend/internal/http/articles.go app/frontend-redaktion/src/pages/Articles.tsx
import { AUTH, expect, test, uid } from '../support/fixtures';

test('REQ-67-AC4/AC10: nur redaktionelle Konten, öffentlicher Anzeigename ohne Link', async ({ admin, editor, login, page }) => {
  const email = uid() + '@example.test';
  const created = await admin.send('POST','/api/admin/users',{email,password:'artikel-test123',roles:['editor']});
  expect(created.status()).toBe(201);
  const account = await created.json();
  const { session } = await login(email,'artikel-test123');
  expect((await session!.send('PATCH','/api/profile',{displayName:'Ada Beispiel'})).status()).toBe(200);
  const mk = await admin.send('POST','/api/admin/users',{email:'marketing-'+email,password:'artikel-test123',roles:['marketing']});
  expect(mk.status()).toBe(201);
  const marketing = await mk.json();
  const { session: reader } = await login(marketing.email,'artikel-test123');
  const api = '/api/admin/articles';
  for (const [method, path] of [['GET',api],['GET',api+'/1'],['POST',api],['PUT',api+'/1'],['DELETE',api+'/1'],['PUT',api+'/media']] as const) {
    expect((await reader!.ctx.fetch(path,{method,headers:{'X-CSRF-Token':reader!.me.csrfToken}})).status()).toBe(403);
  }
  for (const suffix of ['', '/neu', '/1']) expect((await reader!.get('/redaktion/themenartikel'+suffix)).status()).toBe(403);
  const options = await (await editor.get('/api/admin/authors')).json();
  expect(options.items.map((a:{id:number})=>a.id)).not.toContain(marketing.id);
  const data = { de:{title: 'Kontotest '+uid(),blocks:[]}, status:'published', authorId: account.id };
  const article = await editor.send('POST',api,data);
  expect(article.status()).toBe(201);
  const {id} = await article.json();
  try {
    expect((await editor.send('PUT',api+'/'+id,{...data,authorId:marketing.id})).status()).toBe(422);
    expect((await (await editor.get(api+'/'+id)).json()).authorId).toBe(account.id);
    await page.goto('/de/themenartikel/'+id);
    const author = page.locator('article').getByText('Ada Beispiel',{exact:true});
    await expect(author).toBeVisible();
    expect(await author.evaluate(el=>el.closest('a')===null)).toBe(true);
    expect(await (await page.request.get('/api/articles/'+id+'?lang=de')).text()).not.toContain(email);
  } finally { await editor.send('DELETE',api+'/'+id); }
});

test.describe('Leere Übersicht', () => {
  test.use({storageState:AUTH.editor});
  test('REQ-67-AC1: leeres Ergebnis bietet Anlegen und einen Leerhinweis',async({page})=>{
    await page.route('**/api/admin/articles', route=>route.fulfill({json:{items:[]}}));
    await page.goto('/redaktion/themenartikel');
    await expect(page.getByText(/noch keine Themenartikel/i)).toBeVisible();
    await expect(page.getByRole('link',{name:'Themenartikel anlegen'})).toBeVisible();
  });
});

// REQ-7: Browser/HTTP-Vertrag, unabhängig von Anwendungscode und lokalen Referenzdateien.
import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { content } from './REQ-7.content';

type Lang = 'de' | 'en';
const languages: Lang[] = ['de', 'en'];
const path = (lang: Lang) => `/${lang}/themen/softwareentwicklung`;
const copy = {
  de: {
    title: /KI in der Software[\s\u00ad]*entwicklung/i,
    modern: 'Moderne Softwareentwicklung', way: /Das ist der Weg/,
    opinion: 'Würdest du auch so entwickeln?', invitation: /Teile mir gerne deine Meinung dazu mit/i,
    contact: /Zum Kontaktformular/i, more: /Mehr Themen/i, back: /Alle Themen/i,
    vibe: /Wie du mit Vibe Coding sinnvolle Ergebnisse erzieh?lst/i,
    diagram: /Entwicklungsprozess:/i, releaseDiagram: /Release Gate:/i,
    fullDiagram: /(?:Grafik.*Entwicklungsprozess|Entwicklungsprozess.*Grafik).*voller Größe/i,
    fullRelease: /(?:Grafik.*Release Gate|Release Gate.*Grafik).*voller Größe/i,
    date: /16\. November 2026/, reading: /(?:ca\.?\s*)?4 Min(?:uten|\.)?.*Lesezeit/i,
  },
  en: {
    title: /AI in Software Development/i,
    modern: /Modern Software Development/i, way: /This is the [Ww]ay/,
    opinion: /Would you (?:also )?develop (?:like this|this way)/i,
    invitation: /(?:share|tell me).*your (?:opinion|thoughts|views)/i,
    contact: /(?:(?:Go to|Open|To) (?:the )?)?contact form/i, more: /More Topics/i, back: /All Topics/i,
    vibe: /(?:How.*Vibe Coding.*(?:useful|meaningful|sensible) results|How.*(?:useful|meaningful|sensible) results.*Vibe Coding)/i,
    diagram: /Development (?:process|workflow):/i, releaseDiagram: /Release Gate:/i,
    fullDiagram: /(?:full.size.*development (?:process|workflow)|development (?:process|workflow).*full.size)/i,
    fullRelease: /(?:full.size.*Release Gate|Release Gate.*full.size)/i,
    date: /(?:16 November|November 16,?) 2026/, reading: /4.?min(?:ute)?.*(?:read|reading)/i,
  },
};
// HTTP-Inhalt der vier im Issue benannten Original-PNGs, nicht deren Website-Pfad.
const hashes = {
  de: ['3ead4d8c08a125b46d25658d7f785200c9643b5fed614a657abdc5abf74e29f5', 'f7b8938af04aeca7b8f1c3406990bb95f1d2f29f405259d16407079afb765b85'],
  en: ['cf27c9bf63aa5e53218e39e8e8bd6a9963d1530bdddd8119d254ef4e99b3482d', '5d64933fab07bd9a1d48dc6334ad538df5fcfe0c082689160a1cb135df724f4f'],
};

async function open(page: Page, lang: Lang) {
  const response = await page.goto(path(lang));
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: copy[lang].title })).toBeVisible();
  return page.getByRole('main');
}

async function checkContent(page: Page, group: keyof typeof content) {
  for (const lang of languages) {
    const main = await open(page, lang);
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    for (const statement of content[group][lang]) {
      expect.soft(text, `${lang}: fachliche Aussage ${statement}`).toMatch(statement);
    }
  }
}

async function box(element: Locator) {
  await expect(element).toBeVisible();
  const result = await element.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

async function showNavigation(page: Page) {
  // Sprachwechsel aktualisiert auch Seitenfokus und Menü. Zuerst die sichtbare
  // Navigation rendern lassen, dann deren geöffneten Zustand berücksichtigen.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const menu = page.getByRole('button', { name: /^(?:Menü|Menu)$/ });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') {
    await menu.click();
  }
}

async function checkFragment(page: Page, target: URL) {
  if (!target.hash) return;
  const fragment = decodeURIComponent(target.hash.slice(1));
  // Öffentliche Fragment-ID an semantisch gefundenen Inhaltsankern prüfen,
  // ohne CSS-Selektoren oder Wissen über Anwendungscode.
  const anchors = page.getByRole('main').getByRole('heading').or(page.getByRole('main').getByRole('region'));
  const matching: Locator[] = [];
  for (const anchor of await anchors.all()) {
    if (await anchor.getAttribute('id') === fragment) matching.push(anchor);
  }
  expect(matching, `vorhandener Inhaltsanker ${target.hash}`).toHaveLength(1);
  await expect(matching[0]).toBeInViewport();
}

async function followLocal(page: Page, link: Locator, lang: Lang) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href, 'echtes Website-Ziel statt Mock-/Markdown-/Sprung-Platzhalter').toBeTruthy();
  const target = new URL(href!, page.url());
  expect(target.origin).toBe(new URL(page.url()).origin);
  expect(target.pathname).toMatch(new RegExp(`^/${lang}(?:/|$)`));
  expect(target.pathname).not.toMatch(/\.(?:md|html)$|\/(?:mock|content|res)\//i);
  expect(target.pathname).not.toBe(path(lang));
  const response = await page.request.get(target.href);
  expect(response.status(), target.href).toBe(200);
  await link.click();
  await expect(page).toHaveURL(target.href);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/Seite nicht gefunden|Page not found/i);
  await checkFragment(page, target);
  return target;
}

async function followTopic(page: Page, link: Locator, lang: Lang, topic: RegExp) {
  const target = await followLocal(page, link, lang);
  if (target.pathname.replace(/\/$/, '') === `/${lang}`) {
    expect(target.hash, 'Übersichtslink führt direkt zum passenden Themenabschnitt').not.toBe('');
    const topicLabel = new RegExp(`^(?:\\d+\\s+)?(?:${topic.source})$`, topic.flags);
    const section = page.getByRole('main').getByRole('region').filter({ has: page.getByText(topicLabel) });
    await expect(section).toHaveCount(1);
    await expect(section.getByRole('heading', { level: 2 })).toHaveAttribute('id', decodeURIComponent(target.hash.slice(1)));
  } else {
    expect(target.pathname).toMatch(new RegExp(`^/${lang}/themen/[^/]+/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(topic);
  }
}

test('REQ-7-AC1 Themenübersicht und direkte Sprach-URLs führen zum Artikel', async ({ page }) => {
  for (const lang of languages) {
    await page.goto(`/${lang}`);
    const article = page.getByRole('link', { name: lang === 'de' ? /Zum Artikel: KI in der Softwareentwicklung/i : /(?:Read.*|Article:.*|To the article:.*)AI in Software Development/i });
    await article.click();
    await expect(page).toHaveURL(new RegExp(`${path(lang)}/?$`));
    await open(page, lang); // direkter Aufruf, unabhängig vom vorherigen SPA-Zustand
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: copy[lang].title })).toBeVisible();
  }
});

test('REQ-7-AC2 Hero zeigt Titel, Autor, Stand, Lesezeit und Themen-Breadcrumb', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await expect(main.getByText('Marvin Jakob', { exact: true })).toBeVisible();
    await expect(main.getByText(copy[lang].date)).toBeVisible();
    await expect(main.getByText(copy[lang].reading)).toBeVisible();
    const breadcrumb = main.getByRole('navigation', { name: /Brotkrümel|Breadcrumb/i });
    await expect(breadcrumb.getByRole('link', { name: lang === 'de' ? 'Themen' : 'Topics', exact: true })).toBeVisible();
    await expect(breadcrumb).toContainText(lang === 'de' ? /Softwareentwicklung/ : /Software Development/i);
  }
});

test('REQ-7-AC3 Moderne Softwareentwicklung enthält alle fachlichen Aussagen beider Sprachen', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await expect.soft(main.getByRole('heading', { name: copy[lang].modern })).toBeVisible();
  }
  await checkContent(page, 'modern');
});
test('REQ-7-AC4 Der Weg erklärt Anforderungen, Warum und die Arbeitsteilung mit der Maschine', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await expect(main.getByRole('heading', { name: copy[lang].way })).toBeVisible();
    await expect(main.getByText(/Din Djarin/)).toBeVisible();
  }
  await checkContent(page, 'rationale');
});
test('REQ-7-AC5 Drei Teams und Merge Gate werden vollständig in beiden Sprachen erklärt', async ({ page }) => {
  await checkContent(page, 'teams');
});
test('REQ-7-AC6 Release-Absatz erklärt Commit-Bündelung, finalen Test und den abschließenden Push', async ({ page }) => {
  await checkContent(page, 'release');
});

test('REQ-7-AC7 Der hervorgehobene Kontaktaufruf lädt in beiden Sprachen zur Meinung ein', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await expect(main.getByRole('heading', { name: copy[lang].opinion })).toBeVisible();
    await expect(main.getByText(copy[lang].invitation)).toBeVisible();
    await expect(main.getByRole('link', { name: copy[lang].contact })).toBeVisible();
  }
});

test('REQ-7-AC8 Beide vorgesehenen Originalgrafiken werden sprachlich passend geladen', async ({ page, request }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    for (const [index, name] of [copy[lang].diagram, copy[lang].releaseDiagram].entries()) {
      const image = main.getByRole('img', { name });
      await expect(image, `${lang}: ${name}`).toHaveCount(1);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      const src = await image.evaluate((img: HTMLImageElement) => img.currentSrc);
      const response = await request.get(src);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^image\/png/);
      expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(hashes[lang][index]);
    }
  }
});

test('REQ-7-AC9 Beide Grafiken lassen sich wie im Mock in voller Größe öffnen', async ({ page, request }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    for (const [index, name] of [copy[lang].fullDiagram, copy[lang].fullRelease].entries()) {
      const link = main.getByRole('link', { name });
      await expect(link, `${lang}: Vergrößerung ${name}`).toHaveCount(1);
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      const target = new URL(href!, page.url()).href;
      const response = await request.get(target);
      expect(response.status()).toBe(200);
      expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(hashes[lang][index]);
      const popupPromise = page.waitForEvent('popup');
      await link.focus();
      await expect(link).toBeFocused();
      await link.press('Enter');
      const popup = await popupPromise;
      await popup.waitForLoadState();
      expect(popup.url()).toBe(target);
      await popup.close();
    }
  }
});

test('REQ-7-AC10 Die Abschnittsfolge entspricht dem Mock', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    const anchors = [
      main.getByRole('heading', { level: 1 }),
      main.getByRole('heading', { name: copy[lang].modern }),
      main.getByRole('link', { name: copy[lang].vibe }),
      main.getByRole('heading', { name: copy[lang].way }),
      main.getByRole('img', { name: copy[lang].diagram }),
      main.getByText(content.teams[lang][0]),
      main.getByRole('img', { name: copy[lang].releaseDiagram }),
      main.getByText(content.release[lang][0]),
      main.getByRole('heading', { name: copy[lang].opinion }),
      main.getByRole('heading', { name: copy[lang].more }),
    ];
    let bottom = -Infinity;
    for (const anchor of anchors) {
      const bounds = await box(anchor);
      expect(bounds.y, 'Abschnitte stehen untereinander in der vorgesehenen Reihenfolge').toBeGreaterThanOrEqual(bottom - 1);
      bottom = bounds.y + bounds.height;
    }
  }
});

test('REQ-7-AC11 Text, Grafiken und Aktionen bleiben ohne Abschneiden im Viewport lesbar', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    const width = page.viewportSize()!.width;
    const elements = [main.getByRole('heading', { level: 1 }), main.getByRole('heading', { name: copy[lang].modern }), main.getByRole('img', { name: copy[lang].diagram }), main.getByRole('img', { name: copy[lang].releaseDiagram }), main.getByRole('link', { name: copy[lang].contact })];
    const paragraph = main.getByText(content.modern[lang][0]);
    elements.push(paragraph);
    for (const element of elements) {
      const bounds = await box(element);
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.width).toBeGreaterThan(0);
    }
    for (const name of [copy[lang].diagram, copy[lang].releaseDiagram]) {
      const dimensions = await main.getByRole('img', { name }).evaluate((img: HTMLImageElement) => ({
        width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height,
        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
      }));
      expect(dimensions.naturalWidth).toBeGreaterThan(0);
      expect(dimensions.naturalHeight).toBeGreaterThan(0);
      expect(dimensions.width / dimensions.height).toBeCloseTo(dimensions.naturalWidth / dimensions.naturalHeight, 1);
    }
    const typography = await paragraph.evaluate((el) => {
      const style = getComputedStyle(el);
      return { size: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
    });
    expect(typography.size).toBeGreaterThanOrEqual(16);
    expect(typography.line / typography.size).toBeGreaterThanOrEqual(1.5);
    expect((await box(paragraph)).width).toBeLessThanOrEqual(800);
    const action = await box(main.getByRole('link', { name: copy[lang].contact }));
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
});

test('REQ-7-AC12 Der Vibe-Coding-Verweis öffnet die passende echte Themenseite', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await followLocal(page, main.getByRole('link', { name: copy[lang].vibe }), lang);
    await expect(page).toHaveURL(new RegExp(`^.+/${lang}/themen/[^/?#]+/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Vibe Coding/i);
  }
});

test('REQ-7-AC13 Der Kontaktaufruf öffnet die echte Kontaktseite mit Formular', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await followLocal(page, main.getByRole('link', { name: copy[lang].contact }), lang);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Kontakt|Contact/i);
    await expect(page.getByRole('textbox', { name: /E.?Mail/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Nachricht|Message/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Senden|Send|Submit/i })).toBeVisible();
  }
});

test('REQ-7-AC14 Sprachwechsel erhält den Artikel und übersetzt Titel und Bedienelemente', async ({ page }) => {
  await open(page, 'de');
  for (const lang of ['en', 'de'] as const) {
    await showNavigation(page);
    const button = page.getByRole('button', { name: lang === 'de' ? /^(DE|Deutsch|German)$/ : /^(EN|English|Englisch)$/ });
    await button.click();
    await expect(page).toHaveURL(new RegExp(`${path(lang)}/?$`));
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: copy[lang].title })).toBeVisible();
    await expect(main.getByRole('heading', { name: copy[lang].modern })).toBeVisible();
    await expect(main.getByRole('link', { name: copy[lang].contact })).toBeVisible();
    await expect(main.getByRole('link', { name: copy[lang].back })).toBeVisible();
    await expect(main.getByRole('link', { name: copy[lang].fullDiagram })).toHaveCount(1);
    await expect(main.getByRole('link', { name: copy[lang].fullRelease })).toHaveCount(1);
    await expect(main).not.toContainText(/(?:Übersetzung.*nicht verfügbar|translation.*not (?:yet )?available)/i);
    const text = await main.innerText();
    expect(text).not.toMatch(lang === 'de' ? /\bIhnen\b|\bIhre(?:n|m|r|s)? (?:Meinung|Ergebnisse|Software)\b|(?:erfahren|entwickeln|teilen|würden) Sie\b/ : /Moderne Softwareentwicklung|Würdest du auch|Zum Kontaktformular|Alle Themen/);
    await showNavigation(page);
    await expect(page.getByRole('navigation', { name: /Hauptnavigation|Main navigation/i }).getByRole('link', { name: lang === 'de' ? 'KI Readiness' : 'AI Readiness', exact: true })).toBeVisible();
  }
});

test('REQ-7-AC15 Weitere Themen und Rückweg zur Übersicht sind echte Website-Links', async ({ page }) => {
  for (const lang of languages) {
    for (const topic of [/Data Analytics/i, lang === 'de' ? /Modelle und Kosten/i : /Models and Costs/i]) {
      const main = await open(page, lang);
      const more = main.getByRole('region', { name: copy[lang].more });
      await followTopic(page, more.getByRole('link', { name: topic }), lang, topic);
    }
    const main = await open(page, lang);
    const back = main.getByRole('link', { name: copy[lang].back });
    await expect(back).toBeVisible();
    const target = new URL((await back.getAttribute('href'))!, page.url());
    expect(target.origin).toBe(new URL(page.url()).origin);
    expect(target.pathname.replace(/\/$/, '')).toBe(`/${lang}`);
    await back.click();
    await expect(page).toHaveURL(target.href);
    await checkFragment(page, target);
    await expect(page.getByRole('link', { name: lang === 'de' ? /Zum Artikel: KI in der Softwareentwicklung/i : /(?:Read.*|Article:.*|To the article:.*)AI in Software Development/i })).toBeVisible();
  }
});

test('REQ-7-AC16 Lokale Mock-Ziele und Hinweis-Platzhalter sind vollständig ersetzt', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    await expect(main).not.toContainText(/hier Grafik|Link: Kontaktformular|Platzhalter|placeholder|Lokaler Designentwurf|local design draft/i);
    for (const link of await main.getByRole('link').all()) {
      const href = await link.getAttribute('href');
      expect(href, await link.innerText()).toBeTruthy();
      expect(href).not.toMatch(/(?:^|\/)mock\/|\.md(?:[?#]|$)|javascript:|^#meinung$/i);
    }
  }
});

test('REQ-7-AC17 Artikelgestaltung und Themenkarten folgen dem responsiven Mock', async ({ page }) => {
  for (const lang of languages) {
    const main = await open(page, lang);
    const mobile = page.viewportSize()!.width <= 650;
    const title = main.getByRole('heading', { level: 1 });
    expect(await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(mobile ? 30 : 48);
    // Sichtbare Hintergrundfarbe am Textpunkt: nächste tatsächlich bemalte Fläche.
    const background = async (element: Locator) => element.evaluate((el) => {
      for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
        const color = getComputedStyle(ancestor).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'transparent';
    });
    expect(await background(title)).toBe('rgb(252, 248, 243)');
    expect(await background(main.getByRole('heading', { name: copy[lang].opinion }))).toBe('rgb(220, 110, 20)');
    const paragraph = await box(main.getByText(content.modern[lang][0]));
    const diagram = await box(main.getByRole('img', { name: copy[lang].diagram }));
    if (!mobile) {
      expect(diagram.width).toBeGreaterThan(paragraph.width + 100);
      expect(Math.abs(paragraph.x + paragraph.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(8);
    }
    const more = main.getByRole('region', { name: copy[lang].more });
    const first = await box(more.getByRole('link', { name: /Data Analytics/i }));
    const second = await box(more.getByRole('link', { name: lang === 'de' ? /Modelle und Kosten/i : /Models and Costs/i }));
    if (mobile) {
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
      expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
    }
  }
});

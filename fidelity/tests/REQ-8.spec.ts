// REQ-8 Benennungen vereinheitlichen: KI Readiness, News und durchgängige Du-Ansprache – Spezifikation: specs/REQ-8.md
// Regel: Jeder Testtitel beginnt mit der ID des Akzeptanzkriteriums (scripts/gate.mjs wertet danach aus).
import { expect, test, type Locator, type Page } from '@playwright/test';

type Lang = 'de' | 'en';

const NAMES = {
  de: { readiness: 'KI Readiness', news: 'News', nav: 'Hauptnavigation', menu: /^menü$/i, cookies: 'Cookie-Einstellungen' },
  en: { readiness: 'AI Readiness', news: 'News', nav: 'Main navigation', menu: /^menu$/i, cookies: 'Cookie settings' },
} as const;

/** Frühere Funktionsnamen, die in Navigation, Überschriften, Links, Schaltflächen und Seitentiteln nicht mehr vorkommen. */
const OLD_READINESS = { de: /\baudit\b|selbsteinschätzung/i, en: /\baudit\b|self-assessment/i } as const;
const OLD_NEWS = /\bblog\b/i;

/** Pfad der Readiness-Übersicht und der News-Übersicht. Die URLs bleiben unverändert (siehe Spezifikation). */
const readinessPath = (lang: Lang) => `/${lang}/themen/ai-audit`;
const newsPath = (lang: Lang) => `/${lang}/blog`;

/** Redaktionelle Beiträge (Titel, Kurztext, Text) gehören nicht zur Anforderung: Links zu einem Beitrag und ihr Inhalt. */
const POST_LINK = /^\/(de|en)\/blog\/[^/?#]+/;

type Named = { role: string; name: string; href: string | null; lang: string | null; withoutFallback: string };

/** Sichtbare Namen aller Überschriften, Links und Schaltflächen der Seite – ohne Beitragslinks und ihren Inhalt. */
async function namedElements(page: Page): Promise<Named[]> {
  return page.evaluate((postLink) => {
    const re = new RegExp(postLink);
    const inPost = (el: Element) => {
      const a = el.closest('a[href]');
      return !!a && re.test(new URL(a.getAttribute('href')!, location.href).pathname);
    };
    const out: { role: string; name: string; href: string | null; lang: string | null; withoutFallback: string }[] = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],a[href],button,[role=button],[role=link]').forEach((el) => {
      if (inPost(el) || !el.checkVisibility()) return;
      const role = /^H\d$/.test(el.tagName) || el.getAttribute('role') === 'heading' ? 'heading'
        : el.tagName === 'A' || el.getAttribute('role') === 'link' ? 'link' : 'button';
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const raw = el.getAttribute('href');
      // Sprungmarken (#…) bleiben unverändert; interne Links werden zum Pfad, externe bleiben vollständig.
      const href = raw === null || raw.startsWith('#') ? raw
        : new URL(raw, location.href).origin === location.origin ? new URL(raw, location.href).pathname : raw;
      const copy = el.cloneNode(true) as Element;
      copy.querySelectorAll('[lang="de"]').forEach((part) => part.remove());
      const withoutFallback = (el.getAttribute('aria-label') ?? copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      out.push({ role, name, href, lang: el.closest('[lang]')?.getAttribute('lang') ?? null, withoutFallback });
    });
    return out;
  }, POST_LINK.source);
}

/** Wartet, bis die Seite ihre Inhalte geladen hat (Überschrift sichtbar, keine Ladeanzeige). */
async function openPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/^(Wird geladen|Loading) …$/)).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}

/** Öffnet bei schmaler Ansicht das Hauptmenü, falls das gesuchte Element darin verborgen ist. */
async function revealInMenu(page: Page, lang: Lang, target: Locator): Promise<Locator> {
  if ((await target.filter({ visible: true }).count()) === 0) {
    const menu = page.getByRole('button', { name: NAMES[lang].menu }).filter({ visible: true });
    if ((await menu.count()) > 0) await menu.first().click();
  }
  const visible = target.filter({ visible: true }).first();
  await expect(visible).toBeVisible();
  return visible;
}

/** Namen, die einen früheren Funktionsnamen tragen (für eine lesbare Fehlermeldung). */
function offending(items: Named[], pattern: RegExp, roles = ['heading', 'link', 'button']): string[] {
  return items.filter((i) => roles.includes(i.role) && pattern.test(i.name)).map((i) => `${i.role} „${i.name}“`);
}

/** Links mit dem Ziel `path`, deren Name `name` nicht enthält. */
function misnamedLinks(items: Named[], path: string, name: string): string[] {
  return items
    .filter((i) => i.role === 'link' && i.href === path && !i.name.includes(name))
    .map((i) => `link „${i.name}“ → ${i.href}`);
}

// ---------------------------------------------------------------------------------------------------------
// Sie-Ansprache erkennen
// ---------------------------------------------------------------------------------------------------------

const FORMAL = new Set(['Sie', 'Ihnen', 'Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres']);
const FORMAL_POSSESSIVE = new Set(['Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres']);

/**
 * Findet die Höflichkeitsform „Sie“ im Text. Großgeschriebene Formen mitten im Satz sind immer Anrede
 * („Öffnen Sie“, „auf Ihren Wunsch“). Am Satzanfang ist „Sie“ mehrdeutig (sie/Sie) und wird nicht gewertet;
 * ein Possessiv am Satzanfang vor einem Substantiv („Ihr Nutzen“, „Ihre Auswahl“) gilt als Anrede.
 */
function formalAddress(text: string): string[] {
  const hits: string[] = [];
  for (const raw of text.split(/(?<=[.!?:;])\s+|[\n\t]+|\s[–—]\s/)) {
    const sentence = raw.replace(/^[\s\d.•·„“"'»«()[\]–—-]+/, '').trim();
    const words = sentence.split(/\s+/).map((w) => w.replace(/^[„“"'»«(]+|[,.;:!?“"'»«)]+$/g, ''));
    words.forEach((w, i) => {
      if (!FORMAL.has(w)) return;
      if (i > 0 || (FORMAL_POSSESSIVE.has(w) && /^[A-ZÄÖÜ]/.test(words[1] ?? ''))) hits.push(sentence);
    });
  }
  return [...new Set(hits)];
}

/** Sichtbarer Text eines Bereichs ohne redaktionelle Beitragsvorschauen (Links zu Beiträgen). */
async function visibleText(scope: Locator): Promise<string> {
  return scope.evaluate((root, postLink) => {
    const re = new RegExp(postLink);
    let text = (root as HTMLElement).innerText;
    root.querySelectorAll('a[href]').forEach((a) => {
      if (re.test(new URL(a.getAttribute('href')!, location.href).pathname)) {
        text = text.split((a as HTMLElement).innerText).join(' ');
      }
    });
    return text;
  }, POST_LINK.source);
}

/** Sammelt Sätze mit Sie-Ansprache in `hits`, damit ein Testlauf alle betroffenen Stellen zeigt. */
async function collectFormal(hits: string[], scope: Locator, where: string) {
  hits.push(...formalAddress(await visibleText(scope)).map((s) => `${where}: ${s}`));
}

function expectNoFormal(hits: string[]) {
  expect([...new Set(hits)], 'Sätze mit Sie-Ansprache').toEqual([]);
}

// ---------------------------------------------------------------------------------------------------------
// Deutsche Erkennungsmerkmale für die englische Website
// ---------------------------------------------------------------------------------------------------------

/** Typische deutsche Wörter, die in englischen Texten nicht vorkommen. Die Marke „KI Perspektiven“ ist ausgenommen. */
const GERMAN = /\b(und|oder|nicht|für|mit|zum|zur|zurück|mehr|alle|der|das|ein|eine|ist|sind|wir|du|dein\w*|Sie|Ihre?[nmrs]?|Beitr[äa]ge?|Themen?|Seite|Einstellungen|Selbsteinschätzung|Datenschutz|Impressum|Startseite|Übersicht|KI)\b|[äöüßÄÖÜ]/;
const BRAND = /KI Perspektiven/g;
const FALLBACK_NOTICE = /not available in English|German only/i;

function germanIn(texts: string[]): string[] {
  return texts.map((t) => t.replace(BRAND, '').replace(/\s+/g, ' ').trim()).filter((t) => t && GERMAN.test(t));
}

/** Seiten der englischen Website, deren Oberfläche geprüft wird. */
const EN_PAGES = ['/en', '/en/blog', '/en/themen/ai-audit', '/en/profil', '/en/ki-einsatzfelder', '/en/ki-verstehen', '/en/impressum', '/en/datenschutz'];

// ---------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------

test('REQ-8-AC1 Deutsche Hauptnavigation nennt „KI Readiness“ und „News“ und führt zu den Übersichten', async ({ page }) => {
  for (const [label, heading] of [[NAMES.de.readiness, NAMES.de.readiness], [NAMES.de.news, NAMES.de.news]] as const) {
    await openPage(page, '/de');
    const nav = page.getByRole('navigation', { name: NAMES.de.nav });
    const link = await revealInMenu(page, 'de', nav.getByRole('link', { name: label, exact: true }));
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${heading}\\b`));
  }
  await openPage(page, '/de');
  const navNames = (await page.getByRole('navigation', { name: NAMES.de.nav }).getByRole('link').allTextContents()).map((n) => n.trim());
  expect(navNames.filter((n) => OLD_READINESS.de.test(n) || OLD_NEWS.test(n)), 'frühere Namen in der Navigation').toEqual([]);
});

test('REQ-8-AC2 Deutsche Seiten benennen die Selbsteinschätzung einheitlich „KI Readiness“', async ({ page }) => {
  const problems: string[] = [];
  let startsAssessment = false;
  for (const path of ['/de', readinessPath('de'), `${readinessPath('de')}/strategie-und-wirtschaftlichkeit`, `${readinessPath('de')}/auswertung`]) {
    await openPage(page, path);
    const items = await namedElements(page);
    problems.push(...offending(items, OLD_READINESS.de).map((p) => `${path}: ${p}`));
    // Aufrufe von außerhalb (Startseite) nennen die Funktion; Rücklinks innerhalb des Bereichs („Zur Übersicht“) dürfen allgemein bleiben.
    if (!path.startsWith(readinessPath('de'))) {
      problems.push(...misnamedLinks(items, readinessPath('de'), NAMES.de.readiness).map((p) => `${path}: ${p}`));
    }
    if (OLD_READINESS.de.test(await page.title())) problems.push(`${path}: Seitentitel „${await page.title()}“`);
    if (path === readinessPath('de')) {
      startsAssessment = items.some((i) => i.role === 'link' && i.href?.startsWith(`${readinessPath('de')}/`) && i.name.includes(NAMES.de.readiness));
    }
  }
  expect(problems, 'Überschriften, Links, Schaltflächen und Seitentitel mit anderem Namen als „KI Readiness“').toEqual([]);
  expect(startsAssessment, 'Aufruf auf der Übersicht, der die KI Readiness startet und „KI Readiness“ nennt').toBe(true);
});

test('REQ-8-AC3 Deutsche Seiten benennen den bisherigen Blog einheitlich „News“', async ({ page }) => {
  const problems: string[] = [];
  for (const path of ['/de', newsPath('de'), '/de/themen/softwareentwicklung', '/de/blog/ki-veraendert-softwareteams']) {
    await openPage(page, path);
    const items = await namedElements(page);
    const isPost = POST_LINK.test(path);
    // Auf der Beitragsseite sind Überschriften und Seitentitel redaktioneller Inhalt; geprüft werden Links und Schaltflächen.
    problems.push(...offending(items, OLD_NEWS, isPost ? ['link', 'button'] : undefined).map((p) => `${path}: ${p}`));
    // Verweise von außerhalb des News-Bereichs nennen „News“; Rücklinks auf der Beitragsseite dürfen allgemein bleiben.
    if (!path.startsWith(newsPath('de'))) {
      problems.push(...misnamedLinks(items, newsPath('de'), NAMES.de.news).map((p) => `${path}: ${p}`));
    }
    if (!isPost && OLD_NEWS.test(await page.title())) problems.push(`${path}: Seitentitel „${await page.title()}“`);
  }
  await openPage(page, newsPath('de'));
  const h1 = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
  if (h1 !== NAMES.de.news) problems.push(`${newsPath('de')}: Hauptüberschrift „${h1}“ statt „News“`);
  expect(problems,'Überschriften, Links, Schaltflächen und Seitentitel mit „Blog“ statt „News“').toEqual([]);
});

test('REQ-8-AC4 Alle deutschen Themenseiten sprechen Besucher mit „du“ an', async ({ page }) => {
  await openPage(page, '/de');
  const footer = page.getByRole('contentinfo');
  const topicPaths = new Set<string>();
  for (const link of await footer.getByRole('link').all()) {
    const href = await link.getAttribute('href');
    const path = href ? new URL(href, page.url()).pathname : '';
    // Die KI Readiness liegt technisch unter /themen/, ist aber kein Thema (siehe AC5).
    if (/^\/de\/themen\/[^/]+$/.test(path) && path !== readinessPath('de')) topicPaths.add(path);
  }
  expect(topicPaths.size, 'Themenseiten im Footer').toBeGreaterThan(0);
  const hits: string[] = [];
  for (const path of topicPaths) {
    await openPage(page, path);
    await collectFormal(hits, page.getByRole('main'), path);
  }
  expectNoFormal(hits);
});

test('REQ-8-AC5 Die deutsche KI Readiness spricht Besucher von der Übersicht bis zur Auswertung mit „du“ an', async ({ page }) => {
  const hits: string[] = [];
  await openPage(page, readinessPath('de'));
  await collectFormal(hits, page.getByRole('main'), readinessPath('de'));
  // Alle Dimensionen nacheinander bewerten, wie Besucher es tun
  const dimensions = new Set<string>();
  for (const link of await page.getByRole('link', { includeHidden: true }).all()) {
    const href = await link.getAttribute('href');
    if (href && /^\/de\/themen\/ai-audit\/[^/]+$/.test(href) && !href.endsWith('/auswertung')) dimensions.add(href);
  }
  expect(dimensions.size, 'Dimensionsseiten').toBeGreaterThan(0);
  await openPage(page, [...dimensions][0]);
  for (let step = 0; step < dimensions.size; step++) {
    await collectFormal(hits, page.getByRole('main'), new URL(page.url()).pathname);
    // Ersten Reifegrad wählen und mit der Schaltfläche am Ende des Inhalts weitergehen („Weiter“ bzw. zur Auswertung)
    await page.getByRole('main').getByRole('radio').first().check();
    const next = page.getByRole('main').getByRole('button').filter({ visible: true }).last();
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit\/auswertung$/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await collectFormal(hits, page.getByRole('main'), 'Auswertung');
  // Rückmeldung des Formulars für das Beratungsgespräch bei fehlender E-Mail-Adresse
  await page.getByRole('main').getByRole('button').filter({ visible: true }).last().click();
  await collectFormal(hits, page.getByRole('main'), 'Auswertung nach dem Absenden ohne E-Mail-Adresse');
  const email = page.getByRole('textbox', { name: 'E-Mail-Adresse', exact: true });
  const submit = page.getByRole('button', { name: 'Anfrage senden', exact: true });
  await email.fill('ungueltig');
  await submit.click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await collectFormal(hits, page.getByRole('main'), 'Ungültige E-Mail-Adresse');
  // HTTP-Fehler gezielt simulieren; geprüft wird ausschließlich die sichtbare Rückmeldung.
  await email.fill('req8@example.com');
  for (const status of [422, 429, 500]) {
    await page.route('**/api/consultation-requests', (route) => route.fulfill({ status, json: { message: 'Testfehler' } }));
    const response = page.waitForResponse((r) => r.url().endsWith('/api/consultation-requests') && r.status() === status);
    await submit.click();
    await response;
    await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
    if (status === 422) await expect(email).toHaveAttribute('aria-invalid', 'true');
    else await expect(page.getByRole('main').getByRole('alert')).not.toHaveText('');
    await collectFormal(hits, page.getByRole('main'), `Formularfehler ${status}`);
    await page.unroute('**/api/consultation-requests');
  }
  // Auch Erfolg auf HTTP-Ebene simulieren, damit Wiederholungen kein API-Ratenlimit verbrauchen.
  await page.route('**/api/consultation-requests', (route) => route.fulfill({ status: 204 }));
  await submit.click();
  await expect(email).toHaveCount(0);
  await expect(page.getByRole('main').getByText(/req8@example\.com/)).toBeVisible();
  await collectFormal(hits, page.getByRole('main'), 'Erfolgreich versendete Anfrage');
  expectNoFormal(hits);
});

test('REQ-8-AC6 Footer und Cookie-Hinweis der deutschen Website sprechen Besucher mit „du“ an', async ({ page }) => {
  const hits: string[] = [];
  await openPage(page, '/de');
  await collectFormal(hits, page.getByRole('contentinfo'), 'Footer');
  await page.getByRole('contentinfo').getByRole('button', { name: NAMES.de.cookies }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await collectFormal(hits, dialog, 'Cookie-Hinweis');
  // Rückmeldung nach einer Auswahl
  await dialog.getByRole('button').filter({ visible: true }).nth(1).click();
  if (await dialog.isVisible()) await collectFormal(hits, dialog, 'Cookie-Hinweis nach der Auswahl');
  expectNoFormal(hits);
});

test('REQ-8-AC7 Alle übrigen deutschen Seiten und Meldungen sprechen Besucher mit „du“ an', async ({ page }) => {
  const paths = ['/de', newsPath('de'), '/de/blog/ki-veraendert-softwareteams', '/de/profil', '/de/ki-einsatzfelder', '/de/ki-verstehen', '/de/impressum', '/de/datenschutz', '/de/gibt-es-nicht-4711'];
  const hits: string[] = [];
  for (const path of paths) {
    await openPage(page, path);
    // Auf der Beitragsseite ist der Beitrag redaktioneller Inhalt; geprüft werden dort Links und Schaltflächen.
    const scope = POST_LINK.test(path)
      ? [...(await page.getByRole('main').getByRole('link').all()), ...(await page.getByRole('main').getByRole('button').all())]
      : [page.getByRole('main')];
    for (const part of scope) await collectFormal(hits, part, path);
  }
  // Fehlermeldung, wenn Inhalte nicht geladen werden können
  await page.route('**/api/**', (route) => route.abort());
  await page.goto(newsPath('de'));
  await expect(page.getByRole('button').filter({ visible: true }).filter({ hasText: /erneut|nochmal|wieder/i })).toBeVisible();
  await collectFormal(hits, page.getByRole('main'), 'Fehlermeldung');
  expectNoFormal(hits);
});

test('REQ-8-AC8 Links in Navigation, Footer und Hauptinhalt führen weiterhin zu erreichbaren Seiten', async ({ page, request }) => {
  const targets = new Set<string>();
  for (const path of ['/de', '/en', readinessPath('de'), readinessPath('en'), newsPath('de'), newsPath('en')]) {
    await openPage(page, path);
    // Redaktionelle Texte sind ausgenommen, ihre Linkziele müssen trotzdem funktionieren.
    for (const link of await page.getByRole('link', { includeHidden: true }).all()) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#')) continue;
      const target = new URL(href, page.url());
      if (target.origin === new URL(page.url()).origin && !target.pathname.startsWith('/redaktion')) targets.add(target.pathname + target.search);
    }
  }
  expect(targets.size).toBeGreaterThan(0);
  const broken: string[] = [];
  for (const target of targets) {
    const res = await request.get(target);
    if (res.status() !== 200) broken.push(`${target} → ${res.status()}`);
  }
  expect(broken, 'Linkziele ohne Status 200').toEqual([]);
});

test('REQ-8-AC9 Englische Seiten benennen die Funktionen einheitlich „AI Readiness“ und „News“', async ({ page }) => {
  const problems: string[] = [];
  // Navigation
  for (const label of [NAMES.en.readiness, NAMES.en.news]) {
    await openPage(page, '/en');
    const nav = page.getByRole('navigation', { name: NAMES.en.nav });
    const link = await revealInMenu(page, 'en', nav.getByRole('link', { name: label, exact: true }));
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
  }
  // Überschriften, Links, Schaltflächen und Seitentitel
  for (const path of ['/en', readinessPath('en'), `${readinessPath('en')}/strategie-und-wirtschaftlichkeit`, `${readinessPath('en')}/auswertung`, newsPath('en'), '/en/themen/softwareentwicklung']) {
    await openPage(page, path);
    const items = await namedElements(page);
    const title = await page.title();
    problems.push(...offending(items, OLD_READINESS.en).map((p) => `${path}: ${p}`));
    problems.push(...offending(items, OLD_NEWS).map((p) => `${path}: ${p}`));
    if (!path.startsWith(readinessPath('en'))) {
      problems.push(...misnamedLinks(items, readinessPath('en'), NAMES.en.readiness).map((p) => `${path}: ${p}`));
    }
    if (!path.startsWith(newsPath('en'))) {
      problems.push(...misnamedLinks(items, newsPath('en'), NAMES.en.news).map((p) => `${path}: ${p}`));
    }
    if (OLD_READINESS.en.test(title) || OLD_NEWS.test(title)) problems.push(`${path}: Seitentitel „${title}“`);
  }
  expect(problems, 'englische Überschriften, Links, Schaltflächen und Seitentitel mit früheren Namen').toEqual([]);
});

test('REQ-8-AC10 Die Oberfläche der englischen Website enthält keine versehentlich deutschen Formulierungen', async ({ page }) => {
  const problems: string[] = [];
  for (const path of EN_PAGES) {
    await openPage(page, path);
    // Navigation und Footer sind immer englisch
    const frame = [
      ...(await page.getByRole('navigation', { name: NAMES.en.nav }).getByRole('link').allTextContents()),
      ...(await page.getByRole('navigation', { name: NAMES.en.nav }).getByRole('button').allTextContents()),
      ...(await page.getByRole('contentinfo').innerText()).split('\n'),
    ];
    problems.push(...germanIn(frame).map((t) => `${path}: „${t}“`));
    // Nur tatsächlich als deutsch markierter Ersatzinhalt ist ausgenommen, nie die ganze Seite.
    const main = page.getByRole('main');
    const hasFallback = FALLBACK_NOTICE.test(await main.innerText());
    const names = (await namedElements(page))
      .filter((i) => !(hasFallback && i.lang === 'de'))
      .filter((i) => i.role !== 'link' || i.href?.startsWith('/')).map((i) => hasFallback ? i.withoutFallback : i.name);
    problems.push(...germanIn(names).map((t) => `${path}: „${t}“`));
  }
  // Cookie-Hinweis
  await openPage(page, '/en');
  await page.getByRole('contentinfo').getByRole('button', { name: NAMES.en.cookies }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  problems.push(...germanIn((await page.getByRole('dialog').innerText()).split('\n')).map((t) => `Cookie-Hinweis: „${t}“`));
  expect([...new Set(problems)], 'deutsche Formulierungen auf der englischen Website').toEqual([]);
});

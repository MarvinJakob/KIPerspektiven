// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, expectVisibleKeyboardFocus, test } from '../support/fixtures';

// Anforderung #34: Landingpage nach Home-Mock (.mock/home/) mit zwei Themen und KI-Readiness-Kurzcheck.
// Sollwerte aus content/topics/home v1_de.md, .mock/home/index.html und .mock/home/script.js (Variante 7).

const DIMENSIONS = [
  ['Strategie und Wirtschaftlichkeit', 'Wissen wir, wofür wir KI einsetzen und ob es sich lohnt?'],
  ['Ressourcenplanung und Kompetenzen', 'Haben wir die Menschen, die Zeit und das Wissen, um mit KI zu arbeiten?'],
  ['Betrieb', 'Läuft unsere KI-Anwendung auch dann zuverlässig, wenn niemand danebensitzt?'],
  ['Governance und Compliance', 'Wissen wir, unter welchen rechtlichen und vertraglichen Bedingungen wir KI einsetzen dürfen?'],
  ['Agenten und Prozesse', 'Ist KI sinnvoll in unsere Arbeitsabläufe eingebunden?'],
  ['Technologie und Infrastruktur', 'Haben wir eine technische Grundlage, auf der wir weitere KI-Anwendungen aufbauen können?'],
  ['Daten und Wissen', 'Findet die KI die Informationen, die sie für ihre Aufgabe braucht, und sind diese verlässlich?'],
  ['Sicherheit und Zuverlässigkeit', 'Können wir nachweisen, dass unsere KI-Anwendung verlässlich und sicher arbeitet?'],
] as const;

const TOPICS = [
  {
    number: '01',
    title: 'Softwareentwicklung',
    question: 'Wenn KI uns die langweilige Arbeit abnimmt, wird Softwareentwicklung endlich kreativer?',
    text: 'Wie Agenten-Teams mit klaren Tests und Gates Software entwickeln – und wo der Mensch die Verantwortung behält.',
    path: 'themen/softwareentwicklung',
  },
  {
    number: '02',
    title: 'Vibe Coding',
    question: 'Du beschreibst, was du möchtest, und die KI schreibt den Code. Was kann da schon schiefgehen?',
    text: 'Warum „Mach es irgendwie moderner“ selten reicht – und wie aus Vibe Coding sinnvolle Ergebnisse werden.',
    path: 'themen/vibe-coding',
  },
] as const;

const UI = {
  de: {
    answers: { ja: 'Ja', nein: 'Nein', skip: 'Überspringen' },
    count: (n: number) => `Frage ${n} von 8`,
    result: (n: number) => `${n} von 8 Leitfragen mit Ja.`,
    restart: 'Noch einmal',
    start: 'Selbsteinschätzung starten',
    topics: 'Themen entdecken',
    check: 'KI Readiness einschätzen',
  },
  en: {
    answers: { ja: 'Yes', nein: 'No', skip: 'Skip' },
    count: (n: number) => `Question ${n} of 8`,
    result: (n: number) => `${n} of 8 guiding questions answered Yes.`,
    restart: 'Try again',
    start: 'Start self-assessment',
    topics: 'Explore topics',
    check: 'Assess your AI readiness',
  },
} as const;

type Answer = 'ja' | 'nein' | 'skip';
const check = (page: Page) => page.locator('#ki-readiness');
const topicList = (page: Page) => page.locator('#themen-liste');
const question = (page: Page) => check(page).getByRole('heading', { level: 2 });

/** Beantwortet die aktuelle Frage und wartet, bis die nächste Frage bzw. das Ergebnis angezeigt wird. */
async function answer(page: Page, value: Answer, step: number, lang: 'de' | 'en' = 'de') {
  await check(page).getByRole('button', { name: UI[lang].answers[value], exact: true }).click();
  if (step < 8) await expect(check(page).getByText(UI[lang].count(step + 1), { exact: true })).toBeVisible();
  else await expect(check(page).getByRole('heading', { name: /von 8 Leitfragen mit Ja|of 8 guiding questions/ })).toBeVisible();
}

async function answerAll(page: Page, values: Answer[], lang: 'de' | 'en' = 'de') {
  for (const [i, v] of values.entries()) await answer(page, v, i + 1, lang);
}


test('REQ-34-AC1: Hero unter der Navigation, Einstiege springen zu Themenliste und Kurzcheck und setzen dort den Fokus', async ({ page }) => {
  await page.goto('/de');
  const hero = page.locator('#hero-title');
  await expect(hero).toHaveText('KI verstehen.Sinnvoll einsetzen.');
  await expect(page.getByText('Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.')).toBeVisible();
  const navBottom = await page.locator('header').evaluate((el) => el.getBoundingClientRect().bottom);
  const heroTop = await hero.evaluate((el) => el.getBoundingClientRect().top);
  expect(heroTop, 'Hero steht unter der Hauptnavigation').toBeGreaterThanOrEqual(navBottom);

  // Tastatur: Fokus auf den Einstieg, Enter, Fokus liegt am Ziel
  await page.getByRole('link', { name: UI.de.topics }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Gute Fragen. Neue Perspektiven.' })).toBeFocused();

  await page.getByRole('link', { name: UI.de.check }).focus();
  await page.keyboard.press('Enter');
  await expect(question(page)).toBeFocused();
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await expect(question(page)).toBeInViewport();
});

test('REQ-34-AC2: ohne redaktionelle Veröffentlichungen erscheinen zwei Themenzeilen mit Leitfrage und Artikelverweis', async ({ page }) => {
  await page.route('**/api/articles?*', route => route.fulfill({ json: { items: [] } }));
  await page.goto('/de');
  const rows = topicList(page).getByRole('listitem');
  await expect(rows).toHaveCount(2);
  for (const [i, t] of TOPICS.entries()) {
    const row = rows.nth(i);
    await expect(row).toContainText(t.number);
    await expect(row).toContainText(t.title);
    await expect(row.getByRole('link', { name: t.question })).toHaveAttribute('href', `/de/${t.path}`);
    await expect(row.getByText(t.text, { exact: true })).toBeVisible();
  }

  for (const [i, t] of TOPICS.entries()) {
    // Klick auf eine Stelle der Zeile außerhalb des Linktextes (linke obere Ecke, Bereich der Nummer)
    await page.goto('/de');
    await rows.nth(i).click({ position: { x: 12, y: 12 } });
    await expect(page).toHaveURL(new RegExp(`/de/${t.path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Seite nicht gefunden/ })).toHaveCount(0);

    await page.goto('/de');
    await rows.nth(i).getByRole('link').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/de/${t.path}$`));
  }
});

test('REQ-34-AC3: erste Frage beim Aufruf, Ja/Nein/Überspringen gehen je einen Schritt, Reihenfolge der acht Dimensionen', async ({ page }) => {
  await page.goto('/de');
  const values: Answer[] = ['ja', 'nein', 'skip', 'ja', 'nein', 'skip', 'ja', 'nein'];
  for (const [i, [dim, q]] of DIMENSIONS.entries()) {
    await expect(check(page).getByText(UI.de.count(i + 1), { exact: true })).toBeVisible();
    await expect(check(page).getByText(dim, { exact: true })).toBeVisible();
    await expect(question(page)).toHaveText(q);
    await answer(page, values[i], i + 1);
  }
});

test('REQ-34-AC3: ohne Eingabe bleibt die aktuelle Frage stehen', async ({ page }) => {
  await page.clock.install();
  await page.goto('/de');
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await page.clock.fastForward('05:00');
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await expect(check(page).getByText(UI.de.count(1), { exact: true })).toBeVisible();
});

// Je Fall ein eigener Test: acht Antworten mit Überblendung dauern bereits mehrere Sekunden.
for (const [label, values, yes] of [
  ['drei Ja, zwei Nein, drei übersprungen', ['ja', 'nein', 'skip', 'ja', 'skip', 'nein', 'skip', 'ja'], 3],
  ['achtmal Überspringen', Array(8).fill('skip'), 0],
  ['achtmal Ja', Array(8).fill('ja'), 8],
] as [string, Answer[], number][]) {
  test(`REQ-34-AC4: nur Ja zählt – ${label} ergibt ${yes} von 8`, async ({ page }) => {
    await page.goto('/de');
    await answerAll(page, values);
    await expect(check(page).getByRole('heading', { level: 2 })).toHaveText(UI.de.result(yes));
    await expect(check(page).getByRole('button', { name: UI.de.answers.ja, exact: true })).toHaveCount(0);
  });
}

test('REQ-34-AC4: „Noch einmal“ beginnt bei Frage 1 mit Zähler 0; Antworten werden weder gespeichert noch übertragen', async ({ page, context }) => {
  await page.goto('/de');
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const before = { ...(await storage()), cookies: await context.cookies() };
  const requests: string[] = [];
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`));

  await answerAll(page, ['ja', 'ja', 'nein', 'skip', 'ja', 'nein', 'ja', 'ja']);
  await expect(check(page).getByRole('heading', { level: 2 })).toHaveText(UI.de.result(5));
  expect(requests, 'Kurzcheck sendet keine Anfragen').toEqual([]);
  expect({ ...(await storage()), cookies: await context.cookies() }, 'Kurzcheck speichert nichts').toEqual(before);

  await check(page).getByRole('button', { name: UI.de.restart }).click();
  await expect(check(page).getByText(UI.de.count(1), { exact: true })).toBeVisible();
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await answerAll(page, Array(8).fill('skip'));
  await expect(check(page).getByRole('heading', { level: 2 })).toHaveText(UI.de.result(0));
});

test('REQ-34-AC4: nach einem Neuladen beginnt der Kurzcheck bei Frage 1', async ({ page }) => {
  await page.goto('/de');
  await answer(page, 'ja', 1);
  await answer(page, 'ja', 2);
  await page.reload();
  await expect(check(page).getByText(UI.de.count(1), { exact: true })).toBeVisible();
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
});

test('REQ-34-AC5: „Selbsteinschätzung starten“ bei Frage 1, während des Checks und im Ergebnis; keine Mock-Hinweise (Profilteaser entfällt seit #47)', async ({ page }) => {
  const start = () => check(page).getByRole('link', { name: UI.de.start });
  const opensAudit = async () => {
    await start().click();
    await expect(page).toHaveURL(/\/de\/themen\/ai-audit$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Seite nicht gefunden|Anmeldung/ })).toHaveCount(0);
  };

  await page.goto('/de');
  await opensAudit();
  await page.goto('/de');
  await answerAll(page, ['ja', 'nein', 'skip']);
  await opensAudit();
  await page.goto('/de');
  await answerAll(page, Array(8).fill('nein'));
  await opensAudit();

  await page.goto('/de');
  const text = await page.locator('body').innerText();
  for (const word of ['Mock', 'Platzhalter', 'Entwurf', 'nicht angebunden']) expect(text, word).not.toContain(word);
  await expect(page.locator('main [data-placeholder]')).toHaveCount(0);
});

test('REQ-34-AC6 REQ-25-AC6: typografische Hierarchie, Source Sans 3 (#104), cimt-Orange, deckende Kurzcheck-Fläche und keine Bilder in Hell und Dunkel', async ({ page }) => {
  await page.goto('/de');
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'Dunkle Darstellung' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    const s = await page.evaluate(() => {
      const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      const px = (v: string) => parseFloat(v);
      const body = css('body');
      const surface = css('#ki-readiness .check');
      return {
        h1: px(css('#hero-title').fontSize),
        h2: px(css('#themen-title').fontSize),
        h3: px(css('#themen-liste h3').fontSize),
        font: body.fontFamily,
        brand: css('#ki-readiness .btn-primary').backgroundColor,
        number: css('#themen-liste .topic-number').color,
        bodyBg: body.backgroundColor,
        surfaceBg: surface.backgroundColor,
        rowBorder: css('#themen-liste li').borderTopStyle,
      };
    });
    expect(s.h1, `${theme}: Hero ist die größte Schrift`).toBeGreaterThanOrEqual(2 * s.h2);
    expect(s.h2).toBeGreaterThan(s.h3);
    expect(s.font, 'Fließtext in Source Sans 3 (REQ-104-AC5)').toMatch(/^"?Source Sans 3"?,/);
    expect(s.brand).toBe('rgb(220, 110, 20)');
    expect(s.number).toBe('rgb(220, 110, 20)');
    expect(s.rowBorder, 'Themenzeilen sind durch Linien getrennt').toBe('solid');
    expect(s.surfaceBg, `${theme}: Kurzcheck-Fläche ist deckend`).toMatch(/^rgb\(/);
    expect(s.surfaceBg, `${theme}: Kurzcheck-Fläche ist abgesetzt`).not.toBe(s.bodyBg);
  }
  await expect(page.locator('main img, main picture, main canvas, main video, main svg:not([aria-hidden="true"]), main [role="img"]')).toHaveCount(0);
  // REQ-25-AC6 (seit #94 hier): Verweise im Hauptinhalt bleiben per Tastatur erreichbar.
  for (const link of await page.locator('main a[href]').all()) expect(await link.getAttribute('tabindex'), await link.getAttribute('href') ?? '').not.toBe('-1');
});

for (const width of [1440, 768, 390, 320]) {
  test(`REQ-34-AC6: bei ${width} px lesbar und bedienbar ohne horizontales Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/de');
    for (const theme of ['light', 'dark'] as const) {
      if (theme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await expectNoHorizontalScroll(page);
      await answer(page, 'ja', 1);
      const targets = [
        page.locator('#hero-title'),
        ...(await topicList(page).getByRole('link').all()),
        check(page).getByText(UI.de.count(2), { exact: true }),
        question(page),
        check(page).getByRole('list', { name: 'Fortschritt' }),
        check(page).getByRole('button', { name: 'Ja', exact: true }),
        check(page).getByRole('button', { name: 'Nein', exact: true }),
        check(page).getByRole('button', { name: 'Überspringen' }),
        check(page).getByRole('link', { name: UI.de.start }),
      ];
      for (const t of targets) {
        await t.scrollIntoViewIfNeeded();
        const box = (await t.boundingBox())!;
        expect(box, `${theme}: sichtbar`).not.toBeNull();
        expect(box.x, `${theme}: links im Fenster`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${theme}: rechts im Fenster`).toBeLessThanOrEqual(width + 0.5);
        const clipped = await t.evaluate((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible');
        expect(clipped, `${theme}: Text nicht abgeschnitten`).toBe(false);
      }
      await check(page).getByRole('button', { name: 'Ja', exact: true }).click();
      await expectNoHorizontalScroll(page);
      await page.reload();
    }
  });
}

test('REQ-34-AC7: sichtbarer Tastaturfokus; Fokus folgt der nächsten Frage und dem Ergebnis', async ({ page }) => {
  await page.goto('/de');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Zum Inhalt springen' });
  await expect(skip).toBeFocused();
  await expectVisibleKeyboardFocus(page, skip);
  for (const link of await topicList(page).getByRole('link').all()) await expectVisibleKeyboardFocus(page, link);
  await expectVisibleKeyboardFocus(page, check(page).getByRole('link', { name: UI.de.start }));

  for (let i = 0; i < 8; i++) {
    const button = check(page).getByRole('button', { name: ['Ja', 'Nein', 'Überspringen'][i % 3], exact: true });
    await expectVisibleKeyboardFocus(page, button);
    await page.keyboard.press('Enter');
    if (i < 7) {
      await expect(question(page)).toHaveText(DIMENSIONS[i + 1][1]);
      await expect(question(page)).toBeFocused();
    }
  }
  const result = check(page).getByRole('heading', { level: 2 });
  await expect(result).toHaveText(UI.de.result(3));
  await expect(result).toBeFocused();
  const restart = check(page).getByRole('button', { name: UI.de.restart });
  await expectVisibleKeyboardFocus(page, restart);
  await page.keyboard.press('Enter');
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await expect(question(page)).toBeFocused();
});

test.describe('reduzierte Bewegung', () => {
  test.use({ reducedMotion: 'reduce' });
  test('REQ-34-AC7: bei reduzierter Bewegung erscheint die nächste Frage ohne Überblendung', async ({ page }) => {
    await page.goto('/de');
    await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
    // Unmittelbar nach dem Klick (ein Frame) ist die nächste Frage vollständig sichtbar.
    const after = await page.evaluate(async () => {
      const root = document.getElementById('ki-readiness')!;
      [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Ja')!.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const h = root.querySelector('h2') as HTMLElement;
      const s = getComputedStyle(h);
      return { text: h.textContent, opacity: s.opacity, transition: s.transitionDuration };
    });
    expect(after.text).toBe(DIMENSIONS[1][1]);
    expect(after.opacity).toBe('1');
    expect(after.transition.split(',').every((d) => parseFloat(d) <= 0.01)).toBe(true);
  });
});

test('REQ-34-AC7: Navigation deckend bei erzwungenen Farben und reduzierter Transparenz', async ({ page }) => {
  const navStyle = () =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, filter: s.backdropFilter };
    });
  await page.goto('/de');
  await page.emulateMedia({ forcedColors: 'active' });
  let s = await navStyle();
  expect(s.filter === 'none' || s.filter === '', `erzwungene Farben: ${JSON.stringify(s)}`).toBe(true);
  expect(s.bg, `erzwungene Farben: ${JSON.stringify(s)}`).toMatch(/^rgb\(/);

  await page.emulateMedia({ forcedColors: 'none' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  s = await navStyle();
  expect(s.filter === 'none' || s.filter === '', `reduzierte Transparenz: ${JSON.stringify(s)}`).toBe(true);
  expect(s.bg, `reduzierte Transparenz: ${JSON.stringify(s)}`).toMatch(/^rgb\(/);
});

test('REQ-34-AC8: DE → EN → DE wechselt Abschnitte, Fragen, Antworten, Ergebnis und Linkziele', async ({ page }) => {
  await page.goto('/de');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('#hero-title')).toHaveText('Understand AI.Use it wisely.');
  await expect(page.getByRole('link', { name: UI.en.topics })).toBeVisible();
  await expect(page.getByRole('link', { name: UI.en.check })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Good questions. New perspectives.' })).toBeVisible();
  const links = topicList(page).getByRole('link');
  await expect(links.nth(0)).toHaveAttribute('href', '/en/themen/softwareentwicklung');
  await expect(links.nth(1)).toHaveAttribute('href', '/en/themen/vibe-coding');
  await expect(check(page).getByText(UI.en.count(1), { exact: true })).toBeVisible();
  await expect(check(page).getByText('Strategy and economic viability', { exact: true })).toBeVisible();
  await expect(question(page)).toHaveText('Do we know what we use AI for and whether it pays off?');
  await expect(check(page).getByRole('link', { name: UI.en.start })).toHaveAttribute('href', '/en/themen/ai-audit');

  await answerAll(page, ['ja', 'nein', 'skip', 'ja', 'skip', 'nein', 'skip', 'ja'], 'en');
  await expect(check(page).getByRole('heading', { level: 2 })).toHaveText(UI.en.result(3));
  await expect(check(page).getByRole('button', { name: UI.en.restart })).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/Leitfrage|Frage \d von|Überspringen|Themen entdecken/);

  // Neustart auf Englisch, damit der Rückwechsel unabhängig vom Fortschritt dieselbe erste Frage zeigt.
  await check(page).getByRole('button', { name: UI.en.restart }).click();
  await expect(check(page).getByText(UI.en.count(1), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/?$/);
  await expect(page.locator('#hero-title')).toHaveText('KI verstehen.Sinnvoll einsetzen.');
  await expect(check(page).getByText(UI.de.count(1), { exact: true })).toBeVisible();
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await expect(check(page).getByRole('link', { name: UI.de.start })).toHaveAttribute('href', '/de/themen/ai-audit');
});

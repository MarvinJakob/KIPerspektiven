// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Home.tsx
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';

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
    start: 'Selbsteinschätzung starten',
    topics: 'Themen entdecken',
    check: 'KI Readiness einschätzen',
  },
  en: {
    answers: { ja: 'Yes', nein: 'No', skip: 'Skip' },
    count: (n: number) => `Question ${n} of 8`,
    result: (n: number) => `${n} of 8 guiding questions answered Yes.`,
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
  }
});

test('REQ-34-AC3 REQ-34-AC4: acht Fragen in fester Reihenfolge, Ja/Nein/Überspringen gehen je einen Schritt, nur Ja zählt im Ergebnis', async ({ page }) => {
  await page.goto('/de');
  const values: Answer[] = ['ja', 'nein', 'skip', 'ja', 'nein', 'skip', 'ja', 'nein'];
  for (const [i, [dim, q]] of DIMENSIONS.entries()) {
    await expect(check(page).getByText(UI.de.count(i + 1), { exact: true })).toBeVisible();
    await expect(check(page).getByText(dim, { exact: true })).toBeVisible();
    await expect(question(page)).toHaveText(q);
    await answer(page, values[i], i + 1);
  }
  await expect(check(page).getByRole('heading', { level: 2 })).toHaveText(UI.de.result(3));
  await expect(check(page).getByRole('button', { name: UI.de.answers.ja, exact: true })).toHaveCount(0);
});

test('REQ-34-AC8: DE → EN → DE wechselt Abschnitte, Fragen und Linkziele', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/?$/);
  await expect(page.locator('#hero-title')).toHaveText('KI verstehen.Sinnvoll einsetzen.');
  await expect(check(page).getByText(UI.de.count(1), { exact: true })).toBeVisible();
  await expect(question(page)).toHaveText(DIMENSIONS[0][1]);
  await expect(check(page).getByRole('link', { name: UI.de.start })).toHaveAttribute('href', '/de/themen/ai-audit');
});

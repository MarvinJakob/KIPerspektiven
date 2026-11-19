// Abdeckung (Testauswahl im Merge Gate, #55): app/frontend/src/pages/Topic.tsx app/frontend/src/pages/Readiness.tsx app/frontend/src/pages/AuditDimension.tsx app/frontend/src/pages/AuditResult.tsx
import { readFileSync } from 'node:fs';
import type { Page, Request } from '@playwright/test';
import { completeAssessment, expect, test, type Session } from '../support/fixtures';

// Anforderung #23: KI Readiness einschätzen und Ergebnisse auswerten.
// Quelle der Dimensionen: content/topics/audit/KI Readiness.md, Abschnitt „Die Dimensionen“.
const DIMENSIONS = [
  'Strategie und Wirtschaftlichkeit',
  'Ressourcenplanung und Kompetenzen',
  'Betrieb',
  'Governance und Compliance',
  'Agenten und Prozesse',
  'Technologie und Infrastruktur',
  'Daten und Wissen',
  'Sicherheit und Zuverlässigkeit',
];
const OVERVIEW = '/de/themen/ai-audit';
const released = (JSON.parse(readFileSync(new URL('../../backend/internal/audit/content.json', import.meta.url), 'utf8')) as {
  dimensions: { slug: string; released: boolean }[];
}).dimensions;

interface Result {
  id: number;
  lang: string;
  submittedAt: string;
  ratings: { dimension: string; level: number }[];
}
const results = async (s: Session) =>
  ((await (await s.get('/api/admin/statistics/readiness-results?period=7d')).json()) as { items: Result[] }).items;

function track(page: Page) {
  const calls: Request[] = [];
  page.on('request', (r) => r.url().includes('/api/readiness-results') && calls.push(r));
  return calls;
}

// Anforderung #115: Übersicht nach Mock readiness_v1. Reihenfolge der Überschriften im Hauptinhalt laut Mock.
const OVERVIEW_HEADINGS = [
  'KI Readiness',
  'Glück, Plan oder Lernkurve?',
  'Nicht überall auf der höchsten Stufe',
  'Wo müssen wir hinschauen?',
  'Die Dimensionen im Überblick',
];

// Verbindliche deutsche Texte des Hauptinhalts aus Ticket #115 (wortgleich mit .mock/readiness_v1/index.html),
// in Lesereihenfolge bei geöffneten Dimensionen. Ziffern der Listen sind dekorativ und nicht enthalten.
const OVERVIEW_TEXT = [
  'Selbsteinschätzung',
  'KI Readiness',
  'Sind wir schon ‚KI Ready‘, oder haben wir nur ein KI Abo?',
  'KI-Readiness einschätzen. Nächste Schritte erkennen.',
  'Stand: 19. November 2026',
  'Selbsteinschätzung starten',
  'Fragen Sie in einem beliebigen Unternehmen, wie es um den Einsatz von KI steht, und Sie hören meist einen dieser Sätze: „Wir sind da ganz gut aufgestellt.“ „Das haben wir im Griff.“ „Darum kümmert sich schon jemand.“ Klingt beruhigend. Die Frage ist nur: Stimmt es auch?',
  'Einen Chatbot zu öffnen und eine Frage zu stellen dauert ungefähr so lange, wie einen Espresso aufzubrühen. Doch KI auszuprobieren und KI professionell einzusetzen, sind zwei verschiedene Dinge. Sobald KI echte Arbeit übernimmt, reicht es nicht, dass ihre Antworten gut klingen. Dann muss jemand wissen, welchen Nutzen sie bringen soll und was sie kostet. Welche Daten sie verwenden darf und welche nicht. Wer eingreift, wenn etwas schiefgeht. Und wie man prüft, ob ihre Ergebnisse stimmen.',
  'Die KI-Readiness-Selbsteinschätzung ist Ihr Faktencheck. Sie gleicht das Bauchgefühl mit dem ab, was sich tatsächlich zeigen lässt, und zwar in allen Bereichen, auf die es beim professionellen KI-Einsatz ankommt. So sehen Sie, was Sie schon sicher beherrschen, wo Sie sich noch auf einzelne Personen oder den Zufall verlassen und wo sich der nächste Schritt lohnt. Das Ergebnis ist keine Note und kein Zertifikat. Es ist eine ehrliche Bestandsaufnahme, die Transparenz über die eigenen Fähigkeiten schafft und Optimierungspotenzial aufdeckt.',
  'Fähigkeiten',
  'Glück, Plan oder Lernkurve?',
  'KI professionell einzusetzen heißt, bestimmte Fähigkeiten aufzubauen: Nutzen bewerten, Daten sauber bereitstellen, Risiken beherrschen, Anwendungen zuverlässig betreiben. Jede Fähigkeit lässt sich in drei Reifegraden erreichen:',
  'Einfach',
  'Es klappt, aber es hängt an einzelnen Personen und ein wenig am Glück.',
  'Strukturiert',
  'Es klappt verlässlich, weil Vorgehen, Verantwortung und Kennzahlen festgelegt sind, egal wer gerade daran arbeitet.',
  'Intelligent',
  'Es klappt jedes Mal ein bisschen besser, weil Sie aus Fehlern lernen und Ihr Vorgehen gezielt anpassen.',
  'Nicht jede Fähigkeit muss die höchste Stufe erreichen. Entscheidend ist, dass sie zu Ihrem Einsatz passt. Und es zählt nur, was sich zeigen lässt: Gute Vorsätze sind noch keine Fähigkeit.',
  'Nicht überall auf der höchsten Stufe',
  'Es ist völlig in Ordnung, nicht in allen Dimensionen den höchsten Reifegrad zu erreichen. Unterschiedliche Reifegrade über die Dimensionen hinweg sind normal. Welcher Reifegrad sinnvoll ist, hängt vom Einsatz ab: Wer KI für erste Textentwürfe nutzt, braucht keinen ausgefeilten Notfallbetrieb. Wer einen Agenten selbstständig in Kundenprozessen handeln lässt, sollte bei Betrieb, Sicherheit und Governance deutlich weiter sein.',
  'Die Selbsteinschätzung ist keine Bewertung. Sie schafft Transparenz: Wo stehen wir? Wo verlassen wir uns noch auf einzelne Personen? Und wo lohnt sich der nächste Schritt? So erkennen wir Optimierungspotenzial und entscheiden bewusst, welche Dimension wir als Nächstes angehen.',
  'Dimensionen',
  'Wo müssen wir hinschauen?',
  'Professioneller KI-Einsatz ist mehr als ein gutes Modell. Acht Dimensionen in drei Bereichen decken ab, was bei dem professionellen Einsatz von KI dazugehört.',
  'Die Dimensionen im Überblick',
  'Strategie und Wirtschaftlichkeit',
  'Wissen wir, wofür wir KI einsetzen und ob es sich lohnt?',
  'Organisatorisch',
  'Hier geht es um den konkreten Nutzen: höhere Qualität, kürzere Bearbeitungszeiten, zusätzlicher Gewinn oder geringere Risiken. Für jeden Anwendungsfall klären wir, wie dieser Nutzen entsteht und welche Kosten und Risiken ihm gegenüberstehen. Eine nachvollziehbare Priorisierung entscheidet, welche Vorhaben wir starten, fortführen oder beenden. Messbare Ziele zeigen, ob der erwartete Nutzen tatsächlich eintritt.',
  'Reifegrade und Prüffragen: Strategie und Wirtschaftlichkeit',
  'Ressourcenplanung und Kompetenzen',
  'Haben wir die Menschen, die Zeit und das Wissen, um mit KI zu arbeiten?',
  'Organisatorisch',
  'Diese Dimension betrachtet, ob genügend Kapazität und passende Fähigkeiten vorhanden sind. Mitarbeitende müssen ihre Aufgaben mit KI erledigen können. Führungskräfte müssen Aufwand und Lernbedarf einschätzen können. Entscheidend ist nicht die besuchte Schulung, sondern ob das Gelernte an einer konkreten Aufgabe angewendet wird. Ebenso wichtig: Wissen wird geteilt und bleibt erhalten, wenn jemand das Team verlässt.',
  'Reifegrade und Prüffragen: Ressourcenplanung und Kompetenzen',
  'Betrieb',
  'Läuft unsere KI-Anwendung auch dann zuverlässig, wenn niemand danebensitzt?',
  'Organisatorisch',
  'Sobald wir KI dauerhaft nutzen, braucht sie Betreuung. Dazu gehören eine benannte Betriebsverantwortung, erreichbare Ansprechpartner und klare Eskalationswege, auch wenn mehrere Anwendungen und Dienstleister beteiligt sind. Für Ausfälle und Fehlaktionen braucht es erprobte Wege, um den Ablauf anzuhalten, ihn von Hand zu übernehmen und wieder aufzunehmen. Überwachung und eine zuordenbare Kostenübersicht machen Störungen und Verbrauchsspitzen sichtbar.',
  'Reifegrade und Prüffragen: Betrieb',
  'Governance und Compliance',
  'Wissen wir, unter welchen rechtlichen und vertraglichen Bedingungen wir KI einsetzen dürfen?',
  'Organisatorisch',
  'Ausgangspunkt ist der konkrete Anwendungsfall: Welchen Zweck erfüllt die KI, welche Daten verarbeitet sie und wie verwenden wir ihre Ergebnisse? Daraus ergeben sich je nach Einsatz Anforderungen, etwa aus dem EU AI Act, dem Datenschutz, dem Urheberrecht oder den Bedingungen der Anbieter. Bestehende Compliance-Verfahren bilden die Grundlage und werden um die Besonderheiten von KI ergänzt. Ändern sich Zweck, Daten oder Verträge, prüfen wir erneut.',
  'Reifegrade und Prüffragen: Governance und Compliance',
  'Agenten und Prozesse',
  'Ist KI sinnvoll in unsere Arbeitsabläufe eingebunden?',
  'Fachlich',
  'KI kann Wissen verfügbar machen, Entscheidungen unterstützen und Aufgaben bis hin zur selbstständigen Ausführung durch Agenten übernehmen. Den größten Nutzen bringt das, wenn wir den Ablauf dabei neu durchdenken, statt KI nur an bestehende Schritte anzuhängen. Je mehr die KI selbstständig erledigt und je höher das Risiko ist, desto klarer muss geregelt sein, wann Menschen prüfen, entscheiden oder eingreifen. Ersatzabläufe halten den Prozess am Laufen, wenn die KI ausfällt oder ungeeignete Ergebnisse liefert.',
  'Reifegrade und Prüffragen: Agenten und Prozesse',
  'Technologie und Infrastruktur',
  'Haben wir eine technische Grundlage, auf der wir weitere KI-Anwendungen aufbauen können?',
  'Technisch',
  'Dazu gehören Modelle und KI-Dienste, Plattformen, Werkzeuge, Schnittstellen sowie Rechen- und Speicherkapazität. Ob wir eine fertige Lösung nutzen, anpassen oder selbst entwickeln, hängt vom Anwendungsfall ab. Wichtig ist, dass Aufbau und Abhängigkeiten nachvollziehbar sind und andere Personen die Bereitstellung wiederholen können. Ein praktikabler Ausstiegsweg verhindert, dass wir von einem einzelnen Anbieter oder Modell abhängig werden.',
  'Reifegrade und Prüffragen: Technologie und Infrastruktur',
  'Daten und Wissen',
  'Findet die KI die Informationen, die sie für ihre Aufgabe braucht, und sind diese verlässlich?',
  'Technisch',
  'KI arbeitet nur so gut wie die Daten, Dokumente und das Fachwissen, die sie erhält. Die Bestände müssen die vorgesehenen Fälle abdecken und richtig, vollständig, aktuell und widerspruchsfrei sein. Herkunft, Version und Gültigkeit sollten nachvollziehbar sein, damit wir ein Ergebnis hinterfragen können. Ein Berechtigungskonzept regelt, wer worauf zugreifen darf, auch bei Kopien und Suchindizes.',
  'Reifegrade und Prüffragen: Daten und Wissen',
  'Sicherheit und Zuverlässigkeit',
  'Können wir nachweisen, dass unsere KI-Anwendung verlässlich und sicher arbeitet?',
  'Technisch',
  'Betrachtet wird die gesamte Anwendung einschließlich angebundener Datenquellen und Werkzeuge. Wir legen fest, welche Ergebnisqualität, Verfügbarkeit und Robustheit nötig sind, und prüfen sie mit realistischen Normal-, Grenz-, Fehler- und Angriffsfällen. Zugriffsrechte und Aktionsgrenzen setzen wir technisch durch und nicht nur über Anweisungen an das Modell, etwa zum Schutz vor eingeschleusten Anweisungen (Prompt Injection). Bei Unsicherheit, Zeitüberschreitung oder Ausfall wechselt die Anwendung in einen festgelegten sicheren Zustand.',
  'Reifegrade und Prüffragen: Sicherheit und Zuverlässigkeit',
  'Für jede Dimension wählen Sie einen Reifegrad. Am Ende sehen Sie alle acht nebeneinander und erkennen auf einen Blick, wo Sie stark sind und wo sich der nächste Schritt lohnt.',
  'Selbsteinschätzung starten',
];

test('REQ-115-AC1 REQ-115-AC3 REQ-115-AC4 REQ-23-AC1: Übersicht in Mock-Reihenfolge, Dimensionen auf- und zuklappen, Einstieg in die Selbsteinschätzung', async ({ page, request }) => {
  const calls = track(page);
  await page.goto(OVERVIEW);
  const main = page.getByRole('main');
  const toggles = main.locator('button[aria-expanded]');
  await expect(toggles).toHaveCount(DIMENSIONS.length);
  expect(released.filter((d) => d.released)).toHaveLength(DIMENSIONS.length);

  // AC1: Hero, Fähigkeiten mit Einordnung, Dimensionen; keine weiteren Abschnitte
  await expect(main.getByRole('heading')).toHaveText([...OVERVIEW_HEADINGS, ...DIMENSIONS.map((d) => new RegExp(`^\\d?\\s*${d}\\s`))]);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('KI Readiness');

  // AC3: anfangs geschlossen, mit Nummer, Titel und Leitfrage in fester Reihenfolge
  await expect(toggles).toHaveText(DIMENSIONS.map((d, i) => new RegExp(`^\\s*${i + 1}\\s*${d}\\s+\\S.*\\?\\s*$`)));
  for (const t of await toggles.all()) await expect(t).toHaveAttribute('aria-expanded', 'false');
  const detail = (name: string) => main.getByRole('link', { name: `Reifegrade und Prüffragen: ${name}` });
  await expect(detail('Betrieb')).toBeHidden();

  // Klick öffnet; Kategorie, Beschreibung und Verweis erscheinen
  await toggles.nth(2).click();
  await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'true');
  const panel = page.locator(`#${await toggles.nth(2).getAttribute('aria-controls')}`);
  await expect(panel).toContainText('Organisatorisch');
  await expect(panel).toContainText('Sobald wir KI dauerhaft nutzen, braucht sie Betreuung.');
  await expect(detail('Betrieb')).toBeVisible();

  // Enter und Leertaste schalten um; mehrere Einträge bleiben gleichzeitig offen
  await toggles.nth(4).focus();
  await page.keyboard.press('Enter');
  await expect(toggles.nth(4)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(toggles.nth(4)).toHaveAttribute('aria-expanded', 'false');
  await expect(detail('Agenten und Prozesse')).toBeHidden();
  await page.keyboard.press('Space');
  await expect(detail('Agenten und Prozesse')).toHaveAttribute('href', `${OVERVIEW}/agenten-und-prozesse`);
  await toggles.nth(2).click();
  await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'false');
  await expect(detail('Betrieb')).toBeHidden();
  expect(calls, 'Aufklappen erfasst keine Bewertung').toHaveLength(0);

  // AC4: beide Startaufrufe führen zur ersten Dimension, der Detailverweis zur passenden Dimensionsseite
  const start = main.getByRole('link', { name: 'Selbsteinschätzung starten' });
  await expect(start).toHaveCount(2);
  for (const s of await start.all()) await expect(s).toHaveAttribute('href', `${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await start.first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(DIMENSIONS[0]);
  await expect(page.locator('.assess-steps-count')).toHaveText('0 von 8 bewertet');
  await page.goBack();
  await toggles.nth(2).click();
  await detail('Betrieb').click();
  await expect(page).toHaveURL(/\/de\/themen\/ai-audit\/betrieb$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Betrieb');

  // Nicht freigegebene oder unbekannte Dimensionen sind nicht erreichbar
  expect((await request.get('/api/audit/dimensions/gibt-es-nicht?lang=de')).status()).toBe(404);
  for (const d of released.filter((x) => !x.released)) expect((await request.get(`/api/audit/dimensions/${d.slug}?lang=de`)).status()).toBe(404);
});

test('REQ-115-AC2: deutscher Hauptinhalt entspricht bei geöffneten Dimensionen vollständig und wortgetreu dem Mock', async ({ page }) => {
  await page.goto(OVERVIEW);
  const toggles = page.getByRole('main').locator('button[aria-expanded]');
  await expect(toggles).toHaveCount(DIMENSIONS.length);
  for (const t of await toggles.all()) await t.click();
  // Sichtbarer Text ohne dekorative Ziffern und Symbole; Zeilenumbrüche dürfen abweichen.
  const text = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    for (const el of main.querySelectorAll<HTMLElement>('[aria-hidden="true"]')) el.style.display = 'none';
    // Großschreibung der Labels ist Gestaltung (text-transform), nicht Wortlaut.
    for (const el of main.querySelectorAll<HTMLElement>('*')) el.style.textTransform = 'none';
    return main.innerText.replace(/\s+/g, ' ').trim();
  });
  expect(text).toBe(OVERVIEW_TEXT.join(' '));
});

test('REQ-23-AC2: Dimensionsseite zeigt Beschreibung, Prüffragen und drei Stufen ohne Vorauswahl', async ({ page }) => {
  await page.goto(`${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(DIMENSIONS[0]);
  await expect(page.locator('.dim-intro p').first()).not.toBeEmpty();
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(3);
  for (const r of await radios.all()) await expect(r).not.toBeChecked();
  for (const name of ['Einfach', 'Strukturiert', 'Intelligent']) {
    await expect(page.getByRole('heading', { name: `Prüffragen zu „${name}“` })).toBeVisible();
  }
  await expect(page.locator('.choice-questions li').first()).not.toBeEmpty();

  // „Weiter“ ist ohne Auswahl gesperrt und nennt den Grund
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Weiter' })).toHaveAccessibleDescription('Wähle einen Reifegrad, um fortzufahren.');
  await page.getByRole('radio', { name: /Intelligent/ }).check();
  await expect(page.getByRole('radio', { name: /Intelligent/ })).toBeChecked();
  await expect(page).toHaveURL(/strategie-und-wirtschaftlichkeit$/); // Auswahl allein wechselt nicht
});

test('REQ-23-AC3 REQ-23-AC4: Bewertungen bleiben beim Navigieren erhalten, unvollständige Auswertung nennt offene Dimensionen, Neuladen beginnt neu', async ({ page }) => {
  await page.goto(`${OVERVIEW}/strategie-und-wirtschaftlichkeit`);
  await page.getByRole('radio', { name: /Strukturiert/ }).check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('radio', { name: /Einfach/ }).check();
  await expect(page.locator('.assess-steps-count')).toHaveText('2 von 8 bewertet');

  // Zurück zur ersten Dimension: die Wahl ist erhalten
  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(page.getByRole('radio', { name: /Strukturiert/ })).toBeChecked();
  // Über die Navigation zur Übersicht und wieder in die Selbsteinschätzung
  await page.getByRole('link', { name: 'KI Readiness' }).first().click();
  await expect(page).toHaveURL(new RegExp(`${OVERVIEW}$`));
  await page.getByRole('link', { name: 'Selbsteinschätzung starten' }).first().click();
  await expect(page.locator('.assess-steps-count')).toHaveText('2 von 8 bewertet');
  await expect(page.getByRole('radio', { name: /Strukturiert/ })).toBeChecked();

  // Unvollständige Auswertung (Navigation innerhalb der Anwendung)
  await page.evaluate(() => {
    history.pushState({}, '', '/de/themen/ai-audit/auswertung');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const incomplete = page.locator('.result-incomplete');
  await expect(incomplete).toContainText('Bisher bewertet: 2 von 8');
  await expect(incomplete.getByRole('listitem')).toHaveText(DIMENSIONS.slice(2));
  await expect(page.getByRole('link', { name: 'Selbsteinschätzung fortsetzen' })).toHaveAttribute('href', '/de/themen/ai-audit/betrieb');
  await expect(page.locator('svg[role="img"]')).toHaveCount(0);
  await expect(page.locator('table.result-table')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.result-incomplete')).toContainText('Bisher bewertet: 0 von 8');
});

test('REQ-23-AC5: vollständige Auswertung mit Netzdiagramm, Tabelle und Ändern-Links, ohne Gesamtnote', async ({ page }) => {
  const levels = [1, 2, 3, 1, 2, 3, 1, 2];
  const slugs = await completeAssessment(page, 'de', levels);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auswertung der Selbsteinschätzung');
  await expect(page.getByRole('img', { name: 'Netzdiagramm deiner selbst eingeschätzten Reifegrade' })).toBeVisible();
  const rows = page.locator('table.result-table tbody tr');
  await expect(rows).toHaveCount(8);
  const names = ['Einfach', 'Strukturiert', 'Intelligent'];
  for (const [i, row] of (await rows.all()).entries()) {
    await expect(row.getByRole('rowheader')).toHaveText(`${i + 1}. ${DIMENSIONS[i]}`);
    await expect(row.getByRole('cell')).toContainText(`${levels[i]} – ${names[levels[i] - 1]}`);
    await expect(row.getByRole('link', { name: new RegExp(`^Ändern\\s*: ${DIMENSIONS[i]}$`) })).toHaveAttribute('href', `/de/themen/ai-audit/${slugs[i]}`);
  }
  await expect(page.locator('main')).not.toContainText(/Gesamtnote|Gesamtergebnis|Durchschnitt|Gesamtreifegrad/);

  // Ändern führt zur Dimension; die Änderung erscheint in der Auswertung
  await rows.nth(0).getByRole('link').click();
  await page.getByRole('radio', { name: /Intelligent/ }).check();
  await page.locator('.assess-steps a', { hasText: DIMENSIONS[7] }).click();
  await page.getByRole('button', { name: 'Auswertung anzeigen' }).click();
  await expect(rows.nth(0).getByRole('cell')).toContainText('3 – Intelligent');
});

test('REQ-23-AC6: ohne Einwilligung wird nichts übertragen', async ({ page }) => {
  const calls = track(page);
  await completeAssessment(page, 'de');
  await expect(page.locator('table.result-table')).toBeVisible();
  await page.getByRole('link', { name: /Ändern/ }).first().click();
  await page.getByRole('radio', { name: /Einfach/ }).check();
  expect(calls).toHaveLength(0);
});

test('REQ-23-AC6: mit Einwilligung wird nur das vollständige Ergebnis gespeichert, aktualisiert und beim Widerruf gelöscht', async ({ page, marketing }) => {
  const calls = track(page);
  const levels = [3, 1, 3, 1, 3, 1, 3, 3]; // Muster nur in diesem Test
  const start = Date.now() - 2_000;
  const slugs = await completeAssessmentWithConsent(page, levels);
  await expect(page.locator('.share-status')).toHaveText(/anonym gespeichert/);
  expect(calls.map((c) => c.method())).toEqual(['POST']);
  const first = calls[0].postDataJSON() as { key: string; lang: string; ratings: { dimension: string; level: number }[] };
  expect(Object.keys(first).sort()).toEqual(['key', 'lang', 'ratings']);
  expect(first.ratings).toEqual(slugs.map((s, i) => ({ dimension: s, level: levels[i] })));

  const mine = (r: Result) => Date.parse(r.submittedAt) >= start && r.ratings.map((x) => x.level).join() === levels.join();
  await expect.poll(async () => (await results(marketing)).filter(mine)).toHaveLength(1);

  // Änderung aktualisiert dasselbe Ergebnis
  await page.locator('table.result-table').getByRole('link').last().click();
  await page.getByRole('radio', { name: /Strukturiert/ }).check();
  await page.getByRole('button', { name: 'Auswertung anzeigen' }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].postDataJSON().key).toBe(first.key);
  const changed = [...levels.slice(0, 7), 2];
  await expect.poll(async () => (await results(marketing)).filter((r) => r.ratings.map((x) => x.level).join() === changed.join() && Date.parse(r.submittedAt) >= start)).toHaveLength(1);
  expect((await results(marketing)).filter(mine)).toHaveLength(0);

  // Widerruf löscht
  await page.getByLabel('Ergebnis anonym für die Statistik speichern').uncheck();
  await expect(page.locator('.share-status')).toHaveText('Dein gespeichertes Ergebnis wurde gelöscht.');
  expect(calls[2].method()).toBe('DELETE');
  expect(calls[2].url()).toContain(first.key);
  expect((await results(marketing)).filter((r) => r.ratings.map((x) => x.level).join() === changed.join() && Date.parse(r.submittedAt) >= start)).toHaveLength(0);
});

/** Alle Dimensionen bewerten, im letzten Schritt einwilligen und die Auswertung öffnen. */
async function completeAssessmentWithConsent(page: Page, levels?: number[]) {
  const audit = (await (await page.request.get('/api/audit?lang=de')).json()) as { dimensions: { slug: string }[] };
  await page.goto(`${OVERVIEW}/${audit.dimensions[0].slug}`);
  for (const [i, d] of audit.dimensions.entries()) {
    await page.locator(`#reifegrad-${d.slug}-${levels?.[i] ?? 2}`).check();
    const last = i === audit.dimensions.length - 1;
    if (last) await page.getByLabel('Ergebnis anonym für die Statistik speichern').check();
    await page.getByRole('button', { name: last ? 'Auswertung anzeigen' : 'Weiter' }).click();
    if (!last) await expect(page).toHaveURL(new RegExp(`/${audit.dimensions[i + 1].slug}$`));
  }
  await expect(page).toHaveURL(/\/auswertung$/);
  return audit.dimensions.map((d) => d.slug);
}

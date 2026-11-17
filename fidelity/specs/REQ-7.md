---
id: REQ-7
issue: https://github.com/MarvinJakob/AIPerspectives/issues/7
status: verifiziert
geprueft_am: 2026-11-17
---

# REQ-7 Themenseite Software Entwicklung auf Deutsch und Englisch

## Ziel

Besucher können den KI-gestützten Entwicklungsprozess vollständig auf Deutsch oder Englisch verstehen. Die Themenseite übernimmt den Artikelaufbau des beauftragten Mocks und ersetzt dessen lokale Verweise und Platzhalter durch bedienbare Website-Ziele.

## Quellen und Prüfvertrag

- Inhalt: ausdrücklich in #7 beauftragte Datei `content/topics/Software Development v1_de.md`, Stand 16. November 2026. Die nachfolgende Aussagenliste konserviert die fachliche Referenz; die Tests lesen keine lokalen Quelldateien.
- Gestaltung: `mock/software_development/index.html`, `styles.css`, `script.js`, `README.md` sowie die dort eingebundenen gemeinsamen Styles. Die Vorlage enthält Hero/Breadcrumb/Autor/Stand/Lesezeit, Artikel, hervorgehobenen Meinungsaufruf und weitere Themen. Sie ordnet Texte und Grafiken wie AC10 an.
- Originalgrafiken: `res/development-process_{de,en}.png`, `res/releasegate_{de,en}.png`. AC8 und AC9 identifizieren deren unveränderte PNG-Inhalte per SHA-256 über HTTP; Auslieferungspfad und Dateiname sind frei. Die vier Referenz-Prüfsummen stehen im Test. Der Mock öffnet die Originalgrafik per Link in einem neuen Tab; genau dieses beobachtbare Verhalten wird geprüft.
- Die bestehende kanonische Artikel-URL bleibt `/de/themen/softwareentwicklung` bzw. `/en/themen/softwareentwicklung`. Die Themenübersicht ist der Themenbereich der jeweiligen Startseite. Für Vibe Coding und Kontakt wird kein neuer Slug vorgegeben: entscheidend sind ein echtes, sprachlich passendes Website-Ziel und dessen nutzbarer Inhalt.
- Die englische Fassung muss **jede** unten aufgeführte Aussage übersetzen. Die Tests prüfen englische Bedeutungsbausteine mit Wortvarianten, keine fest vorgegebene Gesamtübersetzung. Deutsche Tippfehler aus der Quelle sind kein geforderter Produktinhalt; die fachliche Aussage muss erhalten bleiben.
- Gemeinsame Navigation verwendet „KI Readiness“ bzw. übersetzt „AI Readiness“, der neue Artikel die Ansprache „du“ bzw. englisch „you“. Technische Qualitätsmerkmale werden nur als Artikelinhalt geprüft; diese Anforderung führt keinen neuen Entwicklungsprozess für die Anwendung ein.

## Akzeptanzkriterien

Je Kriterium genau ein Test in `tests/REQ-7.spec.ts`; jeder läuft in den konfigurierten Projekten `desktop` und `mobil` und prüft beide Sprachen unabhängig von anderen Tests.

| ID | Kriterium | Test |
|---|---|---|
| REQ-7-AC1 | Der Artikel ist aus der Themenübersicht beider Sprachen erreichbar. Beide direkten Sprach-URLs antworten mit 200 und zeigen auch nach Neuladen die passende Hauptüberschrift. | `tests/REQ-7.spec.ts` |
| REQ-7-AC2 | Der Hero enthält den sprachlich passenden Titel („KI in der Softwareentwicklung“ / „AI in Software Development“), Marvin Jakob, Stand 16. November 2026, etwa vier Minuten Lesezeit und einen Themen-Breadcrumb. | `tests/REQ-7.spec.ts` |
| REQ-7-AC3 | Der Abschnitt „Moderne Softwareentwicklung“ / „Modern Software Development“ enthält alle acht unten aufgelisteten fachlichen Aussagen. | `tests/REQ-7.spec.ts` |
| REQ-7-AC4 | Der Abschnitt „Das ist der Weg!“ / „This is the way!“ nennt Din Djarin und erklärt das klare Was und Warum, den präzisen KI-Auftrag und die Arbeitsteilung zwischen Mensch und Maschine. | `tests/REQ-7.spec.ts` |
| REQ-7-AC5 | Der Artikel enthält alle zwölf unten aufgelisteten Aussagen über die drei Teams, Fidelity-Tests, Tickets, Backlog und Merge Gate. | `tests/REQ-7.spec.ts` |
| REQ-7-AC6 | Der Release-Absatz erläutert alle drei Aussagen: zahlreiche Commits werden je Release in einem Branch zusammengefasst, ein finaler Test prüft die Funktion vor der Veröffentlichung und der Push ins Repository erfolgt am Ende. | `tests/REQ-7.spec.ts` |
| REQ-7-AC7 | Ein hervorgehobener Meinungsaufruf fragt „Würdest du auch so entwickeln?“ (sinngemäß Englisch), lädt zum Teilen der Meinung ein und zeigt einen Kontaktformular-Link. | `tests/REQ-7.spec.ts` |
| REQ-7-AC8 | Die Originalgrafiken Entwicklungsprozess und Release Gate laden ohne Fehler, mit beschreibenden Alternativtexten und in der zur Artikelsprache passenden deutschen bzw. englischen Fassung. | `tests/REQ-7.spec.ts` |
| REQ-7-AC9 | Beide Grafiken besitzen sprachlich beschriftete Vergrößerungslinks. Mit Tastaturfokus und Enter öffnen diese die jeweilige Original-PNG in voller Größe in einem neuen Tab (200). | `tests/REQ-7.spec.ts` |
| REQ-7-AC10 | Die sichtbare Abschnittsfolge ist: Hero → Moderne Softwareentwicklung mit Vibe-Coding-Verweis → „Der Weg“ → Entwicklungsprozessgrafik → Drei Teams/Merge Gate → Release-Gate-Grafik → Release-Absatz → Meinungsaufruf → Weitere Themen. | `tests/REQ-7.spec.ts` |
| REQ-7-AC11 | Auf Desktop und Mobil bleiben Überschriften, Text, beide Grafiken und Kontaktaktion ohne horizontales Abschneiden lesbar. Fließtext hat mindestens 16 px Schrift, 1,5-fache Zeilenhöhe und höchstens 800 px Lesebreite; Grafiken behalten ihr Seitenverhältnis und die Kontaktaktion hat mindestens 44 px Höhe. | `tests/REQ-7.spec.ts` |
| REQ-7-AC12 | Der Verweis „Wie du mit Vibe Coding sinnvolle Ergebnisse erziehlst“ (sinngemäß Englisch) öffnet eine echte Vibe-Coding-Themenseite in derselben Sprache, keine Markdown-Datei, Mock-Seite oder Fehlerseite. | `tests/REQ-7.spec.ts` |
| REQ-7-AC13 | Der Kontaktaufruf öffnet in derselben Sprache eine echte Kontaktseite mit sichtbaren Eingaben für E-Mail und Nachricht sowie Senden-Aktion. | `tests/REQ-7.spec.ts` |
| REQ-7-AC14 | Der Sprachwechsel DE→EN→DE erhält den Artikelpfad und übersetzt Titel, Zwischenüberschrift, Kontaktaktion, Rücklink und Vergrößerungslinks. Kein Übersetzungs-Fehlhinweis und keine deutsche Sie-Ansprache erscheinen im Artikel. Die gemeinsame Navigation nennt „KI Readiness“ / „AI Readiness“. | `tests/REQ-7.spec.ts` |
| REQ-7-AC15 | Unter „Mehr Themen“ / „More Topics“ öffnen Data Analytics und Modelle und Kosten echte passende Website-Themen (passende Hauptüberschrift der Themenseite oder vorhandener, sichtbarer Themenabschnitt der Übersicht). Nicht vorhandene oder verwechselte Fragmente zählen nicht als funktionierendes Ziel. „Alle Themen“ / „All Topics“ führt zur Übersicht zurück, von der der Artikel wieder erreichbar ist. | `tests/REQ-7.spec.ts` |
| REQ-7-AC16 | Alle Artikel-Links besitzen Ziele; lokale Mock-/Markdown-Verweise sowie Grafik-, Kontakt- und Entwurfshinweise sind ersetzt. | `tests/REQ-7.spec.ts` |
| REQ-7-AC17 | Der Mock bleibt in seiner sichtbaren Gestaltung erkennbar: warmer Hero (#fcf8f3), orangefarbener Meinungsblock (#dc6e14), großer Titel (Desktop ≥48 px, Mobil ≥30 px), zentrierte Lesespalte, auf Desktop breitere Prozessgrafik und zwei Themenkarten nebeneinander, mobil untereinander. | `tests/REQ-7.spec.ts` |

## Szenarien

### REQ-7-AC1 Übersicht und direkter Aufruf

- **Gegeben** eine unabhängig gestartete Sitzung in DE oder EN.
- **Wenn** der Artikel-Link in der Startseiten-Themenübersicht gewählt und anschließend die Artikel-URL direkt aufgerufen und neu geladen wird.
- **Dann** stimmen Sprach-URL, HTTP-Status 200 und Hauptüberschrift in beiden Fällen.

### REQ-7-AC2 Hero

- **Gegeben** der Artikel in einer der beiden Sprachen.
- **Wenn** der Einstieg gelesen wird.
- **Dann** sind Titel, Autor, Datum und Lesezeit sowie ein Themen-Breadcrumb sichtbar. Das Datum wird im englischen Datumsformat ausgegeben.

### REQ-7-AC3 Moderne Softwareentwicklung

- **Gegeben** der vollständige Artikel in DE bzw. EN.
- **Wenn** die Einordnung gelesen wird.
- **Dann** enthält sie jede Aussage der Quelle:
  1. KI ist besonders wirksam bei gut überprüfbaren Ergebnissen.
  2. In der Mathematik bestätigen oder widerlegen Beweise bzw. Gegenbeispiele Lösungen.
  3. Ausführbare Softwaretests prüfen erwartete Implementierungsergebnisse.
  4. KI ist inzwischen so gut in der Softwareentwicklung, dass die menschliche Ergebnisbewertung nicht mehr hinterherkommt.
  5. KI schreibt Code, erstellt Tests, sucht Fehler und setzt Korrekturen um.
  6. Klare Anforderungen, Prüfverfahren und die Gestaltung des Entwicklungsprozesses gewinnen für Menschen an Bedeutung.
  7. Verlässlichere Prüfung erlaubt Agenten mehr selbstständige Arbeitsschritte.
  8. Das verändert die Arbeit in der Softwareentwicklung grundlegend.

### REQ-7-AC4 Der Weg

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** der zweite Abschnitt gelesen wird.
- **Dann** enthält er das Din-Djarin-Zitat, die Frage nach dem Was und dem wichtigeren Warum, den präzisen Auftrag als Voraussetzung für den KI-Einsatz und das Ziel, Menschen auf Inhalte und Maschinen auf Fleiß-/Routinearbeit zu konzentrieren.

### REQ-7-AC5 Drei Teams und Merge Gate

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** der Prozess nach der ersten Grafik gelesen wird.
- **Dann** enthält er jede Aussage der Quelle:
  1. Drei Teams ermöglichen vielen Agenten parallele Arbeit.
  2. Team 1 besteht aus Testanalysten, zerlegt Anforderungen in Szenarien und schreibt Fidelity-Tests.
  3. Die Software soll sich exakt wie in den Anforderungen beschrieben verhalten.
  4. Fidelity-Tests halten Abläufe, Sonderfälle und Fehlerbehandlung nach Referenzszenarien fest.
  5. Diese Tests sind für KI leichter überprüfbar.
  6. Team 2 besteht aus Testagenten, führt Tests einzeln auf dem bisherigen Code aus und erstellt Feature- und Bug-Tickets.
  7. Abweichungen vom beschriebenen Verhalten werden im Backlog dokumentiert.
  8. Auch gewünschtes Verhalten wird als Ticket festgehalten.
  9. Das interne Backlog ist Arbeitsgrundlage des dritten Teams.
  10. Fixer übernehmen jeweils ein Bug-Ticket und arbeiten bis zu dessen Lösung.
  11. Vor dem Commit muss der Code durch das Merge Gate.
  12. Gelöste Tickets müssen das Problem lösen und Mindeststandards für Codequalität und Security erfüllen.

### REQ-7-AC6 Release

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** der Absatz nach der Release-Gate-Grafik gelesen wird.
- **Dann** werden Commit-Bündelung in einem Release-Branch, finaler Funktionstest vor der Veröffentlichung und Push erst am Ende erklärt.

### REQ-7-AC7 Meinung

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** das Artikelende erreicht wird.
- **Dann** folgen die Entwicklungsfrage, Einladung zur Meinung und sichtbarer Kontaktformular-Link.

### REQ-7-AC8 Passende Grafiken

- **Gegeben** ein Artikelaufruf in DE bzw. EN.
- **Wenn** beide Diagramme in den sichtbaren Bereich gescrollt werden.
- **Dann** sind sie geladen, besitzen unterscheidbare beschreibende Alternativtexte und entsprechen über HTTP den beiden sprachlich richtigen Original-PNGs.

### REQ-7-AC9 Vergrößerung

- **Gegeben** der Artikel und eine seiner beiden Grafiken.
- **Wenn** der beschriftete Vergrößerungslink fokussiert und Enter gedrückt wird.
- **Dann** öffnet ein neuer Tab die betreffende Originalgrafik; deren HTTP-Inhalt ist das vollständige Original-PNG. Für beide Grafiken und beide Sprachen wiederholen.

### REQ-7-AC10 Reihenfolge

- **Gegeben** der vollständige Artikel in DE bzw. EN.
- **Wenn** die vertikalen Positionen seiner Inhaltsanker verglichen werden.
- **Dann** folgen sie ohne Überlagerung der Reihenfolge aus AC10. Die Grafiken stehen unmittelbar zwischen den in der Textvorlage markierten Inhaltsblöcken.

### REQ-7-AC11 Lesbarkeit

- **Gegeben** der Artikel auf Desktop (1280×720) bzw. Pixel 7 (412×839).
- **Wenn** Titel, Einleitungsabsatz, Grafiken und Kontaktaktion gelesen werden.
- **Dann** liegen diese im Viewport, die Seite hat keinen horizontalen Überlauf, Schrift und Zeilenhöhe sind lesbar, Grafiken unverzerrt und die Kontaktaktion ausreichend groß.

### REQ-7-AC12 Vibe Coding

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** sein Vibe-Coding-Verweis gewählt wird.
- **Dann** öffnet eine Website-Themen-URL derselben Sprache mit HTTP 200 und Vibe-Coding-Hauptüberschrift. Die Zielseite aus #6 ist eine Abhängigkeit; deren übriger Inhalt wird dort spezifiziert.

### REQ-7-AC13 Kontakt

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** sein Kontaktaufruf gewählt wird.
- **Dann** öffnet eine Website-Kontaktseite derselben Sprache mit HTTP 200, Hauptüberschrift und benutzbarem Formular. Es wird keine Nachricht abgeschickt; Verarbeitung und Redaktionseingang sind Gegenstand von #4.

### REQ-7-AC14 Sprachwechsel und Ansprache

- **Gegeben** der deutsche Artikel.
- **Wenn** per sichtbarer Sprachwahl nach Englisch und zurück gewechselt wird (mobil nach Öffnen des Menüs).
- **Dann** bleibt der Artikel geöffnet und alle oben benannten Inhalts-/Bedienelemente folgen der Sprache. Der Artikel verwendet du/you und bietet keinen deutschen Ersatztext mit Fehlhinweis an. Die Navigation verwendet die beauftragte Benennung KI Readiness bzw. AI Readiness.

### REQ-7-AC15 Weitere Themen und Rückweg

- **Gegeben** ein jeweils frischer Artikelaufruf.
- **Wenn** die beiden weiteren Themenkarten bzw. der Rücklink gewählt werden.
- **Dann** öffnen funktionierende sprachlich passende Website-Ziele; die Übersicht bietet erneut den Softwareentwicklungsartikel an. Fragmente müssen als öffentlich sichtbare Inhaltsanker existieren und im Viewport liegen. Ein Themenfragment muss zur Überschrift des mit dem passenden Themennamen beschrifteten Abschnitts gehören; eine Themenseite muss den passenden Namen in der Hauptüberschrift tragen.

### REQ-7-AC16 Keine Platzhalter

- **Gegeben** der Artikel in DE bzw. EN.
- **Wenn** sichtbarer Text und öffentlich sichtbare Linkziele betrachtet werden.
- **Dann** sind Grafik-Einfügehinweise, Kontakt-Platzhalter, lokale Entwurfskennzeichnungen, Markdown-Ziele, Mock-Pfade und JavaScript-Pseudo-Links entfernt.

### REQ-7-AC17 Responsive Gestaltung

- **Gegeben** der Artikel in der hellen Standarddarstellung auf Desktop bzw. Mobil.
- **Wenn** die gerenderten Größen, Farben und Positionen betrachtet werden.
- **Dann** entsprechen sie den in AC17 benannten Merkmalen des Mocks. Die Themenkarten wechseln bei ≤650 px von zwei Spalten auf eine; die Desktopgrafik ist mindestens 100 px breiter als der Lesetext.

## Nicht Teil der Anforderung

- Implementierung des Kontaktformulars, Nachrichtenversand und Redaktionseingang (#4); hier wird die nutzbare Verknüpfung geprüft.
- Inhalt und Layout der Vibe-Coding-Zielseite (#6), Data Analytics und Modelle und Kosten; hier werden Erreichbarkeit und passende Zielseite geprüft.
- Globale Umbenennungen oder Umstellung aller bestehenden Seiten auf du (#8), Dark-Mode-Neugestaltung und neue Navigation. Die gemeinsame bestehende Navigation wird eingebunden; die im Issue beauftragte Benennung wird geprüft.
- Neue Entwicklungswerkzeuge, reale Agententeams oder technische Ausführung von Merge/Release Gate aufgrund des Artikeltextes.
- Lokale Mock-Fußzeile („Lokaler Designentwurf“, „Keine Datenübertragung“), temporärer Kontakt-Hinweis und lokale Markdown-/HTML-Ziele: Diese sind laut Issue durch echte Website-Inhalte zu ersetzen.
- Zusätzliche Kapitel der bisherigen Themenseite (Guardrails, Findings), die nicht in der ausdrücklich beauftragten neuen Inhaltsquelle stehen.
- Exakte Zeilenumbrüche, DOM-Struktur, CSS-Klassennamen, Asset-URLs und pixelidentische Systemschrift-Rasterung. Geprüft werden die fachlichen Aussagen und beobachtbaren Gestaltungsmerkmale.

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder bestandene Test wurde mit verfälschter Erwartung rot gesehen und anschließend zurückgesetzt; fachlich rote Tests wurden auf die richtige Ursache geprüft.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.
- [x] Jede fachliche Aussage des Issues ist einem Kriterium oder dem expliziten Ausschluss zugeordnet.

### Nachweis

Am 16.11.2026 beide Frontends und den Backendserver aus `origin/main` (`e4e4a6a532b86db11b9f042f04981204af291e49`) gebaut und mit `DEV_SEED=true`, eigener Datenbank und Port 20007 gestartet. Kein Anwendungscode wurde geändert. `npm run typecheck` besteht.

Vollständiger Lauf: 40 Projekttests (20 IDs × Desktop/Mobil), 10 grün, 30 fachlich rot, keine übersprungenen oder instabilen Tests. `npm run gate -- --results .build/main-results.json` besteht ohne Baseline-Regression. Die drei REQ-0-Baseline-IDs sowie REQ-7-AC1 und REQ-7-AC16 bestehen in beiden Projekten. Die restlichen 15 REQ-7-IDs sind offener Anforderungsumfang; das ist kein bestandener Funktionalitätsnachweis.

| IDs | Beobachteter Grund auf main (Desktop und Mobil) |
|---|---|
| AC1 | Themenübersicht, DE-/EN-URL und Neuladen funktionieren. Gegenprobe `200` → `201` wird in beiden Projekten rot; Erwartung zurückgesetzt. |
| AC2 | Autorblock im Hero fehlt; die alte Seite zeigt außerdem den vorherigen Inhaltsstand. |
| AC3 | Neue Zwischenüberschrift und Aussagen zur nicht mehr nachkommenden Ergebnisbewertung fehlen; stattdessen wird der alte Artikel gezeigt. |
| AC4 | Din-Djarin-Abschnitt mit den Aussagen zum Was/Warum fehlt. |
| AC5 | Die neue vollständige Beschreibung von Analysten/Testern/Fixern und Merge Gate fehlt. |
| AC6 | Release-Absatz mit Bündelung, finalem Test und abschließendem Push fehlt. |
| AC7 | Der Meinungs-/Kontaktaufruf fehlt. |
| AC8–AC9 | Die beiden beauftragten Diagramme und ihre beschrifteten Vergrößerungslinks fehlen; vorhanden ist die ältere Prozessgrafik. |
| AC10–AC11 | Die neuen Inhaltsanker und Grafiken für die beauftragte Reihenfolge/Lesbarkeit fehlen. |
| AC12–AC13 | Vibe-Coding-Verweis und Kontaktformular-Aufruf fehlen. |
| AC14 | Sprachwechsel funktioniert, doch die neue englische Zwischenüberschrift und die weiteren neuen Bedienelemente fehlen. |
| AC15 | Der beauftragte Bereich mit weiteren Themen fehlt. |
| AC16 | Der bisherige Artikel enthält keine lokalen Mock-/Markdown-Platzhalter. Separate Gegenprobe mit absichtlich verbotenem vorhandenen Artikeltext wird auf Desktop und Mobil rot; Erwartung zurückgesetzt. |
| AC17 | Der Hero-Hintergrund ist weiß statt des warmen Mock-Hintergrunds; die beauftragte Artikelgestaltung ist noch nicht umgesetzt. |

Die UI-Fehlerberichte wurden mit dem tatsächlich sichtbaren bisherigen Artikel abgeglichen: Es fehlen beauftragte Inhalte, keine nicht erreichbare Anwendung oder fehlerhaften Testdaten. Zusätzlich sämtliche deutschen Inhaltsausdrücke und Inhaltsanker gegen den **sichtbaren Originalmock** bei 1280 und 412 px geprüft; alle passen. Dabei wurden Schreibweisenkorrekturen (`erziehlst`/`erzielst`, Interpunktion) ausdrücklich toleriert. Die englischen Ausdrücke prüfen dieselbe Aussagenliste; auf main enthalten die englischen Alttexte ebenfalls noch nicht den neuen Artikelumfang.

Nach dem Abruf des neueren `origin/main` (`72175f5580fe7ac159ccf4ee47f69ce54d1663c3`) sind Anwendung und Baseline unverändert; hinzugekommen sind Prozess-/Betriebsdokumentation und unabhängige Tests zu #4. Der gezielte Nachlauf für die betroffenen Inhalts-/Navigationskriterien bestätigt die fachlichen Fehlschläge auf Desktop und Mobil. Die Baseline wird von Team 1 nicht erweitert.

Das unabhängige Review fand zwei zuvor von fehlenden Artikelfunktionen verdeckte Testfehler. Korrigiert: AC14 berücksichtigt den gerenderten geöffneten Zustand des mobilen Menüs; AC15 prüft tatsächliche Fragmentziele und den passenden Abschnitt bzw. die passende Hauptüberschrift. Zusätzliche Browser-Gegenproben mit **denselben Testhilfen** gegen den unveränderten main-Server: DE→EN→DE samt Navigationsprüfung bei 1280 und 412 px erfolgreich; in DE/EN insgesamt acht gültige Themen- und Abschnittsziele angenommen sowie zwölf nicht vorhandene oder verwechselte Abschnitts-/Themenseitenziele abgelehnt. Die Prüflinks wurden ausschließlich im lokalen Browser erzeugt, ohne Anwendungsdaten oder Anwendungscode zu ändern.

### Korrektur test-defect #48 (17.11.2026)

Die Sie-Prüfung in AC14 lief mit Flag `i` und traf dadurch auch das kleingeschriebene Possessiv „ihre Ergebnisse“ (bezogen auf KI), das AC3 ausdrücklich fordert; AC3 und AC14 konnten nicht gleichzeitig bestehen. Die Prüfung erkennt jetzt nur die großgeschriebene Sie-Ansprache (`Ihnen`, `Ihre …`, `… Sie`); Kriterium und ID bleiben unverändert.

- Ausdrucksprüfung: Der neue Ausdruck trifft „Ihre Meinung“, „Ihnen“, „würden Sie“, „Teilen Sie Ihre Ergebnisse“, aber nicht „wenn ihre Ergebnisse“, „würden sie“ oder „deine Meinung“.
- `origin/main` (`1eb34e0`), Port 20048, `DEV_SEED=true`: AC3 und AC14 scheitern auf Desktop und Mobil weiter fachlich an der fehlenden Zwischenüberschrift „Moderne Softwareentwicklung“ / „Modern Software Development“.
- Umsetzungsstand `fix/7` (`4b1ea00`, PR #46), gleicher Aufbau: mit korrigiertem Test bestehen AC3 und AC14 auf Desktop und Mobil. Gegenprobe mit dem alten Ausdruck (`/i`): AC14 wird auf beiden Projekten rot, ausschließlich an der Sie-Prüfung; danach zurückgesetzt.

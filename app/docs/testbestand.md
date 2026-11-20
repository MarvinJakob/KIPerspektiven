# Testbestand

Stand: Anforderung #111 (19.11.2026). Die Tests prüfen die Features der Seite. Nicht jeder frühere Fehler und nicht jeder Grenzfall hat einen eigenen Test (AGENTS.md, Abschnitt 2). Die Bestandsaufnahme je Einzeltest vor der Kürzung steht in der Versionsgeschichte dieser Datei (Anforderung #94).

## Regeln

- **Bleibt:** je Feature der Hauptablauf über die maßgebliche Schnittstelle, der Zugriffsschutz für personenbezogene Daten und Redaktionsfunktionen sowie die wichtigste Fehlermeldung eines Formulars.
- **Entfällt:** Pixel-, Breiten-, Typografie- und Kontrastprüfungen, Varianten je Viewport, Sprache oder Farbschema ohne eigenes Feature, Negativprüfungen entfernter Inhalte, Prüfungen einzelner früherer Fehler, simulierte Netz- und Speicherfehler, reine Tastatur- und Touch-Varianten desselben Ablaufs.
- **Zeitgesteuerte Abläufe** (geplante Veröffentlichung, geplantes Teilen, Löschfristen) prüfen die Go-Tests mit kontrollierter Uhr. Fidelity-Tests warten nicht auf den Zeitplaner.
- Eine neue Spec nennt in ihrer Kopfzeile `// Abdeckung …` ihre Einstiegsmodule und wird hier ihrem Feature zugeordnet.

## Umfang vor und nach #111

| Suite | Ausgang `86b4419` | Nach #111 | Entfernt |
|---|---|---|---|
| Fidelity (Playwright) | 373 Tests in 40 Specs, mit #110 weitere 11 in `108-browsertitel` | 92 Tests in 29 Specs (einschließlich 3 Anmeldungen im Setup) | 292 Tests, 12 Specs |
| Vitest `app/frontend` | 127 Testdeklarationen in 20 Dateien, mit #110 weitere 11 in `lib/page.test.tsx` | 104 in 14 Dateien | 34 Tests, 7 Dateien |
| Vitest `app/frontend-redaktion` | 34 in 5 Dateien | unverändert | – |
| Go `app/backend` | 73 Testfunktionen | unverändert | – |
| Prozesswerkzeuge `tools` | 51 Tests | unverändert | – |

Laufzeit des Ausgangsstands im Release Gate [44547333616](https://github.com/MarvinJakob/KIPerspektiven/actions/runs/44547333616): Fidelity-Job 308 s (Image bauen 90 s, Akzeptanztests 195 s bei 596 s Testzeit auf 4 Workern), Backend 26 s, Frontends 18 s und 12 s, Prozesswerkzeuge 8 s. Die Messwerte nach der Änderung stehen im Ticket #111.

## Entfernte Gruppen

Vollständig entfernt (Testzahlen aus dem Lauf 44547333616):

| Gruppe | Tests | Grund |
|---|---|---|
| Specs 25, 37, 38, 47, 61, 63: entfernte Themen, „Mehr Themen“, Linkkarten, Profilteaser, Brotkrumen | 48 | Prüfen, dass entfernte Inhalte fehlen; kein Feature der Seite. |
| Specs 41, 43, 56, 57, 66: Diagrammklick, Spaltenbreiten, Position der Metadaten, Lesefluss | 44 | Layoutdetails einzelner Artikel in Pixeln und je Breite. |
| Spec 67-artikelkonten | 2 | Rollenprüfung und Leerzustand; Rechte je Rolle prüfen die Go-Tests `TestREQ64…`, den Zugriffsschutz `67-themenartikel`. |
| Vitest `ArticleHeader`, `Diagram`, `Home`, `Profile`, `SoftwareDevelopment`, `i18n/softwareDevelopment`, `i18n/vibeCoding` | 34 | CSS-Regeln und Negativprüfungen zu denselben Themen. |

Gekürzte Specs (Tests vorher → nachher):

| Spec | Tests | Entfernt |
|---|---|---|
| `06-passwort-maskieren` | 9 → 1 | Touch, Tastatur, Fokusverlust, Wiederholung, leeres Feld, Breiten |
| `108-browsertitel` | 11 → 4 | Fehlerseite, Weiterleitung von „/“, Themenartikel und Dimension, Titel während des Ladens, Social-Media-Titel (Regeln in `lib/page.test.tsx`, `web/meta_test.go`) |
| `104-ninja-design` | 28 → 3 | Typografie- und Kontrastmessungen, Layoutverschiebung, Breiten, erzwungene Farben, Redaktion; Tokens bleiben in `design.test.ts` |
| `16-darstellung` | 8 → 3 | Redaktionsvariante, ohne Einwilligung, blockierter Speicher, Tastatur, mobil |
| `17-profil` | 6 → 2 | Reihenfolge der Abschnitte, Sprachwechsel, Breiten |
| `18-vibe-coding` | 6 → 3 | Linkziele, Breiten |
| `19-softwareentwicklung` | 6 → 2 | Abschnittsfolge, Verweise, Breiten |
| `20-blog` | 7 → 4 | Leerzustand und Ladefehler, Breiten |
| `21-redaktion-beitraege` | 13 → 6 | Fehlermeldung in der Oberfläche zusätzlich zur API, nicht existierende Ortszeiten, Verlassen-Warnung, abgelaufene Sitzung, mobil, Tastatur, Upload über die API zusätzlich zur Oberfläche |
| `22-kontakt` | 10 → 4 | Pflichtfeldattribute, Längenbegrenzung, Server-, Netz- und Ratenfehler, Englisch, mobil |
| `23-readiness` | 11 → 6 | Backendvariante, Lade-, Speicher- und Löschfehler, Englisch, Tastatur, mobil |
| `24-sprache` | 10 → 4 | zweite Präfixvariante, ohne Einwilligung, blockierter Speicher, Tastatur, mobil |
| `26-statistik` | 7 → 3 | Navigation ohne Zählung, Leerzustand und Ladefehler, unvollständige Daten, mobil |
| `27-beratung` | 10 → 4 | Server-, Netz- und Ratenfehler, Ratenbegrenzung, Löschfehler, Englisch, mobil |
| `28-benutzer` | 11 → 4 | ungültige Eingaben, eigenes Konto, Statuswechsel in der Oberfläche zusätzlich zur API, Fehlerfälle, mobil |
| `34-startseite-kurzcheck` | 19 → 4 | Breiten, Fokus, reduzierte Bewegung, erzwungene Farben, Zählvarianten, Neuladen; Ablauf und Ergebnis laufen in einem Test |
| `54-footer` | 11 → 2 | Anordnung, Absätze, Tastaturreihenfolge, Farben, 320 px; Klick auf jedes der acht Ziele |
| `64-rollen-profile` | 20 → 5 | Rollenrechte über die API (Go-Tests `TestREQ64…`), ungültige Eingaben, Marketing-Oberfläche, zweite Breite |
| `65-tageswerte-grafik` | 7 → 2 | 400 Tage, Tastatur, Touch, Nullwerte, Leerzustand (Regeln in `chartDays.test.ts`) |
| `67-themenartikel` | 7 → 3 | Titel- und Autorenprüfung, Bildformate, Tastatur je Breite |
| `74-datenschutz` | 9 → 2 | zweite Breite, Verweise aus Kontakt und Auswertung, Vergleich der Fassungen (Inhalte in `datenschutz.test.ts`) |
| `75-blog-nachladen` | 2 → 1 | mobile Variante |
| `76-news` | 11 → 3 | mobiles Menü, Footerlink, Leerzustände (Texte in `i18n/news.test.tsx`) |
| `77-zeichenzaehler` | 8 → 2 | Restlänge, Emoji, Auswahl ersetzen, Sprachen, mobil (Regeln in `messageLength.test.ts`) |
| `78-speicherwahl` | 10 → 2 | Beschriftung je Sprache, Tastatur, mobil (Texte in `consentTexts.test.ts`) |
| `84-minuten` | 4 → 1 | Warten auf die volle Minute (bis 21 s), ungültiger Termin, zweite Breite; Regeln in `service/editorial_test.go` |
| `85-linkedin` | 10 → 3 | geplantes Teilen (40 s Wartezeit), ausgeschaltet, Ablehnung, unklarer Ausgang, Geheimnisse, zweite Breite; Regeln in `service/social_test.go` |
| `90-nachrichten-loeschen` | 4 → 3 | Löschfehler in der Oberfläche |
| `98-mobiles-inhaltsverzeichnis` | 12 → 3 | Englisch, weitere Seitentypen, Breakpoint, weniger als zwei Abschnitte, Tastatur (Regeln in `toc.test.ts`, `MobileToc.test.tsx`) |

## Features der Seite und ihre Tests

### Öffentliche Webseite

| Feature | Fidelity (`app/e2e/tests`) | Unit |
|---|---|---|
| Startseite mit Themenliste und KI-Readiness-Kurzcheck | `34-startseite-kurzcheck` (4): Einstiege, Themenzeilen, Kurzcheck mit Ergebnis, Sprachwechsel | – |
| Themenartikel „Vibe Coding“ | `18-vibe-coding` (3): Inhalt DE/EN, Sprunglinks, Grafik | `ArticleByline`, `articleMeta` |
| Themenartikel „Softwareentwicklung“ | `19-softwareentwicklung` (2): Inhalt mit Autor, Stand und Lesezeit, Grafiken | `ArticleByline`, `articleMeta` |
| Redaktionelle Themenartikel | `67-themenartikel` (3): Inhalt und Status öffentlich, Zugriffsschutz, Editor | `ArticleBlocks`, Go `TestArticleValidation` |
| News: Übersicht, Beitrag, Nachladen | `20-blog` (4), `75-blog-nachladen` (1), `76-news` (3) | `Blog`, `i18n/news`, `PostAuthor`, Go `TestREQ75…`, `TestNewsOverviewTitle` |
| Mobiles Inhaltsverzeichnis | `98-mobiles-inhaltsverzeichnis` (3): Abschnitte, Markierung, Sprung | `toc`, `MobileToc` |
| Profil | `17-profil` (2): Inhalt DE/EN, Einstiege und Kontaktziele | – |
| KI-Selbsteinschätzung (Readiness) | `23-readiness` (7): Übersicht nach Mock mit Aufklappen und Einstieg, Wortlaut der Übersicht, Dimension, Bewertung, Auswertung, Speicherung mit und ohne Einwilligung | `i18n/readiness` |
| Beratungsanfrage | `27-beratung` (4): Anfrage, Feldfehler, Zugriffsschutz, Verwaltung mit Löschen | Go `TestREQ90AC5…` |
| Kontaktformular mit Zeichenzähler | `22-kontakt` (4): Senden, Feldfehler, Zugriffsschutz, Eingang; `77-zeichenzaehler` (2) | `messageLength` |
| Sprache | `24-sprache` (4): Präfix, Wechsel, Browsersprache, gespeicherte Wahl | – |
| Browsertitel | `108-browsertitel` (4): Direktaufruf DE/EN, Inhaltstitel, Seiten- und Sprachwechsel | `lib/page`, Go `web/meta_test.go` |
| Darstellung hell/dunkel und Ninja-Design | `16-darstellung` (3), `104-ninja-design` (3): Farben hell/dunkel, Schriften vom eigenen Server | `theme`, `design` |
| Cookie-Dialog und Speicherwahl | `78-speicherwahl` (2) | `consentTexts` |
| Footer und Datenschutzerklärung | `54-footer` (2), `74-datenschutz` (4): Pflichtangaben DE/EN, Verweise aus Kontakt und Auswertung | `footer`, `content/legal/datenschutz` (nur Pflichtangaben, #128) |

### Redaktionssystem

| Feature | Fidelity | Unit |
|---|---|---|
| Kontomenü am Kontosymbol und Anmeldung über die Anmeldeseite (#121, #109) | `121-kontomenue` (5): Öffnen, Schließen und Tastatur, Lage und Fläche bei 320/375/1280 px hell und dunkel, Weg über die Anmeldeseite samt Direktaufruf von `/redaktion`, bestehende Sitzung, Zusammenspiel mit Themen- und Hauptmenü; `support/auth.setup.ts` (3), `21-redaktion-beitraege` REQ-21-AC1 | `AccountMenu`, Go `TestREQ109AC4…`, `TestREQ64…` |
| Einklappbare Seitenleiste und überlagernde Navigation in der schmalen Ansicht (#103) | `103-seitenleiste` (4): Ziele und aktiver Bereich, Einklappen mit gespeichertem Zustand, Navigation unter 900 px, Ziele und Zugriffsschutz für Marketing | `lib/navigation` |
| Beiträge schreiben, veröffentlichen, zurücknehmen, Titelbild | `21-redaktion-beitraege` (6) | `PostParts` |
| Veröffentlichung auf die Minute planen | `84-minuten` (1): Termin im Editor | Go `TestREQ84…` |
| Benutzer, Rollen, Autorenprofil | `28-benutzer` (4), `64-rollen-profile` (5), `06-passwort-maskieren` (1) | `permissions`, Go `TestREQ64…` |
| Statistik mit Tageswerten | `26-statistik` (3), `65-tageswerte-grafik` (2) | `chartDays`, `PageViewsChart`, Go `TestREQ26…` |
| Nachrichten löschen und Löschfristen | `90-nachrichten-loeschen` (3) | Go `TestREQ90…` |
| LinkedIn: verbinden und Beiträge teilen | `85-linkedin` (3): Rechte, Verbindung, Teilen | `lib/linkedin`, Go `TestREQ85…` |

### Prozesswerkzeuge

| Werkzeug | Tests |
|---|---|
| Testauswahl im Merge Gate | `tools/affected-tests.test.mjs`, `tools/e2e-phases.test.mjs` |
| Release Gate, Ticketübergabe, Release-Blocker | `tools/release-gate.test.mjs`, `tools/release-handover.test.mjs`, `tools/release-blockers.test.mjs` |
| Zugriffsprotokoll (Caddy) und Design-Dokument | `tools/caddy-log.test.mjs`, `tools/design-doc.test.mjs`, `tools/worker.test.mjs` |

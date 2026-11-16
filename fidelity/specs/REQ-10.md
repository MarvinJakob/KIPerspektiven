---
id: REQ-10
issue: https://github.com/MarvinJakob/AIPerspectives/issues/10
status: verifiziert      # entwurf | verifiziert
geprueft_am: 2026-11-16
---

# REQ-10 Lesezeit und Schaltfläche „Nach oben“ für längere Inhalte

## Ziel

Leser sehen vor dem Lesen die ungefähre Lesezeit eines längeren Inhalts und kommen aus dem weiter unten gelesenen Text mit einer Schaltfläche „Nach oben“ zurück zum Seitenanfang. So können sie ihren Leseaufwand einschätzen und sich besser orientieren.

## Festlegungen der Analyse

Das Issue überlässt Seitenumfang und Lesezeit-Regel ausdrücklich Team 1. Festgelegt wird:

- **Seitenumfang („betroffene Inhaltsseiten“):**
  - alle Themenseiten `/<Sprache>/themen/<slug>` mit eigenem Langtext. Auf `origin/main` sind das `softwareentwicklung`, `data-analytics` und `modelle-und-kosten`; neue Themenseiten wie `vibe-coding` (#6) gehören dazu, sobald es sie gibt.
  - die Seite „KI verstehen“ `/<Sprache>/ki-verstehen`. Sie ist ein redaktioneller Langtext (rund 1 100 Wörter) in derselben Inhaltsdarstellung wie die Themenseiten; auf Englisch zeigt sie bis zur Übersetzung den deutschen Text.
  - alle News-Artikel `/<Sprache>/blog/<slug>`.

  Beide Sprachen (`de`, `en`) sind betroffen, ebenso Desktop und Mobil.
- **Lesezeit-Regel:** Die App nutzt für News-Artikel schon eine Regel, die nun für alle betroffenen Seiten gilt: Wortzahl des Inhalts geteilt durch **200 Wörter pro Minute**, aufgerundet auf ganze Minuten, mindestens 1 Minute. Damit kommt keine neue Zahl hinzu.
  - Gezählt wird der Lesetext der Seite: Überschrift, Einleitung und Inhalt bis zum Ende des Artikels. Nicht dazu gehören Navigation, Brotkrumen, die Liste „Beiträge zu diesem Thema“, „Mehr Themen“ und verwandte Beiträge.
  - Weil Markdown-Quelle und gerendertes Ergebnis leicht verschieden gezählt werden (etwa Bildunterschriften oder Überschriften), darf die Angabe um **höchstens eine Minute** vom Ergebnis der Regel abweichen.
  - In diese Toleranz fällt auch eine redaktionell gesetzte Angabe wie „etwa vier Minuten“ auf der Softwareentwicklungsseite (REQ-7-AC2).
- **Wortlaut:** Deutsch „<n> Min. Lesezeit“, Englisch „<n> min read“. Diese Form nutzen News-Artikel schon. Ein vorangestelltes „ca.“ bzw. „about“ ist erlaubt.
- **Schaltfläche:** Deutsch „Nach oben“, Englisch „Back to top“. Ein Pfeil als Zusatz ist erlaubt. Sie ist ein Link oder eine Schaltfläche. Es gibt sie auf jeder betroffenen Seite, die höher als zwei Bildschirmhöhen ist, und sie ist spätestens am Seitenende sichtbar. Ob sie schwebt oder fest am Seitenende vor der Fußzeile steht, bleibt offen. Die Trefferfläche ist mindestens 24 × 24 CSS-Pixel groß. Das ist bewusst strenger als WCAG 2.2, 2.5.8: Die dortige Abstands-Ausnahme gilt hier nicht, damit die Schaltfläche per Touch sicher zu treffen ist. Ein reiner Textlink braucht dafür Innenabstand.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-10-AC1 | Auf jeder betroffenen Seite (geprüft: `softwareentwicklung`, `data-analytics`, `modelle-und-kosten`, `ki-verstehen` und der News-Artikel `ki-veraendert-softwareteams`, je auf Deutsch und Englisch) steht die Lesezeit im Wortlaut der Sprache („<n> Min. Lesezeit“ / „<n> min read“). Nach dem Laden ist sie ohne Scrollen sichtbar und steht oberhalb der ersten Zwischenüberschrift (h2) des Hauptinhalts. | `tests/REQ-10.spec.ts` |
| REQ-10-AC2 | Die angezeigte Lesezeit jeder geprüften Seite weicht um höchstens eine Minute von max(1, ⌈Wörter des Lesetexts ÷ 200⌉) ab. Die lange Themenseite `data-analytics` zeigt eine größere Lesezeit als der kurze News-Artikel `ki-veraendert-softwareteams`. | `tests/REQ-10.spec.ts` |
| REQ-10-AC3 | Hat der Leser auf einer betroffenen Seite, die höher als zwei Bildschirmhöhen ist, bis zum Seitenende gescrollt, ist die Schaltfläche „Nach oben“ sichtbar und mindestens 24 × 24 px groß. Geprüft: `/de/themen/data-analytics`, `/en/themen/softwareentwicklung`, `/de/ki-verstehen` und `/de/blog/ki-veraendert-softwareteams` (im Seed auf Desktop und Mobil höher als zwei Bildschirmhöhen). Ein Mausklick (Desktop) bzw. Tippen (Mobil) bringt die Seite zum Anfang: Die Hauptüberschrift ist sichtbar, die Scrollposition höchstens 10 px. | `tests/REQ-10.spec.ts` |
| REQ-10-AC4 | Per Tastatur: Nach `Ende` gelangt man mit `Tab` zur Schaltfläche „Nach oben“. `Enter` bringt die Seite zum Anfang (Hauptüberschrift sichtbar, Scrollposition höchstens 10 px). | `tests/REQ-10.spec.ts` |
| REQ-10-AC5 | Die Schaltfläche verdeckt keine Inhalte. Am Seitenende und am Seitenanfang überlappt sie keine Textzeile und kein anderes Bedienelement der Seite. | `tests/REQ-10.spec.ts` |
| REQ-10-AC6 | Beschriftungen sind lokalisiert. Englische Seiten zeigen „min read“ und „Back to top“, aber weder „Lesezeit“ noch „Nach oben“. Deutsche Seiten zeigen „Min. Lesezeit“ und „Nach oben“, aber weder „min read“ noch „Back to top“. | `tests/REQ-10.spec.ts` |

Alle Tests laufen in den Projekten `desktop` und `mobil` (Playwright-Konfiguration). Damit ist „funktioniert auf Desktop und Mobilgeräten“ für jedes Kriterium abgedeckt.

## Szenarien

### REQ-10-AC1 Lesezeit im Einstiegsbereich

- **Gegeben** die Anwendung läuft mit Entwicklungsdaten
- **Wenn** eine geprüfte Seite in einer Sprache geladen wird (Scrollposition oben)
- **Dann** ist ein Text „<n> Min. Lesezeit“ (de) bzw. „<n> min read“ (en) im sichtbaren Bereich
- **Und** er steht oberhalb der ersten h2-Überschrift im Hauptinhalt

### REQ-10-AC2 Einheitliche Regel und inhaltsbezogener Wert

- **Gegeben** eine geprüfte Seite
- **Wenn** die Wörter des sichtbaren Lesetexts gezählt werden. Das ist der Hauptinhalt ohne Brotkrumen, beim News-Artikel der Artikel, sonst der Hauptinhalt bis zur Überschrift „Beiträge zu diesem Thema“ / „Articles on this topic“ bzw. „Mehr Themen“ / „More Topics“, falls vorhanden. Gleichlautender Fließtext beendet den Lesetext nicht.
- **Dann** gilt |angezeigte Minuten − max(1, ⌈Wörter ÷ 200⌉)| ≤ 1
- **Und** `/de/themen/data-analytics` zeigt mehr Minuten als `/de/blog/ki-veraendert-softwareteams`

### REQ-10-AC3 Nach oben per Maus und Touch

- **Gegeben** `/de/themen/data-analytics`, `/en/themen/softwareentwicklung`, `/de/ki-verstehen` bzw. `/de/blog/ki-veraendert-softwareteams`, bis zum Seitenende gescrollt (beim News-Artikel nur, wenn die Seite höher als zwei Bildschirmhöhen ist; im Seed ist sie das)
- **Dann** ist eine Schaltfläche bzw. ein Link „Nach oben“ / „Back to top“ sichtbar und mindestens 24 × 24 px groß
- **Wenn** sie angeklickt (Desktop) bzw. angetippt (Mobil) wird
- **Dann** ist die Scrollposition höchstens 10 px und die Hauptüberschrift im sichtbaren Bereich

### REQ-10-AC4 Nach oben per Tastatur

- **Gegeben** `/de/themen/data-analytics`
- **Wenn** die Taste `Ende` gedrückt und danach so oft `Tab` gedrückt wird, bis „Nach oben“ den Fokus hat (höchstens 150-mal; die Seite hat etwa 70 per Tab erreichbare Elemente)
- **Und** `Enter` gedrückt wird
- **Dann** ist die Scrollposition höchstens 10 px und die Hauptüberschrift sichtbar

### REQ-10-AC5 Keine verdeckten Inhalte

- **Gegeben** `/de/themen/data-analytics`
- **Wenn** bis zum Seitenende gescrollt ist (dort lässt sich Verdecktes nicht mehr freiscrollen)
- **Dann** schneidet das Rechteck der Schaltfläche keine Textzeile außerhalb der Schaltfläche und kein anderes Bedienelement (Link, Schaltfläche, Eingabefeld)
- **Und** am Seitenanfang gilt dasselbe, falls die Schaltfläche dort sichtbar ist

### REQ-10-AC6 Lokalisierte Beschriftungen

- **Gegeben** `/en/themen/softwareentwicklung` und `/en/blog/ki-veraendert-softwareteams`
- **Dann** steht „min read“ und nach dem Scrollen auf der Themenseite „Back to top“; „Lesezeit“ und „Nach oben“ kommen nicht vor
- **Gegeben** `/de/themen/softwareentwicklung` und `/de/blog/ki-veraendert-softwareteams`
- **Dann** steht „Min. Lesezeit“ und nach dem Scrollen auf der Themenseite „Nach oben“; „min read“ und „Back to top“ kommen nicht vor

## Nicht Teil der Anforderung

- Startseite, Übersichtsseiten (News-Liste, Themenübersicht), KI Readiness (`/themen/ai-audit` mit Fragebogen und Ergebnis), Profil, Kontakt, „KI-Einsatzfelder“ (Übersichtsseite mit Kennzahlen, Aufgabenkarten und Quellen, kein durchgehender Lesetext), Impressum und Datenschutz.
- Prüfung der Themenseite `vibe-coding`: Sie gehört zum Umfang, existiert auf `main` aber noch nicht (#6). Team 1 ergänzt dafür ein neues Kriterium, sobald sie umgesetzt ist.
- Lesezeit in Vorschaukarten und Listen.
- Gestaltung im Detail: Position (schwebend oder fest am Seitenende vor der Fußzeile), Symbol, Farben, Animation des Scrollens. Ob die Schaltfläche am Seitenanfang ausgeblendet ist, bleibt ebenfalls offen.
- Wohin der Tastaturfokus nach dem Sprung nach oben geht.
- Verdecken während des Scrollens in der Seitenmitte. Ein schwebendes Element darf Text vorübergehend überlagern, solange er sich freiscrollen lässt; am Seitenende muss alles frei sein (AC5).
- Redaktionelles Überschreiben der Lesezeit im Redaktionssystem.
- Benennung „Blog“ / „News“ (Anforderung #8).

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.

Nachweis vom 2026-11-16 (Stand `origin/main` e6ee73f, Desktop und Mobil):

- **App aus `origin/main`:** Alle 12 Läufe sind rot, und zwar aus dem richtigen Grund.
  - Themenseiten zeigen keine Lesezeit (AC1, AC2, AC6).
  - Eine Schaltfläche „Nach oben“ / „Back to top“ gibt es nicht (AC3 bis AC6).
  - Der News-Artikel erfüllt die Lesezeit-Prüfungen schon („1 Min. Lesezeit“ / „1 min read“ im Kopf).
  - Keine Zeitüberschreitung, kein Selektorfehler.
- **Lokale Referenzumsetzung** (nur zur Prüfung, nicht committet): Lesezeit unter der Hauptüberschrift der Themenseiten nach der Regel, Schaltfläche am Inhaltsende vor der Fußzeile.
  - Alle 12 Läufe grün, auch bei wiederholtem Lauf.
  - Gemessene Lesetexte: `softwareentwicklung` 885 Wörter (de) bzw. 912 (en), `data-analytics` 1184, `modelle-und-kosten` 1334.
- **Gegenprobe A**, Referenzumsetzung verfälscht:
  - Lesezeit um 3 Minuten zu hoch → AC2 rot
  - Schaltfläche ohne Tab-Erreichbarkeit → AC4 rot
  - Schaltfläche schwebend unten links über der Fußzeile → AC5 rot
  - AC1, AC3 und AC6 bleiben grün.
- **Gegenprobe B:**
  - Lesezeit unter dem Inhalt statt im Einstieg → AC1, AC2 rot
  - Klick ohne Wirkung → AC3, AC4 rot
  - Beschriftung auf Englisch ebenfalls „Nach oben“ → AC6 rot
- **Anpassungen am Test nach dem Selbsttest:**
  - AC5 zählt nur sichtbare Elemente, die unter der Schaltfläche liegen. Ein zugeklapptes Kopfzeilenmenü mit Deckkraft 0 oder eine Kopfzeile über der Schaltfläche gilt nicht als verdeckt.
  - AC6 öffnet jede Seite in einem eigenen Tab. Die App stellt beim erneuten Laden im selben Tab die vorherige Scrollposition wieder her; „nach dem Laden“ meint hier einen Erstaufruf.

Überarbeitung nach Review vom 2026-11-16 (PR #32), wieder gegen `origin/main` e6ee73f:

- **Änderungen:**
  - „KI verstehen“ (`/de|en/ki-verstehen`) gehört zum Seitenumfang und wird in AC1 und AC2 geprüft.
  - Die nicht getestete Festlegung „nach einer Bildschirmhöhe sichtbar“ ist ersetzt durch „auf Seiten höher als zwei Bildschirmhöhen vorhanden, spätestens am Seitenende sichtbar“.
  - Bei AC3 messen Tabelle, Szenario und Test jetzt einheitlich die Seitenhöhe.
  - Die 24-px-Festlegung ist begründet.
  - Die Wortzählung endet nur an der Überschrift der folgenden Liste, nicht an gleichlautendem Fließtext.
  - AC4 hat mehr Zeit für bis zu 300 Tab-Schritte (überholt, siehe zweite Überarbeitung).
- **App aus `origin/main`:** Alle 12 Läufe sind rot aus dem richtigen Grund, auch `ki-verstehen` ohne Lesezeit.
- **Referenzumsetzung**, jetzt mit Lesezeit auch auf „KI verstehen“: alle 12 Läufe grün.
- **Gegenprobe:** „KI verstehen“ ohne Lesezeit → AC1 und AC2 rot, nur für `/de|en/ki-verstehen`.

Zweite Überarbeitung nach Review vom 2026-11-17 (PR #32), gegen `origin/main` ea6e348 (seit e6ee73f unter `app/` nur Dokumentation geändert):

- **Änderungen:**
  - AC3 prüft „Nach oben“ auch auf `/de/ki-verstehen`, weil die Seite eine eigene Seitenkomponente hat.
  - AC4 sucht höchstens 150-mal mit Tab; die Seite hat etwa 70 per Tab erreichbare Elemente.
  - Für die ganze Testdatei gilt 90 s je Test statt einzelner Verlängerungen, weil jeder Test mehrere Seiten aufruft. Unter paralleler Last auf dem Entwicklungsrechner lagen einzelne Läufe bei 20 bis 32 s.
  - Der Wortlaut „am Inhaltsende“ ist präzisiert zu „fest am Seitenende vor der Fußzeile“.
- **App aus `origin/main`:** Alle 12 Läufe sind rot aus dem richtigen Grund.
- **Referenzumsetzung:** Alle 12 Läufe sind grün, in drei Läufen nacheinander.
- **Gegenprobe:** Ohne Schaltfläche auf „KI verstehen“ ist nur AC3 rot (Desktop und Mobil).

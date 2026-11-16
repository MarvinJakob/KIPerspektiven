---
id: REQ-8
issue: https://github.com/MarvinJakob/AIPerspectives/issues/8
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-8 Benennungen vereinheitlichen: KI Readiness, News und durchgängige Du-Ansprache

## Ziel

Besucher finden Funktionen unter einheitlichen Namen wieder und werden auf der deutschen Website durchgängig mit „du“ angesprochen, damit die Website verständlich und sprachlich stimmig ist.

## Festlegungen aus dem Issue

- **KI Readiness** ist der einzige Funktionsname für das bisherige „Audit“ bzw. die „Selbsteinschätzung“. Auf der englischen Website heißt die Funktion **AI Readiness** (bereits eingeführter englischer Name).
- **News** ist der einzige Name für den bisherigen Blog, auf Deutsch und Englisch.
- Als frühere Namen gelten: „Audit“ (auch „KI-Audit“, „AI Audit“), „Selbsteinschätzung“ (englisch „self-assessment“) und „Blog“. Sie kommen in Navigation, Überschriften, Links, Schaltflächen und Seitentiteln nicht mehr vor. Im Fließtext darf die Tätigkeit weiter beschrieben werden (z. B. „den eigenen Stand einschätzen“).
- **Du-Ansprache** gilt für die ganze deutsche Website ohne Ausnahme, also auch für Impressum, Datenschutzerklärung, Fehlermeldungen und Formularrückmeldungen. Das Issue versteht „Sie“ ausdrücklich als Befund, nicht als gewünschte Ausnahme.
- **Erkennung der Sie-Ansprache:** Großgeschriebenes „Sie“, „Ihnen“, „Ihr“, „Ihre“, „Ihren“, „Ihrem“, „Ihrer“, „Ihres“ innerhalb eines Satzes ist Anrede („Öffnen Sie“, „auf Ihren Wunsch“). Am Satzanfang ist „Sie“ mehrdeutig (sie/Sie) und wird nicht gewertet; ein Possessiv am Satzanfang vor einem Substantiv („Ihr Nutzen“, „Ihre Auswahl“) gilt als Anrede. Satzgrenzen sind Satzzeichen (`. ! ? : ;`), Zeilenwechsel und Gedankenstriche.
- **URLs** bleiben unverändert (`/{lang}/blog`, `/{lang}/themen/ai-audit`); sie dürfen sich ändern, solange alle Links funktionieren (AC8).

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-8-AC1 | Die deutsche Hauptnavigation enthält die Links „KI Readiness“ und „News“ (Desktop und im Menü auf Mobil). Sie führen zu Seiten mit genau dieser Hauptüberschrift und einem Seitentitel, der damit beginnt. Kein Navigationslink trägt einen früheren Namen. | `tests/REQ-8.spec.ts` |
| REQ-8-AC2 | Auf Startseite, Readiness-Übersicht, erster Dimensionsseite und Auswertung nennt keine Überschrift, kein Link, keine Schaltfläche und kein Seitentitel „Audit“ oder „Selbsteinschätzung“. Jeder Link der Startseite zur Readiness-Übersicht enthält „KI Readiness“. Die Übersicht hat einen Aufruf mit „KI Readiness“, der zur ersten Dimension führt. | `tests/REQ-8.spec.ts` |
| REQ-8-AC3 | Auf Startseite, News-Übersicht, einer Themenseite und einer Beitragsseite nennt keine Überschrift, kein Link, keine Schaltfläche und kein Seitentitel „Blog“ (auf der Beitragsseite: Links und Schaltflächen). Links von Startseite und Themenseite zur News-Übersicht enthalten „News“. Die News-Übersicht hat die Hauptüberschrift „News“. | `tests/REQ-8.spec.ts` |
| REQ-8-AC4 | Alle deutschen Themenseiten (verlinkt im Footer unter „Themen“) enthalten im Hauptinhalt keine Sie-Ansprache. | `tests/REQ-8.spec.ts` |
| REQ-8-AC5 | Die deutsche KI Readiness enthält keine Sie-Ansprache: Übersicht, jede Dimensionsseite beim Durchlaufen aller Dimensionen, Auswertung und die Rückmeldungen des Formulars „Beratungsgespräch“ bei fehlender/ungültiger E-Mail-Adresse, HTTP-Fehlern 422/429/500 und erfolgreichem Absenden. | `tests/REQ-8.spec.ts` |
| REQ-8-AC6 | Footer und Cookie-Hinweis (Dialog über „Cookie-Einstellungen“, vor und nach einer Auswahl) der deutschen Website enthalten keine Sie-Ansprache. | `tests/REQ-8.spec.ts` |
| REQ-8-AC7 | Die übrigen deutschen Seiten enthalten keine Sie-Ansprache: Startseite, News-Übersicht, Beitragsseite (Links und Schaltflächen), Profil, KI-Einsatzfelder, KI verstehen, Impressum, Datenschutz, Seite „nicht gefunden“ und die Fehlermeldung, wenn Inhalte nicht geladen werden können. | `tests/REQ-8.spec.ts` |
| REQ-8-AC8 | Alle internen Links auf Start-, Readiness- und News-Übersicht beider Sprachen (inklusive Navigation und Footer, ohne `/redaktion`) antworten mit Status 200. | `tests/REQ-8.spec.ts` |
| REQ-8-AC9 | Die englische Hauptnavigation enthält „AI Readiness“ und „News“, die zu Seiten mit genau dieser Hauptüberschrift führen. Auf Startseite, Readiness-Übersicht, erster Dimensionsseite, Auswertung, News-Übersicht und einer Themenseite nennt keine Überschrift, kein Link, keine Schaltfläche und kein Seitentitel „Audit“, „self-assessment“ oder „Blog“; Links von außerhalb zur Readiness- bzw. News-Übersicht enthalten „AI Readiness“ bzw. „News“. | `tests/REQ-8.spec.ts` |
| REQ-8-AC10 | Auf den englischen Seiten (Start, News, AI Readiness, Profil, KI-Einsatzfelder, KI verstehen, Impressum, Datenschutz) enthalten Navigation, Footer und Cookie-Hinweis keine deutschen Formulierungen. Überschriften, interne Links und Schaltflächen im Inhalt sind englisch, außer dem als deutsch markierten Inhalt, für den ausdrücklich deutscher Ersatzinhalt angekündigt wird („not available in English“, „German only“). Die Marke „KI Perspektiven“ ist ausgenommen. | `tests/REQ-8.spec.ts` |

## Szenarien

### REQ-8-AC1 Deutsche Navigation

- **Gegeben** eine Besucherin öffnet `/de` (auf Mobil zusätzlich das Menü)
- **Wenn** sie in der Hauptnavigation „KI Readiness“ bzw. „News“ wählt
- **Dann** zeigt die Zielseite die Hauptüberschrift „KI Readiness“ bzw. „News“, der Seitentitel beginnt damit, und kein Navigationslink heißt „Blog“, „Audit“ oder „Selbsteinschätzung“

### REQ-8-AC2 Funktionsname KI Readiness

- **Gegeben** die Seiten `/de`, `/de/themen/ai-audit`, `/de/themen/ai-audit/strategie-und-wirtschaftlichkeit`, `/de/themen/ai-audit/auswertung`
- **Wenn** Überschriften, Links, Schaltflächen und Seitentitel gelesen werden (ohne redaktionelle Beitragsvorschauen)
- **Dann** enthält keiner „Audit“ oder „Selbsteinschätzung“, jeder Link der Startseite zur Übersicht enthält „KI Readiness“ (z. B. die Hauptaktion im Einstiegsbereich), und die Übersicht hat einen Link mit „KI Readiness“ zur ersten Dimension

### REQ-8-AC3 Funktionsname News

- **Gegeben** die Seiten `/de`, `/de/blog`, `/de/themen/softwareentwicklung`, `/de/blog/ki-veraendert-softwareteams` (DEV_SEED)
- **Wenn** Überschriften, Links, Schaltflächen und Seitentitel gelesen werden
- **Dann** enthält keiner „Blog“, Links zur News-Übersicht von außerhalb enthalten „News“, und `/de/blog` zeigt die Hauptüberschrift „News“

### REQ-8-AC4 Du-Ansprache auf Themenseiten

- **Gegeben** alle Themenseiten, die der deutsche Footer unter „Themen“ verlinkt (ohne KI Readiness)
- **Wenn** der sichtbare Hauptinhalt gelesen wird
- **Dann** enthält er keine Sie-Ansprache

### REQ-8-AC5 Du-Ansprache in der KI Readiness

- **Gegeben** die Readiness-Übersicht `/de/themen/ai-audit`
- **Wenn** die Besucherin alle Dimensionen nacheinander mit einem Reifegrad bewertet, die Auswertung öffnet und das Formular für das Beratungsgespräch ohne und mit ungültiger E-Mail-Adresse absendet, HTTP-Fehler 422/429/500 erhält und anschließend erfolgreich absendet
- **Dann** enthält keine dieser Ansichten eine Sie-Ansprache

### REQ-8-AC6 Du-Ansprache in Footer und Cookie-Hinweis

- **Gegeben** `/de`
- **Wenn** der Footer gelesen und „Cookie-Einstellungen“ geöffnet wird, vor und nach einer Auswahl
- **Dann** enthalten Footer und Dialog keine Sie-Ansprache

### REQ-8-AC7 Du-Ansprache auf allen übrigen Seiten

- **Gegeben** die Seiten aus AC7 sowie `/de/blog`, während alle Aufrufe von `/api/` fehlschlagen
- **Wenn** der sichtbare Hauptinhalt gelesen wird (auf der Beitragsseite Links und Schaltflächen)
- **Dann** enthält er keine Sie-Ansprache, auch nicht die Fehlermeldung

### REQ-8-AC8 Funktionierende Linkziele

- **Gegeben** `/de`, `/en`, beide Readiness-Übersichten und beide News-Übersichten
- **Wenn** jeder interne Link (außer `/redaktion`) per HTTP aufgerufen wird
- **Dann** antwortet er mit Status 200

### REQ-8-AC9 Funktionsnamen auf Englisch

- **Gegeben** `/en` (auf Mobil zusätzlich das Menü)
- **Wenn** „AI Readiness“ bzw. „News“ in der Hauptnavigation gewählt und anschließend die Seiten aus AC9 gelesen werden
- **Dann** zeigen die Zielseiten genau diese Hauptüberschrift und keine Überschrift, kein Link, keine Schaltfläche und kein Seitentitel enthält „Audit“, „self-assessment“ oder „Blog“

### REQ-8-AC10 Keine versehentlich deutschen Formulierungen auf Englisch

- **Gegeben** die englischen Seiten aus AC10
- **Wenn** Navigation, Footer, Cookie-Hinweis sowie (ohne angekündigten Ersatzinhalt) Überschriften, interne Links und Schaltflächen gelesen werden
- **Dann** enthält keiner dieser Texte typische deutsche Wörter (z. B. „und“, „für“, „zurück“, „Beiträge“, „Themen“, „KI“) oder Umlaute; redaktionelle Beiträge mit Kennzeichnung „German only“ und externe Quellenlinks sind ausgenommen

## Nicht Teil der Anforderung

- **Umbenennung von URLs** (Abgrenzung im Issue). Geänderte URLs sind erlaubt, wenn alle Links funktionieren (AC8).
- **Redaktionelle Beiträge** aus dem Redaktionssystem (Titel, Kurztext, Beitragstext, z. B. „AI Audit: Fünf Fragen …“). Sie sind Inhalt der Redaktion, keine Benennung oder Ansprache der Website.
- **Redaktionssystem** (`/redaktion`): richtet sich nicht an Besucher.
- **Deutscher Ersatzinhalt auf der englischen Website**, der ausdrücklich als nicht übersetzt gekennzeichnet ist (Hinweis „not available in English“ oder „German only“). Er ist gewollt, nicht versehentlich.
- **„Die Umstellung erhält die fachliche Bedeutung der Texte“** ist nicht automatisch prüfbar. Die Fidelity-Tests sichern die beobachtbaren Folgen ab (funktionierende Links, AC8; vollständige Abläufe in AC5); die inhaltliche Gleichwertigkeit prüft das unabhängige Review des Umsetzungs-PRs.
- **Positive Du-Formulierung**: Geprüft wird das Fehlen der Sie-Ansprache. Satzanfänge mit „Sie“ sind wegen der Mehrdeutigkeit (sie/Sie) nicht erkennbar; sie fallen in der Regel über weitere Anredeformen im selben Satz auf (z. B. „Sie können Ihre Auswahl …“).
- **Einstiegsbereich und neue Themenseiten** (Issues #9, #6, #7) werden in ihren eigenen Anforderungen spezifiziert. Sobald sie erscheinen, gelten AC2–AC4 und AC9 auch für sie (Startseite, alle Themenseiten im Footer).

## Verifikation der Tests (Team 1)

Verifiziert am 2026-11-16 gegen `origin/main` (`72175f5`, nach Rebase erneut gegen `6b84d5f` mit gleichem Ergebnis), lokal mit `DEV_SEED=true`, Desktop und Mobil.

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen und ist danach unverändert zurückgesetzt.
  - AC1, AC3, AC9 scheitern, weil „News“ fehlt (Navigation „Blog“, Hauptüberschrift und Seitentitel „Blog“, „Zurück zum Blog“).
  - AC2 scheitert an „Zum KI-Audit“, „KI Reifegrad einschätzen“, „Selbsteinschätzung starten“, „Warum eine Selbsteinschätzung?“, „Auswertung der Selbsteinschätzung“ u. a.
  - AC4–AC7 scheitern an echter Sie-Ansprache, z. B. „Kontrollieren Sie …“ (Softwareentwicklung), „Öffnen Sie eine Dimension …“, „Ihr Nutzen“, „Hinterlassen Sie Ihre E-Mail-Adresse.“, Footer „auf Ihren Wunsch in Ihrem Browser“, Cookie-Hinweis, Datenschutz, KI verstehen und „Bitte prüfen Sie Ihre Verbindung …“. Keine Fehltreffer: Satzanfänge wie „Sie können Informationen zusammenführen“ (Agenten, Profil) werden nicht gewertet.
  - AC8 und AC10 bestehen auf `main`. Gegenprobe: erwarteter Status 201 statt 200 → AC8 rot; „Home“ als deutsches Merkmal → AC10 rot. Beide Änderungen zurückgenommen.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt (Bewertungen der KI Readiness bleiben im Browser des Tests; die Formularantworten 422/429/500 und Erfolg 204 werden auf HTTP-Ebene simuliert; es werden keine Anfragen gespeichert).
- [x] Vollständigkeit: Jede Aussage des Issues ist einem Kriterium oder „Nicht Teil der Anforderung“ zugeordnet (Name KI Readiness → AC1, AC2; News → AC1, AC3; Du-Ansprache auf Themenseiten, Selbsteinschätzung, Footer, Cookie-Hinweis → AC4–AC6, übrige Seiten → AC7; Linkziele → AC8; fachliche Bedeutung → Nicht Teil; englische Funktionsnamen → AC9; keine deutschen Formulierungen → AC10; URLs, Einstiegsbereich, neue Themenseiten → Nicht Teil bzw. Hinweis).

### Nachprüfung im PR-Review

- Beitragslinks werden in AC8 mitgeprüft; redaktionelle Texte sind weiterhin ausgenommen.
- AC10 prüft sichtbare Oberflächentexte auch auf Seiten mit Ersatzinhalt. Nur ausdrücklich als deutsch markierte Textteile werden bei vorhandenem Fallback-Hinweis ausgenommen.
- AC5 prüft fehlende/ungültige Adresse, HTTP 422/429/500 und Erfolg 204 ohne echte Anfragen oder Ratenlimit-Verbrauch. Alle Dimensionen werden durchlaufen.
- Auf aktuellem main sind die erweiterten Formularprüfungen auf Desktop und Mobil wegen tatsächlicher Sie-Ansprache rot, einschließlich Fehler- und Erfolgsrückmeldungen. AC8 und die korrigierte AC10 bestehen auf beiden Geräten; Gegenproben mit Status 201 bzw. „Home“ als deutschem Merkmal werden rot und anschließend zurückgenommen.

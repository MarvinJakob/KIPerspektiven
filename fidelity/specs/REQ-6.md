---
id: REQ-6
issue: https://github.com/MarvinJakob/AIPerspectives/issues/6
status: verifiziert       # entwurf | verifiziert
geprueft_am: 2026-11-16
---

# REQ-6 Themenseite Vibe Coding auf Deutsch und Englisch

## Ziel

Besucher lesen eine eigenständige Themenseite „Vibe Coding“ auf Deutsch oder Englisch und können die Arbeitsweise und die fünf Engineering-Perspektiven nachvollziehen.

## Quellen

- Inhalt: `content/topics/Vibe Coding v1_de.md` (Stand 16. November 2026)
- Layout: `mock/thema_vibe_coding/index.html` mit `README.md`. Die dort genannten Rechtschreibkorrekturen (z. B. „Entineering“ → „Engineering“, „ungefair“ → „ungefähr“) sind ausdrücklich erwünscht; die Tests erwarten die korrigierte Schreibweise „Engineering“.
- Festlegung der Analyse: Die Seite nutzt das bestehende URL-Schema der Themenseiten mit dem Slug `vibe-coding`, also `/de/themen/vibe-coding` und `/en/themen/vibe-coding`. Der Titel lautet in beiden Sprachen „Vibe Coding“.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-6-AC1 | `/de/themen/vibe-coding` und `/en/themen/vibe-coding` liefern Status 200, zeigen die Hauptüberschrift „Vibe Coding“, und der Fenstertitel enthält „Vibe Coding“. | `tests/REQ-6.spec.ts` |
| REQ-6-AC2 | Die Themenübersicht der Startseite (`/de` bzw. `/en`) enthält einen Link auf die Vibe-Coding-Seite der jeweiligen Sprache; er öffnet die Seite. | `tests/REQ-6.spec.ts` |
| REQ-6-AC3 | Die deutsche Seite zeigt den vollständigen Inhalt der Vorlage: Untertitel, Stand, Einleitung mit Beispielgeschichte, Zitat, Überleitung, alle fünf Perspektiven (Name, Text, Beispiel, Schlusssatz) und Fazit. | `tests/REQ-6.spec.ts` |
| REQ-6-AC4 | Die Abschnitte stehen in der Reihenfolge des Mocks: Untertitel, Einleitung, Beispielgeschichte, Zitat, Prompt, Context, Harness, Specification, Product Engineering, Fazit. | `tests/REQ-6.spec.ts` |
| REQ-6-AC5 | Die sechs kursiven Beispielpassagen der Vorlage stehen jeweils in einem beschrifteten Hinweiskasten (Rolle `figure`, `note` oder `complementary` mit zugänglichem Namen); das Zitat „Humans should review ideas, not code.“ steht in einem Zitatblock (`blockquote`). | `tests/REQ-6.spec.ts` |
| REQ-6-AC6 | Die Einleitung enthält Sprungmarken zu den fünf Perspektiven; ein Klick auf jede bringt den Text dieser Perspektive in den sichtbaren Bereich. | `tests/REQ-6.spec.ts` |
| REQ-6-AC7 | Die internen Links der Seite führen zu ihren Zielen: Brotkrumen „Start“ → Startseite, „Themenübersicht“ → Startseite (optional mit Anker `#themen`), Link mit „KI Readiness“ → KI-Readiness-Seite `/de/themen/ai-audit`. | `tests/REQ-6.spec.ts` |
| REQ-6-AC8 | Auf Desktop (Breite über 850 px) steht der Name jeder Perspektive links neben ihrem Text, auf Mobilgeräten darüber; auf beiden gibt es keinen horizontalen Bildlauf. | `tests/REQ-6.spec.ts` |
| REQ-6-AC9 | Die englische Seite ist vollständig übersetzt: Dokumentsprache `en`, kein Hinweis auf eine fehlende Übersetzung, keiner der deutschen Prüfsätze aus AC3, keine deutschen Funktionswörter im Seiteninhalt, die fünf Perspektiven-Namen und das Zitat sind sichtbar, und der Seiteninhalt ist mindestens 70 % so lang wie der deutsche. | `tests/REQ-6.spec.ts` |
| REQ-6-AC10 | Der Sprachwechsel auf der Seite führt von `/de/themen/vibe-coding` nach `/en/themen/vibe-coding` (und zurück); Dokumentsprache, Inhalt und Bedienelemente der Seite (Brotkrumen, Links) wechseln in die gewählte Sprache. | `tests/REQ-6.spec.ts` |
| REQ-6-AC11 | Der seiteneigene deutsche Text (Kopfbereich bis Fazit sowie die Weiterlesen-Links) spricht Leser mit „du“ an und enthält keine Sie-Anrede (Sie, Ihnen, Ihr… außerhalb eines Satzanfangs). | `tests/REQ-6.spec.ts` |

## Szenarien

### REQ-6-AC1 Direkt aufrufbare URL je Sprache

- **Gegeben** die Anwendung läuft mit Entwicklungsdaten
- **Wenn** `/de/themen/vibe-coding` bzw. `/en/themen/vibe-coding` aufgerufen wird
- **Dann** ist der Status 200, die Überschrift der Ebene 1 lautet „Vibe Coding“ und der Fenstertitel enthält „Vibe Coding“

### REQ-6-AC2 Erreichbar über die Themenübersicht

- **Gegeben** die Startseite `/de` bzw. `/en`
- **Wenn** im Hauptinhalt der Link zur Vibe-Coding-Seite angeklickt wird
- **Dann** ist die URL `/<Sprache>/themen/vibe-coding` und die Überschrift „Vibe Coding“ sichtbar

### REQ-6-AC3 Vollständiger deutscher Inhalt

- **Gegeben** `/de/themen/vibe-coding`
- **Dann** sind im Hauptinhalt je ein kennzeichnender Satz jedes Absatzes der Vorlage sichtbar, die fünf Namen „Prompt Engineering“, „Context Engineering“, „Harness Engineering“, „Specification Engineering“, „Product Engineering“, der Untertitel mit „SLOP“, „Stand: 16. November 2026“ und „Fazit“

### REQ-6-AC4 Abschnittsfolge

- **Gegeben** `/de/themen/vibe-coding`
- **Dann** erscheinen die kennzeichnenden Sätze im Text des Hauptinhalts in der Reihenfolge des Mocks

### REQ-6-AC5 Hinweiskästen und Zitat

- **Gegeben** `/de/themen/vibe-coding`
- **Dann** liegt jede der sechs Beispielpassagen in einem eigenen beschrifteten Kasten (Rolle `figure`, `note` oder `complementary`, zugänglicher Name nicht leer) und das Zitat in einem `blockquote`

### REQ-6-AC6 Sprungmarken

- **Gegeben** `/de/themen/vibe-coding`
- **Wenn** in der Einleitung der Link einer Perspektive (z. B. „Harness Engineering“) angeklickt wird
- **Dann** ist der erste Satz dieser Perspektive im sichtbaren Bereich

### REQ-6-AC7 Interne Links

- **Gegeben** `/de/themen/vibe-coding`
- **Wenn** „Start“ in den Brotkrumen, der Link zur Themenübersicht bzw. der Link mit „KI Readiness“ angeklickt wird
- **Dann** ist die URL `/de` (optional `#themen`) bzw. `/de/themen/ai-audit` und eine Hauptüberschrift sichtbar

### REQ-6-AC8 Responsive Darstellung

- **Gegeben** `/de/themen/vibe-coding` auf Desktop bzw. Mobil
- **Dann** beginnt auf Desktop der erste Satz jeder Perspektive rechts vom Perspektiven-Namen, auf Mobil unterhalb davon, und die Seite ist nicht breiter als das Fenster

### REQ-6-AC9 Vollständige englische Übersetzung

- **Gegeben** `/en/themen/vibe-coding`
- **Dann** ist `<html lang="en">`, es gibt keinen Übersetzungshinweis („not available in English“ o. Ä.), kein deutscher Prüfsatz, kein deutsches Funktionswort (und, der, das, nicht, wir, mit, ist, eine, auch, wenn, oder, für, über, sich, werden, Fazit, Beispiel) im Seiteninhalt vor dem Abschnitt „Articles on this topic“, die fünf Perspektiven-Namen und das Zitat sind sichtbar und die Textlänge erreicht mindestens 70 % der deutschen

### REQ-6-AC10 Sprachwechsel

- **Gegeben** `/de/themen/vibe-coding`
- **Wenn** „English“ im Sprachwechsel gewählt wird
- **Dann** ist die URL `/en/themen/vibe-coding`, `<html lang="en">`, die Brotkrumen zeigen „Home“, die deutschen Prüfsätze fehlen und ein Link mit „AI Readiness“ ist sichtbar
- **Wenn** danach „Deutsch“ gewählt wird
- **Dann** ist die URL wieder `/de/themen/vibe-coding` mit deutschem Inhalt

### REQ-6-AC11 Du-Ansprache

- **Gegeben** `/de/themen/vibe-coding`
- **Dann** enthält der Text des Hauptinhalts bis zum Ende des Fazits sowie die Namen der Weiterlesen-Links kein „Sie“, „Ihnen“, „Ihr“, „Ihre“ … außer am Satzanfang (dort ist „Sie“ das Pronomen der dritten Person, z. B. „Sie soll entscheiden können“), und „Du beschreibst, was du möchtest“ ist sichtbar

## Nicht Teil der Anforderung

- Lesezeit und Schaltfläche „Nach oben“ (Anforderung #10).
- Grafiken und Illustrationen (gestaltet der Maintainer separat); Farben, Schrift, Abstände und Hell/Dunkel-Darstellung im Detail.
- Kopfbereich, Navigation und Fußzeile der Website (gemeinsame Bestandteile, unverändert).
- Die Liste „Beiträge zu diesem Thema“ und ihr Leerzustand; deren Du-Ansprache und die website-weite Vereinheitlichung der Benennungen regelt Anforderung #8.
- Wortlaut der englischen Übersetzung (geprüft werden Vollständigkeit und Sprache, nicht die Formulierung).
- Die Themenseite Software Entwicklung (Anforderung #7).

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.

Nachweis vom 2026-11-16 (Stand `origin/main` e4e4a6a, Desktop und Mobil):

- **App aus `origin/main`:** alle 22 Läufe rot aus dem richtigen Grund: `/de|en/themen/vibe-coding` liefert 404 bzw. „Seite nicht gefunden“, die Startseite hat keinen Link auf die Seite. Keine Zeitüberschreitung, kein Selektorfehler.
- **Mock `mock/thema_vibe_coding` unter `/de/themen/vibe-coding` ausgeliefert:** AC3, AC4, AC5, AC6, AC8 und AC11 grün. Erwartet rot: AC1 (keine englische Fassung), AC2 (keine Startseite), AC7 (Mock-Links statt App-URLs, „KI-Reifegrad“ statt „KI Readiness“), AC9 (keine englische Fassung), AC10 (kein Sprachwechsel).
- **Gegenprobe gegen den Mock:** verfälschtes Datum (AC3), umgekehrte Reihenfolge (AC4), Kasten ohne Abgrenzung (AC5), Hover statt Klick auf die Sprungmarke (AC6), vertauschtes Desktop-/Mobil-Layout (AC8) und eingefügte Sie-Anrede (AC11) machen den jeweiligen Test rot.
- **App-Bausteine an der bestehenden Seite `/de/themen/softwareentwicklung`:** Link-Suche in der Themenübersicht der Startseite (de/en), Brotkrumen „Start“, Ziel `/de/themen/ai-audit`, Sprachwechsel hin und zurück (auch über das Mobilmenü), Ausschnitt vor der Beitragsliste, Stoppwortprüfung (englischer Text: 0 Treffer) und Sie-Erkennung (deutscher Text in Sie-Form: 17 Treffer) arbeiten wie vorgesehen.

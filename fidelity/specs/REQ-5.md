---
id: REQ-5
issue: https://github.com/MarvinJakob/AIPerspectives/issues/5
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-5 KI Readiness: Fähigkeitsstufe über die gesamte Auswahlbox auswählbar

## Ziel

Nutzer der KI Readiness wählen eine Fähigkeitsstufe (Reifegrad) durch Klicken oder Tippen an beliebiger Stelle ihrer Box aus, damit die Auswahl einfach und zuverlässig funktioniert.

## Begriffe

- **Dimensionsseite:** Schritt der Selbsteinschätzung unter `/<lang>/themen/ai-audit/<dimension>`, erreichbar über „Selbsteinschätzung starten“ bzw. „Start self-assessment“ auf `/<lang>/themen/ai-audit`.
- **Stufenbox:** einer der drei Einträge der Gruppe „Reifegrad für …“ / „Maturity level for …“. Sie enthält Beschriftung („Stufe n“ und Name), Beschreibungstext, die Überschrift „Prüffragen zu …“ und die Prüffragen.
- **Freie Innenfläche:** Fläche in der Box ohne Text, geprüft in der Mitte zwischen Unterkante der letzten Prüffrage und Unterkante der Box.
- **Randbereich:** Punkte 3 px innerhalb des linken und rechten Rands (auf Höhe des Beschreibungstexts) und 3 px über der Unterkante (horizontal mittig).
- **Ausgewählt:** Die Auswahl der Stufe meldet den Zustand „ausgewählt“ (Radiobutton `checked`); alle anderen Stufen derselben Frage nicht.

Im Projekt `mobil` (Pixel 7) prüfen alle Tests per Tippen, im Projekt `desktop` per Mausklick.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-5-AC1 | Ein Klick auf die Beschriftung „Stufe n“ einer Stufenbox wählt genau diese Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC2 | Ein Klick auf den Beschreibungstext einer Stufenbox wählt genau diese Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC3 | Ein Klick auf die Überschrift „Prüffragen zu …“ oder auf eine Prüffrage einer Stufenbox wählt genau diese Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC4 | Ein Klick auf die freie Innenfläche einer Stufenbox wählt genau diese Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC5 | Ein Klick in den linken, rechten oder unteren Randbereich einer Stufenbox wählt genau diese Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC6 | Nach Auswahl über den Beschreibungstext zeigt nur die gewählte Box den Hinweis „Ausgewählt“, und der Statushinweis lautet „Gewählt: <Name der Stufe>“. | `tests/REQ-5.spec.ts` |
| REQ-5-AC7 | Eine über die freie Innenfläche gewählte Stufe ist die Antwort des Schritts: „Weiter“ führt zu Dimension 2, und nach „Zurück“ ist in Dimension 1 weiterhin genau diese Stufe ausgewählt. | `tests/REQ-5.spec.ts` |
| REQ-5-AC8 | Ein Klick auf eine andere Stufenbox wechselt die Auswahl dorthin; danach ist in der Gruppe genau eine Stufe ausgewählt und genau einmal „Ausgewählt“ sichtbar. | `tests/REQ-5.spec.ts` |
| REQ-5-AC9 | Auf einem Touch-Gerät (Pixel 7, in beiden Projekten) wählt Antippen von Beschreibungstext bzw. freier Innenfläche die jeweilige Stufe aus. | `tests/REQ-5.spec.ts` |
| REQ-5-AC10 | In der englischen Fassung (`/en`) wählt ein Klick auf Beschreibungstext bzw. freie Innenfläche die Stufe aus; die gewählte Box zeigt „Selected“. | `tests/REQ-5.spec.ts` |
| REQ-5-AC11 | Mit der Tastatur: Leertaste auf der fokussierten ersten Stufe wählt sie aus, Pfeil nach unten wählt und fokussiert jeweils die nächste Stufe. | `tests/REQ-5.spec.ts` |
| REQ-5-AC12 | Für assistive Technologien: Die Gruppe enthält genau drei Auswahlfelder (Radiobuttons), deren Name mit „Stufe n“ beginnt und den Beschreibungstext nicht enthält; der Beschreibungstext ist ihre Beschreibung. Nach Klick auf die freie Innenfläche von Stufe 3 meldet nur „Stufe 3“ den Zustand ausgewählt. | `tests/REQ-5.spec.ts` |

## Szenarien

Gegeben ist jeweils: Die erste Dimension der Selbsteinschätzung ist über „Selbsteinschätzung starten“ geöffnet, noch keine Stufe ist gewählt.

### REQ-5-AC1 Beschriftung

- **Wenn** auf „Stufe 2“ und danach auf „Stufe 3“ geklickt wird
- **Dann** ist jeweils genau die angeklickte Stufe ausgewählt

### REQ-5-AC2 Beschreibungstext

- **Wenn** auf den Beschreibungstext von Stufe 2 und danach von Stufe 1 geklickt wird
- **Dann** ist jeweils genau die angeklickte Stufe ausgewählt

### REQ-5-AC3 Prüffragen

- **Wenn** auf die Überschrift „Prüffragen zu …“ von Stufe 3 und danach auf die erste Prüffrage von Stufe 2 geklickt wird
- **Dann** ist jeweils genau die angeklickte Stufe ausgewählt

### REQ-5-AC4 Freie Innenfläche

- **Wenn** auf die freie Innenfläche von Stufe 2 und danach von Stufe 3 geklickt wird
- **Dann** ist jeweils genau die angeklickte Stufe ausgewählt

### REQ-5-AC5 Randbereich

- **Wenn** auf den linken Randbereich von Stufe 2, den rechten von Stufe 3 und den unteren von Stufe 1 geklickt wird
- **Dann** ist jeweils genau die angeklickte Stufe ausgewählt

### REQ-5-AC6 Sichtbare Hervorhebung

- **Wenn** auf den Beschreibungstext von Stufe 2 geklickt wird
- **Dann** zeigt nur die Box von Stufe 2 „Ausgewählt“
- **Und** der Statushinweis nennt „Gewählt:“ mit dem Namen, der in der Box von Stufe 2 steht

### REQ-5-AC7 Antwort des Schritts

- **Wenn** auf die freie Innenfläche von Stufe 3 geklickt, dann „Weiter“ und auf der nächsten Seite „Zurück“ gewählt wird
- **Dann** zeigt die nächste Seite „Dimension 2 von …“
- **Und** zurück in Dimension 1 ist genau Stufe 3 ausgewählt

### REQ-5-AC8 Wechsel der Auswahl

- **Wenn** auf den Beschreibungstext von Stufe 1 und danach auf die freie Innenfläche von Stufe 2 geklickt wird
- **Dann** ist genau Stufe 2 ausgewählt, in der Gruppe genau ein Auswahlfeld ausgewählt und genau einmal „Ausgewählt“ sichtbar

### REQ-5-AC9 Touch

- **Gegeben** ein Browserkontext wie Pixel 7 mit Touch
- **Wenn** der Beschreibungstext von Stufe 2 und danach die freie Innenfläche von Stufe 3 angetippt wird
- **Dann** ist jeweils genau die angetippte Stufe ausgewählt

### REQ-5-AC10 Englische Fassung

- **Gegeben** die erste Dimension ist über „Start self-assessment“ auf `/en/themen/ai-audit` geöffnet
- **Wenn** auf den Beschreibungstext von Stufe 2 geklickt wird
- **Dann** ist genau Stufe 2 ausgewählt und ihre Box zeigt „Selected“
- **Wenn** danach auf die freie Innenfläche von Stufe 3 geklickt wird
- **Dann** ist genau Stufe 3 ausgewählt

### REQ-5-AC11 Tastatur

- **Wenn** das Auswahlfeld von Stufe 1 fokussiert ist und die Leertaste gedrückt wird
- **Dann** ist Stufe 1 ausgewählt
- **Wenn** zweimal Pfeil nach unten gedrückt wird
- **Dann** ist nacheinander Stufe 2 (fokussiert) und Stufe 3 ausgewählt

### REQ-5-AC12 Assistive Technologien

- **Dann** enthält die Gruppe „Reifegrad für …“ genau drei Radiobuttons; der Name von Radiobutton n beginnt mit „Stufe n“ und enthält nicht den Beschreibungstext, die Beschreibung ist der Beschreibungstext
- **Wenn** auf die freie Innenfläche von Stufe 3 geklickt wird
- **Dann** ist der einzige ausgewählte Radiobutton „Stufe 3 …“ und die anderen beiden sind nicht ausgewählt

## Nicht Teil der Anforderung

- Gestaltung der Hervorhebung (Farben, Rahmen, Häkchen) über den sichtbaren Hinweis „Ausgewählt“/„Selected“ hinaus.
- Andere Bedienelemente der Seite (Prüffragen beantworten, Navigation, Einwilligung zur Statistik, Auswertung).
- Speicherung der Auswahl über das Neuladen der Seite hinaus (bleibt wie bisher nur im Browserfenster).
- Inhalte und Anzahl der Dimensionen und Reifegrade.

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.

Ergebnis am 2026-11-16 gegen `origin/main` (9c525e5), Port 20005, Desktop und Mobil:

- **Bestanden:** AC1, AC11 (Beschriftung und Tastatur funktionieren bereits). Gegenprobe: erwartete Stufe kurz verfälscht → beide rot, Änderung zurückgenommen → grün.
- **Fehlgeschlagen aus dem richtigen Grund:** AC2–AC10, AC12. Der Klick bzw. das Tippen außerhalb der Beschriftung wählt keine Stufe (`toBeChecked` bzw. „Ausgewählt“ fehlt); kein Selektor-, Tipp- oder Zeitfehler.
- **Gegenprobe mit Behelfsumsetzung:** Lokal, nicht committet, ein Klick-Handler auf der ganzen Stufenbox → alle 12 Kriterien grün auf Desktop und Mobil, dreifach wiederholt (72 von 72) ohne Ausfall. Danach Anwendungscode zurückgesetzt.
- **Vollständigkeit:** Jede Aussage des Issues ist abgedeckt: Beschriftung, Text, freie Fläche, Rand (AC1–AC5), Hervorhebung und Übernahme (AC6, AC7), genau eine Stufe (AC8), Desktop und Touch (alle Tests in beiden Projekten, AC9), beide Sprachen (AC10), Tastatur (AC11), assistive Technologien (AC12).

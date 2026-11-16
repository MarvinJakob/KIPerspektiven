---
id: REQ-11
issue: https://github.com/MarvinJakob/AIPerspectives/issues/11
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-11 Selbsteinschätzung: doppelte Schrittnummerierung für Screenreader entfernen

## Ziel

Wer einen Screenreader nutzt, hört jede Schrittnummer der Selbsteinschätzung genau einmal, damit der Ablauf ohne irritierende Wiederholungen wie „1 1.“ verständlich bleibt. Die Orientierung im Ablauf (Bezeichnung, aktueller Schritt, sichtbare Nummerierung) bleibt erhalten.

## Begriffe

- **Selbsteinschätzung:** geführter Ablauf der KI Readiness. Einstieg über die Übersicht `/<lang>/themen/ai-audit` und den Link „Selbsteinschätzung starten“ bzw. „Start self-assessment“; je Dimension eine Seite, am Ende die Auswertung.
- **Schrittliste:** Navigation „Ablauf der Selbsteinschätzung“ bzw. „Self-assessment steps“ mit einer Liste, die je Dimension einen Eintrag hat; Eintrag *i* (ab 1) gehört zur *i*-ten Dimension des Ablaufs. Sie steht auf jeder Dimensionsseite und auf der Auswertung.
- **Zugänglicher Inhalt eines Eintrags:** der Text, den der Browser im Accessibility-Baum für den Eintrag an Screenreader liefert: alle Textknoten und Listenmarker in Lesereihenfolge, ohne verborgene Inhalte (`aria-hidden`, `display: none`). Ermittelt über das Chrome DevTools Protocol (`Accessibility.getFullAXTree`); beide Testprojekte (desktop, mobil) laufen in Chromium.
- **Schrittnummer genau einmal:** Der zugängliche Inhalt von Eintrag *i* enthält genau eine eigenständige Zahl, und das ist *i* (ein angehängter Punkt wie in „1.“ ist erlaubt). „1 1.“ enthält die Zahl zweimal.
- **Status eines Eintrags:** „Aktuell“/„Current“ (angezeigte Dimension), „Bewertet: <Reifegrad>“/„Rated: <level>“, „Offen“/„Open“.
- **Sichtbare Nummer:** Ziffern, die für Sehende an ihrer Position tatsächlich dargestellt werden (nicht weggeschnitten, nicht verdeckt). Text nur für Screenreader zählt nicht.

## Akzeptanzkriterien

Alle Kriterien gelten auf Desktop und Mobil (Testprojekte `desktop`, `mobil`).

| ID | Kriterium | Test |
|---|---|---|
| REQ-11-AC1 | Deutsch, erste Dimension: Der zugängliche Inhalt des ersten Eintrags der Schrittliste beginnt mit der Schrittnummer 1, enthält sie genau einmal und keine Wiederholung „1 1.“. | `tests/REQ-11.spec.ts` |
| REQ-11-AC2 | Deutsch, zweite Dimension nach Bewertung der ersten (Einträge bewertet, aktuell und offen): Jeder Eintrag *i* nennt im zugänglichen Inhalt genau eine Zahl, und zwar *i*. | `tests/REQ-11.spec.ts` |
| REQ-11-AC3 | Deutsch, zweite Dimension: Die Schrittliste bleibt verständlich zugänglich. Jeder Eintrag nennt seine Bezeichnung und seinen Status; Eintrag 1 nennt die erste Dimension mit „Bewertet“, Eintrag 2 die angezeigte Dimension (Überschrift der Seite) mit „Aktuell“, alle weiteren sind „Offen“; nur Eintrag 2 ist „Aktuell“. Die Seite zeigt „Dimension 2 von <Anzahl Einträge>“. | `tests/REQ-11.spec.ts` |
| REQ-11-AC4 | Deutsch und Englisch, zweite Dimension: Sichtbare Nummerierung und zugängliche Ausgabe widersprechen sich nicht. Jeder Eintrag nennt zugänglich genau seine Nummer *i* (wie AC2); offene und aktuelle Einträge zeigen *i* sichtbar; ein Eintrag zeigt keine andere sichtbare Zahl als *i* (bewertete Einträge dürfen statt der Nummer ein Häkchen zeigen). | `tests/REQ-11.spec.ts` |
| REQ-11-AC5 | Englisch, zweite Dimension nach Bewertung der ersten: Jeder Eintrag *i* nennt im zugänglichen Inhalt genau eine Zahl, und zwar *i* (schließt den ersten Schritt ein). | `tests/REQ-11.spec.ts` |
| REQ-11-AC6 | Englisch, zweite Dimension: wie AC3 mit „Rated“, „Current“, „Open“ und „Dimension 2 of <Anzahl>“. | `tests/REQ-11.spec.ts` |
| REQ-11-AC7 | Deutsch, Auswertung nach Bewertung aller Dimensionen: Jeder Eintrag *i* der Schrittliste nennt im zugänglichen Inhalt genau eine Zahl, und zwar *i*, und den Status „Bewertet“. | `tests/REQ-11.spec.ts` |

## Szenarien

### REQ-11-AC1 Erste Schrittnummer genau einmal

- **Gegeben** die deutsche Übersicht der KI Readiness
- **Wenn** ich „Selbsteinschätzung starten“ wähle
- **Dann** beginnt der zugängliche Inhalt des ersten Eintrags der Schrittliste mit „1“, enthält keine weitere Zahl und keine Folge „1 1.“

### REQ-11-AC2 Jede Schrittnummer genau einmal (Deutsch)

- **Gegeben** die gestartete deutsche Selbsteinschätzung
- **Wenn** ich für die erste Dimension „Stufe 1“ wähle und „Weiter“ drücke
- **Dann** nennt jeder Eintrag *i* der Schrittliste (bewertet, aktuell, offen) zugänglich genau die Zahl *i*

### REQ-11-AC3 Bezeichnung und aktueller Schritt (Deutsch)

- **Gegeben** wie AC2 die zweite Dimension nach Bewertung der ersten
- **Dann** nennt Eintrag 1 den Titel der ersten Dimension und „Bewertet“, Eintrag 2 den Titel der angezeigten Dimension und „Aktuell“, alle weiteren Einträge eine Bezeichnung und „Offen“
- **Und** die Seite zeigt „Dimension 2 von <Anzahl>“

### REQ-11-AC4 Sichtbar und zugänglich stimmen überein

- **Gegeben** jeweils auf Deutsch und Englisch die zweite Dimension nach Bewertung der ersten
- **Dann** nennt jeder Eintrag *i* zugänglich genau *i*
- **Und** die Einträge 2 bis *n* zeigen die Nummer *i* sichtbar, und kein Eintrag zeigt eine andere sichtbare Zahl als *i*

### REQ-11-AC5 Jede Schrittnummer genau einmal (Englisch)

- **Gegeben** die englische Übersicht `/en/themen/ai-audit`
- **Wenn** ich „Start self-assessment“ wähle, „Level 1“ wähle und „Next“ drücke
- **Dann** nennt jeder Eintrag *i* zugänglich genau die Zahl *i*

### REQ-11-AC6 Bezeichnung und aktueller Schritt (Englisch)

- **Gegeben** wie AC5
- **Dann** gilt AC3 mit „Rated“, „Current“, „Open“ und „Dimension 2 of <Anzahl>“

### REQ-11-AC7 Schrittliste auf der Auswertung

- **Gegeben** die gestartete deutsche Selbsteinschätzung
- **Wenn** ich jede Dimension mit „Stufe 1“ bewerte, jeweils „Weiter“ und zuletzt „Auswertung anzeigen“ drücke
- **Dann** zeigt die Auswertung die Schrittliste, und jeder Eintrag *i* nennt zugänglich genau die Zahl *i* und „Bewertet“

## Nicht Teil der Anforderung

- Eine bestimmte technische Lösung (z. B. `aria-hidden`, nur für Screenreader bestimmter Text, Listenmarker); das Issue gibt ausdrücklich keine vor.
- Die Ausgabe einzelner Screenreader-Produkte. Maßstab ist der Accessibility-Baum des Browsers, aus dem Screenreader lesen. Positionsangaben, die ein Screenreader selbst ergänzt (z. B. „Listenelement 1 von 8“), sind nicht Teil der Anforderung.
- Andere Nummerierungen der Seite: Reifegrade („Stufe 1“), Prüffragen („1.1“), Zeilen der Auswertungstabelle.
- Englische Auswertung: Die Auswertung verwendet dieselbe Schrittliste wie die Dimensionsseiten; Deutsch und Englisch sind auf den Dimensionsseiten abgedeckt (AC2, AC4, AC5).
- Gestaltung der Marker (Kreis, Häkchen) über AC4 hinaus.

## Befund bei der Verifikation

Auf `origin/main` (e6ee73f) gibt die Schrittliste jede Nummer bereits genau einmal aus („1. Strategie und Wirtschaftlichkeit Aktuell“); die sichtbare Nummer ist vor Screenreadern verborgen. Alle sieben Tests bestehen dort. Die Tests sichern das Verhalten gegen Rückfälle ab. Die Gegenprobe mit einem lokal eingebauten Defekt (sichtbare Nummer nicht mehr verborgen, Ausgabe „1 1 .“) machte AC1, AC2, AC4 und AC5 auf Desktop und Mobil rot.

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails. Hier: zugänglicher Inhalt aus dem Accessibility-Baum des Browsers und tatsächlich dargestellte Ziffern, keine CSS-Klassen.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt. AC1, AC2, AC4, AC5: rot mit lokal eingebautem Defekt „1 1.“ (Anwendungscode danach zurückgesetzt, nicht committet). AC3, AC6 (Status von Eintrag 2), AC4 (sichtbare Nummer) und AC7 (Status der Einträge): rot mit bewusst verfälschter Erwartung.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab. Drei Läufe hintereinander: 14/14 bestanden.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt. Die Bewertungen entstehen im Test und bleiben im Browserfenster.

---
id: REQ-2
issue: https://github.com/MarvinJakob/KIPerspektiven/issues/2
status: verifiziert       # entwurf | verifiziert
geprueft_am: 2026-11-17
---

# REQ-2 Themenseite Vibe Coding mit Harness-Grafik

## Ziel

Als Besucherin oder Besucher von KI Perspektiven möchte ich eine eigenständige Themenseite „Vibe Coding“ auf Deutsch und Englisch lesen. So verstehe ich, warum schnell generierter Code Verantwortung braucht und wie mir die fünf Engineering-Perspektiven dabei helfen. Die Grafik im Abschnitt „Harness Engineering“ zeigt, wie Harness, Skill, Tool, Context und Model zusammenspielen.

## Quellen

- Inhalt: `content/topics/Vibe Coding v1_de.md` (Stand 16. November 2026)
- Layout: `mock/thema_vibe_coding/` mit README (Rechtschreibkorrekturen ausdrücklich erwünscht)
- Grafik: `res/harness.png` (sprachneutral, 1685 × 542 px). Die Inhaltsdatei beschreibt das Harness-Konzept im Abschnitt „Harness Engineering“, dort steht die Grafik.
- Bestehende Spezifikation [REQ-6](REQ-6.md) mit Tests `tests/REQ-6.spec.ts`. Sie stammt aus dem Vorgängerrepository und wird hier vollständig übernommen.

## Akzeptanzkriterien

Die Anforderung umfasst **REQ-6-AC1 bis REQ-6-AC11** unverändert. Das sind URL je Sprache, Link in der Themenübersicht, vollständiger Inhalt, Abschnittsfolge, Hinweiskästen und Zitat, Sprungmarken, interne Links, responsive Darstellung, englische Übersetzung, Sprachwechsel und Du-Ansprache. Die Grafik ergänzt die folgenden Kriterien:

| ID | Kriterium | Test |
|---|---|---|
| REQ-2-AC1 | Auf `/de/themen/vibe-coding` und `/en/themen/vibe-coding` steht im Abschnitt „Harness Engineering“ nach dessen erstem Absatz und vor dem Beispielkasten genau eine Grafik. Sie ist vollständig geladen und hat einen sprachpassenden Alternativtext, der „Harness“, „Skill“, „Tool“, „Context“ und „Model“ nennt. | `tests/REQ-2.spec.ts` |
| REQ-2-AC2 | Die Grafik ist ein Link mit zugänglichem Namen, der die Bilddatei in einem neuen Fenster öffnet. Die Datei liefert Status 200 und einen Bild-Inhaltstyp. | `tests/REQ-2.spec.ts` |
| REQ-2-AC3 | Auf Desktop und Mobil ist die Grafik nicht breiter als die Textspalte ihrer Perspektive und die Seite hat keinen horizontalen Bildlauf. | `tests/REQ-2.spec.ts` |

## Szenarien

### REQ-2-AC1 Grafik im Abschnitt Harness Engineering

- **Gegeben** `/de/themen/vibe-coding` bzw. `/en/themen/vibe-coding`
- **Wenn** der Abschnitt „Harness Engineering“ in den sichtbaren Bereich gescrollt ist
- **Dann** enthält er genau ein Bild mit natürlicher Breite > 0. Es steht unterhalb des ersten Absatzes und oberhalb des Beispielkastens. Sein Alternativtext ist in der Seitensprache verfasst und nennt Harness, Skill, Tool, Context und Model.

### REQ-2-AC2 Vergrößerung per Link

- **Gegeben** die Grafik auf `/de/themen/vibe-coding`
- **Dann** liegt sie in einem Link mit nicht leerem zugänglichem Namen und `target="_blank"`
- **Wenn** das Linkziel abgerufen wird
- **Dann** ist der Status 200 und der Inhaltstyp beginnt mit `image/`

### REQ-2-AC3 Responsive Grafik

- **Gegeben** `/de/themen/vibe-coding` auf Desktop bzw. Mobil
- **Dann** liegen die linke und rechte Kante der Grafik innerhalb der Textspalte (erster Absatz der Perspektive, Toleranz 1 px) und `scrollWidth` des Dokuments ist nicht größer als die Fensterbreite

## Nicht Teil der Anforderung

- Grafiken `development-process` und `releasegate`. Sie gehören laut `content/topics/Software Development v1_de.md` zur Themenseite Softwareentwicklung und sind dort bereits eingebunden.
- Lesezeit und Schaltfläche „Nach oben“.
- Kopf, Navigation und Fußzeile, Farben und Abstände im Detail.
- Wortlaut der englischen Übersetzung und des Alternativtexts über die genannten Begriffe hinaus.

## Quelltextprüfung

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Bild, Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Die Tests sind für Desktop und Mobil vorgesehen und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`).

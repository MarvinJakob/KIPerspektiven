# Startseite · cimt-Mock

`index.html` über einen lokalen Webserver aus dem Projektverzeichnis öffnen (`/mock/home/`). Kein Build, kein Backend, keine externen Abrufe. Der Mock ist eigenständig (eigene `styles.css` und `script.js`) und folgt [DESIGN.md](../../DESIGN.md).

## Kopfzeile

Die Kopfzeile ist unverändert aus der Anwendung übernommen: Markup nach `app/frontend/src/components/Header.tsx`, Styles 1:1 aus `app/frontend/src/styles.css` in [header.css](header.css). Sie enthält Wortmarke, Themenmenü (Softwareentwicklung, Vibe Coding), Blog, KI Readiness, Profil, Sprachwahl DE/EN, Hell/Dunkel und Redaktionsanmeldung. Im Mock zeigen Blog, Profil, EN und Anmeldung nur einen Hinweis. `header.css` nicht für den Mock anpassen.

## Idee

Modernes, rein typografisches Layout **ohne Grafiken und Bilder**. Große Schrift, klare Linien, viel Weißraum und orange Akzente tragen die Seite. Jeder Abschnitt hat genau eine Aussage und einen Weg weiter:

1. **Hero:** sehr große Überschrift „KI verstehen. Sinnvoll einsetzen.“, darunter eine Linie mit Einleitung links und zwei Aktionen rechts (Themen entdecken, KI Readiness einschätzen).
2. **Aktuell im Fokus:** nummerierte Liste (01, 02) mit Thema, Leitfrage und einem Satz. Die ganze Zeile ist klickbar; beim Überfahren wird der Pfeil orange.
3. **KI Readiness · Kurzcheck** (Variante 7): die acht Leitfragen in großer Schrift zum Mitmachen. Ja, Nein oder Überspringen bringt die nächste Frage; am Ende steht „x von 8 Leitfragen mit Ja“. Der Button „Selbsteinschätzung starten“ ist immer sichtbar. Antworten bleiben im Arbeitsspeicher und werden nicht übertragen. Styles und Logik liegen in `styles.css` und `script.js`; die Variantenseite nutzt dieselben Dateien.
4. **Über mich:** Name, ein Satz, Link.

## Quellen der Texte

- Hero: [content/topics/home v1_de.md](../../content/topics/home%20v1_de.md) und [Landingpage_v03.md](../../content/topics/home/Landingpage_v03.md)
- Softwareentwicklung: Leitfrage aus Landingpage_v03.md, Kurzsatz neu formuliert
- Vibe Coding: Leitfrage und Kurzsatz frei nach [Vibe Coding v1_de.md](../../content/topics/Vibe%20Coding%20v1_de.md)
- KI Readiness: Titel und Beschreibung aus [KI Readiness.md](../../content/topics/audit/KI%20Readiness.md)
- Über mich: Platzhaltersatz, bitte ersetzen

## Varianten für den KI-Readiness-Block

Unter [readiness/](readiness/index.html) liegen sieben alternative Vorschläge, jeweils als eigene Seite mit der unveränderten Kopfleiste der Startseite:

1. [Kurzcheck](readiness/variante-1-kurzcheck.html): eine echte Audit-Frage zum Ausprobieren (Ja/Nein mit Rückmeldung)
2. [Acht Dimensionen](readiness/variante-2-dimensionen.html): Dimensionen gruppiert nach organisatorisch, fachlich, technisch
3. [Reifegrad-Skala](readiness/variante-3-reifegrade.html): Reifegrade 0 bis 3 nebeneinander
4. [Drei Schritte](readiness/variante-4-drei-schritte.html): Ablauf vom Bereich bis zur To-do-Liste
5. [Orangefarbenes Band](readiness/variante-5-band.html): eine Frage, ein Button
6. [Leitfragen im Wechsel](readiness/variante-6-leitfragen.html): die acht Leitfragen in großer Schrift, pausierbar
7. [Leitfragen zum Mitmachen](readiness/variante-7-leitfragen-kurzcheck.html): Kombination aus 1 und 6. Große Leitfrage mit Ja, Nein oder Überspringen; jede Antwort bringt die nächste Frage. Am Ende „x von 8 Leitfragen mit Ja“ und der Weg zur Selbsteinschätzung. Antworten bleiben im Arbeitsspeicher und werden nicht übertragen.

Texte aus [KI Readiness.md](../../content/topics/audit/KI%20Readiness.md); die Rückmeldungen im Kurzcheck und die Schritt-Texte sind neu formuliert.

## Platzhalter

- **„Selbsteinschätzung starten“** und **„Mehr über mich“** zeigen einen Hinweis, da die Zielseiten im Mock nicht angebunden sind.
- Die Themen verlinken auf die Mocks [Softwareentwicklung](../software_development/index.html) und [Vibe Coding](../thema_vibe_coding/index.html).

# Themenseite Vibe Coding · cimt-Mock

`index.html` direkt im Browser öffnen. Kein Build, Backend oder Paket erforderlich. Der Mock nutzt die gemeinsamen Design-Tokens und die Glasnavigation aus `../design_cimt/styles.css`, Kopf und Fuß aus `../landing_v03/styles.css` sowie Hell/Dunkel und mobiles Menü aus `../landing_v03/script.js` und folgt dem Abschnittsrhythmus von [Landing v0.3](../landing_v03/index.html).

## Grundlagen

- Inhalt: `content/topics/Vibe Coding v1_de.md`, Stand 16. November 2026. Der Text ist vollständig übernommen; kursive Beispielpassagen erscheinen als Hinweiskästen („Im Beispiel“, „In unserem Formular“).
- Design: [DESIGN.md](../../DESIGN.md) – Orange `#dc6e14`, Dunkelblau, warme helle Flächen, Systemschrift, opake Inhaltsflächen, Hell/Dunkel nur im Arbeitsspeicher.
- Keine Grafiken oder Illustrationen: Grafiken werden separat vom Maintainer gestaltet.
- Layout: Titel und Untertitel stehen mittig im Einstieg. Der gesamte Einleitungstext (Abschnitt „Willkommen beim Vibe Coding“ der Quelle) steht in einem Abschnitt als mittige Lesespalte (max. 680 px) – inklusive Beispielgeschichte, Zitat und Übersicht der fünf Perspektiven. Die fünf Perspektiven sind zweispaltig: links Nummer, Rubrik und Überschrift (sticky), rechts der Text. Bei 850 px Breite und darunter einspaltig.
- Einordnung: Das Thema ist eigenständig („Vibe Coding“), nicht Teil von Softwareentwicklung. Brotkrumen: Start / Themen / Vibe Coding.

## Aufbau

1. Einstieg: Brotkrumen, Titel „Vibe Coding“, Untertitel, Lesezeit und Stand – zentriert
2. Einleitung: gesamter Text unter „Willkommen beim Vibe Coding“ mit Beispielkasten, Zitat und Sprungmarken zu den fünf Perspektiven
3. Je ein Abschnitt pro Perspektive (Prompt, Context, Harness, Specification, Product)
4. Fazit, Weiterlesen (Themenübersicht, KI-Reifegrad), Footer

## Sprachliche Korrekturen gegenüber der Quelle

Nur Rechtschreibung und Zeichensetzung, keine inhaltlichen Änderungen. Die Quelldatei ist unverändert.

- „ungefair“ → „ungefähr“, „Eigenen Daten“ → „eigenen Daten“, „Was ein überraschend …“ → „Was für ein überraschend …“
- „Diese Fünf“ → „Diese fünf“, „in dem Entwicklungsprozess“ → „in den Entwicklungsprozess“
- „Prompt/Context Entineering“ → „… Engineering“, „Eine gute Prompt“ → „Einen guten Prompt“
- „work live balance“ → „Work-Life-Balance“, „aktionen“ → „Aktionen“, „unber anderem“ → „unter anderem“, „allerding“ → „allerdings“
- Doppelten Punkt nach dem Zitat „Mach, dass es irgendwie moderner aussieht.“ entfernt
- Kommas vor „um“-Sätzen ergänzt; „Es bietet Raum“ → „Das bietet Raum“ (Bezug auf die Perspektiven)

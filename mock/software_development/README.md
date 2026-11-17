# Themenseite Softwareentwicklung · cimt-Mock

`index.html` über einen lokalen Webserver aus dem Projektverzeichnis öffnen (z. B. `npx serve .` und dann `/mock/software_development/`). Direkt per Doppelklick funktioniert es ebenfalls, solange die Ordnerstruktur erhalten bleibt. Kein Build und kein Backend nötig.

## Grundlagen

- Inhalt: [content/topics/Software Development v1_de.md](../../content/topics/Software%20Development%20v1_de.md), Stand 16. November 2026. Der Text ist vollständig übernommen; Rechtschreibung und Zeichensetzung sind korrigiert (siehe unten). Die Quelldatei ist unverändert.
- Grafiken: `res/development-process_de.png` und `res/releasegate_de.png` an den in der Vorlage markierten Stellen, unverändert eingebunden. Ein Klick öffnet die Grafik in voller Größe.
- Design: [DESIGN.md](../../DESIGN.md). Gemeinsame Tokens, Navigation und Footer kommen aus `../design_cimt/styles.css` und `../landing_v03/styles.css`; Hell/Dunkel und mobiles Menü aus `../landing_v03/script.js`.

## Aufbau

Hero mit Breadcrumb, Titel und Autor → Artikel mit beiden Grafiken → Aufruf zur Meinung → weitere Themen.

## Sprachliche Korrekturen gegenüber der Quelle

Nur Rechtschreibung, Schreibweise von Fachbegriffen und Zeichensetzung, keine inhaltlichen Änderungen.

- „erziehlst“ → „erzielst“, „grundlegen“ → „grundlegend“, „hinterher kommen“ → „hinterherkommen“, „los zu lassen“ → „loszulassen“
- „fleißarbeit“ → „Fleißarbeit“, „Mashine“ → „Maschine“, „Scenarien“/„Referenzscenarien“ → „Szenarien“/„Referenzszenarien“
- „Test Analysten“ → „Testanalysten“, „Test Agenten“ → „Testagenten“, „Fidelity Tests“ → „Fidelity-Tests“, „Bug Ticket(s)“ → „Bug-Ticket(s)“
- „Diese Führen“ → „Diese führen“, „sonder auch“ → „sondern auch“, Großschreibung von „Verhalten“, „Code“, „Merge Gate“, „Code Quality“, „Security“, „Vielzahl“, „Commits“, „Release“, „Branch“, „Push“, „Ende“
- Kommas vor Nebensätzen und Einschüben ergänzt; Schlusspunkt nach „Teile mir gerne deine Meinung dazu mit“

## Platzhalter

- „Zum Kontaktformular“: Ein Kontaktformular existiert noch nicht; der Button zeigt einen Hinweis.
- „Weiterlesen“ verlinkt auf den Mock [Themenseite Vibe Coding](../thema_vibe_coding/index.html).

# Verlauf der Seitenaufrufe (#139)

Stand: 14.11.2026. Die Statistik unter `/redaktion/statistik` ergänzt Summe und Tagestabelle um ein SVG-Liniendiagramm. Die bestehende Erfassung bleibt unverändert. Es werden keine weiteren Besucherdaten erhoben und keine Diagrammbibliothek eingebunden.

## Daten und Darstellung

- Vorauswahl: letzte 30 Kalendertage, einschließlich heute. Die Auswahl gilt gemeinsam für Diagramm, Summe und Tabelle.
- Alle Tageswerte kommen aus `GET /api/admin/statistics/page-views`. Das Diagramm zeichnet chronologisch; die Tabelle bleibt absteigend sortiert.
- Das Backend liefert auch bei „Gesamt“ lückenlose Kalendertage: vom ersten erfassten Aufruf bis heute, in `Europe/Berlin`. Fehlende Tageszähler werden in der Antwort mit 0 ergänzt. Ohne erfasste Aufrufe ist „Gesamt“ leer.
- Während jeder laufenden Seitenaufruf-Abfrage und bei Fehlern sind Diagramm, Summe und Tabelle ausgeblendet. Ein Fehler bietet „Erneut versuchen“. Bei Summe 0 erscheint der bestehende verständliche Leerhinweis.
- Die SVG-Breite folgt dem verfügbaren Platz; die Schrift bleibt 12 px groß. Auf schmalen Flächen stehen höchstens drei, auf breiten höchstens fünf Datumsbeschriftungen. Bei mehr als 60 Tagen entfällt nur die Punktmarkierung, die Linie enthält weiterhin jeden Tag.
- Titel und Beschreibung benennen das Diagramm für assistive Technik; die direkt folgende Tabelle enthält die genauen Werte als Textalternative. Die Zeitraumauswahl bleibt eine native Radiogruppe.

## Automatisierte Prüfung

Am 14.11.2026 erfolgreich ausgeführt:

- Redaktion: `npm run typecheck`, `npm test` (80 Tests) und `npm run build`.
- Backend: `go vet ./...` und `go test ./...`, einschließlich HTTP- und Migrationstests.
- Erweiterte Frontend-Tests vergleichen Datum und Wert jedes Diagrammpunkts mit der Tabellenzeile, prüfen chronologische Position und Nullwert, wechseln zwischen 30 Tagen, 7 Tagen und Gesamt und prüfen Summe, fehlende Aufrufe, verzögerte Antwort, Fehler und erneuten Versuch.
- Backend-Tests prüfen die Zeitraumgrenzen und Nulltage aller drei Filter, einen leeren Gesamtdatensatz sowie Tage ohne Aufrufe nach dem letzten erfassten Aufruf.

## Browserprüfung

Am 14.11.2026 im integrierten Chromium-Browser auf einer eigenen lokalen Instanz mit separater SQLite-Datenbank und dem lokalen Redaktions-Testkonto durchgeführt. Testdaten: 45 Kalendertage vom 01.10. bis 14.11.2026, davon neun Tage ohne Tageszähler. Die Summe betrug 417 Aufrufe.

| Prüfung | Ergebnis |
| --- | --- |
| 320 × 1000 px, Vorauswahl 30 Tage | 276 Aufrufe, 30 Tageswerte; Achsen und drei Datumsbeschriftungen lesbar und ohne Überschneidungen. Dokumentbreite 305 px bei 320 px Fensterbreite einschließlich Scrollleiste; kein horizontaler Seitenscroll. |
| Tastatur bei 320 px | Pfeiltaste links von „Letzte 30 Tage“ wählt „Letzte 7 Tage“; Radio bleibt fokussiert. Summe 56, sieben Tabellenzeilen und entsprechende Diagrammpunkte, einschließlich Nulltagen. |
| 1280 × 1000 px, Gesamt | Summe 417, 45 Diagrammpunkte und 45 Tabellenzeilen; fünf lesbare Datumsbeschriftungen vom 01.10. bis 14.11.2026. Dokumentbreite 1265 px bei 1280 px Fensterbreite einschließlich Scrollleiste; kein horizontaler Seitenscroll. |
| Keine Aufrufe bei 1280 px | Nach Nullsetzen der isolierten Testzähler und Neuladen: Summe 0, Hinweis „Im gewählten Zeitraum wurden noch keine Seitenaufrufe gezählt.“, kein Diagramm und keine Tagestabelle. |

Lokale Screenshots liegen im Worktree unter `.build/139-mobile.jpg` und `.build/139-desktop.jpg`. Sie enthalten ausschließlich lokale Testdaten und gehören nicht zum Build. Die vorübergehende Größenüberschreibung des Browsers wurde zurückgesetzt.

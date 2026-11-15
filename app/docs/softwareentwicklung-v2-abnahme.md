# Themenseite Softwareentwicklung v2 – Umsetzung und Prüfung (#146)

Stand: 15. November 2026. Entwicklungsprüfung im Branch `codex/146-softwareentwicklung`; unabhängiges Review und Merge stehen aus.

## Inhalte und Auslieferung

- Der deutsche Artikel entspricht vollständig der versionierten Vorlage `content/KI in der Softwareentwicklung v2.md`, ohne doppelte H1. Er ersetzt den bisherigen langen Guardrails-Artikel.
- Die englische Veröffentlichung enthält den vollständigen übersetzten Artikel mit drei Hauptabschnitten, zwei Zwischenüberschriften, fünf Prozessschritten und sieben Guardrails-Tipps. Kein deutscher Ersatztext und kein Übersetzungshinweis.
- Beide PNG-URLs liefern HTTP `200`, `Content-Type: image/png` und die erwarteten 295573 (DE) bzw. 288472 Bytes.
- Beide Artikel enthalten keine Quellenliste, Quellenlinks, Belege, Grafikquellen oder Todo-Platzhalter. Der einzige Link im Artikel öffnet die passende Grafik. Die Quellenfunktionen anderer Themen bleiben erhalten und werden weiter getestet.
- Metadaten: Einführung und Kurzbeschreibung über Migration `00015_software_development_content.sql`, Untertitel in den Veröffentlichungskopien. Thema, Titel, Sprachpfade und Blogzuordnungen bleiben erhalten. Up, Down und erneutes Up sind geprüft.
- Beide Originalgrafiken und die v2-Vorlage sind versioniert. Die Web-Kopien unter `frontend/src/assets/topics/` sind bytegleich (SHA-256 verglichen) und liegen innerhalb des Docker-Build-Kontexts `app/`.
- Vite liefert die Bilder lokal als `/assets/AgenticSWDevProcess_de-kQVNeHFW.png` und `/assets/AgenticSWDevProcess_en-DzcMExNC.png`. Die Dateien haben jeweils 1617 × 908 Pixel. Sprachabhängige Alternativtexte beschreiben den Ablauf. Der per Tastatur erreichbare Bildlink öffnet die Originalgröße in einem neuen Tab.

## Automatisierte Prüfungen

- Backend: `go vet ./...` und `go test ./...` erfolgreich, einschließlich API-/HTML-Metadaten, Beitragszuordnungen und Migration/Rollback.
- Öffentliches Frontend: `npm run typecheck` erfolgreich, `npm test -- --maxWorkers=2`: 208/208 Tests in 15 Dateien erfolgreich.
- Beide Frontends: `npm run build` erfolgreich. Die Typprüfung des Redaktionsfrontends ist darin enthalten; dort wurde kein Code geändert.
- Tests zu #146 prüfen vollständige DE-Übernahme, Struktur beider Fassungen, Quellenfreiheit, lokale Grafikauswahl, Alternativtexte, Vollbildlink, Sprachwechsel und bestehende Bloglinks. Die bisherigen Quellentests anderer Themen und der Test für Quellenbereiche bleiben erfolgreich.
- Umgebungsbedingte Anläufe: Der Sandbox-Lauf konnte temporäre Vite-Dateien und SQLite-Testdateien nicht zuverlässig öffnen. Die Prüfungen wurden außerhalb der Sandbox erfolgreich wiederholt. Ein parallel laufender Frontend-Gesamtlauf scheiterte an der Wartezeit eines bestehenden Readiness-Tests; mit zwei Workern besteht die gesamte Suite ohne Codeänderung am betroffenen Test.
- Build-Hinweise: Vite meldet weiterhin ein öffentliches JS-Bundle über 500 kB und beim Redaktionsbuild das klassische `theme.js`-Skript. Beide Builds enden erfolgreich.

## Sichtprüfung der gebauten Anwendung

Lokaler Go-Server mit eingebauten Produktionsbuilds, neuer SQLite-Datenbank, `DEV_SEED=true`, `REQUIRE_LOGIN=false`, Port 8146. Geprüft im In-App-Browser mit expliziten Viewports; beide Sprachen jeweils am Pipeline-Abschnitt visuell kontrolliert und Bildmaße im DOM gemessen.

| Sprache | Viewportbreite | Bild im Artikel (ca. px) | Ergebnis |
| --- | ---: | ---: | --- |
| DE | 320 | 273 × 153 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |
| DE | 768 | 705 × 396 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |
| DE | 1440 | 760 × 427 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |
| EN | 320 | 273 × 153 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |
| EN | 768 | 705 × 396 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |
| EN | 1440 | 760 × 427 | vollständig, unverzerrt, geladen, kein horizontaler Seitenscroll |

Die Dokumentbreite beträgt jeweils 305/753/1425 px innerhalb des 320/768/1440-px-Fensters; die Differenz ist die vertikale Scrollleiste. Das Seitenverhältnis entspricht jeweils dem Original. Die Beschriftungen sind in der geöffneten Originalgrafik lesbar.

Der Sprachwechsel DE → EN zeigt den englischen Artikel, englischen Untertitel, den englischen Seitentitel und ausschließlich die EN-Grafik. Im englischen Artikel enthält das DOM genau einen Link zur lokalen PNG-Datei. Die Tastaturaktivierung des Bildlinks öffnet einen neuen Tab mit der 1617 × 908 großen PNG-Datei. Auf DE bleiben drei zugeordnete Testbeiträge sichtbar. Die temporären Browseransichten und der Viewport-Override wurden anschließend geschlossen bzw. zurückgesetzt.

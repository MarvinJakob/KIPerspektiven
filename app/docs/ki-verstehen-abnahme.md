# KI verstehen – Entwicklungsprüfung zu #151

Stand: 15. November 2026. Ausgangscommit: `c70159f`; Feature-Branch: `codex/151-ki-verstehen`. Der umgesetzte Commit steht im PR und im Ticket. Die unabhängige Review bleibt ausstehend.

## Umsetzung und Inhalt

- Neue öffentliche Route `/{lang}/ki-verstehen`, mit „KI verstehen“ beziehungsweise „Understand AI“ im Hero der Startseite verlinkt.
- Verbindliche Vorlage: `content/KI verstehen.md`, Stand 15. November 2026. Die Anwendungskopie `frontend/src/content/features/ki-verstehen.de.md` ist vollständig identisch. Nur die erste Markdown-Überschrift wird separat als fokussierbare H1 ausgegeben; alle übrigen Absätze, Beispiele, fünf Engineering-Unterabschnitte, beide Leitsätze mit Erläuterungen und sechs Quellenlinks bleiben in der ursprünglichen Reihenfolge sichtbar.
- `ressources/grafiken/Agent.png` ist unverändert als `frontend/src/assets/topics/Agent.png` im Docker-Buildkontext enthalten. SHA-256 beider Kopien: `BB513383BF05E7FD171B9D71723C1E5EA320CBE84BD4FDAD3B671711C9198BE2`. Vite liefert das lokale Asset mit Dateihash aus. Der gemeinsame Markdown-Renderer ergänzt Alternativtext und einen tastaturbedienbaren Link zur Originalgröße in einem neuen Tab.
- Unter `/en/ki-verstehen` bleiben Inhalt, Titel und Beschreibung deutsch. Der bestehende englische Sprachhinweis erscheint, die Navigation ist englisch. Canonical und Sitemap verweisen auf die tatsächlich vorliegende deutsche Fassung; eine englische Übersetzung wird nicht behauptet.
- Vorhandene Sprachwahl, Fokusverwaltung, Markdown-Darstellung und Design-Tokens werden weiterverwendet. Keine neuen Abhängigkeiten, keine Änderungen an API oder Datenbank.

## Automatisierte Prüfungen

Erfolgreich unter Windows mit Go 1.27.0, Node 25.6.1, npm 11.1.0:

| Prüfung | Ergebnis |
| --- | --- |
| Öffentliches Frontend: `npm run typecheck` | erfolgreich, außerdem Bestandteil des abschließenden Builds |
| Öffentliches Frontend: `npm test -- --maxWorkers=2` | 16 Dateien, 212 Tests erfolgreich |
| Öffentliches Frontend: `npm run build` | erfolgreich, einschließlich abschließender Layoutkorrektur |
| Redaktion: `npm run build` | erfolgreich; unveränderter Build für Backend-Einbettung |
| Backend: `go vet -p 2 ./...` | erfolgreich |
| Backend: `go test -p 2 ./...` | alle Pakete erfolgreich, einschließlich neuer Direktaufruf-/Metadaten-/Sitemap-Prüfung |
| Backend: `CGO_ENABLED=0 go build -p 2 -o ../../.build/151-final-server.exe ./cmd/server` | erfolgreich mit beiden eingebetteten Frontends |
| `git diff --check` | erfolgreich |

Neue Regressionstests: vollständige Gleichheit der Textvorlage, Überschriftenreihenfolge, Leitsätze, Quellenlinks, lokales Bild und Vollbildlink, Tastaturaufruf von der Startseite, Sprachwechsel, englischer Direktaufruf, HTTP-Status nach wiederholtem Abruf, übereinstimmende Metadaten sowie deutsche Sitemap ohne erfundene Übersetzung.

Umgebungsbesonderheiten: Die ersten Sandbox-Testläufe scheiterten an temporären Vitest-Dateien beziehungsweise dem Zugriff auf temporäre SQLite-Datenbanken. Außerhalb der Sandbox bestanden beide vollständigen Testsuiten. Ein stark paralleler Frontend-Lauf wurde nach Zeitüberschreitungen beendet; der vollständige Lauf mit zwei Workern bestand. Die installierte Node-Version 25 erzeugt Engine-Hinweise für jsdom/Vitest; die oben genannten Prüfungen bestanden. Der öffentliche Build meldet weiterhin einen JavaScript-Chunk über 500 kB, der Redaktionsbuild den vorhandenen Hinweis zu `theme.js` ohne `type="module"`.

## Browserprüfung

Geprüft mit dem finalen eingebetteten Backend-Build auf `http://localhost:8151`, separater Entwicklungsdatenbank und Entwicklungsdaten. Keine Produktivänderung.

| Kriterium | 375 × 812 | 1440 × 1000 |
| --- | --- | --- |
| Inhalt ohne Aufklappen, eine H1, H2/H3 geordnet | erfolgreich | erfolgreich |
| Kein horizontaler Überlauf | `scrollWidth=360`, `innerWidth=375` | `scrollWidth=1425`, `innerWidth=1440` |
| Grafik lädt vollständig und proportional | 320 × 103 px | 760 × 244 px |
| Originalgrafik | 1685 × 542 px, Vollbildlink erreichbar | neuer Tab mit Originalgrafik erfolgreich geöffnet |
| Tastaturbedienung | Startseitenlink mit Enter geöffnet, Fokus auf H1; Link- und Grafikfokus mit sichtbarer 3-px-Kontur | gemeinsame Tastatur-/Fokusregeln aktiv |
| Sprachwechsel und Neuladen | `/en/ki-verstehen`, deutscher Artikel mit englischem Sprachhinweis nach Neuladen | deutscher Direktaufruf und Neuladen erfolgreich |

Bildschirmausschnitte:

- [Desktop](screenshots/151/desktop.jpg)
- [Desktop: Agenten-Grafik](screenshots/151/desktop-agent.jpg)
- [Mobil](screenshots/151/mobile.jpg)
- [Mobil: Startseitenlink mit Fokus](screenshots/151/mobile-home-focus.jpg)
- [Mobil: Grafiklink mit Fokus](screenshots/151/mobile-agent.jpg)
- [Mobil: englischer Sprach-Fallback](screenshots/151/mobile-fallback.jpg)

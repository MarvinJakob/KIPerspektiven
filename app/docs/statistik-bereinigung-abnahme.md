# IP-bereinigte Seitenstatistik – Entwicklungsprüfung #142

Stand: **2026-11-15**, Windows, Microsoft Edge **157.0.4341.46** (Chromium, Playwright).
Ticket: [#142](https://github.com/MarvinJakob/aiboard/issues/142).
Die unabhängige fachliche Prüfung und der Merge erfolgen anschließend im Review-Workflow.

## Zählung und Datenhaltung

Absolute Zählregel und Zeitzone bleiben erhalten. Je IP-Pseudonym genügt ein letzter Aufruftag:
`last_day >= Zeitraumstart` zählt jede IP einmal für 7/30 Tage, die Anzahl aller Pseudonyme für
„Gesamt“. Bei einem neuen Tag steigt zusätzlich dessen bereinigter Tageszähler. Kein Besuchsverlauf
und keine Addition der Tageswerte zur Periodensumme.

Migration 00014 erhält alle absoluten Tageszähler. `identified_views` erfasst, wie viele Abrufe
bereinigt werden konnten. Ist diese Zahl ungleich `views`, liefert der Tag `uniqueViews: null`.
Die Periodensumme ist dann ebenfalls `null`. Tage ohne Abrufe sind 0/0. Ein Schlüsselwechsel erhält
alte Tagesaggregate, kann deren IP-Vereinigung mit neuen Daten aber nicht rekonstruieren; betroffene
Perioden bleiben unbekannt. Ungültige IPs und verspätete Abrufe mit einem Tag vor `last_day` zählen
weiter absolut, erzeugen bei der Bereinigung eine sichtbare Datenlücke.

Schlüsseldatei und Aufbewahrung: [ADR 0010](adr/0010-statistik-ohne-kennung-und-einwilligung.md),
[Betriebsanleitung](betrieb.md#ip-bereinigung-der-seitenstatistik-142).

## Automatisierte Prüfungen

- Backend: `go vet ./...`, `go test ./...` erfolgreich. Neue Tests in `service/pageviews_test.go`
  prüfen gleiche/verschiedene IPs, IPv4-mapped IPv6, Berlin-Mitternacht, Zeitraumgrenzen, Wiederkehr
  lange inaktiver IPs, unvollständige Historie, Neustart, Schlüsselwechsel, parallele Abrufe und
  verspätete Aufrufe. Der HTTP-Integrationstest prüft echte HTML-Aufrufe hinter einem konfigurierten
  Proxy und die ausschließliche Aggregatausgabe der API.
- `clientip/clientip_test.go`: unvertraute Peers ignorieren gefälschte Header, Proxyketten werden
  rechts nach links geprüft, IPv6 wird kanonisiert, ungültige/fehlende IPs bleiben unbekannt.
- Öffentliche Webseite: Typprüfung, **207 Tests**, Produktionsbuild erfolgreich.
- Redaktion: Typprüfung, **88 Tests**, Produktionsbuild erfolgreich. UI-Tests prüfen Kennzahlen,
  beide Tabellenwerte, gemeinsame Koordinaten, Tastatur-Schalter, Zustand bei Zeitraumwechsel,
  Lade-/Fehlerfälle und Datenlücken ohne Nullersatz oder Verbindung über die Lücke.
- Go- und TypeScript-Code aus OpenAPI/SQL neu erzeugt. Compose-YAML geparst und feste Caddy-IP,
  /32-Vertrauensgrenze und separates Subnetz auf Konsistenz geprüft. Docker steht lokal nicht zur
  Verfügung; ein Container-/Netzwerk-Lauf wurde daher nicht behauptet.

## Browserprüfung am gebauten Frontend mit echtem Backend

Lokaler Testserver auf `127.0.0.1:18742`, isolierte SQLite-Datei, Entwicklungs-Testkonto
`redaktion@example.test`. Keine Produktivdaten. Für die sichtbare Darstellung wurden passende
Tagesaggregate und IP-Pseudonyme als Testdaten gesetzt: am 14.11. drei Aufrufe von A, am 15.11.
je ein Aufruf von A/B. Die automatische HTTP-Prüfung deckt separat den Erfassungsweg ab.

| Ansicht | Zeiträume | Seitenbreite / Scrollbreite | Diagrammbreite | Ergebnis |
| --- | --- | --- | --- | --- |
| 320 px | 7 Tage, 30 Tage, Gesamt | 320 / 320 px | 288 px | bestanden |
| 1280 px | 7 Tage, 30 Tage, Gesamt | 1280 / 1280 px | 1120 px | bestanden |

Je Breite und Zeitraum geprüft:

1. Absolute Anzahl 5, bereinigte Anzahl 2; Tageswerte 3/1 und 2/2; Tage ohne Abrufe 0/0.
2. Checkbox beim Öffnen aktiv. Fokus auf Checkbox, Leertaste: nur die bereinigte Kurve verschwindet.
   Absolute Kurve, beide Kennzahlen und identische Tabelle bleiben sichtbar.
3. Zeitraum wechseln: Checkbox bleibt aus; erneut einschalten: zweite Kurve sichtbar.
4. Blaue durchgezogene und violette gestrichelte Kurve, beschriftete Legende, gemeinsame Achsen.
   Screenshots in Hell/Dunkel visuell geprüft. Navigation bricht bei 320 px vollständig um.
5. Zusätzlichen alten absoluten Zähler ohne Zuordnung eingefügt: „Gesamt“ zeigt absolut 13 und
   bereinigt „Nicht verfügbar“, Beginnhinweis und fehlenden Tageswert als Text. Auch dann kein
   horizontaler Seitenscroll. Keine JavaScript-Seitenfehler.

Lokale Nachweise (ignorierte Build-Ablage): `.build/browser-evidence/browser-result.json`,
`statistics-320-light.png`, `statistics-320-dark.png`, `statistics-1280-light.png`,
`statistics-1280-dark.png`, `statistics-320-history.png`.

Beim ersten Browserlauf gefundener Überlauf der Redaktionsnavigation (335 statt 320 px) wurde durch
Umbruch der Navigationslinks behoben und in allen obigen Kombinationen erneut geprüft.

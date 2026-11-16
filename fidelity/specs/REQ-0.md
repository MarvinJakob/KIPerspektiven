---
id: REQ-0
issue: keine (Grundfunktion der Plattform)
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-0 Grundfunktion

## Ziel

Die Anwendung ist nach jedem Build erreichbar. Diese Tests sind die Mindestvoraussetzung für jedes Merge und jedes Release.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-0-AC1 | `GET /api/health` antwortet mit Status 200. | `tests/REQ-0.spec.ts` |
| REQ-0-AC2 | Die Startseite `/de` lädt mit Status 200 und zeigt eine Hauptüberschrift. | `tests/REQ-0.spec.ts` |
| REQ-0-AC3 | Ein unbekannter Pfad liefert Status 404. | `tests/REQ-0.spec.ts` |

## Szenarien

### REQ-0-AC1 Healthcheck

- **Gegeben** die Anwendung läuft
- **Wenn** `GET /api/health` aufgerufen wird
- **Dann** ist der Status 200

### REQ-0-AC2 Startseite

- **Gegeben** die Anwendung läuft
- **Wenn** eine Besucherin `/de` öffnet
- **Dann** ist der Status 200 und eine Überschrift der Ebene 1 ist sichtbar

### REQ-0-AC3 Unbekannte Seite

- **Gegeben** die Anwendung läuft
- **Wenn** `/de/gibt-es-nicht-4711` aufgerufen wird
- **Dann** ist der Status 404

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Ohne laufende Anwendung schlagen alle drei Tests fehl.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander ab.
- [x] Keine Testdaten nötig.

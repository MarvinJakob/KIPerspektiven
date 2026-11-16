---
id: REQ-<Issue-Nummer>
issue: https://github.com/MarvinJakob/AIPerspectives/issues/<Issue-Nummer>
status: entwurf          # entwurf | verifiziert
geprueft_am:             # JJJJ-MM-TT, gesetzt von Team 1 nach dem Selbsttest
---

# REQ-<n> <Titel der Anforderung>

## Ziel

Wer will was erreichen und warum (ein bis zwei Sätze aus der User Story).

## Akzeptanzkriterien

Jedes Kriterium ist beobachtbar (Browser oder HTTP), eindeutig und hat genau eine Test-ID.

| ID | Kriterium | Test |
|---|---|---|
| REQ-<n>-AC1 | … | `tests/REQ-<n>.spec.ts` |
| REQ-<n>-AC2 | … | `tests/REQ-<n>.spec.ts` |

## Szenarien

### REQ-<n>-AC1 <Kurztitel>

- **Gegeben** …
- **Wenn** …
- **Dann** …

## Nicht Teil der Anforderung

- …

## Verifikation der Tests (Team 1)

- [ ] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [ ] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [ ] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt.
- [ ] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [ ] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.

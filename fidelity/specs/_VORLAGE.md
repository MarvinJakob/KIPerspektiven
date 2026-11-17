---
id: REQ-<Issue-Nummer>
issue: https://github.com/MarvinJakob/AIPerspectives/issues/<Issue-Nummer>
status: entwurf          # Team 1 prüft durch Lesen; Team 2 dokumentiert Laufzeitvalidierung am Issue
geprueft_am:             # bleibt bei Erstellung leer; keine ungeprüften Verifikationsdaten
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

## Quelltextprüfung (Team 1, ohne Testlauf)

- [ ] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [ ] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [ ] Die Tests sind für Desktop und Mobil vorgesehen und hängen nicht voneinander oder von der Reihenfolge ab.
- [ ] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.

## Laufzeitvalidierung (Team 2, Nachweis am Issue)

Team 1 führt keine Tests oder Gegenproben aus. Team 2 dokumentiert Commit, gezielten Feature-Lauf auf Desktop und Mobil, Gegenproben und Fehlerursachen am Anforderungs-Issue. Temporäre Änderungen vollständig zurücknehmen; die Spezifikationsdatei nicht dauerhaft ändern. Team 4 wertet die gesamte Suite ausschließlich im Release Gate aus.

Closes #<Ticket>

Fidelity: REQ-<n>-AC<m>

## Änderung

<!-- Was wurde geändert und warum, in zwei bis vier Sätzen. -->

## Merge-Gate-Checkliste

<!-- Alle Punkte müssen abgehakt sein, sonst schlägt der Job „Review“ fehl. Nicht zutreffende Punkte mit Begründung abhaken. -->

- [ ] Genau ein Ticket bearbeitet, Branch `<team>/<Ticket>` aus aktuellem `main`
- [ ] Unabhängiges Review durch einen frischen Reviewer (ohne Kontext der Umsetzung) durchgeführt, alle Befunde behoben oder begründet
- [ ] Lokal ausgeführt: relevante Unit-Tests und die Fidelity-Tests der Zeile `Fidelity:`
- [ ] Keine Zugangsdaten, personenbezogenen Daten oder lokalen Pfade im Diff
- [ ] Migrationen (falls vorhanden) sind additiv

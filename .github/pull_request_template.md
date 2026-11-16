Closes #<Ticket>

Fidelity: REQ-<n>-AC<m>

Implementer-Agents: <alle beteiligten Agentensitzungs-IDs, durch Komma getrennt>
Reviewer-Agent: <andere Agentensitzungs-ID, erst nach tatsächlichem Review eintragen>
Reviewed-Commit: <vollständiger Head-SHA des unabhängig geprüften Commits>

<!-- Kein Implementierer darf sein Ticket selbst reviewen. Der Reviewer dokumentiert Ergebnis,
     Befunde, Sitzungs-ID und Commit zusätzlich als PR-Kommentar. Nach Codeänderungen erneut prüfen.
     Bis zur Abnahme als Draft auf dem Board in Review zur Übernahme freigeben. -->

## Änderung

<!-- Was wurde geändert und warum, in zwei bis vier Sätzen. -->

## Merge-Gate-Checkliste

<!-- Alle Punkte müssen abgehakt sein, sonst schlägt der Job „Review“ fehl. Nicht zutreffende Punkte mit Begründung abhaken. -->

- [ ] Genau ein Ticket bearbeitet, Branch `<team>/<Ticket>` aus aktuellem `main`
- [ ] Unabhängiges Review durch einen frischen Reviewer (ohne Kontext der Umsetzung) durchgeführt, alle Befunde behoben oder begründet
- [ ] Lokal ausgeführt: relevante Unit-Tests und die Fidelity-Tests der Zeile `Fidelity:`
- [ ] Keine Zugangsdaten, personenbezogenen Daten oder lokalen Pfade im Diff
- [ ] Migrationen (falls vorhanden) sind additiv

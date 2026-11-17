Closes #<Ticket>

Fidelity: REQ-<n>-AC<m>

Implementer-Agents: <alle beteiligten Agentensitzungs-IDs, durch Komma getrennt>
Reviewer-Agent: <andere Agentensitzungs-ID, erst nach tatsächlichem Review eintragen>
Reviewed-Commit: <vollständiger Head-SHA des unabhängig geprüften Commits>
Review-ID: <GitHub-Review-ID; setzt tools/review.mjs aus der unabhängigen Sitzung>

<!-- Vorlage für Team 1 (spec/), Team 3 (fix/) und Wartung. Baseline-PRs von Team 2 (verify/) brauchen nur
     „Refs #<Anforderung>“ und einen Satz: siehe AGENTS_TESTER.md.
     Team 1: „Refs #<Anforderung>“ statt „Closes“ (bei test-defect: „Closes #<Testdefekt>“), Zeile „Fidelity:“ entfernen.
     Team 3: „Fidelity:“ nennt die IDs des Bug-Tickets; der Job Fidelity des Merge Gate prüft sie.
     Kein Implementierer reviewt sein Ticket selbst. Bis zur Abnahme bleibt der PR ein Draft mit Board-Status
     Review; die drei Review-Zeilen und den Review-Punkt trägt tools/review.mjs ein (AGENTS_REVIEWER.md). -->

## Änderung

<!-- Was wurde geändert und warum, in zwei bis vier Sätzen. -->

## Merge-Gate-Checkliste

<!-- Alle Punkte müssen abgehakt sein, sonst schlägt der Job „Review“ fehl. Nicht zutreffende Punkte mit Begründung abhaken. -->

- [ ] Genau ein Ticket bearbeitet, Branch `<team>/<Ticket>` aus aktuellem `main`
- [ ] Unabhängiges Review durch eine andere Agentensitzung (ohne Kontext der Umsetzung) durchgeführt, alle Befunde behoben oder begründet
- [ ] Lokale Prüfungen der eigenen Rolle ausgeführt (AGENTS_ANALYST.md bzw. AGENTS_FIXER.md); auf dem Draft sind Team-Grenzen, Build, Unit-Tests, Security und Fidelity grün
- [ ] Keine Zugangsdaten, personenbezogenen Daten oder lokalen Pfade im Diff
- [ ] Migrationen (falls vorhanden) sind additiv

# Team 2 – Tester

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `verify/<n>`, einzige Änderung im Repository: IDs am Ende von `fidelity/baseline.txt` anhängen.

**Ziel:** Für genau eine Anforderung feststellen, was funktioniert und was nicht, und dafür Tickets anlegen: **Feature-Tickets** für das, was funktioniert, **Bug-Tickets** für das, was nicht funktioniert. Team 2 führt dafür ausschließlich die Fidelity-Tests **seines Tickets** aus, nie die ganze Suite. Die läuft im Merge Gate und im Release Gate.

## Ablauf

1. **Auswählen:** die älteste Anforderung mit `specified`, zu der kein Folgeticket (`bug`, `test-defect`) offen ist (Warteschlange aus `bash tools/work.sh --check`, Einträge mit `guide: AGENTS_TESTER.md`). Das ist der erste Test nach der Spezifikation oder der erneute Test, nachdem alle Bugs der Anforderung behoben sind. Belegen: `bash tools/task.sh claim verify <n>`, Board `In Progress`.
2. **Tests des Tickets ausführen:** Anwendung aus dem Worktree bauen und starten (Stand `origin/main`, Commit notieren: `git rev-parse --short HEAD`), dann:
   ```bash
   cd fidelity && npm ci && npx playwright install chromium   # einmalig je Worktree
   export BASE_URL=http://localhost:$P
   npx playwright test --grep "REQ-<n>-AC" --list --reporter=json > inventory.json
   npx playwright test --grep "REQ-<n>-AC"
   node scripts/gate.mjs --inventory inventory.json --no-baseline
   ```
   Das Gate listet „Neu funktionierend“ (bestanden auf Desktop **und** Mobil) und „Funktionieren nicht“. Meldet es einen ungültigen oder unvollständigen Lauf, ist das kein fachliches Ergebnis: Ursache beheben (Server, Browser) und wiederholen. Jede fehlgeschlagene ID einmal einzeln wiederholen (`--grep "REQ-<n>-AC<m> "`). Wechselt das Ergebnis, ist der Test instabil (Schritt 5).
3. **Funktioniert nicht → Bug-Ticket:** je Fehlerursache ein Ticket nach [bug.yml](.github/ISSUE_TEMPLATE/bug.yml), nicht je ID:
   - Titel `[REQ-<n>-AC<m>] <Was funktioniert nicht>` mit der ersten betroffenen ID, Label `bug`.
   - alle betroffenen IDs, erwartetes Verhalten laut Spezifikation, tatsächliches Verhalten laut Testlauf, getesteter Commit.
   - **Schritte zum Nachstellen ohne Test** (URL, Testkonto, Aktion, sichtbares Ergebnis): Team 3 führt keine Fidelity-Tests aus.
   - Steht eine fehlschlagende ID bereits in der Baseline, ist das eine Regression: zusätzlich Label `release-blocker`.
4. **Funktioniert → Baseline und Feature-Ticket:** Bestandene IDs, die noch nicht in `fidelity/baseline.txt` stehen, dort am Ende anhängen (eine ID je Zeile). Commit `test: REQ-<n>-AC… in die Baseline aufnehmen (#<n>)`, Rebase, Push, PR **ohne Draft**:
   ```bash
   gh pr create --title "test: REQ-<n>-AC… in die Baseline aufnehmen (#<n>)" \
     --body "Refs #<n>. Bestanden auf Commit <sha>: <IDs>."
   gh pr checks <PR> --watch && gh pr merge <PR> --squash --delete-branch
   ```
   Ein Agenten-Review braucht dieser PR nicht: Der Job „Team-Grenzen“ lässt nur angehängte, gültige IDs zu, der Job „Fidelity“ weist nach, dass sie in der ganzen Suite bestehen. Schlägt „Fidelity“ für eine ID fehl, die lokal bestanden hat, ist der Test instabil: ID aus dem PR nehmen, Schritt 5.

   Nach dem Merge ein Ticket nach [feature.yml](.github/ISSUE_TEMPLATE/feature.yml) anlegen und sofort schließen: Titel `[REQ-<n>] funktioniert: <Kurzbeschreibung>`, Label `feature`, die aufgenommenen IDs, Anforderung, Commit und Baseline-PR (`gh issue close <nr> --reason completed`).
5. **Test wirkt falsch oder instabil → Testdefekt:** kein Bug-Ticket, sondern ein Ticket mit Label `test-defect`, Titel `[REQ-<n>-AC<m>] <Befund>`, mit Beobachtung und Begründung. Team 1 korrigiert den Test.
6. **Abschließen:** `bash tools/task.sh finish verify <n>` (ohne neue IDs gibt es keinen PR, das ist in Ordnung). Label und Board der Anforderung setzt der Prozessabgleich: „Bug offen“, solange Folgetickets offen sind, und `done` samt Schließen, sobald alle IDs der Spezifikation in der Baseline stehen. Bleibt die Anforderung offen, wird sie automatisch wieder frei, wenn ihr letztes Folgeticket geschlossen ist.

## Grenzen

Team 2 schreibt und ändert keine Tests, ändert keinen Anwendungscode und behebt keine Fehler. Es bewertet nur die Anforderung, die es belegt hat, und wertet keine Läufe der ganzen Suite aus: Regressionen an anderer Stelle hält das Merge Gate auf, ein fehlgeschlagenes Release Gate bearbeitet der Reviewer.

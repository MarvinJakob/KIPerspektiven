# Team 2 – Feature-Tester

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `verify/<n>`; einzige dauerhafte Dateiänderung: neue IDs am Ende von `fidelity/baseline.txt`.

**Ziel:** Einzelne Tests und Teilläufe genau eines Features ausführen, Tests validieren, Feature- und Bug-Tickets schreiben. Die gesamte Fidelity-Suite läuft ausschließlich im Release Gate und wird von Team 4 ausgewertet.

1. Älteste freie Anforderung mit `specified` und ohne offenes Folgeticket (`feature`, `bug`, `test-defect`) wählen. `claim verify <n>`, Board `In Arbeit`, Status prüfen.
2. Spezifikation und Übergabe lesen. Anwendung aus `origin/main` im Worktree mit eigenem Port/Seed starten. Commit notieren. Nur Feature `REQ-<n>` auf Desktop und Mobil ausführen:
   ```bash
   cd fidelity && npm ci && npx playwright install chromium
   export BASE_URL=http://localhost:$P
   npx playwright test --grep '\bREQ-<n>-AC[0-9]+\b' --list --reporter=json > inventory.json
   npx playwright test --grep '\bREQ-<n>-AC[0-9]+\b'
   node scripts/gate.mjs --inventory inventory.json --no-baseline
   ```
3. Neue Tests validieren: bestandene Kriterien mit vorübergehend falscher Erwartung rot sehen, Änderungen vollständig zurücknehmen. Fehlgeschlagene Tests müssen wegen fehlender/falscher Funktion scheitern; Selektorfehler oder Instabilität sind Testdefekte. Jede fehlschlagende ID gezielt wiederholen (`--grep '\bREQ-<n>-AC<m>\b'`). Ergebnisse und Gegenproben am Issue mit Commit, Befehlen und konkreter Fehlermeldung dokumentieren; keine dauerhafte Änderung an Tests oder Spezifikation.
4. Pro Fehlerursache nach Suche nach vorhandenen Tickets ein Folgeticket schreiben:
   - neue Funktion fehlt → [Feature-Ticket](.github/ISSUE_TEMPLATE/feature.yml), Label `feature`;
   - vorhandenes Verhalten ist falsch → [Bug-Ticket](.github/ISSUE_TEMPLATE/bug.yml), Label `bug`;
   - Test falsch/instabil → Label `test-defect`, konkrete Ursache und Gegenprobe.
   Titel `[REQ-<n>-AC<m>] …`, alle IDs, erwartetes/tatsächliches Verhalten, Reproduktionsschritte ohne Test, Commit und Laufnachweis. Team 3 bearbeitet alle drei Typen. Baseline-Regression zusätzlich `release-blocker`. Neue Tickets nach `Bug offen`, Status prüfen.
5. Neu bestandene IDs erst nach gültiger Ausführung und Gegenprobe an Baseline anhängen. Rebase/Push, PR `verify/<n>` mit `Refs #<n>`, Commit und Ergebnissen. Board `Merge Gate`, Status prüfen. Das Gate prüft nur dieses Feature und die neuen Baseline-IDs. Dieser rein appendierende PR braucht kein zusätzliches Agenten-Review; Scope und Funktionsnachweis werden automatisch geprüft. Nur bei grünem Gate mergen.
6. Nach Merge einen Nachweis mit Label `works` und IDs, Commit sowie Baseline-PR anlegen, sofort schließen und Board `Funktioniert` prüfen. Bereits bestehende historische Erfolgs-Tickets mit `feature` bleiben erhalten; neue offene Feature-Tickets sind Implementierungsaufträge.
7. Ergebnisse sichern, Server beenden, Zielstatus setzen/prüfen (mit offenen Folgetickets `Bug offen`, sonst `Spezifiziert`; vollständig in Baseline und ohne Folgetickets `Funktioniert`), `finish verify <n>`, entferntes `in-progress` kontrollieren. Ohne neue IDs ist kein PR nötig. Der Prozessabgleich setzt `done` und schließt erfüllte Anforderungen.

Team 2 implementiert und korrigiert keine Funktionen oder Tests. Validierung steht als Evidence am Issue; Team 1 darf deshalb seine Entwurf-Metadaten nicht selbst als verifiziert markieren.

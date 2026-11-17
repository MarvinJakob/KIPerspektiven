# Team 4 – Review und Release-Tests

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). `Team 4`, `Reviewer` und `review` bezeichnen diese Rolle.

**Ziel:** Unabhängiges Review von PRs, Ausführung/Verfolgung und Auswertung der gesamten Testsuite im Release Gate, Bug-Tickets für Team 3 und nachvollziehbarer Produktionsnachweis. Die Suite läuft in Actions, nicht lokal. Team 4 prüft auch erfolgreiche Berichte auf fachliche Fehler außerhalb der Baseline.

Eine Sitzung nimmt genau eine Review-, Anforderungs-Review- oder Release-Auswertungsaufgabe. Keine eigene Implementierung abnehmen. Bei autorisierter Wartung zur Release-Nacharbeit wird die Sitzung Implementierer; deren PR reviewed eine andere Sitzung.

## Anforderungs-Review (Anforderung in `Merge Gate`)

Eine Anforderung (`requirement` + `specified`) mit offenen Folgetickets (`feature`, `bug`, `test-defect`, Titel `[REQ-<n>-…]`) wartet in `Merge Gate`; an ihr selbst arbeitet in dieser Zeit niemand. Hat jedes offene Folgeticket einen offenen PR `fix/<m>` und steht es im Board in `Review` / `Merge Gate`, listet die Warteschlange die Anforderung als Team-4-Aufgabe (`team: review`, Phase 0, mit `followUps` und `prs`); `work.sh --watch` startet dafür automatisch eine Sitzung. Der Merker `requirement-reviewed` verhindert einen zweiten Start. Der Prozessabgleich entfernt ihn, sobald ein offenes Folgeticket ohne offenen PR hinzukommt oder kein Folgeticket mehr offen ist. Die Reviews der einzelnen Folge-PRs bleiben eigene Team-4-Aufgaben nach dem nächsten Abschnitt.

1. **Reservieren ohne Worktree:** Anhand der Metadaten prüfen, dass weder `requirement-reviewed` noch `in-progress` gesetzt ist und das Board nicht `In Arbeit` zeigt; eine laufende Prüfung anderer Sitzungen nicht übernehmen. Übernahme mit echter Sitzungs-ID im Issue kommentieren (`Requirement-Review: <Sitzungs-ID>`), Label `in-progress` setzen, Board `In Arbeit` setzen und mit `get` bestätigen. Erst danach Issue, Spezifikation, Folgetickets und PRs lesen. Kein `claim`, kein Branch, keine Dateiänderungen.
2. **Vollständigkeit prüfen** gegen den aktuellen `origin/main`:
   - Alle Akzeptanzkriterien aus `fidelity/specs/REQ-<n>.md` ermitteln. Jedes Kriterium muss in `fidelity/baseline.txt` stehen oder in der `Fidelity:`-Zeile mindestens eines offenen Folge-PRs genannt sein.
   - Für jeden Folge-PR Head-SHA notieren und den Feature-Fidelity-Job des aktuellen Laufs prüfen (`gh pr view <PR> --json body,headRefOid,isDraft`, `gh pr checks <PR>`): Die geforderten IDs müssen grün sein. Unvollständige, übersprungene oder veraltete Läufe sind kein Nachweis.
   - Folgetickets und PRs nennen Anforderung und IDs korrekt (`[REQ-<n>-AC<m>]`, `Closes #<Folgeticket>`); es gibt kein offenes Folgeticket ohne PR.
3. **Lücken zu Folgetickets machen:** Für jedes nicht abgedeckte Kriterium und jede rote oder fehlende geforderte ID ohne Ticket nach Duplikatsuche ein Folgeticket für Team 3 anlegen (`feature`, `bug` oder `test-defect`, Titel `[REQ-<n>-AC<m>] …`, IDs, erwartetes/tatsächliches Verhalten, PR und Commit), Board `Bug offen` setzen und prüfen. Befunde an einem einzelnen Folge-PR zusätzlich als PR-Kommentar festhalten; diesen PR nicht selbst korrigieren oder im Rahmen dieser Aufgabe abnehmen.
4. **Abschließen:** Ergebnis im Issue dokumentieren: geprüfter `origin/main`-Commit, Folge-PRs mit Head-SHA, Abdeckung je Kriterium (Baseline oder PR), neue Folgetickets und eigene Sitzungs-ID. Label `requirement-reviewed` setzen, Board `Merge Gate` setzen und prüfen, `in-progress` entfernen und den endgültigen Status erneut prüfen. Danach endet die Sitzung.

Nach dem Merge aller Folge-PRs schließen sich die Folgetickets; der Prozessabgleich setzt die Anforderung auf `Spezifiziert` und entfernt den Merker, Team 2 übernimmt Funktionsnachweis und Baseline. Neue Folgetickets ohne PR entfernen den Merker ebenfalls; haben auch sie einen PR im Review, folgt automatisch ein erneutes Anforderungs-Review.

## Review vor dem Merge Gate

1. Freigegebenen PR in Board `Review` / `Merge Gate` auswählen. Issue, Spezifikation, Diff und Implementierer-IDs lesen. War die eigene Sitzung beteiligt, nicht übernehmen. `resume <spec|fix|maint> <n>` im vorhandenen Worktree, Board `Review` setzen und prüfen. Keine Dateien verändern.
2. Exakten Head-SHA notieren. Korrektheit, Eingaben/Rechte/Geheimnisse, Wartbarkeit, additive Migrationen und angemessene Unit-Tests prüfen. Bei Spezifikations-PRs Vollständigkeit und Testquelltext prüfen: Team 1 behauptet keinen Laufzeitnachweis. Bei Testdefekten darf der Akzeptanzumfang nicht sinken. Wartung muss durch den Issue-Umfang gedeckt sein.
3. Die technischen Jobs des aktuellen Draft-Laufs prüfen: Scope, Build, Unit, Security, Prozessprüfungen und ausschließlich Feature-Fidelity. Reine Wartung ohne Feature-Bezug lässt Fidelity gezielt aus. Neue rote Nicht-Baseline-Kriterien sind zulässiger Backlog; erforderliche IDs, unvollständige Läufe und Testdefekte dürfen nicht als erfolgreich gelten.
4. Befunde als Review/PR-Kommentar mit Commit, eigener Sitzungs-ID und konkretem Handlungsbedarf dokumentieren. Board `In Arbeit`, Status prüfen, `pause <team> <n>`. Nicht selbst korrigieren und anschließend selbst abnehmen.
5. Ohne offene Befunde Review-Bericht speichern und aus der echten unabhängigen Sitzung ausführen:
   ```bash
   node tools/review.mjs <PR> <geprüfter SHA> <Bericht-Datei>
   gh pr ready <PR>
   gh pr checks <PR> --watch
   gh pr merge <PR> --squash --match-head-commit <geprüfter SHA> --delete-branch
   ```
   Es zählt der Gate-Lauf nach letzter Commit-, Text- und Draft-Änderung. Vor Merge Head erneut prüfen. Muss der Branch aktualisiert werden, nur die freigegebene PR-Aufgabe aktualisieren und jeden neuen Head erneut reviewen. Nie `--admin`.
6. Nach Merge Issue-Zielstatus setzen und prüfen: Fehler/Features/Testdefekte `Funktioniert`; Anforderung nach Spezifikationsmerge `Spezifiziert`. `finish <team> <n>`, entferntes `in-progress` prüfen. Prozessabgleich übernimmt `specified`, `done` und die Nachprüfung durch Team 2. Der Merge startet das Release Gate automatisch; „gemergt“ ist noch kein Produktionsnachweis.

Baseline-PRs von Team 2 brauchen kein zusätzliches Agenten-Review: Scope und Feature-Gate weisen die ausschließlich angehängten IDs nach.

## Release Gate

[release.yml](.github/workflows/release.yml) startet nach Merge/Push auf `main`: einmaliger CI-Build und parallele Unit-Tests, vollständige Fidelity-Suite, Final Check, Snapshot, Übertragung des geprüften Images, Produktions-Smoke-Test und erst danach Release-Branch/Veröffentlichung. Kein weiterer Workflow führt die gesamte Fidelity-Suite aus.

1. Aufgabe `release-failure` oder `release-review` wählen (Warteschlange: `AGENTS_REVIEWER.md`), `claim maint <n>`, Board `In Arbeit`, Status prüfen. Die Release-Nacharbeit erstellt nach fehlgeschlagenem Lauf ein Fehler-Auswertungsticket und nach erfolgreichem Lauf ein Bericht-Auswertungsticket. Ohne Ticket beim Auftrag `Team 4` den letzten noch ungeprüften Release-Lauf als Auswertungs-Issue erfassen und reservieren; ohne offene Arbeit melden und enden.
2. **Exakten Lauf und Commit zuordnen**, nicht pauschal den jüngsten grünen Lauf verwenden:
   ```bash
   gh run list -w release.yml -b main -L 20 --json databaseId,headSha,status,conclusion
   gh run view <Lauf> --json jobs
   gh run download <Lauf> -n fidelity-release -D .build/release-report
   node fidelity/scripts/gate.mjs --results .build/release-report/results.json --inventory .build/release-report/inventory.json
   ```
   Das Artefakt `release-metadata` nennt den tatsächlich getesteten Commit; bei manuell gewähltem `ref` reicht `run.head_sha` nicht. Für ältere Commits die zugehörige Baseline aus dem getesteten Commit verwenden; nie eine heutige Baseline auf einen alten Lauf anwenden. Bericht, Inventar, globale Fehler, Baseline-Regressionen und Nicht-Baseline-Fehler auswerten. Auch ein grünes Gate kann fachlichen Backlog enthalten.
3. **Befunde zu Tickets machen**, vorher Duplikate nach IDs/Ursache suchen:
   - Regression oder fehlerhaftes vorhandenes Verhalten → `bug`, Baseline-Regression zusätzlich `release-blocker`.
   - Neue Funktion fehlt → `feature` an Team 3.
   - Test selbst falsch/instabil → `test-defect` an Team 3; betrifft er die Baseline, zusätzlich `release-blocker`.
   - Build-/Unit-Fehler → Bug mit Release-Blocker; Prozess-/Infrastrukturfehler → Wartungsauftrag.
   Alle betroffenen IDs, erwartetes/tatsächliches Verhalten, Reproduktionsschritte, Commit und Lauf angeben. Keine erfundenen Fidelity-IDs für reine Unit-/Infrastrukturfehler: zugehöriges Verhalten identifizieren oder ausdrücklich autorisierte Wartung verwenden. Neue Tickets nach `Bug offen`, Status prüfen.
4. **Diagnose:** Runner-/Netzfehler höchstens einmal nach Ursachenprüfung erneut ausführen. Für Stabilitätsprüfung denselben Commit im Release Gate ohne Deployment testen:
   ```bash
   gh workflow run release.yml -f ref=<getesteter main-Commit> -F tests-only=true
   ```
   Diagnose-/übersprungene Läufe ohne erfolgreichen Veröffentlichungsjob sind kein Produktionsnachweis. Gates oder Baseline niemals zur Freigabe abschwächen.
5. **Produktionsfehler:** Logs zur Wiederherstellung der vorherigen Version prüfen. Ohne Vorgänger oder bei fehlgeschlagener Rückkehr sofort konkreten Blocker an den Maintainer. Zugang lesend über `deploy-access.yml` prüfen, Secret-Werte nie auslesen. Manueller Rollback nur auf ausdrücklichen Auftrag. Korrekturen am Workflow nur im autorisierten Wartungsumfang und mit Review einer anderen Sitzung.
6. **Abschließen:** Lauf, Commit, Ergebnis und verknüpfte Folgetickets am Auswertungs-Issue dokumentieren. Ein `release-review`-Ticket ist mit vollständiger Auswertung/Übergabe erledigt, auch bei noch offenen fachlichen Folgetickets. Ein `release-failure`-Ticket erst nach behobener Ursache und erfolgreichem produktivem Lauf schließen; bis dahin gesichert mit `pause` übergeben. Bei Abschluss Board `Funktioniert`, prüfen, `finish maint <n>`, entferntes `in-progress` prüfen.

Veröffentlichung gilt nur als nachgewiesen, wenn Deployment, Produktions-Smoke-Test und Veröffentlichungsjob erfolgreich sind und Release-Commit/Image zum Lauf passen. Bei zusammengefassten wartenden Releases darf ein neuerer erfolgreicher Commit den eigenen Merge enthalten; Abstammung belegen. Produktionszustand nach manuellem Rollback zusätzlich über den lesenden Zugangs-/Statusworkflow prüfen; der historische Branch `release` allein reicht nicht.

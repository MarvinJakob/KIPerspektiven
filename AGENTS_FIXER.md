# Team 3 – Fixer

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `fix/<n>`, Änderungen nur in `app/`.

**Ziel:** Genau ein Bug-Ticket je Agent beheben. Team 3 arbeitet nach Bug-Ticket und Spezifikation. Fidelity-Tests führt es **nicht** aus und ändert sie nie: Ob der Fehler behoben ist, prüft der Job „Fidelity“ des Merge Gate, ob die Anforderung danach funktioniert, stellt Team 2 fest.

## Ablauf

1. **Auswählen:** zuerst `release-blocker`, dann das älteste Bug-Ticket (Warteschlange aus `bash tools/work.sh --check`, Einträge mit `guide: AGENTS_FIXER.md`). Belegen: `bash tools/task.sh claim fix <n>`, Board `In Progress`.
2. **Verstehen und nachstellen:** Bug-Ticket und die dort genannten Kriterien in `fidelity/specs/REQ-<r>.md` lesen. Anwendung im Worktree starten und das Verhalten mit den Schritten des Tickets von Hand nachstellen (Browser oder `curl`). Den Test in `fidelity/tests/` nur lesen, wenn die Erwartung sonst unklar bleibt.
   - Tritt der Fehler auf dem aktuellen Stand nicht mehr auf: Beobachtung und Commit kommentieren, Ticket schließen, `finish`. Team 2 testet die Anforderung erneut, sobald kein Folgeticket mehr offen ist.
   - Passt der Test nicht zur Anforderung oder ist er instabil: `node tools/test-defect.mjs <Bug-Ticket> <Befund-Datei>` legt ein freies `test-defect`-Ticket für Team 1 an und setzt am Bug `waiting-for-test`. Zwischenstand übergeben (`pause`). Der Prozessabgleich gibt den Bug nach der Testkorrektur wieder frei.
3. **Beheben:** so klein wie möglich, nach den Konventionen in [app/README.md](app/README.md). Schnittstellenänderungen beginnen in `app/api/openapi.yaml`, Migrationen nur additiv. Geänderte Logik bekommt Unit-Tests. Die Ursache beheben, nicht den Test bedienen: Sonderfälle nur für Testdaten sind ein Review-Befund.
4. **Lokal prüfen** (nur das, was das Merge Gate nicht schneller oder besser prüft):
   - die Unit-Tests der geänderten Pakete und die Typprüfung des geänderten Frontends,
   - das im Ticket beschriebene Verhalten von Hand: Jetzt tritt das erwartete Ergebnis ein, auf schmalem und breitem Viewport, wenn die Oberfläche betroffen ist.

   Nicht lokal: Fidelity-Tests, vollständige Unit-Test-Läufe aller Teile, Security-Scans.
5. **Draft-PR:** Rebase auf `origin/main`, Push, Draft nach [Vorlage](.github/pull_request_template.md) mit `gh pr create --draft --body-file …`:
   - `Closes #<n>`,
   - `Fidelity: <alle Test-IDs des Bug-Tickets>`,
   - `Implementer-Agents: <alle beteiligten Sitzungs-IDs>`.

   `fidelity/baseline.txt` bleibt unverändert; die IDs nimmt Team 2 nach seinem erneuten Test auf.
6. **Merge Gate als Test:** `gh pr checks <PR> --watch`. Auf dem Draft müssen Team-Grenzen, Build, Unit-Tests, Security und Fidelity grün sein; „Review“ und der Abschlussjob bleiben bis zur Abnahme rot. Ist „Fidelity“ rot, nennt die Zusammenfassung des Jobs je geforderter ID `bestanden`, `fehlgeschlagen` oder `fehlt` sowie Regressionen der Baseline:
   ```bash
   gh run view <Lauf> --log-failed                              # Auswertung und Fehlermeldungen
   gh run download <Lauf> -n fidelity-report -D .build/report   # Bericht mit Trace und Screenshots
   ```
   Im selben Branch beheben und pushen, bis die Jobs grün sind. Eine Regression der Baseline ist ein eigener Fehler dieser Änderung und wird hier behoben.
7. **Übergeben an das Review:** Board `Review`, am PR Commit, Prüfergebnisse und Implementierer-IDs festhalten, `bash tools/task.sh pause fix <n>` (AGENTS.md, „Übergabe und Wiederaufnahme“), nächste Aufgabe. Der Reviewer nimmt ab, mergt und schließt die Aufgabe ab; mit dem Merge schließt `Closes` das Bug-Ticket. Kommt das Ticket mit Befunden nach `In Progress` zurück, übernimmt ein Implementierer mit `resume`, behebt sie und übergibt erneut. Jeder neue Commit braucht ein neues Review.

## Grenzen

Team 3 ändert nichts außerhalb von `app/`: keine Tests, keine Spezifikationen, keine Baseline, keine Workflows oder Werkzeuge. Es legt keine Feature-Tickets an und erklärt keine Anforderung für erfüllt. Ein Implementierer reviewt sein Ticket nie selbst.

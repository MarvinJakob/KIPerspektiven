# Team 1 – Analyst

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `spec/<n>`, Änderungen nur in `fidelity/specs/` und `fidelity/tests/`.

**Ziel:** Für jede Anforderung Akzeptanzkriterien und Fidelity-Tests, die zuverlässig zeigen, ob die Anforderung **vollständig** umgesetzt ist. Nur Team 1 schreibt und ändert Fidelity-Tests. Ob die Anwendung sie besteht, bewertet Team 2.

## Ablauf

1. **Auswählen:** zuerst `test-defect`, dann die älteste Anforderung mit `needs-analysis` (Warteschlange aus `bash tools/work.sh --check`, Einträge mit `guide: AGENTS_ANALYST.md`). Belegen: `bash tools/task.sh claim spec <n>`, Board `In Progress`. `<n>` ist die Nummer des Tickets, das bearbeitet wird.
2. **Analysieren:** Ticket lesen. Jede fachliche Aussage wird ein Akzeptanzkriterium oder steht ausdrücklich unter „Nicht Teil der Anforderung“. Widersprüche oder fehlende Entscheidungen sind ein Blocker (AGENTS.md, Regel 6).
3. **Spezifizieren:** `fidelity/specs/REQ-<n>.md` nach [fidelity/specs/_VORLAGE.md](fidelity/specs/_VORLAGE.md). IDs `REQ-<n>-AC<m>`, fortlaufend, nie wiederverwendet. Kriterien SMART und von außen beobachtbar (sichtbarer Text, URL, Statuscode, API-Antwort). Jedes Szenario so beschreiben, dass Team 2 daraus ein Bug-Ticket ableiten und Team 3 das Verhalten ohne den Test nachstellen kann.
4. **Tests schreiben:** `fidelity/tests/REQ-<n>.spec.ts`, genau ein Playwright-Test je Kriterium, Titel beginnt mit der ID. Nur über Browser oder HTTP prüfen, Elemente über Rolle und sichtbaren Text finden (`getByRole`, `getByText`), keine CSS-Klassen oder internen Aufrufe. Testdaten nur aus `DEV_SEED` oder im Test angelegt. Tests unabhängig voneinander, auf Desktop und Mobil, ohne `skip`, `fixme` oder erwartete Fehlschläge.
5. **Verifizieren** (Pflicht, Ergebnis in der Checkliste der Spezifikation): Anwendung aus dem Worktree starten (Stand `origin/main`) und **nur die Tests dieses Tickets** ausführen:
   ```bash
   cd fidelity && npm ci && npx playwright install chromium   # einmalig je Worktree
   npm run typecheck
   BASE_URL=http://localhost:$P npx playwright test --grep "REQ-<n>-AC"
   ```
   - Bestandener Test: Gegenprobe – Erwartung kurz verfälschen, Test muss rot werden, Änderung zurücknehmen.
   - Fehlgeschlagener Test: Er muss aus dem richtigen Grund scheitern (Funktion fehlt), nicht wegen Tippfehler, falschem Selektor oder Zeitüberschreitung.
   - Stabilität: Zwei Läufe liefern dasselbe Ergebnis.
   - Vollständigkeit: Jede Aussage des Tickets ist durch ein Kriterium abgedeckt.

   Danach `status: verifiziert` und Datum in der Spezifikation. Dieser Lauf prüft die Tests, nicht die Anwendung: keine Bug-Tickets, keine Baseline.
6. **Draft-PR:** Rebase auf `origin/main`, Push, Draft nach [Vorlage](.github/pull_request_template.md): `Refs #<n>` (nicht `Closes`), ohne Zeile `Fidelity:`, mit `Implementer-Agents:`. Jobs abwarten (`gh pr checks <PR> --watch`): Bis auf „Review“ muss alles grün sein. Der Job „Fidelity“ führt die ganze Suite aus und lehnt ungültige Testtitel, doppelte IDs und unvollständige Läufe ab; neue fehlschlagende Tests außerhalb der Baseline sind erlaubt.
7. **Übergeben an das Review:** Board `Review`, Übergabe am PR dokumentieren, `bash tools/task.sh pause spec <n>` (AGENTS.md, „Übergabe und Wiederaufnahme“). Der Reviewer nimmt ab, mergt und schließt die Aufgabe ab. Nach dem Merge setzt der Prozessabgleich `needs-analysis` → `specified`; damit ist die Anforderung für Team 2 frei.

## Testdefekt (`test-defect`)

Ein Ticket von Team 2 oder Team 3, dass ein Test falsch oder instabil ist.

- Test bzw. Spezifikation korrigieren, wie oben verifizieren, PR mit `Closes #<Testdefekt>`. Mit dem Schließen gibt der Prozessabgleich wartende Bug-Tickets (`waiting-for-test`) frei, und Team 2 testet die Anforderung erneut.
- Ändert sich die fachliche Aussage eines Kriteriums, bekommt es eine neue ID. Die alte ID entfernt nur der Maintainer aus der Baseline.
- Ist der Test nach Prüfung richtig: Begründung und offene Entscheidung als Blocker ans Ticket (Regel 6). Nicht still schließen.

## Grenzen

Team 1 ändert nie Anwendungscode und nie die Baseline, legt keine Bug- oder Feature-Tickets an und führt nicht die ganze Suite aus.

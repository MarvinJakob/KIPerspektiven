# Team 3 – Implementierer

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `fix/<n>`; Anwendungscode unter `app/`. Bei verknüpftem Issue mit `test-defect` zusätzlich betroffene Fidelity-Tests und nötige Spezifikationskorrekturen.

**Ziel:** Genau einen Implementierungsauftrag bearbeiten: fehlende Features umsetzen, Bugs oder Testdefekte beheben. Team 2 stellt anschließend den Funktionsnachweis fest.

1. Freies Ticket wählen: zuerst `release-blocker`, dann `test-defect`, danach ältestes `bug` oder `feature`. `claim fix <n>`, Board `In Arbeit`, Status prüfen.
2. Issue, Spezifikation und betroffenen Test lesen. Fehler/fehlende Funktion mit Ticket-Schritten nachstellen; gezielte Fidelity-Tests bei Bedarf ausführen, nie die gesamte Suite. Ein grüner Einzellauf widerlegt keinen Testdefekt. Bereits nachweislich behoben: Commit und gezielten Nachweis dokumentieren, schließen, Board `Funktioniert`, `finish`.
3. Implementieren nach [app/README.md](app/README.md), so klein wie möglich. Schnittstellen zuerst in `app/api/openapi.yaml`, Migrationen nur additiv, geänderte Logik mit Unit-Tests.
4. Bei Testdefekt: Ursache reproduzieren (auch falsche positive Ergebnisse/Instabilität), betroffenen Test und nötige Spezifikationsdokumentation korrigieren. Kein Abschwächen, Skip oder Entfernen von Baseline-IDs. Deckt ein korrekter Test eine fehlende Funktion auf, eigenes Feature-/Bug-Ticket anlegen. Nicht bestandene IDs nie als Pflicht-Erfolg deklarieren. Eine korrigierte Baseline-ID muss vor Merge wieder bestehen; nötige fachliche Entscheidung als Blocker melden.
5. Liegt ein Testdefekt außerhalb des eigenen Implementierungsauftrags, `node tools/test-defect.mjs <Ticket> <Befund-Datei>` verwenden. Das getrennte Ticket ist für einen anderen Worker von Team 3 frei; eigenen Stand mit `waiting-for-test` sichern und `pause`. Nach Korrektur gibt der Prozessabgleich die Implementierung frei. Fremde Branches nie verändern.
6. Relevante Unit-Tests/Typprüfung und betroffenes Verhalten prüfen. Optional gezielte Feature-Tests mit Inventar; keine vollständigen Fidelity-, Unit- oder Security-Läufe lokal doppeln. Baseline unverändert lassen.
7. Rebase, Push, Draft-PR nach Vorlage: `Closes #<n>`, `Fidelity: <erfüllte Ticket-IDs>`, echte Implementierer-IDs. Bei reinem Testdefekt können neue Kriterien noch fachlich rot sein; Pflicht sind ausgewählte Baseline-IDs, keine falsche Erfolgsbehauptung. Gate führt ausschließlich betroffene Features aus.
8. Bis auf Review/Abschlussjob müssen Scope, Build, Unit, Security, Prozessprüfungen und Feature-Fidelity grün sein. Fehler im selben Branch beheben. Dann Board `Review`, Status prüfen, Befunde/Nachweise dokumentieren, Server beenden, `pause fix <n>`. Team 4 reviewed und merged; jeder neue Commit braucht erneutes Review. Prozessabgleich gibt die Anforderung an Team 2 zurück, sobald keine Folgetickets offen sind.

Team 3 ändert keine Baseline, Gate-Skripte, Workflows oder zentralen Prozessdateien. Ein Implementierer nimmt seine eigene Arbeit nie ab.

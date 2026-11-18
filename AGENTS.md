# Entwicklungsprozess für KI Perspektiven

Repository: `MarvinJakob/KIPerspektiven` · [Projektboard „KI Perspektiven“](https://github.com/users/MarvinJakob/projects/4)

Bei einem Umsetzungsauftrag verantwortet ein Agent die Anforderung von der Klärung über Implementierung, Pull Request und Fehlerbehebung bis zum Merge und zum Nachweis der erfolgreichen Produktionsauslieferung. Bei einem ausdrücklich auf Beratung, Review, Spezifikation oder Dokumentation begrenzten Auftrag endet die Arbeit mit dem angeforderten Ergebnis.

## GitHub-Zugriff über die CLI

- Die Umgebungsvariable `GH_TOKEN` ist gesetzt und wird von `gh` vorrangig gegenüber der Anmeldung im Windows-Schlüsselspeicher verwendet. Den vorhandenen Token verwenden; Tokenwerte niemals ausgeben oder in Dateien beziehungsweise Commits übernehmen.
- Geprüfter Stand vom 17.11.2026: Anmeldung als `MarvinJakob`, Admin-Zugriff auf `MarvinJakob/KIPerspektiven` und Zugriff auf das Projektboard über `gh api graphql` funktionieren mit `GH_TOKEN`.
- Der Komfortbefehl `gh project` scheitert in dieser Umgebung mit `unknown owner type`. Das bedeutet nicht, dass der Projektzugriff fehlt. Projektboard-Abfragen und Statusänderungen bei diesem Fehler direkt über `gh api graphql` durchführen und die gespeicherten Änderungen anschließend erneut abfragen.
- `gh auth status` meldet für den aktuellen Token die Scopes `project`, `repo` und `workflow` sowie den fehlenden Scope `read:org`. Der direkte GraphQL-Zugriff auf das persönliche Projektboard funktioniert dennoch. Deshalb nicht allein aufgrund dieser Meldung neue Zugangsdaten verlangen oder auf Browserbedienung ausweichen.
- SSH-Schlüssel dienen Git-Operationen wie Fetch und Push; Issues und Projektboards werden über die API-Anmeldung verwaltet.

Beispiel für eine lesende Verbindungsprüfung in PowerShell:

```powershell
gh api user --jq .login
gh api graphql -f query='query { user(login: "MarvinJakob") { projectV2(number: 4) { id title } } }'
```

## Board und Zustände

Das Feld **Status** bildet die Prozessspalten ab. Der Agent aktualisiert den Status bei jedem Übergang und prüft anschließend die gespeicherte Zuordnung. Labels ergänzen Typ und Suchbarkeit; sie ersetzen den Boardstatus nicht.

Der **Assignee** zeigt, wer das Ticket bearbeitet. Vor der ersten inhaltlichen Änderung am Ticket, am Branch oder an Tests prüft der Agent die Zuweisung und vorhandene Hinweise auf laufende Arbeit. Ist das Ticket frei, trägt er sich als Assignee ein und liest die gespeicherte Zuweisung zurück. Nutzen mehrere Sitzungen dasselbe GitHub-Konto, kennzeichnet er die Übernahme im Ticket mit dem zugehörigen Branch und einem eindeutigen Sitzungsvermerk. Bei konkurrierender Belegung klärt er die Zuständigkeit vor der Bearbeitung. Während der Spezifikation bleibt die Anforderung im **Backlog**. Ein Umsetzungsauftrag behält denselben Bearbeiter bis zum erfolgreichen Deployment. Nur bei einem ausdrücklich auf Spezifikation begrenzten Auftrag verlinkt der Agent nach **Spezifiziert** den Branch und den Test-Commit, dokumentiert den Übergabestand und gibt seine Zuweisung frei.

| Spalte | Bedeutung und Übergangsbedingung |
|---|---|
| **Backlog** | Eingang für Anforderungen. Ziel, Mehrwert, Umfang und klare Akzeptanzkriterien sind beschrieben. |
| **Spezifiziert** | Spezifikation, eindeutige Akzeptanzkriterien und zugeordnete, geschriebene Tests sind gegen die Originalanforderung geprüft und gesichert. Die Anforderung ist bereit zur Implementierung. |
| **In Arbeit** | Ein Agent hat das Ticket übernommen und implementiert die spezifizierte Anforderung oder behebt den Bug. |
| **Merge Gate** | Die Implementierung liegt als Pull Request vor. Das Merge Gate führt die vom PR betroffenen Tests aus. Der Agent bearbeitet Findings und mergt nach grünem Pflichtcheck. |
| **Release Gate** | Der PR ist nach `main` gemergt. Das Release Gate prüft den Stand auf `main` mit der vollständigen Testsuite und installiert ihn anschließend in Produktion. Der Agent begleitet den Lauf bis zum Produktionsnachweis. |
| **Bug offen** | Ein reproduzierbarer Fehler wurde festgestellt. Das Bug-Ticket enthält Nachweise und wartet auf seine Behebung. |
| **Funktioniert** | Alle Akzeptanzkriterien sind mit Nachweisen für den geprüften Commit erfüllt, die Pflichtprüfungen bestanden und der betreffende Stand ist nachweislich erfolgreich in Produktion. Erst jetzt wird das Ticket abgeschlossen. |

Normaler Ablauf: **Backlog → Spezifiziert → In Arbeit → Merge Gate → Release Gate → Funktioniert**.

Fehlerbehebung: **Bug offen → In Arbeit → Merge Gate → Release Gate → Funktioniert**. Die zugehörige Anforderung bleibt offen, bis auch ihre relevanten Bugs behoben und ausgeliefert sind. Scheitert das Merge Gate, bleibt das Umsetzungsticket in **Merge Gate**; scheitert das Release Gate, bleibt es in **Release Gate**. Für die Untersuchung des Befunds gilt Abschnitt 6. Änderungen am fachlichen Umfang erfordern zunächst angepasste Kriterien und eine aktualisierte Spezifikation.

## 1. Gute Anforderungen im Backlog

Eine Anforderung beschreibt ein überprüfbares Ergebnis aus Sicht der Zielgruppe. Sie muss unabhängig verständlich und klein genug für eine zusammenhängende Umsetzung sein. Große Vorhaben werden in einzeln nutzbare Anforderungen zerlegt.

Jede Anforderung enthält:

- **Titel:** kurz, konkret und auf das gewünschte Verhalten bezogen.
- **Ausgangslage:** welches Problem heute besteht und wen es betrifft.
- **Ziel und Mehrwert:** was Nutzer erreichen sollen und welchen konkreten Nutzen das bringt, beispielsweise als User Story: „Als <Rolle> möchte ich <Ziel>, damit <Mehrwert>.“
- **Umfang und Abgrenzung:** betroffene Abläufe, Seiten oder Schnittstellen sowie ausdrücklich ausgeschlossene Inhalte.
- **Akzeptanzkriterien:** verbindliche, nummerierte und eindeutig prüfbare Bedingungen. Kriterien sind bereits im Backlog Pflicht, nicht optional.
- **Quellen und Abhängigkeiten:** maßgebliche Texte, Entwürfe, Schnittstellen, notwendige Vorarbeiten und bekannte Einschränkungen. Offene fachliche Entscheidungen sind sichtbar vermerkt.

Akzeptanzkriterien beschreiben beobachtbares Verhalten statt Implementierungsdetails. Jedes Kriterium nennt Voraussetzung, Aktion und erwartetes Ergebnis, vorzugsweise als **Gegeben / Wenn / Dann**. Neben dem Erfolgsfall gehören relevante Fehlerfälle, Berechtigungen, leere Zustände und Grenzfälle dazu; Sprachen, Desktop, Mobil und Barrierefreiheit werden berücksichtigt, soweit sie betroffen sind. Formulierungen wie „schnell“, „intuitiv“ oder „funktioniert korrekt“ genügen ohne konkrete Prüfvorgabe nicht.

Beispiel:

> **Ziel:** Besucher sollen eine Nachricht absenden können, damit sie eine Beratung anfragen können.
>
> **AC1:** Gegeben ist ein vollständig und gültig ausgefülltes Kontaktformular. Wenn der Besucher absendet und die Speicherung erfolgreich ist, erscheint eine sichtbare Erfolgsbestätigung und die Nachricht ist im geschützten Nachrichteneingang vorhanden.
>
> **AC2:** Gegeben ist eine ungültige E-Mail-Adresse. Wenn der Besucher absendet, erscheint am E-Mail-Feld ein verständlicher Fehler; es wird keine Nachricht gespeichert und die übrigen Eingaben bleiben erhalten.

Der Agent präzisiert unklare Anforderungen vor der Umsetzung anhand vorhandener Quellen. Fehlt eine fachlich notwendige Entscheidung, dokumentiert er die konkrete offene Frage im Ticket und meldet sie dem Auftraggeber; er erfindet keine Geschäftsregeln und arbeitet währenddessen an unabhängigen Schritten weiter.

## 2. Gute Tests

Erstelle für jede neue oder geänderte Anforderung sowohl Unit-Tests als auch Fidelity-Tests. Leite beide aus den Akzeptanzkriterien ab.

- **Unit-Tests** prüfen einzelne Regeln oder Berechnungen isoliert. Wähle kleine Eingaben mit bekannten Sollwerten und decke relevante Varianten und Grenzwerte auf dieser schnellen Ebene ab.
- **Fidelity-Tests** prüfen über die für das jeweilige Kriterium maßgebliche Schnittstelle, ob die Anwendung das zugesicherte Ergebnis liefert. Prüfe dabei auch fachlich relevante Zustandsänderungen.

1. **Das Soll vor der Implementierung festlegen.** Leite Testfälle und konkrete Erwartungswerte aus der Anforderung, ihren verbindlichen Quellen und Beispielen ab. Ordne sie der jeweiligen Kriterien-ID zu. Berechne Sollwerte unabhängig vom Anwendungscode. Kläre fachliche Lücken gemäß Abschnitt 1, bevor du eine Annahme als Erwartung festschreibst.
2. **Eine konkrete Abweichung erkennbar machen.** Beschreibe mit minimalen Daten die Ausgangslage, führe die Aktion über die relevante Schnittstelle aus und prüfe das beobachtbare Ergebnis samt zugesicherten Seiteneffekten. Frage bei der Durchsicht jedes Tests: „Welche plausible Fehlumsetzung würde dieser Test erkennen?“ Wähle Daten, die korrektes und fehlerhaftes Verhalten unterscheidbar machen. Berücksichtige relevante Fehlerfälle, Berechtigungen, leere Zustände und Grenzwerte. Testname, Kriterien-ID und Fehlermeldung sollen die verletzte Zusage erkennen lassen.
3. **Fidelity-Tests auf der schnellsten aussagekräftigen Ebene ausführen.** Prüfe beispielsweise eine Feldmeldung im Komponententest und die Speicherung über die API mit einer Testdatenbank. Nutze einen Browsertest mit echtem Backend, wenn das Kriterium das Zusammenspiel von Oberfläche und Backend verlangt. Ersetze nur Abhängigkeiten außerhalb des geprüften Verhaltens durch Testdoubles. Wähle für den übergreifenden Ablauf repräsentative Fälle. Wiederhole dort weitere Varianten nur, wenn sie einen zusätzlichen Fehler aufdecken können.
4. **Die Durchlaufzeit messen und gezielt verkürzen.** Halte Testdaten klein, verwende aufwendige Testumgebungen wieder und isoliere veränderliche Daten pro Test. So können unabhängige Tests parallel laufen. Kontrolliere Zeit, Zufall und externe Dienste. Warte bei asynchronen Vorgängen auf ein beobachtbares Ereignis mit begründetem Zeitlimit. Miss die Laufzeit je Suite und optimiere zuerst die teuersten Schritte unter Erhalt der Kriterienabdeckung. Untersuche sporadische Fehlschläge auch dann, wenn ein Wiederholungslauf erfolgreich ist.
5. **Gezielt entwickeln, vollständig freigeben.** Führe während der Umsetzung die betroffenen Tests aus. Vor dem Merge müssen die zugehörigen Unit- und Fidelity-Tests sowie sämtliche weiteren Pflichtprüfungen für den aktuellen PR-Stand erfolgreich sein.

**Beispiel zum Kontaktformular aus Abschnitt 1.** Ein Unit-Test prüft die Validierungsregel für AC2 mit der Eingabe `anna.example.org` und erwartet die Einstufung als ungültig. Der Fidelity-Test sendet das Formular mit dieser Adresse ab. Er prüft die Fehlermeldung am E-Mail-Feld, den Erhalt der übrigen Eingaben und dass im Eingang keine Nachricht aus diesem Versuch erscheint. Für AC1 sendet ein Fidelity-Test eine gültige, eindeutig erkennbare Nachricht, prüft die sichtbare Bestätigung und liest die Nachricht im geschützten Eingang wieder aus.

## 3. Anforderungen spezifizieren

Die Spezifikation folgt dem Prinzip anforderungsbasierter Akzeptanztests vor der Implementierung (ATDD). Maßgeblich sind die Originalanforderung und ihre verbindlichen Quellen und Beispiele.

1. Die Originalanforderung und ihre Quellen vollständig lesen. Jede fachliche Aussage einem Akzeptanzkriterium oder einer ausdrücklich dokumentierten Abgrenzung zuordnen; keine Aussage stillschweigend auslassen.
2. Die Spezifikation im Ticket ergänzen. Kriterien erhalten stabile IDs `REQ-<n>-AC<m>`; IDs werden nicht für andere Aussagen wiederverwendet. Ziel und Mehrwert aus dem Ticket erhalten.
3. Die Spezifikation auf Vollständigkeit und eindeutige Akzeptanzkriterien prüfen und sichern.
4. Vor der Implementierung sowohl Unit-Tests als auch Fidelity-Tests nach Abschnitt 2 schreiben und den Kriterien-IDs eindeutig zuordnen. Erwartete Ergebnisse aus der Originalanforderung und ihren Quellen und Beispielen ableiten; vorhandener oder später erzeugter Anwendungscode ist keine fachliche Sollvorgabe. Vorhandene geeignete Tests wiederverwenden oder erweitern. Falls ein Kriterium nicht sinnvoll automatisierbar ist, bereits hier die Begründung und eine reproduzierbare manuelle Prüfung mit erwartetem Ergebnis festlegen. Dafür bereits den isolierten Branch beziehungsweise Worktree gemäß Abschnitt 4 verwenden. Tests versionieren und im Ticket verlinken.
5. In einem gesonderten Prüfschritt die Kriterien und Testfälle nochmals direkt mit der Originalanforderung abgleichen. Gezielt nach ausgelassenen Aussagen, falschen oder unbelegten Annahmen sowie fehlenden Fehler- und Grenzfällen suchen. Jede fachliche Aussage muss durch einen geeigneten Test abgedeckt oder ausdrücklich abgegrenzt sein. Fachlich notwendige offene Entscheidungen gemäß Abschnitt 1 klären.
6. Die Tests ausführen und Testbefehl, Ergebnis, geprüften Commit sowie Laufzeit im Ticket dokumentieren. Vor der Implementierung dürfen Tests wegen des noch fehlenden Verhaltens fehlschlagen; diese erwarteten Fehlschläge konkret den Kriterien zuordnen. Für diesen erwarteten Fehlschlag genügt der Eintrag am Kriterium. Bleibt die Abweichung nach der Umsetzung im Gate bestehen, gilt Abschnitt 6. Fehler im Testaufbau vorher beheben. Erst wenn Spezifikation und Tests gegen die Originalanforderung geprüft und gesichert sind, das Ticket nach **Spezifiziert** verschieben.

## 4. Umsetzung in In Arbeit

1. Vor Beginn der Implementierung das bereits übernommene Ticket von **Spezifiziert** nach **In Arbeit** verschieben. Für Bug-Tickets erfolgt dieser Übergang aus **Bug offen**.
2. In einem isolierten Branch beziehungsweise Worktree aus aktuellem `origin/main` arbeiten; für neue Branches `codex/<ticket>-<kurzname>` verwenden. Den bereits für die Spezifikation angelegten Branch beziehungsweise Worktree unter Erhalt der vorab geschriebenen Tests weiterverwenden, sofern er für das Ticket verfügbar ist. Änderungen im Hauptarbeitsverzeichnis anderer Sitzungen nicht überschreiben.
3. Die Anforderung anhand ihrer Spezifikation und Akzeptanzkriterien implementieren. Architektur und Anwendungskonventionen aus `ARCHITECTURE.md` und `app/README.md` beachten. Schnittstellenänderungen in `app/api/openapi.yaml` beginnen, Datenbankmigrationen additiv gestalten.
4. Die Implementierung mit den vorab geschriebenen Tests automatisiert prüfen. Erwartete Fehlschläge müssen durch die Umsetzung des geforderten Verhaltens behoben werden. Änderungen an Sollwerten oder Akzeptanzkriterien benötigen eine fachliche Begründung aus der Originalanforderung oder eine dokumentierte Anpassung des Umfangs; Tests nicht an fehlerhaftes Verhalten anpassen.
5. Das Anforderungsticket ist der verbindliche Ort für die Kriteriennachweise. Die in der Spezifikation begonnene Zuordnung dort fortführen: **Quellaussage → Kriterien-ID → Testfall und Testebene → Ergebnis für den geprüften Commit**. Je Nachweis Testbefehl oder manuelle Prüfschritte, Commit-SHA, Ergebnis, Laufzeit und Link zum Testbericht oder Prüfprotokoll angeben. Übersprungene und ausstehende Kriterien als **nicht geprüft** kennzeichnen und offenhalten.
6. Implementierung, Kriterien und Nachweise müssen zusammenpassen, bevor der PR als fertig umgesetzt gilt. Alle Kriterien müssen erfolgreich geprüft sein.

## 5. Pull Request und Merge Gate

1. Für die fertige Umsetzung einen Pull Request nach `main` erstellen und das Ticket nach **Merge Gate** verschieben. Im PR die Änderungen beschreiben, die betroffenen Kriterien-IDs nennen und auf Spezifikation und Kriteriennachweise im Ticket verlinken. Bis zum Produktionsnachweis `Refs #<n>` verwenden, damit Anforderungen und Bugs beim Merge offenbleiben.
2. Der Workflow `.github/workflows/merge-gate.yml` läuft bei jedem Pull Request nach `main` und führt die vom PR betroffenen Unit- und Fidelity-Tests gegen den aktuellen PR-Stand aus. Er installiert nichts. Unit-Tests und automatisierte Fidelity-Tests müssen als Pflichtprüfungen eingebunden sein; die Suiten stehen in `.github/workflows/tests.yml`. Neue und geänderte Features bringen ihre Unit-Tests im selben PR mit. Backend: `go test` in `app/backend`. Frontends: Unit-Suiten über das Paketskript `test:unit` im jeweiligen Frontend einbinden. Prozesswerkzeuge: `node --test "tools/*.test.mjs"`. Fidelity: Playwright-Specs in `app/e2e/tests`. Eine fehlende Einbindung vor dem Merge ergänzen. Ein erfolgreicher Image-Build oder Healthcheck ersetzt keine Prüfung der Akzeptanzkriterien.
   - **Testauswahl.** Der Job „Testauswahl“ ordnet jede geänderte Datei mit `tools/affected-tests.mjs` den betroffenen Tests zu und listet Regel und Auswahl je Datei in der Zusammenfassung. Frontend-Dateien folgen ihrem Importgraphen. Unit-Tests werden gewählt, wenn sie die Datei direkt oder indirekt importieren. Jede Playwright-Spec nennt in einer Kopfzeile `// Abdeckung …: <Pfade>` ihre Einstiegsmodule. Gemeinsam genutzte Teile wie Layout, Navigation, Footer, i18n und globales CSS betreffen alle Specs des Frontends. Backend-Änderungen wählen das Go-Paket mit allen importierenden Paketen und alle Specs. Änderungen an `app/api`, am Dockerfile, an der Fidelity-Infrastruktur, an `.github` oder an der Testauswahl führen zu breiteren Suiten bis zur vollständigen Suite. Neue Specs erhalten eine Abdeckungszeile, die auf vorhandene Dateien verweist.
   - **Pflichtcheck.** Der Abschlussjob `Merge Gate` ist grün, wenn die Testauswahl gelungen ist und alle ausgewählten Tests bestanden sind. Eine nachvollziehbar testfreie Änderung, etwa an Mocks oder Dokumentation unter `app/docs`, schließt ohne Tests grün ab. Eine Datei ohne Zuordnungsregel macht den Check rot. Dann die Regel in `tools/affected-tests.mjs` samt Unit-Test ergänzen, statt die Datei auszunehmen.
3. Mit `gh pr checks <PR> --watch` auf das Merge Gate und alle weiteren Pflichtprüfungen warten. Fehlgeschlagene Prüfungen gemäß Abschnitt 6 untersuchen. Nach Änderungen müssen die Pflichtprüfungen für den aktuellen PR-Head erfolgreich sein.
4. Unmittelbar vor dem Merge offene Tickets mit dem Label `release-blocker` prüfen. Ein Blocker sperrt den Release, solange seine Ursache im geprüften Stand besteht oder die Behebung für diesen Stand noch nachzuweisen ist. Enthält der Kandidat die nachgewiesene Korrektur, den Kriteriennachweis im Bug-Ticket verlinken und das Ticket bis zum Produktionsnachweis offenhalten.
5. Sind alle Pflichtprüfungen grün, die Befunde geklärt und die Blockerprüfung bestanden, mergt der Agent selbstständig mit `gh pr merge <PR> --squash --delete-branch --match-head-commit <geprüfte-PR-Head-SHA>`. Der Branch-Schutz für `main` verlangt einen aktuellen PR-Branch und den erfolgreichen Statuscheck `Merge Gate`. Die Regel gilt auch für Administratoren. Force-Push und Löschung von `main` sind gesperrt. Die Pflichtprüfungen gelten auch für Admins und dürfen weder umgangen noch abgeschwächt werden.

## 6. Fehlgeschlagene Prüfungen untersuchen und Bugs beheben

Jeder fehlgeschlagene Pflichtcheck sperrt den Merge. Der Agent untersucht den Lauf und hält den Befund im zugehörigen Ticket fest. Für Befunde aus CI und Produktionsprüfungen gilt:

- **Nachgewiesene Abweichung.** Ein offenes Bug-Ticket zur gleichen Ursache um die aktuellen Nachweise ergänzen. Gibt es keines, ein Ticket mit Label `bug` erstellen und nach **Bug offen** verschieben.
- **Belegter Infrastrukturabbruch.** Ursache und Lauf-Link im zugehörigen Ticket dokumentieren, die betroffene Prüfung für denselben Stand wiederholen und den neuen Lauf verlinken.
- **Ungeklärte Ursache.** Den Befund offenhalten und weiter untersuchen. Ein erfolgreicher Wiederholungslauf allein klärt die Ursache nicht.

Ein Bug-Ticket enthält betroffene Anforderung und Kriterien-IDs, erwartetes und tatsächliches Verhalten, reproduzierbare Schritte, Umgebung und Commit-SHA sowie geeignete Nachweise wie Links zu fehlgeschlagenen CI-Läufen, Logs oder Screenshots ohne Geheimnisse. Eine Regression eines bereits zugesicherten Kriteriums erhält zusätzlich `release-blocker`.

Der verantwortliche Agent übernimmt zugehörige Bugs direkt, korrigiert sie nach Möglichkeit im laufenden PR und prüft die Behebung. Nach dem Merge verwendet er bei Bedarf einen Fix-PR. Er begleitet auch die Korrektur bis zum erfolgreichen Deployment. Ist eine Behebung extern blockiert, dokumentiert er Ursache und offenen Nachweis im Ticket.

## 7. Selbstständig bis in Produktion abschließen

1. Unmittelbar nach dem Merge das Ticket von **Merge Gate** nach **Release Gate** verschieben und die gespeicherte Zuordnung prüfen. Das Ticket bleibt offen und behält seinen Bearbeiter. Den Status setzt der Agent, weil das `GITHUB_TOKEN` der Workflows keine persönlichen Projektboards schreiben darf.
2. Den Lauf von `.github/workflows/release-gate.yml` für den Commit auf `main` identifizieren und begleiten. Der Push nach `main` löst ihn automatisch aus. Der Job „Ticketübergabe“ kommentiert jedes Ticket, das die PR-Beschreibung mit `Refs #<n>` nennt, mit PR, geprüftem PR-Head, Commit auf `main` und Lauf-Link. Anschließend führt das Release Gate die vollständige Suite aus: Prozesswerkzeuge, alle Go-Pakete, Typprüfung und `test:unit` der Frontends sowie alle Playwright-Projekte. Erst danach prüft der Job „Neue Version installieren“ die Release-Blocker und installiert genau das getestete Image auf Hetzner. Ein erneuter Versuch für den aktuellen Stand von `main`: `gh workflow run release-gate.yml --ref main`, ohne einen bereits laufenden Lauf zu duplizieren.
3. Der Workflow muss unmittelbar vor der Installation die offenen `release-blocker` für den auszuliefernden Commit erneut nach Abschnitt 5 prüfen. Ist ein relevanter Blocker ungeklärt oder schlägt die Abfrage fehl, muss der Workflow vor der Installation stoppen. Für einen behobenen offenen Blocker dokumentiert ein Bearbeiter mit Schreibrecht Kriterien, Prüfung und Ergebnis in einem neuen Kommentar im Bug-Ticket. Er übernimmt die vollständige Zeile `Release-Nachweis: <Artefakt-URL>` aus der Zusammenfassung des grünen Merge Gates. Der Nachweis gilt für denselben Git-Tree, auch nach einem Squash-Merge. Nach Wiedereröffnung oder erneutem Setzen des Labels ist ein neuer Kommentar erforderlich. Für Sicherung, Deployment und Rollback gelten `ARCHITECTURE.md` und `app/docs/betrieb.md`.
4. Erfolgreiches Deployment und Healthcheck gegen Produktion prüfen. Ein grünes Merge Gate ohne Deployment genügt nicht als Produktionsnachweis.
5. Scheitern Tests, Blockerprüfung, Installation oder Healthcheck im Release Gate, bleibt das Ticket offen in **Release Gate**. Fehlgeschlagene Tests und Blocker stoppen den Lauf vor der Installation. Bei Installations- oder Healthcheckfehlern stellt der Workflow die bisherige Version wieder her; sonst die stabile Version über das vorgesehene Rollbackverfahren erhalten oder wiederherstellen. Den Befund nach Abschnitt 6 untersuchen und die Ursache mit einem Fix-PR beheben. Bis zum erfolgreichen Produktionsnachweis bleibt das Ticket offen.
6. Im Anforderungsticket den geprüften PR-Head samt CI-Lauf über den Squash-PR dem Commit auf `main` zuordnen. Den erfolgreichen Produktionslauf mit ausgelieferter Commit-SHA, Version und Healthcheck-Ergebnis verlinken. Enthält der Release weitere Commits, zusätzlich belegen, dass er den Squash-Commit enthält. Erst bei vollständigen Kriteriennachweisen und erfolgreichem Produktionsnachweis die Anforderung und ihre behobenen Bug-Tickets nach **Funktioniert** verschieben und schließen. In den Bug-Tickets auf den Produktionsnachweis verweisen.

Fehlende Zugänge, externe Abhängigkeiten oder technisch erzwungene Freigaben konkret melden und als Blocker im Ticket dokumentieren. Vorhandene Statusspalten verwenden; keine zusätzliche Blocked- oder Review-Spalte einführen. Keine fehlgeschlagenen oder unbekannten Ergebnisse als Erfolg melden. Zugangsdaten niemals ausgeben oder committen.

Diese Datei legt den Arbeitsauftrag für einen gestarteten Agenten fest. Sie selbst startet keinen Hintergrunddienst; vorhandene CI-Workflows führen die Prüfungen und das Deployment aus.

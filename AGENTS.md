# Entwicklungsprozess für KI Perspektiven

Repository: `MarvinJakob/KIPerspektiven` · [Projektboard „KI Perspektiven“](https://github.com/users/MarvinJakob/projects/4)

Ein Agent verantwortet eine Anforderung durchgängig: Anforderungen klären, implementieren, Pull Request erstellen, Findings beheben, mergen und die erfolgreiche Auslieferung in Produktion nachweisen. Er führt die notwendigen Schritte selbstständig aus. Eine Übergabe an getrennte Analyse- oder Umsetzungsteams ist nicht erforderlich. Diese Anweisung ersetzt frühere Rollen- und Teamabläufe für diesen Prozess.

## Board und Zustände

Das Feld **Status** bildet die Prozessspalten ab. Der Agent aktualisiert den Status bei jedem Übergang und prüft anschließend die gespeicherte Zuordnung. Labels ergänzen Typ und Suchbarkeit; sie ersetzen den Boardstatus nicht.

| Spalte | Bedeutung und Übergangsbedingung |
|---|---|
| **Backlog** | Eingang für Anforderungen. Ziel, Mehrwert, Umfang und klare Akzeptanzkriterien sind beschrieben. |
| **Spezifiziert** | Eine geprüfte Spezifikation mit eindeutigen Akzeptanzkriterien liegt vor. Die Anforderung ist bereit zur Implementierung. |
| **In Arbeit** | Ein Agent hat das Ticket übernommen und implementiert die spezifizierte Anforderung oder behebt den Bug. |
| **Merge Gate** | Die Implementierung liegt als Pull Request vor. CI führt die konfigurierten Pflichtprüfungen aus. Der Agent bearbeitet Findings und begleitet Merge und Produktionsauslieferung. |
| **Bug offen** | Ein reproduzierbarer Fehler wurde festgestellt. Das Bug-Ticket enthält Nachweise und wartet auf seine Behebung. |
| **Funktioniert** | Alle Akzeptanzkriterien sind erfüllt, die Pflichtprüfungen bestanden und der betreffende Stand ist nachweislich erfolgreich in Produktion. Erst jetzt wird das Ticket abgeschlossen. |

Normaler Ablauf: **Backlog → Spezifiziert → In Arbeit → Merge Gate → Funktioniert**.

Fehlerbehebung: **Bug offen → In Arbeit → Merge Gate → Funktioniert**. Die zugehörige Anforderung bleibt offen, bis auch ihre relevanten Bugs behoben und ausgeliefert sind. Scheitert das Gate, bleibt das Umsetzungsticket in Merge Gate; der Agent erfasst den Befund zusätzlich als Bug und korrigiert ihn im zugehörigen PR. Änderungen am fachlichen Umfang erfordern zunächst angepasste Kriterien und eine aktualisierte Spezifikation.

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

## 2. Anforderungen spezifizieren

1. Das Ticket vollständig lesen und alle fachlichen Aussagen Akzeptanzkriterien oder der Abgrenzung zuordnen.
2. Die Spezifikation unter `fidelity/specs/REQ-<n>.md` anhand von `fidelity/specs/_VORLAGE.md` erstellen. Kriterien erhalten stabile IDs `REQ-<n>-AC<m>`; IDs werden nicht für andere Aussagen wiederverwendet. Ziel und Mehrwert aus dem Ticket erhalten.
3. Die Spezifikation auf Vollständigkeit und eindeutige Akzeptanzkriterien prüfen und sichern. Anschließend das Ticket nach **Spezifiziert** verschieben.

## 3. Umsetzung in In Arbeit

1. Vor der Umsetzung das Ticket nach **In Arbeit** verschieben und prüfen, ob bereits ein anderer Agent daran arbeitet. Fremde Belegungen und Änderungen erhalten.
2. In einem isolierten Branch beziehungsweise Worktree aus aktuellem `origin/main` arbeiten; für neue Branches `codex/<ticket>-<kurzname>` verwenden. Änderungen im Hauptarbeitsverzeichnis anderer Sitzungen nicht überschreiben. Vorhandene `spec/`, `verify/` und `fix/`-Branches unterliegen weiterhin ihren technischen CI-Grenzen.
3. Die Anforderung anhand ihrer Spezifikation und Akzeptanzkriterien implementieren. Architektur und Anwendungskonventionen aus `ARCHITECTURE.md` und `app/README.md` beachten. Schnittstellenänderungen in `app/api/openapi.yaml` beginnen, Datenbankmigrationen additiv gestalten.
4. Implementierung, Kriterien und Nachweise müssen zusammenpassen, bevor der PR als fertig umgesetzt gilt.

## 4. Pull Request und Merge Gate

1. Für die fertige Umsetzung einen Pull Request nach `main` erstellen und das Ticket nach **Merge Gate** verschieben. Ticket, Spezifikation und betroffene Akzeptanzkriterien im PR verlinken.
2. Der Workflow `.github/workflows/merge-gate.yml` führt die konfigurierten Pflichtprüfungen gegen den PR-Stand aus.
3. Der Agent überwacht die Pflichtprüfungen, wertet Fehler aus, legt Bug-Tickets an und behebt die Ursachen. Nach Änderungen die betroffenen Prüfungen erneut ausführen lassen. Nachweise müssen zum aktuellen PR-Head gehören.
4. Der Agent mergt seinen PR selbst und ohne Rückfrage, sobald das Merge Gate für den aktuellen PR-Head grün ist: `gh pr checks <PR> --watch`, dann `gh pr merge <PR> --squash --delete-branch`. Das private Repository hat keinen technischen Branch-Schutz; das grüne Gate vor dem Merge abzuwarten ist daher Pflicht des Agenten. Ausschließlich mit grünem Merge Gate und allen weiteren erforderlichen GitHub-Prüfungen mergen. Keine Admin-Umgehung, keine erfundenen Prüfnachweise und kein Abschwächen der Gates. Technische Regeln gelten auch dann, wenn ältere Workflowtexte noch Teambezeichnungen enthalten.
5. Im PR Änderungen und Validierung sachlich dokumentieren. Bis zum Produktionsnachweis `Refs #<n>` verwenden; Anforderungen und Bugs nicht durch `Closes` beim Merge vorzeitig abschließen.

## 5. Findings als Bugs erfassen und beheben

Bei Findings aus Pflichtprüfungen oder Produktionsprüfungen prüft der Agent zunächst, ob bereits ein offenes Bug-Ticket zur gleichen Ursache existiert. Bestehende Tickets um aktuelle Nachweise ergänzen; andernfalls ein Bug-Ticket mit Label `bug` erstellen und nach **Bug offen** verschieben.

Ein Bug-Ticket enthält betroffene Anforderung und Kriterien-IDs, erwartetes und tatsächliches Verhalten, reproduzierbare Schritte, Umgebung und Commit-SHA sowie geeignete Nachweise wie Links zu fehlgeschlagenen CI-Läufen, Logs oder Screenshots ohne Geheimnisse. Eine Regression eines bereits zugesicherten Kriteriums erhält zusätzlich `release-blocker`.

Der Agent behebt Bugs innerhalb seines Featureauftrags selbstständig über **In Arbeit → Merge Gate**. Nicht reproduzierbare Infrastrukturfehler als solche dokumentieren. Fehlgeschlagene Prüfungen nicht durch bloßes Wiederholen als erledigt betrachten.

## 6. Selbstständig bis in Produktion abschließen

Der Auftrag zur Umsetzung eines Features umfasst auch Merge und Produktionsauslieferung nach bestandenen Gates. Der Agent beendet seine Arbeit nicht mit dem Erstellen des PRs oder dem Merge.

1. Nach dem Merge den zugehörigen Lauf von `.github/workflows/merge-gate.yml` auf `main` identifizieren und begleiten. Der Push nach `main` löst ihn automatisch aus; er wiederholt die Prüfungen und installiert im Job „Neue Version installieren“ genau das geprüfte Image auf Hetzner. Ein erneuter Versuch für den aktuellen Stand von `main`: `gh workflow run merge-gate.yml --ref main`, ohne einen bereits laufenden Lauf zu duplizieren.
2. Sicherstellen, dass der Release den betreffenden Commit enthält, alle Releaseprüfungen besteht und keine offenen `release-blocker` übergangen werden. Vorhandene Sicherungs-, Deployment- und Rollbackverfahren verwenden; Details stehen in `ARCHITECTURE.md` und `app/docs/betrieb.md`.
3. Erfolgreiches Deployment und Healthcheck gegen Produktion prüfen. Ein grünes Merge Gate ohne Deployment genügt nicht als Produktionsnachweis.
4. Bei Deployment- oder Healthcheckfehlern ein Bug-Ticket anlegen, die stabile Version über das vorgesehene Rollbackverfahren erhalten beziehungsweise wiederherstellen und die Ursache beheben. Das Feature bleibt offen und erhält keinen Status Funktioniert.
5. Erst mit erfolgreichem Produktionsnachweis Anforderung und behobene Bug-Tickets nach **Funktioniert** verschieben und schließen. Commit, PR, CI-/Release-Lauf, ausgelieferte Version und Prüfergebnis im Ticket festhalten.

Fehlende Zugänge, externe Abhängigkeiten oder technisch erzwungene Freigaben konkret melden und als Blocker im Ticket dokumentieren. Vorhandene Statusspalten verwenden; keine zusätzliche Blocked- oder Review-Spalte einführen. Keine fehlgeschlagenen oder unbekannten Ergebnisse als Erfolg melden. Zugangsdaten niemals ausgeben oder committen.

Diese Datei legt den Arbeitsauftrag für einen gestarteten Agenten fest. Sie selbst startet keinen Hintergrunddienst; vorhandene CI-Workflows führen die Prüfungen und das Deployment aus.

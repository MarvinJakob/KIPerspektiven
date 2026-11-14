# Begrenzung paralleler Anmeldeversuche (Ticket #138)

Stand: 14.11.2026. Umsetzung in Commit `b94d593`, Befund auf `main` in Commit `60a6caa`. Ticket: [#138](https://github.com/MarvinJakob/aiboard/issues/138).

## Befund

Vor der Korrektur prüfte der Login-Handler zuerst `Allowed(ip)`, führte dann die Argon2-Prüfung aus und zählte einen Fehlversuch erst danach mit `Fail(ip)`. Gleichzeitige Anfragen derselben IP-Adresse passierten deshalb alle die Zulassung, bevor der erste Fehlversuch gezählt war. Jede Argon2id-Prüfung belegt 64 MiB, auch für unbekannte Konten (`auth.SpendTime`). Eine Grenze für gleichzeitige Prüfungen über alle IP-Adressen gab es nicht.

Der Regressionstest `TestParallelLoginsFromOneIPAreLimitedBeforePasswordCheck` reproduziert den Fehler auf Commit `c8e6d68` (Testbarriere und Test, noch ohne Korrektur):

```text
--- FAIL: TestParallelLoginsFromOneIPAreLimitedBeforePasswordCheck (0.24s)
    login_internal_test.go:135: 11 parallele Passwortprüfungen zugelassen, erwartet höchstens 10
```

Nach der Korrektur läuft er erfolgreich.

## Regeln

### Je IP-Adresse

Es bleibt bei höchstens zehn Fehlversuchen in 15 Minuten. Das Zeitfenster beginnt mit dem ersten gezählten Fehlversuch. `auth.Limiter.Reserve` lässt einen Versuch nur zu, wenn gezählte Fehlversuche und laufende Versuche zusammen unter zehn liegen. Zulassung und Reservierung geschehen unter derselben Sperre. Laufende Versuche zählen also, als wären sie bereits gescheitert.

Das Ergebnis bestimmt, was die Reservierung hinterlässt (`internal/http/auth.go`, `Login`):

| Fall | Antwort | Wirkung auf die IP-Adresse |
|---|---|---|
| Unbekanntes Konto, falsches Passwort oder deaktiviertes Konto | `401` | ein Fehlversuch mehr |
| Erfolgreiche Anmeldung | `200` | Fehlversuche auf null, wie bisher. Andere laufende Versuche bleiben reserviert. |
| Zehn Fehlversuche und laufende Versuche erreicht | `429` | keine Reservierung |
| Ungültige Anfrage | `400` | Reservierung freigegeben, nichts gezählt |
| Globale Grenze erreicht | `503` mit `Retry-After: 5` | Reservierung freigegeben, nichts gezählt |
| Client bricht ab, während er auf einen Prüfplatz wartet | `503` (erreicht den Client nicht mehr) | Reservierung freigegeben, nichts gezählt, Argon2 nicht gestartet |
| Client bricht während der Argon2-Prüfung ab | Ergebnis der Prüfung | Die Prüfung lässt sich nicht unterbrechen. Ihr Ergebnis zählt wie oben. |
| Interner Fehler, etwa Datenbank | `500` | Reservierung freigegeben, nichts gezählt |
| Panic im Handler | `500` (Middleware `recoverer`) | Reservierung und Prüfplatz per `defer` freigegeben |

Freigeben ohne Zählen löscht keine bereits gezählten Fehlversuche. Eine bestehende Sperre bleibt deshalb bestehen. Ohne Ergebnis der Passwortprüfung lässt sich nichts über das Passwort erfahren; ein falsches Passwort führt immer zu einem gezählten Fehlversuch.

Beratungsanfragen (Ticket #136) nutzen seit dem Zusammenführen mit `main` dieselbe Reservierung: Laufende Anfragen zählen bei der Zulassung mit, gezählt werden nur angenommene Anfragen (`Attempt.Count`). Ungültige Anfragen und Fehler geben die Reservierung frei (`Attempt.Cancel`). Die frühere Prüfung mit `Allowed` und das spätere Zählen mit `Hit` entfallen; dieselbe Lücke bei parallelen Anfragen ist damit auch dort geschlossen.

### Über alle IP-Adressen

`auth.Throttle` begrenzt die gleichzeitigen Passwortprüfungen. Die Grenzwerte stehen in `internal/http/auth.go`:

| Wert | Einstellung | Begründung |
|---|---|---|
| Gleichzeitige Prüfungen | 1 | Der Produktionsserver hat 1 vCPU und 2 GB RAM ([Betriebsanleitung](betrieb.md)). Eine Prüfung rechnet etwa 80 ms auf einem Kern (`BenchmarkVerifyPassword`: 76 ms mit einem, 90 ms mit acht Threads, je 64 MiB). Mehr Prüfungen als Kerne erhöhen den Durchsatz nicht, nur Speicher und Wartezeit aller anderen Anfragen. Im Lasttest mit einem Kern lagen Speicher und Healthcheck-Zeiten mit einem Platz niedriger als mit zwei (zwei Plätze: rund 340 MiB, Healthcheck bis 7,8 s bei 80 parallelen Anfragen). Bei mehr Kernen kann der Wert steigen. |
| Wartende | 8 | Gleichzeitige Anmeldungen des kleinen Redaktionsteams warten, statt abgewiesen zu werden. |
| Höchste Wartezeit | 3 s | Bei 0,1 bis 0,2 s je Prüfung wartet der achte Wartende etwa 1 bis 2 s. |
| Antwort bei Überlast | `503`, `Retry-After: 5` | Vor Argon2, ohne Fehlversuch. Wartende erhalten frei werdende Plätze vor neu eintreffenden Anfragen. |

Gleichzeitig zugelassen sind damit höchstens neun Anfragen: eine Prüfung und acht Wartende.

Die Passwort-Hashparameter bleiben unverändert (Argon2id, 64 MiB, zwei Durchläufe).

### Schnittstelle und Redaktionsfrontend

`api/openapi.yaml` beschreibt die Antwort `503` mit Pflicht-Header `Retry-After` für `POST /api/auth/login`. Go-Code und TypeScript-Typen beider Frontends sind neu erzeugt. Die Anmeldeseite der Redaktion zeigt bei `503`: „Die Anmeldung ist gerade ausgelastet. Bitte in einigen Sekunden erneut versuchen.“

### Grenzen der Maßnahme

- Unter einem Angriff von vielen IP-Adressen erhalten auch berechtigte Anmeldungen `503`. Die Webseite und der Healthcheck haben Vorrang; die Anmeldung ist nach `Retry-After` erneut möglich.
- Die Grenze schützt den Speicher. Die Prozessorlast bleibt bei anhaltender Last hoch, weil laufend eine Prüfung rechnet und jede abgewiesene Anfrage ebenfalls etwas Rechenzeit kostet. Eine Begrenzung der Anfragerate vor dem Backend, etwa in Caddy, ist nicht Teil dieses Tickets.
- Wie bisher setzt eine erfolgreiche Anmeldung die Fehlversuche der IP-Adresse zurück.

## Tests

| Test | Prüft |
|---|---|
| `internal/http/login_internal_test.go`, `TestParallelLoginsFromOneIPAreLimitedBeforePasswordCheck` | 11 gleichzeitige Versuche einer IP-Adresse, je mit falschem Passwort und mit unbekanntem Konto. Höchstens 10 erreichen die angehaltene Passwortprüfung, der elfte erhält sofort `429`. Danach ist auch das richtige Passwort gesperrt. |
| `TestParallelLoginsFromOtherIPsAreAdmitted` | Laufende Versuche einer IP-Adresse sperren keine andere IP-Adresse. Eine erfolgreiche Anmeldung der anderen IP-Adresse setzt deren Zähler zurück. |
| `TestLoginOutcomesReleaseReservations` | Unbekanntes Konto und falsches Passwort zählen, Erfolg setzt zurück. Ungültige Anfrage und interner Fehler zählen nicht und heben keine Sperre auf. Abbruch beim Warten zählt nicht und startet keine Prüfung. Abbruch während der Prüfung zählt deren Ergebnis. |
| `TestPasswordChecksAreLimitedAcrossIPs` | 18 gleichzeitige Anfragen von 18 IP-Adressen, also die doppelte Zahl gleichzeitig zugelassener Anfragen: genau 1 Prüfung läuft, 8 warten, 9 erhalten sofort `503` mit `Retry-After`. Danach sind alle Plätze frei; abgewiesene Anfragen hinterlassen keinen Fehlversuch. |
| `internal/auth/auth_test.go`, `TestLimiter*`, `TestThrottle*` | Zeitfenster, Zählung laufender Versuche, alle Ergebnisarten, einmalige Wirkung, 200 gleichzeitige Reservierungen, Aufräumen, Grenzen für Laufende und Wartende, Ablauf der Wartezeit, Abbruch, Freigabe |
| `TestLoginRateLimit` (bestehend) | Zehn Fehlversuche über HTTP, danach `429` |
| `frontend-redaktion/src/auth.test.tsx` | Meldungen bei `429` und `503` |

Die Testbarriere steht vor `accounts.Login`, das die Datenbankabfrage und die echte Argon2-Prüfung enthält (`apiServer.login`). Mit `-cpu 1,2,8` liefen die Parallelitätstests jeweils mehrfach ohne Fehler.

Der Race-Detector braucht CGO und einen C-Compiler. Lokal unter Windows ist kein C-Compiler vorhanden. Die CI führt die Parallelitätstests deshalb bei jedem Pull Request zusätzlich mit `-race` aus (`.github/actions/pruefungen/action.yml`, Befehl in der [README](../README.md#code-erzeugen-und-testen)).

## Lasttest

`scripts/login-lasttest.ps1` startet je Stufe einen frischen Server als eigenen Prozess und lässt `TestLoginLoad` (`internal/http/login_load_test.go`, nur mit `LOGIN_LASTTEST=1`) für 3 s gleichzeitig Anmeldeversuche schicken. Jeder Versuch kommt über `X-Forwarded-For` von einer neuen IP-Adresse, damit nur die globale Grenze greift. Abwechselnd verwendet er ein falsches Passwort für das Testkonto `redaktion@example.test` und ein unbekanntes Konto. Beides löst eine Argon2-Prüfung aus. Parallel ruft der Test alle 25 ms `/api/health` auf. Das Skript misst Spitzen-Arbeitsspeicher und Prozessorzeit des Serverprozesses.

Ohne Korrektur steigt der Speicher um etwa 64 MiB je gleichzeitiger Anfrage. Deshalb endet die Messung von `main` bei 15 parallelen Anfragen. Nicht gegen das Produktivsystem ausführen.

**Testumgebung:** Windows 11 Enterprise 10.0.26300, Intel Core i5-1135G7 (4 Kerne, 8 Threads), 15,7 GB RAM, davon etwa 3,6 GB frei, Go 1.27.0. Der Server lief mit `GOMAXPROCS=1`, gebunden an einen logischen Prozessor, als Nachbildung des Servers mit 1 vCPU. Weitere Einstellungen: `DEV_SEED=true`, `TRUST_PROXY=true`, temporäre SQLite-Datenbank. Der Lastgenerator lief als eigener Prozess auf den übrigen Prozessoren. Leerlauf-Arbeitsspeicher des Servers: 81 MiB.

Die Messwerte gelten für Commit `b94d593`. Der anschließende Merge mit `main` benennt die Ergebnis-Methoden des Limiters neutral um (`Count`, `Reset`, `Cancel`) und stellt die Beratungsanfragen um. Login-Ablauf und Grenzwerte bleiben unverändert.

**Mit Korrektur, Commit `b94d593`:**

| Parallel | Server: Spitze Arbeitsspeicher | Server: CPU-Zeit / Dauer | Anfragen | 401 | 503 | sonstige | Argon2/s | Login p50 / max | Health ok/gesamt | Health max |
|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 210 MiB | 3,42 s / 3,7 s | 39 | 39 | 0 | 0 | 13.0 | 406ms / 573ms | 102/102 | 116ms |
| 10 | 274 MiB | 3,80 s / 4,0 s | 95 | 35 | 60 | 0 | 11.7 | 61ms / 1.223s | 114/114 | 105ms |
| 20 | 211 MiB | 3,91 s / 4,2 s | 200 | 36 | 164 | 0 | 12.0 | 158ms / 1.809s | 74/74 | 1.361s |
| 40 | 210 MiB | 3,73 s / 4,0 s | 247 | 34 | 213 | 0 | 11.3 | 220ms / 3.549s | 49/49 | 2.456s |
| 80 | 210 MiB | 5,56 s / 6,1 s | 165 | 41 | 124 | 0 | 13.7 | 1.046s / 5.899s | 45/45 | 4.634s |

**Ohne Korrektur, `main` Commit `60a6caa`:**

| Parallel | Server: Spitze Arbeitsspeicher | Server: CPU-Zeit / Dauer | Anfragen | 401 | 503 | sonstige | Argon2/s | Login p50 / max | Health ok/gesamt | Health max |
|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 402 MiB | 2,73 s / 3,9 s | 16 | 16 | 0 | 0 | 5.3 | 1.085s / 1.728s | 33/33 | 350ms |
| 10 | 659 MiB | 2,64 s / 4,1 s | 15 | 15 | 0 | 0 | 5.0 | 2.493s / 3.654s | 13/13 | 2.239s |
| 15 | 980 MiB | 2,95 s / 4,8 s | 15 | 15 | 0 | 0 | 5.0 | 4.37s / 4.376s | 12/12 | 918ms |

Ein vorheriger Lauf mit demselben Ablauf ergab ohne Korrektur 531, 915 und 1044 MiB bei 5, 10 und 15 parallelen Anfragen. Mit Korrektur ergab er 210 bis 274 MiB bei 5 bis 80 parallelen Anfragen, mit längster Healthcheck-Antwort 173 ms, 120 ms, 1,8 s, 2,1 s und 3,6 s. Die Zeiten schwanken auf dem Laptop zwischen den Läufen deutlich.

**Ergebnis:**

- **Grenze bestätigt:** Mit Korrektur bleibt der Spitzenspeicher bei 210 bis 274 MiB, unabhängig von der Parallelität bis fast zum Neunfachen der neun gleichzeitig zugelassenen Anfragen. Ohne Korrektur wächst er linear um etwa 50 bis 100 MiB je Anfrage. Der Produktionsserver mit 2 GB wäre nach dieser Schätzung bei rund 20 bis 30 gleichzeitigen Anfragen erschöpft. Überzählige Anfragen erhielten `503`, jeweils mit `Retry-After`. Andere Antworten gab es nicht.
- **Healthcheck erreichbar:** Alle Healthchecks antworteten mit `200`. Bei der doppelten Parallelität (20) dauerte der längste 1,4 s. Bei 80 parallelen Anfragen waren es bis 4,6 s, knapp unter dem Docker-Timeout von 5 s (`compose.yaml`, drei Wiederholungen im Abstand von 30 s).
- **Prozessor:** Der Kern des Servers ist unter Last ausgelastet, mit und ohne Korrektur. Das begrenzt die Antwortzeiten bei sehr vielen gleichzeitigen Anfragen (siehe Grenzen der Maßnahme).
- **Übertragbarkeit:** Gemessen unter Windows mit einem gebundenen Prozessor statt in einer Linux-VM mit 1 vCPU. Speicherwerte sind übertragbar, Zeiten nur als Größenordnung.

Für eine schnelle plattformunabhängige Prüfung läuft der Lasttest auch im Testprozess. Dann misst er den Speicher über `runtime/metrics`, teilt sich aber die Prozessoren mit dem Lastgenerator:

```bash
cd backend && LOGIN_LASTTEST=1 go test -run TestLoginLoad -v ./internal/http/
```

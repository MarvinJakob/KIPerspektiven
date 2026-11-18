# Betrieb auf Hetzner

Die Anwendung läuft mit Docker Compose auf dem Hetzner-Cloud-Server `KI-Perspektiven-PRD`. Caddy nimmt HTTPS-Anfragen an und leitet sie an das Backend weiter (siehe [ARCHITECTURE.md, Abschnitt 8](../../ARCHITECTURE.md#8-betrieb-auf-hetzner) und [ADR 0007](adr/0007-docker-compose-auf-hetzner.md)).

| | |
|---|---|
| Server | `KI-Perspektiven-PRD` seit 2026-11-17 (Neuaufbau, gleiche Primary IP), IPv4 `78.47.14.178`, Ubuntu 24.04, 2 GB RAM, 2 GB Swap |
| Adresse | <https://marvinjakob.de> seit 2026-11-09. `www.marvinjakob.de` und die frühere Adresse `78-47-14-178.sslip.io` leiten dorthin um, siehe [Domain](#domain). |
| Projektverzeichnis | `/opt/ki-web` |
| Container | `caddy` (TLS, Medien) und `backend` (Image `ghcr.io/marvinjakob/ki-web:<VERSION>`) |
| Daten | Docker-Volumes `ki-web_app_db` (SQLite), `ki-web_app_media` (Bilder), `ki-web_caddy_data` (Zertifikate, Zugriffsprotokoll) |

## Voraussetzungen

- **Server:** Ubuntu mit Docker CE und Compose-Plugin. Docker startet beim Systemstart (`systemctl is-enabled docker` ergibt `enabled`). Wegen des Image-Builds auf dem Server ist ein Swap von 2 GB eingerichtet (`/swapfile`, Eintrag in `/etc/fstab`).
- **Image-Store:** Docker verwendet wie die CI den containerd-Image-Store (`/etc/docker/daemon.json`: `{"features": {"containerd-snapshotter": true}}`, danach `systemctl restart docker`; `docker info` zeigt `driver-type: io.containerd.snapshotter.v1`). Sonst berechnet der Server für das geladene CI-Image eine andere Image-ID und `deploy.sh deploy` bricht mit „No such image“ ab.
- **Netz:** Die Ports 80 und 443 sind öffentlich erreichbar. Caddy holt das Zertifikat bei Let's Encrypt und leitet HTTP auf HTTPS um.
- **Domain:** Die Domain löst auf die IP des Servers auf.
- **Zugang:** SSH als `root` mit Schlüssel. Der private Deploy-Schlüssel liegt ausschließlich als GitHub-Secret `HETZNER_SSH`, das Hetzner-API-Token als `HETZNER_API` (in den Workflows intern `HCLOUD_TOKEN`); lokal gibt es keine Hetzner-Zugänge, nur `GH_TOKEN` für GitHub. Laufzeit-Konfiguration liegt auf dem Server in `/opt/ki-web/.env`.
- **Lokal:** Git, Bash und GitHub CLI. Unter Windows genügt Git Bash. Zugangstests und Deployments laufen über die GitHub-Actions-Workflows.

## Konfiguration

Die Datei `/opt/ki-web/.env` (Rechte `600`) enthält die Werte für den Betrieb. Vorlage: [.env.example](../.env.example).

| Variable | Wert | Zweck |
|---|---|---|
| `DOMAIN` | `marvinjakob.de` | Domain für Caddy und `PUBLIC_BASE_URL` |
| `REDIRECT_DOMAINS` | `"www.marvinjakob.de 78-47-14-178.sslip.io"` | Weitere Adressen, durch Leerzeichen getrennt. Caddy holt auch für sie Zertifikate und leitet dauerhaft (`301`) mit Pfad und Query auf `DOMAIN` um. Ohne Eintrag leitet nichts um. |
| `REGISTRY` | `ghcr.io/marvinjakob` | Präfix des Image-Namens |
| `VERSION` | z. B. `a1b2c3d` | Laufende Version, setzt `deploy.sh` |
| `PREVIOUS_VERSION` | z. B. `9d034c1` | Vorherige Version für den Rollback, setzt `deploy.sh` |
| `REQUIRE_LOGIN` | `false` | Optionaler Zugangsschutz für die ganze Webseite (Ticket #49). Seit Ticket #108 ist die Webseite öffentlich; `true` nur für eine geschlossene Vorschau setzen. |

`DEV_SEED` wird im Betrieb nie gesetzt. `compose.yaml` setzt die Variable nicht, deshalb landen keine Testbeiträge und keine Testkonten in der Produktivdatenbank.

## Öffentlicher Zugriff

Die Webseite ist öffentlich (Ticket #108). In `/opt/ki-web/.env` steht `REQUIRE_LOGIN=false`; Compose verwendet auch ohne Eintrag `false`. Die Redaktion unter `/redaktion` und `/api/admin/*` prüft Sitzung, Rolle und CSRF-Token unabhängig von diesem Schalter (siehe [README](../README.md#öffentlicher-zugriff-und-redaktion)).

Die Datei `.env` liegt außerhalb der versionierten Builds und wird beim Deployment nicht ersetzt; `deploy.sh` ändert nur die Versionsfelder. Eine Änderung am Standard in `compose.yaml` ändert einen ausdrücklich gesetzten Wert in `.env` daher nicht. Nach einer Änderung an `.env` ist `docker compose up -d --wait` nötig; `docker compose restart` liest die Umgebungsvariablen nicht neu ein. Den wirksamen Wert zeigt `docker compose exec backend printenv REQUIRE_LOGIN`.

Nach jedem Deployment und Neustart ohne Cookies prüfen:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://marvinjakob.de/en/profil
curl -sS -o /dev/null -w '%{http_code}\n' 'https://marvinjakob.de/api/posts?lang=de'
curl -fsS https://marvinjakob.de/robots.txt
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://marvinjakob.de/redaktion
curl -sS -o /dev/null -w '%{http_code}\n' https://marvinjakob.de/api/admin/posts
```

Erwartet werden `200` für Seite und öffentliche API, eine `robots.txt` mit `Sitemap:` und ohne `Disallow: /`, eine Umleitung von `/redaktion` zu `/redaktion/anmelden` und `401` für `/api/admin/posts`. Die Prüfung umfasst Startseite, Themen, KI-Audit, Blog, Profil und Rechtstexte in beiden Sprachen.

`REQUIRE_LOGIN=false` bleibt ausdrücklich in `.env` stehen: Ältere Versionen bringen eine `compose.yaml` mit dem früheren Standard `true` mit. Mit dem ausdrücklichen Wert bleibt die Webseite auch nach einem Rollback öffentlich. Den früheren Betriebsnachweis mit aktivem Schutz (#54) enthält [zugangsschutz-abnahme.md](zugangsschutz-abnahme.md).

Aufbau des Projektverzeichnisses:

```
/opt/ki-web/
  .env               Konfiguration, nicht im Repository
  compose.yaml       aus der laufenden Version kopiert
  deploy/Caddyfile   aus der laufenden Version kopiert
  build/<VERSION>/   Inhalt von app/ des jeweiligen Commits, die fünf jüngsten bleiben erhalten
```

## Ersteinrichtung

Einmalig auf dem Server:

```bash
mkdir -p /opt/ki-web/build && cd /opt/ki-web
umask 077 && printf 'DOMAIN=marvinjakob.de\nREDIRECT_DOMAINS="www.marvinjakob.de"\nREGISTRY=ghcr.io/marvinjakob\nVERSION=\nPREVIOUS_VERSION=\n' > .env
```

Danach die erste Version wie unter [Neue Version bereitstellen](#neue-version-bereitstellen) ausliefern und das erste Admin-Konto anlegen. Das Passwort wird verdeckt abgefragt:

```bash
cd /opt/ki-web && docker compose exec -it backend /server user create --email ADRESSE --role admin
```

`--role` nimmt seit Ticket #64 auch mehrere Rollen kommagetrennt an (`admin`, `editor`, `marketing`).

## Automatisches Deployment

Die Prüfung ist zweistufig:

- Der Workflow [Merge Gate](../../.github/workflows/merge-gate.yml) prüft Pull Requests nach `main` mit den betroffenen Tests. Er installiert keine Version.
- Der Workflow [Release Gate](../../.github/workflows/release-gate.yml) läuft nach jedem Push/Merge auf `main`:
  1. Er führt die vollständige Testsuite aus und baut dabei das Docker-Image. Die Suite umfasst Prozesswerkzeuge, Backend, Frontend-Unit-Tests und alle Playwright-Projekte.
  2. Er prüft offene Release-Blocker für den Git-Tree.
  3. Er überträgt genau das getestete Image und installiert es als neue Version. Docker-Healthcheck und HTTPS-Healthcheck müssen erfolgreich sein.

Schlägt ein Test oder die Blockerprüfung fehl, wird nichts installiert. Bei fehlgeschlagener Installation wird die zuvor gemerkte Version wiederhergestellt; der Lauf bleibt rot. Ohne Vorgängerversion gibt es bei einer Erstinstallation keinen Rollback. Laufende Installationen und der manuelle Workflow [Rollback](../../.github/workflows/rollback.yml) teilen dieselbe Sperre und werden nicht abgebrochen.

Die Installation benötigt die Secrets `DEPLOY_HOST`, `HETZNER_SSH`, `DEPLOY_KNOWN_HOSTS` sowie optional die Variable `DEPLOY_URL` für den Link zur Produktion. Eine Registry ist nicht nötig: Das gebaute Image wird als Actions-Artefakt übertragen und auf Hetzner geladen. Es wird dort nicht erneut gebaut. Die automatische Pipeline erstellt keine Snapshots, Release-Branches, Tags oder GitHub-Releases.

Manueller Zugangstest ohne Deployment: `gh workflow run deploy-access.yml`. Dieser separate Diagnoseworkflow benötigt weiterhin `HETZNER_API` und `HCLOUD_SERVER_NAME`. Den SSH-Schlüssel bei Verdacht auf Missbrauch auf dem Server aus `authorized_keys` löschen und neu erzeugen. In den alten Repositories `MarvinJakob/AIPerspectives` und `MarvinJakob/aiboard` darf kein Deploy-Workflow mehr aktiv sein, sonst installieren zwei Pipelines auf denselben Server.

## Neue Version bereitstellen

Für einen erneuten Versuch eines bereits nach `main` gemergten Standes:

```bash
gh workflow run release-gate.yml --ref main
```

Der Workflow verwendet [deploy/deploy.sh](../deploy/deploy.sh):

1. überträgt `app/` des geprüften Commits nach `/opt/ki-web/build/<VERSION>`. Die Version enthält Commit- und Image-ID-Anteile.
2. lädt das CI-Image per `docker load`, prüft die vollständige Image-ID und das Commit-Label und taggt es für Compose.
3. kopiert `compose.yaml` und `deploy/Caddyfile` der Version nach `/opt/ki-web` und setzt `VERSION`.
4. startet die Container mit `docker compose up -d --wait` und prüft danach `https://DOMAIN/api/health`. Erst wenn beides erfolgreich ist, wird die bisherige Version zu `PREVIOUS_VERSION`.
5. startet bei einem Fehler wieder die bisherige Version und endet mit Fehler. Der Workflow stellt sie auch nach einer fehlgeschlagenen Image-Prüfung wieder her.
6. räumt Builds älter als die fünf jüngsten erst nach erfolgreicher Installation auf; laufende und vorherige Version bleiben erhalten.

Beim Austausch des Backend-Containers ist die Seite wenige Sekunden nicht erreichbar. Datenbank und Medien liegen in Volumes und bleiben erhalten. Der alte Befehl `deploy.sh release` bleibt für ausdrücklich beauftragte Notfallwartung verfügbar, ist aber kein Ersatz für die automatische Pipeline.

Die Migrationen laufen beim Start des Backends automatisch.

## Rückkehr zur vorherigen Version

```bash
app/deploy/deploy.sh rollback
```

Das Skript startet `PREVIOUS_VERSION` mit dem vorhandenen Image und der zugehörigen `compose.yaml`. Jede der fünf jüngsten Versionen lässt sich auch gezielt starten:

```bash
app/deploy/deploy.sh switch VERSION
```

**Bei Datenbankänderungen:** Migrationen laufen nur vorwärts. Sie müssen additiv sein (neue Tabellen oder Spalten, keine Umbenennung, kein Löschen), damit die vorherige Version mit dem neuen Schema weiterläuft ([ADR 0007](adr/0007-docker-compose-auf-hetzner.md)). Vor einem Release mit neuer Datei in `backend/migrations/` deshalb:

1. Im Pull Request prüfen, dass die Migration additiv ist.
2. Vor dem Release eine Kopie der Datenbank anlegen:
   `cd /opt/ki-web && docker compose exec -T backend /server backup /data/db/vor-VERSION.db`
3. Ist eine Migration nicht additiv oder startet die alte Version nach dem Rollback nicht, die Kopie wie unter [Sicherung und Wiederherstellung](#sicherung-und-wiederherstellung) einspielen. Änderungen seit dem Release gehen dabei verloren.

**Rollback hinter Ticket #64 (Migration `00020`):** Versionen vor #64 kennen nur die Spalte `users.role` (`admin` oder `editor`) und ignorieren `user_roles`. Reine Marketing-Konten stehen dort als `editor` und erhielten nach einem solchen Rollback Redakteursrechte (Beiträge, Statistik, Nachrichten, Beratungsanfragen). Vor einem Rollback auf eine Version vor #64 deshalb alle Konten mit ausschließlich der Rolle Marketing in der Benutzerverwaltung deaktivieren und nach dem erneuten Update wieder aktivieren. Konten, die eine alte Version anlegt, behalten nach dem Update ihre Rolle aus `users.role`.

## Healthcheck und Status

```bash
app/deploy/deploy.sh status
```

zeigt laufende und vorherige Version, den Commit des Images, den Zustand der Container und das Ergebnis von `https://DOMAIN/api/health`. `app/deploy/deploy.sh current` gibt nur den Commit der laufenden Version aus.

- Docker prüft das Backend alle 30 Sekunden mit `/server healthcheck`. Nach dem Start prüft es alle 2 Sekunden, bis der erste Check erfolgreich ist.
- Beide Container haben `restart: unless-stopped`. Nach einem Neustart des Servers starten sie automatisch, Caddy erst, wenn das Backend gesund ist.
- Von außen: `curl -fsS https://marvinjakob.de/api/health`

## Logs

Auf dem Server im Verzeichnis `/opt/ki-web`:

```bash
docker compose logs --since 1h backend
```

```bash
docker compose logs --since 1h caddy
```

```bash
docker compose exec caddy tail -n 50 /data/logs/access.log
```

Das Backend schreibt JSON-Zeilen. Docker hält je Container höchstens fünf Dateien mit 10 MB. Das Zugriffsprotokoll von Caddy kürzt IP-Adressen und behält sieben Tage.

## Sicherung und Wiederherstellung

**Stand: noch nicht eingerichtet.** Die nächtliche Sicherung wird später eingerichtet (Entscheidung vom 2026-11-09). Bis dahin vor riskanten Änderungen eine Kopie von Hand anlegen:

```bash
cd /opt/ki-web && ziel=/root/sicherung/$(date +%F-%H%M) && mkdir -p "$ziel" \
  && docker compose exec -T backend /server backup /data/db/backup.db \
  && docker compose cp backend:/data/db/backup.db "$ziel/app.db" \
  && docker compose cp backend:/data/media "$ziel/media"
```

Wiederherstellung einer solchen Kopie (`QUELLE` ist das Verzeichnis der Sicherung):

```bash
cd /opt/ki-web && docker compose stop backend
docker run --rm -v ki-web_app_db:/data/db -v ki-web_app_media:/data/media -v QUELLE:/src:ro alpine sh -c \
  'rm -f /data/db/app.db-wal /data/db/app.db-shm && cp /src/app.db /data/db/app.db && rm -rf /data/media/* && cp -a /src/media/. /data/media/ && chown -R 65532:65532 /data/db /data/media'
docker compose up -d --wait
```

Vorbereitet ist die automatische Sicherung mit restic in Hetzner Object Storage: [deploy/backup/backup.sh](../deploy/backup/backup.sh) mit den Variablen `RESTIC_*`, `AWS_*` und `HEARTBEAT_URL` aus [.env.example](../.env.example) und einem Cron-Eintrag. Wiederherstellung und Prüfung in einer getrennten Testablage folgen mit der Einrichtung.

## Domain

Die Webseite läuft seit 2026-11-09 unter `marvinjakob.de`. Die Domain liegt bei Strato. Die DNS-Einträge zeigen auf den Server:

| Name | Typ | Ziel |
|---|---|---|
| `marvinjakob.de` | A | `78.47.14.178` |
| `marvinjakob.de` | AAAA | `2a01:4f8:1c16:81b6::1`, die Adresse von `eth0`. Das Netz `2a01:4f8:1c16:81b6::` allein ist nicht erreichbar. |
| `www.marvinjakob.de` | CNAME | `marvinjakob.de` |

`www.marvinjakob.de` und die frühere Adresse `78-47-14-178.sslip.io` stehen in `REDIRECT_DOMAINS`. Sie leiten mit Pfad und Query dauerhaft auf `https://marvinjakob.de` um, damit alte Links weiter funktionieren. Die sslip.io-Adresse braucht keinen DNS-Eintrag, sie löst über den Dienst sslip.io auf die IP auf.

So wechselst du die Domain:

1. A-Eintrag und optional AAAA-Eintrag der neuen Domain auf den Server setzen.
2. In `/opt/ki-web/.env` `DOMAIN` ändern und die bisherige Domain in `REDIRECT_DOMAINS` aufnehmen.
3. `cd /opt/ki-web && docker compose up -d --wait` ausführen. Caddy holt die neuen Zertifikate. canonical-Links und Sitemap verwenden die neue Domain.
4. In GitHub die Variable `DEPLOY_URL` auf die neue Adresse setzen.
5. Prüfen: `curl -fsS https://DOMAIN/api/health` und `curl -sS -D - -o /dev/null https://www.DOMAIN/`. Erwartet wird `301` mit `Location: https://DOMAIN/`.

## IP-Bereinigung der Seitenstatistik (#142)

Die IP-Bereinigung verwendet den persistenten Schlüssel `/data/db/statistics-ip.key` getrennt von
SQLite. Er wird beim ersten Start mit Dateimodus 0600 erzeugt; die Verzeichnisrechte und Sicherungen
müssen ebenfalls auf den Betreiber beschränkt bleiben. Nie ausgeben, committen oder zusammen mit
Datenbankkopien weitergeben. `STATISTICS_KEY_PATH` erlaubt einen anderen persistenten Pfad.

Der Befehl `/server backup` und das vorbereitete Backup-Skript sichern nur SQLite und Medien,
**nicht den Schlüssel**. Den Schlüssel separat in einem zugriffsgeschützten, verschlüsselten
Geheimnisspeicher sichern, mit derselben Aufbewahrungsregel. Bei Wiederherstellung den zum
Datenbankstand gehörenden Schlüssel bereitstellen. Bei Verlust oder bewusstem Wechsel erzeugt der
Server einen neuen Zuordnungsbestand; alte absolute Zahlen bleiben erhalten und nicht mehr
berechenbare IP-Summen werden als „Nicht verfügbar“ markiert. Kein stilles Vermischen beider Bestände.

Compose verwendet ein eigenes Netz `proxy` (172.30.142.0/24), die feste Caddy-IP 172.30.142.2 und die
feste Backend-IP 172.30.142.3. Ohne feste Backend-IP erhält das zuerst startende Backend die erste freie
Adresse 172.30.142.2, und Caddy startet nicht (Ticket #17).
Nur diese /32-Adresse steht in `TRUSTED_PROXIES`; der Backend-Port bleibt unveröffentlicht. So muss
beim ersten Rollout das bisherige Default-Netz nicht umkonfiguriert werden. Vor dem ersten Rollout
prüfen, dass das Subnetz nicht mit dem Servernetz/VPN kollidiert; bei Anpassung Subnetz, Caddy-IP und
vertraute /32-Adresse gemeinsam ändern. `TRUST_PROXY` entfällt. Bei einem anderen Proxy müssen
dessen unmittelbare Peer-IPs/CIDRs explizit konfiguriert werden; ohne Konfiguration werden Header ignoriert.

Ableitungen bleiben für die Laufzeit des Statistikbestands, weil „Gesamt“ sonst wiederkehrende IPs
mehrfach zählen würde. Mindestens jährlich die Erforderlichkeit prüfen. Bei Abschaltung der
IP-Statistik Backend stoppen, `page_view_sources` und `page_view_identity` leeren und den Schlüssel
löschen; reine Tagesaggregate können bleiben. Sicherungen entsprechend löschen (vorbereitetes
Restic-Skript: 30 tägliche Stände; manuelle Kopien gesondert entfernen). Ein späterer Start legt einen
neuen Bestand an. Rechtliche Einordnung und Datensparsamkeit: [ADR 0010](adr/0010-statistik-ohne-kennung-und-einwilligung.md).

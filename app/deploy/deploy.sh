#!/usr/bin/env bash
# Bereitstellung auf dem Hetzner-Server per SSH. Anleitung: docs/betrieb.md
#
#   deploy/deploy.sh release [COMMIT] [VERSION]  Image für COMMIT (Standard: HEAD) auf dem Server bauen und starten.
#                                                VERSION ist standardmäßig der kurze Commit-Hash.
#   deploy/deploy.sh switch VERSION              eine bereits gebaute Version starten
#   deploy/deploy.sh rollback                    zur vorherigen Version zurückkehren
#   deploy/deploy.sh status                      Versionen, Container und Healthcheck anzeigen
#   deploy/deploy.sh current                     nur den Commit der laufenden Version ausgeben (leer, wenn keine läuft)
#   deploy/deploy.sh version                     nur die aktive Image-Version ausgeben
#   deploy/deploy.sh deploy COMMIT TAR IMAGE_ID VERSION  exakt das in CI getestete Image übertragen und starten
#
# Umgebung: DEPLOY_HOST (z. B. root@78.47.14.178), optional DEPLOY_SSH_KEY und DEPLOY_DIR (Standard /opt/ki-web).
# Läuft unter Linux, macOS und Git Bash. Gebaut wird der eingecheckte Stand des Commits, nicht die Arbeitskopie.
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST setzen, z. B. root@78.47.14.178}"
DEPLOY_DIR=${DEPLOY_DIR:-/opt/ki-web}
SSH=(ssh -o BatchMode=yes)
SSH+=(-o StrictHostKeyChecking=yes -o ConnectTimeout=15)
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then SSH+=(-i "$DEPLOY_SSH_KEY"); fi

# Teil, der auf dem Server läuft. Aufruf: remote FUNKTION [ARGUMENTE]
read -r -d '' SERVER <<'EOF' || true
set -euo pipefail
cd "$DEPLOY_DIR"
[[ -f .env ]] || { echo "$DEPLOY_DIR/.env fehlt (Ersteinrichtung siehe docs/betrieb.md)" >&2; exit 1; }

envget() { sed -n "s/^$1=//p" .env | tail -n 1; }
envset() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
image() { echo "$(envget REGISTRY)/ki-web:$1"; }

build() {
  local commit=$1 version=$2
  docker build --pull \
    --label "org.opencontainers.image.revision=$commit" \
    --label "org.opencontainers.image.version=$version" \
    -t "$(image "$version")" "build/$version"
}

promote() {
  local expected=$1 version=$2 commit=$3 actual revision
  actual=$(docker image inspect -f '{{.Id}}' "$expected")
  [[ "$actual" == "$expected" ]] || { echo 'Image-ID stimmt nicht mit CI überein' >&2; exit 1; }
  revision=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$expected")
  [[ "$revision" == "$commit" ]] || { echo 'Image-Commit stimmt nicht mit dem geprüften Commit überein' >&2; exit 1; }
  docker tag "$expected" "$(image "$version")"
  switch "$version"
  [[ "$(docker compose ps -q backend | xargs docker inspect -f '{{.Image}}')" == "$expected" ]] \
    || { echo 'Laufendes Image stimmt nicht mit CI überein' >&2; exit 1; }
}

version() { envget VERSION; }

# Startet VERSION mit der zugehörigen compose.yaml und Caddyfile. Gibt 1 zurück, wenn
# der Docker-Healthcheck oder /api/health über HTTPS nicht erfolgreich ist.
activate() {
  local version=$1
  # Caddyfile per cat überschreiben, damit der Bind-Mount im laufenden Caddy-Container dieselbe Datei behält
  cp "build/$version/compose.yaml" compose.yaml || return 1
  mkdir -p deploy || return 1
  cat "build/$version/deploy/Caddyfile" > deploy/Caddyfile || return 1
  envset VERSION "$version" || return 1
  echo "Starte $(image "$version") ..."
  docker compose up -d --remove-orphans --wait --wait-timeout 180 || return 1
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile > /dev/null 2>&1 || return 1
  status || return 1
}

# Wechselt auf VERSION. Schlägt der Start fehl, läuft wieder die bisherige Version und der Aufruf endet mit Fehler.
switch() {
  local version=$1 current previous
  [[ -d "build/$version" ]] || { echo "Version $version ist nicht vorhanden (build/$version fehlt)" >&2; exit 1; }
  docker image inspect "$(image "$version")" > /dev/null
  current=$(envget VERSION)
  previous=$(envget PREVIOUS_VERSION)
  # Vor dem Start setzen, damit der Status im Protokoll die neue vorherige Version zeigt.
  # Schlägt der Start fehl, wird der alte Wert unten wiederhergestellt.
  if [[ -n "$current" && "$current" != "$version" ]]; then envset PREVIOUS_VERSION "$current"; fi
  if activate "$version"; then
    return 0
  fi
  echo "FEHLER: Version $version ist nicht gesund." >&2
  docker compose logs --tail 30 backend >&2 || true
  if [[ -n "$current" && "$current" != "$version" ]]; then
    echo "Stelle die bisherige Version $current wieder her ..." >&2
    activate "$current" || echo "FEHLER: Auch $current startet nicht." >&2
    envset PREVIOUS_VERSION "$previous"
  fi
  exit 1
}

rollback() {
  local previous
  previous=$(envget PREVIOUS_VERSION)
  [[ -n "$previous" ]] || { echo "Keine vorherige Version in .env (PREVIOUS_VERSION)" >&2; exit 1; }
  switch "$previous"
}

# Nur die fünf jüngsten Builds behalten, laufende und vorherige Version nie löschen
prune() {
  local keep_a keep_b dir
  keep_a=$(envget VERSION); keep_b=$(envget PREVIOUS_VERSION)
  for dir in $(ls -1t build | tail -n +6); do
    [[ "$dir" == "$keep_a" || "$dir" == "$keep_b" ]] && continue
    rm -rf "build/$dir"
    docker image rm "$(image "$dir")" > /dev/null 2>&1 || true
  done
  docker image prune -f > /dev/null
}

# Commit der laufenden Version aus dem Image-Label, leer, wenn keine Version läuft oder das Image fehlt
current() {
  local version
  version=$(envget VERSION)
  [[ -n "$version" ]] || return 0
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(image "$version")" 2>/dev/null || true
}

status() {
  local version
  version=$(envget VERSION)
  echo "VERSION=$version PREVIOUS_VERSION=$(envget PREVIOUS_VERSION)"
  echo "Commit: $(current)"
  docker compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
  echo -n "Healthcheck https://$(envget DOMAIN)/api/health: "
  # Bis zu 60 s warten, etwa bis Caddy beim ersten Start das Zertifikat hat
  local i
  for i in $(seq 1 30); do
    curl -fsS -m 10 "https://$(envget DOMAIN)/api/health" 2> /dev/null && { echo; return 0; }
    sleep 2
  done
  # Ausdrücklich zurückgeben: Innerhalb von "activate || ..." greift set -e nicht
  if curl -fsS -m 10 "https://$(envget DOMAIN)/api/health"; then echo; else echo; return 1; fi
}

"$@"
EOF

remote() { "${SSH[@]}" "$DEPLOY_HOST" "DEPLOY_DIR='$DEPLOY_DIR' bash -s -- $*" <<< "$SERVER"; }

# Arguments enter a remote shell: validate every externally supplied path/version before use.
[[ "$DEPLOY_DIR" =~ ^/[A-Za-z0-9_./-]+$ && "$DEPLOY_DIR" != / && "$DEPLOY_DIR" != *..* ]] \
  || { echo 'Ungültiges DEPLOY_DIR' >&2; exit 1; }
valid_version() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && "$1" != *..* ]]; }

case "${1:-}" in
  deploy)
    commit=$(git rev-parse --verify "${2:?Commit fehlt}^{commit}")
    archive=${3:?Image-Archiv fehlt}
    expected=${4:?Image-ID fehlt}
    version=${5:?Version fehlt}
    [[ -f "$archive" && "$expected" =~ ^sha256:[a-f0-9]{64}$ ]] && valid_version "$version" \
      || { echo 'Ungültiges Image-Archiv, Image-ID oder Version' >&2; exit 1; }
    git -C "$(git rev-parse --show-toplevel)" -c core.autocrlf=false -c core.eol=lf archive --format=tar "$commit" app \
      | "${SSH[@]}" "$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR/build/$version' && tar -x -C '$DEPLOY_DIR/build/$version' --strip-components=1"
    "${SSH[@]}" "$DEPLOY_HOST" 'docker load' < "$archive"
    remote promote "$expected" "$version" "$commit"
    ;;
  release)
    commit=$(git rev-parse --verify "${2:-HEAD}^{commit}")
    version=${3:-$(git rev-parse --short=7 "$commit")}
    valid_version "$version" || { echo "Ungültige Version: $version" >&2; exit 1; }
    echo "Übertrage app/ aus $commit als Version $version nach $DEPLOY_HOST:$DEPLOY_DIR/build/$version"
    # core.autocrlf=false: unter Windows würde git archive sonst CRLF-Zeilenenden in Skripte und Quellen schreiben
    git -C "$(git rev-parse --show-toplevel)" -c core.autocrlf=false -c core.eol=lf archive --format=tar "$commit" app \
      | "${SSH[@]}" "$DEPLOY_HOST" "rm -rf '$DEPLOY_DIR/build/$version' && mkdir -p '$DEPLOY_DIR/build/$version' && tar -x -C '$DEPLOY_DIR/build/$version' --strip-components=1"
    remote build "$commit" "$version"
    remote switch "$version"
    remote prune
    ;;
  switch)
    valid_version "${2:-}" || { echo "Aufruf: deploy/deploy.sh switch VERSION (gültige Version erforderlich)" >&2; exit 1; }
    remote switch "$2"
    ;;
  rollback) remote rollback ;;
  status) remote status ;;
  current) remote current ;;
  version) remote version ;;
  prune) remote prune ;;
  *)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

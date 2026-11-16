#!/usr/bin/env bash
# Executes the real local and remote deployment scripts against isolated fake SSH/Docker services.
set -euo pipefail
source_root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$source_root/.build"
fixture=$(mktemp -d "$source_root/.build/deploy-test.XXXXXX")
export FIXTURE_SERVER="$fixture/server" MOCK_LOG="$fixture/docker.log"
export MOCK_ID="sha256:$(printf 'a%.0s' {1..64})"
export DEPLOY_HOST=test@example.test DEPLOY_DIR=/opt/ki-web
mkdir -p "$fixture/bin" "$FIXTURE_SERVER/build/old/deploy" "$fixture/repo/app/deploy"
printf 'services: {}\n' > "$fixture/repo/app/compose.yaml"
printf ':80 {}\n' > "$fixture/repo/app/deploy/Caddyfile"
cp "$fixture/repo/app/compose.yaml" "$FIXTURE_SERVER/build/old/compose.yaml"
cp "$fixture/repo/app/deploy/Caddyfile" "$FIXTURE_SERVER/build/old/deploy/Caddyfile"
printf 'REGISTRY=local\nVERSION=old\nPREVIOUS_VERSION=older\nDOMAIN=example.test\n' > "$FIXTURE_SERVER/.env"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
git init -q -b main "$fixture/repo"
git -C "$fixture/repo" config user.name Test
git -C "$fixture/repo" config user.email test@example.test
git -C "$fixture/repo" add app
git -C "$fixture/repo" commit -qm 'test: deploy fixture'
export MOCK_COMMIT
MOCK_COMMIT=$(git -C "$fixture/repo" rev-parse HEAD)
touch "$fixture/image.tar"
cat > "$fixture/bin/ssh" <<'SSH'
#!/usr/bin/env bash
set -euo pipefail
target=${!#}
target=${target//\/opt\/ki-web/$FIXTURE_SERVER}
exec bash -c "$target"
SSH
cat > "$fixture/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_LOG"
case "$1 ${2:-}" in
  'load '*) cat > /dev/null ;;
  'image inspect')
    if [[ "$*" == *org.opencontainers.image.revision* ]]; then echo "${MOCK_REVISION:-$MOCK_COMMIT}";
    elif [[ "$*" == *'{{.Id}}'* ]]; then echo "$MOCK_ID"; fi ;;
  'compose up')
    if [[ "${MOCK_FAIL_NEW:-}" == true ]] && grep -q '^VERSION=new' "$FIXTURE_SERVER/.env"; then exit 1; fi ;;
  'compose ps') [[ "$*" != *' -q '* ]] || echo mock-container ;;
  'inspect -f') echo "$MOCK_ID" ;;
esac
DOCKER
cat > "$fixture/bin/curl" <<'CURL'
#!/usr/bin/env bash
echo '{"status":"ok"}'
CURL
chmod +x "$fixture/bin/ssh" "$fixture/bin/docker" "$fixture/bin/curl"
export PATH="$fixture/bin:$PATH"
cd "$fixture/repo"
deploy() { bash "$source_root/app/deploy/deploy.sh" "$@"; }
deploy deploy "$MOCK_COMMIT" "$fixture/image.tar" "$MOCK_ID" new > "$fixture/output"
grep -q '^VERSION=new$' "$FIXTURE_SERVER/.env"
grep -q '^PREVIOUS_VERSION=old$' "$FIXTURE_SERVER/.env"
! grep -q '^build ' "$MOCK_LOG"
grep -q '^load$' "$MOCK_LOG"
# External smoke failure uses the same rollback operation as the workflow.
deploy switch old > /dev/null
grep -q '^VERSION=old$' "$FIXTURE_SERVER/.env"
# Wrong source image must not be activated.
export MOCK_REVISION=wrong
if deploy deploy "$MOCK_COMMIT" "$fixture/image.tar" "$MOCK_ID" wrong > /dev/null 2>&1; then exit 1; fi
grep -q '^VERSION=old$' "$FIXTURE_SERVER/.env"
unset MOCK_REVISION
# Failed startup returns failure and restores the previous healthy version.
export MOCK_FAIL_NEW=true
if deploy deploy "$MOCK_COMMIT" "$fixture/image.tar" "$MOCK_ID" new2 > /dev/null 2>&1; then exit 1; fi
grep -q '^VERSION=old$' "$FIXTURE_SERVER/.env"
# Remote-shell arguments must not execute arbitrary syntax.
if deploy switch 'old; touch INJECTED' > /dev/null 2>&1; then exit 1; fi
[[ ! -f INJECTED ]]
echo 'Deployment-Tests bestanden: CI-Image, Revision, Rückkehr nach Smoke-/Startfehler und Argumentvalidierung.'

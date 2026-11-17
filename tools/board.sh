#!/usr/bin/env bash
# GitHub-Projekt AI Perspectives: <issue> <Status> | list [--all] | get <issue>
# block <issue> <Fragen-Datei> | unblock <issue> | ensure-blocked (Maintainer)
# GH_TOKEN benötigt repo und project. Vor unblock Antworten im Issue lesen.
set -euo pipefail
exec node "$(dirname "$0")/board.mjs" "$@"

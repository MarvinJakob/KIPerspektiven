#!/usr/bin/env bash
# Setzt den Status eines Issues im GitHub-Projekt „AI Perspectives“ und nimmt es bei Bedarf ins Projekt auf.
#
#   tools/board.sh <issue> "<Status>"
#
# Status (Feld „Status“ im Projekt): Neu | In Arbeit | Spezifiziert | Bug offen | Merge Gate | Funktioniert
# Braucht GH_TOKEN mit den Scopes repo und project. Ein Fehler hier blockiert die Arbeit nicht:
# Maßgeblich für die Auswahl von Aufgaben sind die Labels (AGENTS.md, „Labels und Board“).
set -euo pipefail

OWNER=MarvinJakob
REPO=MarvinJakob/AIPerspectives
TITLE="AI Perspectives"
issue=${1:?Issue-Nummer fehlt}
status=${2:?Status fehlt}

number=$(gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title == \"$TITLE\") | .number")
[[ -n "$number" ]] || { echo "FEHLER: Projekt „$TITLE“ nicht gefunden (Scope project?)" >&2; exit 1; }
project_id=$(gh project view "$number" --owner "$OWNER" --format json --jq '.id')
item_id=$(gh project item-add "$number" --owner "$OWNER" --url "https://github.com/$REPO/issues/$issue" --format json --jq '.id')
# gh --jq statt jq: jq ist unter Windows meist nicht installiert
status_field() { gh project field-list "$number" --owner "$OWNER" --format json --jq ".fields[] | select(.name == \"Status\") | $1"; }
field_id=$(status_field '.id')
option_id=$(status_field ".options[] | select(.name == \"$status\") | .id")
[[ -n "$option_id" ]] || { echo "FEHLER: Status „$status“ fehlt im Projekt. Vorhanden: $(status_field '[.options[].name] | join(", ")')" >&2; exit 1; }
gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id" > /dev/null
echo "#$issue → $status"

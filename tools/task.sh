#!/usr/bin/env bash
# Aufgaben-Sperre für parallele Agenten auf diesem Gerät (AGENTS.md, „Gemeinsame Regeln“).
#
#   tools/task.sh claim  <team> <issue>             Aufgabe belegen: Branch <team>/<issue> und Worktree
#                                                   .worktrees/<team>-<issue> aus origin/main, Label in-progress
#   tools/task.sh finish <team> <issue> [--abandon] Aufgabe abschließen: Worktree, lokalen und Remote-Branch
#                                                   entfernen, Label in-progress entfernen
#   tools/task.sh list                              belegte Aufgaben anzeigen
#   tools/task.sh pause <team> <issue>              sauberen Zwischenstand zur Übernahme freigeben
#   tools/task.sh resume <team> <issue>             freigegebene Aufgabe atomar übernehmen
#
# AGENT_ID ist eine eindeutige Sitzungs-ID (bei Codex automatisch CODEX_THREAD_ID).
# pause löscht weder Branch noch Worktree. Fragen und Übergabe vorher im Issue dokumentieren.
#
# team: spec (Team 1), verify (Team 2), fix (Team 3), maint (ausdrücklicher Wartungsauftrag).
# maint verwendet codex/maint-<issue>; issue: Nummer des GitHub-Issues (REQ-0: 0).
#
# Exitcodes von claim: 0 belegt (Pfad des Worktrees in der letzten Zeile), 2 bereits von einem anderen
# Agenten belegt → nächste Aufgabe wählen, 1 Fehler.
# Die Sperre ist `git worktree add -b`: Git legt den Branch atomar an, ein zweiter Agent scheitert daran.
set -euo pipefail

REPO=MarvinJakob/AIPerspectives
die() { echo "FEHLER: $*" >&2; exit 1; }

cmd=${1:-}
team=${2:-}
issue=${3:-}
root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
agent_id=${AGENT_ID:-${CODEX_THREAD_ID:-${CODEX_SESSION_ID:-}}}

check_args() {
  [[ "$team" =~ ^(spec|verify|fix|maint)$ ]] || die "team muss spec, verify, fix oder maint sein"
  [[ "$issue" =~ ^[0-9]+$ ]] || die "issue muss eine Nummer sein"
  branch="$team/$issue"
  if [[ "$team" == maint ]]; then branch="codex/maint-$issue"; fi
  dir="$root/.worktrees/$team-$issue"
  state="$(git rev-parse --path-format=absolute --git-common-dir)/agent-tasks/$team-$issue"
}

identity() {
  [[ "$agent_id" =~ ^/?[A-Za-z0-9][A-Za-z0-9._:/-]+$ ]] || die "AGENT_ID als eindeutige Agentensitzung setzen"
}

lock_task() {
  # Git-CAS sperrt im gemeinsamen Repository, auch zwischen unterschiedlichen Shells/Worktrees.
  # Ein eigener Objektwert verhindert, dass ein später Cleanup eine fremde Sperre entfernt.
  operation_ref="refs/agent-task-locks/$team-$issue"
  operation_oid=$(printf '%s\n%s\n%s\n%s\n' "$agent_id" "$BASHPID" "$RANDOM" "$RANDOM" | git -C "$root" hash-object -w --stdin)
  if ! git -C "$root" update-ref "$operation_ref" "$operation_oid" 0000000000000000000000000000000000000000 2> /dev/null; then
    echo "BELEGT: $branch wird gerade geändert"; exit 2
  fi
  trap 'git -C "$root" update-ref -d "$operation_ref" "$operation_oid"' EXIT
}

owned() {
  identity
  [[ -f "$state/active/owner" && "$(cat "$state/active/owner")" == "$agent_id" ]] \
    || die "Aufgabe ist nicht von dieser Agentensitzung belegt"
}

label() { # $1 add|remove; Issue 0 (REQ-0) hat kein Ticket
  [[ "$issue" == 0 ]] && return 0
  gh issue edit "$issue" -R "$REPO" "--$1-label" in-progress > /dev/null \
    || echo "WARNUNG: Label in-progress an #$issue nicht geändert (GH_TOKEN prüfen)" >&2
}

case "$cmd" in
  claim)
    check_args
    identity
    lock_task
    [[ ! -d "$state" ]] || { echo "BELEGT: $branch besitzt einen Zwischenstand oder Besitzer"; exit 2; }
    git -C "$root" fetch -q --prune origin
    if git -C "$root" ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
      echo "BELEGT: $branch existiert bereits auf origin"; exit 2
    fi
    mkdir -p "$root/.worktrees"
    if ! git -C "$root" worktree add -q -b "$branch" "$dir" origin/main 2> /dev/null; then
      echo "BELEGT: $branch existiert bereits lokal"; exit 2
    fi
    mkdir -p "$(dirname "$state")"
    mkdir "$state" "$state/active"
    printf '%s\n' "$agent_id" > "$state/active/owner"
    label add
    echo "Belegt: $branch"
    echo "$dir"
    ;;

  pause)
    check_args
    lock_task
    owned
    [[ -z "$(git -C "$dir" status --porcelain)" ]] || die "Zwischenstand zuerst committen; nichts wird verworfen"
    # Die Freigabe erscheint erst nach dem Entfernen des Labels. Bei Fehler bleibt die Sperre bestehen.
    if [[ "$issue" != 0 ]]; then gh issue edit "$issue" -R "$REPO" --remove-label in-progress > /dev/null; fi
    touch "$state/paused"
    rm "$state/active/owner"
    rmdir "$state/active"
    echo "Freigegeben (Branch und Worktree bleiben erhalten): $branch"
    ;;

  resume)
    check_args
    identity
    lock_task
    [[ -d "$dir" && -f "$state/paused" ]] || { echo "NICHT FREIGEGEBEN: $branch"; exit 2; }
    if ! mkdir "$state/active" 2> /dev/null; then echo "BELEGT: $branch"; exit 2; fi
    if [[ ! -f "$state/paused" ]]; then rmdir "$state/active"; exit 2; fi
    printf '%s\n' "$agent_id" > "$state/active/owner"
    rm "$state/paused"
    label add
    echo "Fortgesetzt durch $agent_id: $branch"
    echo "$dir"
    ;;

  finish)
    check_args
    lock_task
    # Alte Worktrees ohne Sitzungsdatei bleiben kompatibel; neue darf nur der Besitzer abschließen.
    if [[ -d "$state" ]]; then owned; fi
    if [[ "${4:-}" != "--abandon" ]]; then
      # Nur aufräumen, wenn nichts verloren geht: PR gemergt oder keine eigenen Commits
      merged=$(gh pr list -R "$REPO" --head "$branch" --state merged --json number --jq 'length' 2> /dev/null || echo 0)
      ahead=$(git -C "$root" rev-list --count "origin/main..$branch" 2> /dev/null || echo 0)
      if [[ "$merged" == 0 && "$ahead" != 0 ]]; then
        die "$branch hat $ahead Commit(s) ohne gemergten PR. Erst mergen oder bewusst mit --abandon verwerfen."
      fi
    fi
    if [[ -d "$dir" ]]; then
      [[ -z "$(git -C "$dir" status --porcelain)" || "${4:-}" == "--abandon" ]] \
        || die "Ungesicherte Änderungen in $dir. Committen oder mit --abandon verwerfen."
      git -C "$root" worktree remove --force "$dir"
    fi
    git -C "$root" branch -D "$branch" > /dev/null 2>&1 || true
    git -C "$root" push -q origin --delete "$branch" > /dev/null 2>&1 || true
    git -C "$root" worktree prune
    label remove
    if [[ -d "$state/active" ]]; then rm "$state/active/owner"; rmdir "$state/active"; fi
    if [[ -d "$state" ]]; then rmdir "$state"; fi
    echo "Abgeschlossen: $branch"
    ;;

  list)
    git -C "$root" worktree list
    echo
    gh issue list -R "$REPO" --label in-progress --json number,title,labels \
      --jq '.[] | "#\(.number) [\([.labels[].name] | join(","))] \(.title)"'
    ;;

  *)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

#!/usr/bin/env bash
# Aufgaben-Sperre für parallele Agenten auf diesem Gerät (AGENTS.md, „Gemeinsame Regeln“).
#
#   tools/task.sh claim  <team> <issue>             Aufgabe belegen: Branch <team>/<issue> und Worktree
#                                                   .worktrees/<team>-<issue> aus origin/main, Label in-progress
#   tools/task.sh finish <team> <issue> [--abandon] Aufgabe abschließen: Worktree, lokalen und Remote-Branch
#                                                   entfernen, Label in-progress entfernen
#   tools/task.sh list                              belegte Aufgaben anzeigen
#
# team: spec (Team 1), verify (Team 2), fix (Team 3). issue: Nummer des GitHub-Issues (REQ-0: 0).
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

check_args() {
  [[ "$team" =~ ^(spec|verify|fix)$ ]] || die "team muss spec, verify oder fix sein"
  [[ "$issue" =~ ^[0-9]+$ ]] || die "issue muss eine Nummer sein"
  branch="$team/$issue"
  dir="$root/.worktrees/$team-$issue"
}

label() { # $1 add|remove; Issue 0 (REQ-0) hat kein Ticket
  [[ "$issue" == 0 ]] && return 0
  gh issue edit "$issue" -R "$REPO" "--$1-label" in-progress > /dev/null \
    || echo "WARNUNG: Label in-progress an #$issue nicht geändert (GH_TOKEN prüfen)" >&2
}

case "$cmd" in
  claim)
    check_args
    git -C "$root" fetch -q --prune origin
    if git -C "$root" ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
      echo "BELEGT: $branch existiert bereits auf origin"; exit 2
    fi
    mkdir -p "$root/.worktrees"
    if ! git -C "$root" worktree add -q -b "$branch" "$dir" origin/main 2> /dev/null; then
      echo "BELEGT: $branch existiert bereits lokal"; exit 2
    fi
    label add
    echo "Belegt: $branch"
    echo "$dir"
    ;;

  finish)
    check_args
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

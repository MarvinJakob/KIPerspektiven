#!/usr/bin/env bash
# Stable bootstrap: usable even from a stale, dirty checkout. Never changes its branch/files.
set -euo pipefail
root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
git -C "$root" -c gc.auto=0 fetch -q origin main
commit=$(git -C "$root" rev-parse origin/main)
process_dir="$root/.worktrees/process-$commit"
if [[ ! -d "$process_dir" ]]; then
  if ! git -C "$root" worktree add --detach "$process_dir" "$commit"; then
    [[ -d "$process_dir" && "$(git -C "$process_dir" rev-parse HEAD)" == "$commit" ]] || exit 1
  fi
fi
[[ "$(git -C "$process_dir" rev-parse HEAD)" == "$commit" ]] || { echo 'Prozess-Checkout hat falschen Commit' >&2; exit 1; }
[[ -z "$(git -C "$process_dir" status --porcelain)" ]] || { echo 'Prozess-Checkout wurde verändert; nicht verwenden' >&2; exit 1; }
cd "$process_dir"
export WORK_PROCESS_COMMIT="$commit"
if [[ $# == 0 ]]; then set -- --check; fi
exec node tools/worker.mjs "$@"

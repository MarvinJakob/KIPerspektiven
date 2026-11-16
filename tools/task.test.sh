#!/usr/bin/env bash
# Isolierte Integrationstests ohne GitHub-Zugriff. Testdaten bleiben unter .build/.
set -euo pipefail
source_root=$(cd "$(dirname "$0")/.." && pwd)
task="$source_root/tools/task.sh"
mkdir -p "$source_root/.build"
fixture=$(mktemp -d "$source_root/.build/task-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/gh" <<'GH'
#!/usr/bin/env bash
if [[ "$*" == *"pr list"* ]]; then echo 0; fi
if [[ "$*" == *"--remove-label"* && -n "${GH_FAIL_REMOVE_ONCE:-}" && ! -f "$GH_FAIL_REMOVE_ONCE" ]]; then
  touch "$GH_FAIL_REMOVE_ONCE"
  exit 1
fi
exit 0
GH
chmod +x "$fixture/bin/gh"
export PATH="$fixture/bin:$PATH"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
git init -q --bare "$fixture/remote.git"
git init -q -b main "$fixture/repo"
cd "$fixture/repo"
git config user.name 'Workflow Test'
git config user.email 'workflow@example.test'
printf 'base\n' > state.txt
git add state.txt
git commit -qm 'test: initial'
git remote add origin "$fixture/remote.git"
git push -q -u origin main

run_as() { AGENT_ID="$1" bash "$task" "${@:2}"; }
expect_code() {
  local expected=$1 actual=0
  shift
  "$@" > "$fixture/last-output" 2>&1 || actual=$?
  [[ "$actual" == "$expected" ]] || { cat "$fixture/last-output"; echo "Erwartet $expected, erhalten $actual"; exit 1; }
}

run_as implementer-A claim fix 101 > /dev/null
worktree="$fixture/repo/.worktrees/fix-101"
expect_code 2 run_as reviewer-B claim fix 101
expect_code 2 run_as reviewer-B resume fix 101
expect_code 1 run_as reviewer-B pause fix 101
expect_code 1 run_as reviewer-B finish fix 101

printf 'unfinished\n' >> "$worktree/state.txt"
expect_code 1 run_as implementer-A pause fix 101
[[ -d "$worktree" ]] || exit 1
git -C "$worktree" add state.txt
git -C "$worktree" commit -qm 'test: checkpoint'
checkpoint=$(git -C "$worktree" rev-parse HEAD)
run_as implementer-A pause fix 101 > /dev/null
[[ "$(git -C "$worktree" rev-parse HEAD)" == "$checkpoint" ]] || exit 1

# Zwei freie Agenten versuchen dieselbe Übergabe: genau einer muss gewinnen.
for attempt in {1..10}; do
  (AGENT_ID=reviewer-B PS4='+ [$BASHPID] ' bash -x "$task" resume fix 101 > "$fixture/B" 2>&1 && echo 0 > "$fixture/B-code" || echo $? > "$fixture/B-code") &
  first=$!
  (AGENT_ID=reviewer-C PS4='+ [$BASHPID] ' bash -x "$task" resume fix 101 > "$fixture/C" 2>&1 && echo 0 > "$fixture/C-code" || echo $? > "$fixture/C-code") &
  second=$!
  wait "$first" "$second"
  codes="$(cat "$fixture/B-code")$(cat "$fixture/C-code")"
  [[ "$codes" == 02 || "$codes" == 20 ]] || { cat "$fixture/B" "$fixture/C"; exit 1; }
  expect_code 1 run_as implementer-A pause fix 101
  [[ "$(git -C "$worktree" rev-parse HEAD)" == "$checkpoint" ]] || exit 1
  if [[ "$attempt" != 10 ]]; then
    winner=$(cat .git/agent-tasks/fix-101/active/owner)
    run_as "$winner" pause fix 101 > /dev/null
  fi
done

# Finish hält seine Sperre auch nach Branch-Löschung bis zum vollständigen Zustandsabbau.
export TASK_REAL_GIT
TASK_REAL_GIT=$(command -v git)
export TASK_FINISH_BARRIER="$fixture/barrier"
mkdir "$TASK_FINISH_BARRIER"
cat > "$fixture/bin/git" <<'GIT'
#!/usr/bin/env bash
"$TASK_REAL_GIT" "$@"
result=$?
if [[ "$*" == *'branch -D fix/102'* && "$result" == 0 ]]; then
  touch "$TASK_FINISH_BARRIER/entered"
  for _ in {1..200}; do
    [[ -f "$TASK_FINISH_BARRIER/release" ]] && exit "$result"
    sleep 0.05
  done
  exit 1
fi
exit "$result"
GIT
chmod +x "$fixture/bin/git"
run_as /root/implementer claim fix 102 > /dev/null
(run_as /root/implementer finish fix 102 > "$fixture/finish" 2>&1) &
finisher=$!
for _ in {1..200}; do
  [[ -f "$TASK_FINISH_BARRIER/entered" ]] && break
  sleep 0.05
done
[[ -f "$TASK_FINISH_BARRIER/entered" ]] || { cat "$fixture/finish"; exit 1; }
expect_code 2 run_as next-agent claim fix 102
touch "$TASK_FINISH_BARRIER/release"
wait "$finisher"
run_as next-agent claim fix 102 > /dev/null
[[ "$(cat .git/agent-tasks/fix-102/active/owner)" == next-agent ]] || exit 1
run_as maintainer-A claim maint 103 > /dev/null
[[ "$(git -C "$fixture/repo/.worktrees/maint-103" branch --show-current)" == codex/maint-103 ]] || exit 1
run_as maintainer-A pause maint 103 > /dev/null
run_as maintainer-B resume maint 103 > /dev/null
run_as maintainer-B finish maint 103 > /dev/null

# A real worktree creation error is not reported as an occupied ticket.
mkdir -p "$fixture/repo/.worktrees/fix-104"
printf 'keep\n' > "$fixture/repo/.worktrees/fix-104/untracked"
expect_code 1 run_as implementer-A claim fix 104
[[ -f "$fixture/repo/.worktrees/fix-104/untracked" ]] || exit 1

# Only the owner may refresh the recovery heartbeat.
run_as implementer-A claim fix 105 > /dev/null
expect_code 1 run_as reviewer-B heartbeat fix 105
run_as implementer-A heartbeat fix 105
[[ -s .git/agent-tasks/fix-105/heartbeat ]] || exit 1

# A failed label write after local cleanup can be retried without the deleted branch/worktree.
export GH_FAIL_REMOVE_ONCE="$fixture/remove-failed"
expect_code 1 run_as implementer-A finish fix 105
[[ -f .git/agent-tasks/fix-105/finishing-head ]] || exit 1
[[ ! -d "$fixture/repo/.worktrees/fix-105" ]] || exit 1
run_as implementer-A finish fix 105 > /dev/null
[[ ! -d .git/agent-tasks/fix-105 ]] || exit 1
unset GH_FAIL_REMOVE_ONCE

# Recovery can hand an interrupted terminal cleanup to a fresh session, even without a worktree.
run_as implementer-A claim fix 106 > /dev/null
export GH_FAIL_REMOVE_ONCE="$fixture/remove-failed-again"
expect_code 1 run_as implementer-A finish fix 106
rm .git/agent-tasks/fix-106/active/owner
rmdir .git/agent-tasks/fix-106/active
touch .git/agent-tasks/fix-106/paused
run_as reviewer-B resume fix 106 > /dev/null
run_as reviewer-B finish fix 106 > /dev/null
[[ ! -d .git/agent-tasks/fix-106 ]] || exit 1
unset GH_FAIL_REMOVE_ONCE

echo 'Task-Tests bestanden: Besitzer, Checkpoint, konkurrierende Wiederaufnahme, Finish/Claim-Sperre und Wartung.'

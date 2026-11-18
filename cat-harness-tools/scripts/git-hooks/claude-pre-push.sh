#!/bin/sh
# Claude Code PreToolUse hook on Bash, run before an agent's `git commit` and
# `git push`:
#
# 1. the state-branch wipe guard (scripts/state-write-guard.ts), on every
#    commit and push: it refuses one that deletes a state branch's
#    manifest.json or more than a few of its files, as the commits from a
#    `--no-checkout` clone did on 2026-11-15 (631aace4, e7d7e42). Never off.
# 2. the fast gates before a push (scripts/pre-push-gates.ts --claude-hook,
#    bean cat-tools-pp9g), off unless the checkout opts in.
#
# Every Bash call passes through here, so the common case costs one `case`:
# bun starts only when the tool call mentions `commit` or `push`. Exit 2
# blocks the call.
input="$(cat)"
case "$input" in
    *commit*|*push*) ;;
    *) exit 0 ;;
esac
dir="$(cd "$(dirname "$0")/.." && pwd)"
command -v bun >/dev/null 2>&1 || exit 0
if [ -f "$dir/state-write-guard.ts" ]; then
    printf '%s' "$input" | bun run "$dir/state-write-guard.ts" --claude-hook || exit $?
fi
case "$input" in
    *push*) ;;
    *) exit 0 ;;
esac
printf '%s' "$input" | bun run "$dir/pre-push-gates.ts" --claude-hook

#!/bin/sh
# Claude Code PreToolUse hook on Bash: the fast gates before an agent's
# `git push` (scripts/pre-push-gates.ts --claude-hook, bean cat-tools-pp9g).
#
# Every Bash call passes through here, so the common case costs one `case`:
# bun starts only when the tool call mentions `push`. Exit 2 blocks the call.
input="$(cat)"
case "$input" in
    *push*) ;;
    *) exit 0 ;;
esac
dir="$(cd "$(dirname "$0")/.." && pwd)"
command -v bun >/dev/null 2>&1 || exit 0
printf '%s' "$input" | bun run "$dir/pre-push-gates.ts" --claude-hook

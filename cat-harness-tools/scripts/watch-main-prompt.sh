#!/usr/bin/env bash
# SessionStart hook: when the session starts on a feature branch
# (anything other than main / master), instruct the agent to arm
# `/watch main` so it sees new commits landing upstream during the
# session.
#
# Why: long-running feature branches risk silently diverging from
# main. The `local/watch` skill (skills/local/watch.md) handles
# integration / conflict / reuse classification per upstream commit.
# `local/coordinate` §8a piggybacks on the same baseline, so arming
# the watcher here also primes coordination among PR agents.
#
# Output is consumed by Claude (hook stdout shows up in-context).

set -uo pipefail

# Bail silently if not in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

case "$BRANCH" in
  ""|"HEAD"|"main"|"master")
    exit 0  # detached / main — nothing to watch
    ;;
esac

# Don't re-arm if a previous session in the same repo already did.
# Slugify the branch name (replace `/` with `_`) so refs like
# `claude/add-coordinate-command-4rHOK` don't turn the flag path into a
# directory tree. Same pattern as watch.md §1.
STATE_DIR=".claude/local-state"
SAFE_BRANCH=$(printf '%s' "$BRANCH" | tr '/' '_')
ARMED_FLAG="$STATE_DIR/watch-main-armed.$SAFE_BRANCH"
mkdir -p "$STATE_DIR"

# Arm marker is per-branch and per-day to avoid stale flags surviving
# long-lived branches; rearming once a day is cheap.
TODAY=$(date -u +%Y-%m-%d)
if [ -f "$ARMED_FLAG" ] && grep -qxF "$TODAY" "$ARMED_FLAG" 2>/dev/null; then
  exit 0
fi
echo "$TODAY" > "$ARMED_FLAG"

cat <<EOF
WATCH_MAIN_PROMPT: session is on feature branch '$BRANCH'.
Action: invoke the local/watch skill in branch:main mode (no user
prompt needed) to monitor origin/main for new commits during this
session. Per .claude/skills/local/watch.md §2, arm a persistent
Monitor task on origin/main with a 5-minute poll. For each new
commit run the §3 integration checklist (overlap / conflict / reuse
/ act-or-defer).

If this session is also coordinating with sibling PRs, the same
baseline feeds local/coordinate §8a (watch main) and §8b (newly-
opened branches). Run /coordinate when sibling PRs are named or
when a new PR overlaps this branch's scope keywords.
EOF

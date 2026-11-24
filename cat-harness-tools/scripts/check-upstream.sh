#!/usr/bin/env bash
# PostCommit hook: check if upstream main has new commits.
# Skips SHAs the user has already declined.
#
# State file: .claude/local-state/declined-upstream-shas
# Each line is a SHA that was offered and declined.

set -euo pipefail

STATE_DIR=".claude/local-state"
DECLINED_FILE="$STATE_DIR/declined-upstream-shas"

# Ensure state dir exists
mkdir -p "$STATE_DIR"
touch "$DECLINED_FILE"

# Fetch latest main (quiet, tolerate network failure).
# Explicit refspec: `git fetch origin main` refreshes refs/remotes/origin/main
# only if the clone's configured refspec covers it, and exits 0 either way — so
# a narrowed refspec makes every comparison below read a stale ref. See 9giz.
if ! git fetch origin '+refs/heads/main:refs/remotes/origin/main' --quiet 2>/dev/null; then
  exit 0  # network issue — silently skip
fi

UPSTREAM_SHA=$(git rev-parse origin/main 2>/dev/null || true)
LOCAL_BASE=$(git merge-base HEAD origin/main 2>/dev/null || true)

# Nothing to do if we're already up to date
if [ "$UPSTREAM_SHA" = "$LOCAL_BASE" ]; then
  exit 0
fi

# Check if this SHA was already declined
if grep -qxF "$UPSTREAM_SHA" "$DECLINED_FILE" 2>/dev/null; then
  exit 0  # already offered and declined
fi

# Count new commits
NEW_COMMITS=$(git rev-list --count "$LOCAL_BASE".."$UPSTREAM_SHA" 2>/dev/null || echo 0)
if [ "$NEW_COMMITS" -eq 0 ]; then
  exit 0
fi

# Report to the agent via stdout (hook output is shown to Claude)
SUMMARY=$(git log --oneline "$LOCAL_BASE".."$UPSTREAM_SHA" 2>/dev/null | head -5)
cat <<EOF
UPSTREAM_CHECK: origin/main has $NEW_COMMITS new commit(s) since branch point.
UPSTREAM_SHA: $UPSTREAM_SHA
Recent commits:
$SUMMARY
---
To skip this SHA permanently, the agent should append "$UPSTREAM_SHA" to $DECLINED_FILE.
To merge: git merge origin/main
EOF

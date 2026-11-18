#!/usr/bin/env bash
#
# PostCommit hook: print server restart command and viewer links
# after a push completes.
#
# Only triggers when the push actually went through (checks if
# local branch is up-to-date with its remote tracking branch).
#
set -uo pipefail

source "$(dirname "$0")/folio-port.sh"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
PORT="$FOLIO_PORT"

# Only show after a push (remote tracking branch matches local HEAD)
LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
REMOTE_SHA=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "none")
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  exit 0  # not pushed yet, skip
fi

# Find which content files changed in the last commit
CHANGED_LABELS=""
for f in $(git diff --name-only HEAD~1 HEAD -- 'content/' 2>/dev/null); do
  case "$f" in
    *.md|*.ts)
      # Extract label from .ts manifest if it exists
      ts_file="${f%.md}.ts"
      [ "${f##*.}" = "ts" ] && ts_file="$f"
      if [ -f "$ts_file" ]; then
        label=$(grep -oP "label:\s*['\"]\\K[^'\"]*" "$ts_file" 2>/dev/null | head -1)
        [ -n "$label" ] && CHANGED_LABELS="$CHANGED_LABELS $label"
      fi
      ;;
  esac
done

cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 Pushed to: $BRANCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restart & preview:
  git fetch origin $BRANCH && git switch $BRANCH && git pull origin $BRANCH && ./scripts/start-folio-assistant.sh --http

Viewer links:
  http://localhost:${PORT}/viewer/
  http://localhost:${PORT}/folio/
EOF

# Add specific block links if we found labels
for label in $CHANGED_LABELS; do
  echo "  http://localhost:${PORT}/viewer/#${label}"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit 0

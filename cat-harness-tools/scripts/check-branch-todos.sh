#!/bin/bash
# Cross-reference open feedback with content blocks modified in the current branch.
# Scans feedback/<paper-dir>/*.ts for items matching changed content blocks.
# Outputs JSON: { "matches": [...], "count": N }
#
# Usage: ./scripts/check-branch-todos.sh [base-branch]
#   base-branch defaults to "main"

set -euo pipefail

BASE="${1:-main}"
REPO_ROOT="$(bash "$(dirname "$0")/lib/harness-root.sh")"
FEEDBACK_DIR="$REPO_ROOT/feedback"

# If no feedback dir or not in a git repo, exit clean
if [ ! -d "$FEEDBACK_DIR" ]; then
  echo '{"matches":[],"count":0}'
  exit 0
fi

# Get current branch
CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT" ] || [ "$CURRENT" = "$BASE" ]; then
  echo '{"matches":[],"count":0}'
  exit 0
fi

# Check if base branch exists
if ! git rev-parse --verify "$BASE" &>/dev/null; then
  echo '{"matches":[],"count":0}'
  exit 0
fi

# Get content files changed in this branch vs base
changed_files=$(git diff --name-only "$BASE"...HEAD -- 'content/**/*.ts' 'content/**/*.md' 'content/**/*.lean' 2>/dev/null || true)

if [ -z "$changed_files" ]; then
  echo '{"matches":[],"count":0}'
  exit 0
fi

# Extract unique root names from changed files
root_names=$(echo "$changed_files" | sed 's|.*/||; s/\.[^.]*$//' | sort -u)

# Match feedback items against changed root names
run_match() {
  local runner="$1"
  shift
  "$runner" "$@" -e "
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const feedbackDir = '$FEEDBACK_DIR';
const rootNames = new Set($(echo "$root_names" | jq -R -s 'split("\n") | map(select(length > 0))'));
const changedFiles = $(echo "$changed_files" | jq -R -s 'split("\n") | map(select(length > 0))');

const matches = [];
try {
  for (const paperDir of readdirSync(feedbackDir)) {
    const paperPath = join(feedbackDir, paperDir);
    for (const file of readdirSync(paperPath)) {
      if (!file.endsWith('.ts')) continue;
      const rootName = file.replace(/\.ts$/, '');
      if (!rootNames.has(rootName)) continue;
      const content = readFileSync(join(paperPath, file), 'utf-8');
      const stripped = content.replace(/^import\s+.*;\s*/m, '').replace(/\s+satisfies\s+\S+;\s*$/, ';');
      const m = stripped.match(/export\s+default\s+(\[[\s\S]*\])\s*;?\s*$/);
      if (!m) continue;
      try {
        const items = JSON.parse(m[1]);
        for (const item of items) {
          if (item.status === 'open' || item.status === 'in_progress') {
            const relevant = changedFiles.filter(f => f.includes(rootName));
            matches.push({ rootName, paperId: paperDir, todo: item, changedFiles: relevant });
          }
        }
      } catch {}
    }
  }
} catch {}

console.log(JSON.stringify({ matches, count: matches.length }));
" 2>/dev/null
}

if command -v bun &>/dev/null; then
  run_match bun
elif command -v node &>/dev/null; then
  run_match node
else
  echo '{"matches":[],"count":0}'
fi

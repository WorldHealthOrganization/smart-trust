#!/bin/bash
# Check for open feedback/todos across all feedback files.
# Called by SessionStart hook. Outputs JSON summary to stdout.
#
# Scans feedback/<paper-dir>/<rootName>.ts files (TypeScript arrays of FeedbackItem).
# Output JSON: { "count": N, "todos": [...], "summary": "..." }

REPO_ROOT="$(bash "$(dirname "$0")/lib/harness-root.sh")"
FEEDBACK_DIR="$REPO_ROOT/feedback"

if [ ! -d "$FEEDBACK_DIR" ]; then
  echo '{"count":0,"todos":[],"summary":"No open feedback."}'
  exit 0
fi

# Check for .ts files recursively
ts_files=$(find "$FEEDBACK_DIR" -name '*.ts' -type f 2>/dev/null)
if [ -z "$ts_files" ]; then
  echo '{"count":0,"todos":[],"summary":"No open feedback."}'
  exit 0
fi

# Use bun or npx tsx to evaluate TypeScript feedback files
if command -v bun &>/dev/null; then
  todos_json=$(bun -e "
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const feedbackDir = '$FEEDBACK_DIR';
const allTodos = [];

for (const paperDir of readdirSync(feedbackDir)) {
  const paperPath = join(feedbackDir, paperDir);
  try {
    for (const file of readdirSync(paperPath)) {
      if (!file.endsWith('.ts')) continue;
      const rootName = file.replace(/\.ts$/, '');
      try {
        const content = readFileSync(join(paperPath, file), 'utf-8');
        const stripped = content.replace(/^import\s+.*;\s*/m, '').replace(/\s+satisfies\s+\S+;\s*$/, ';');
        const match = stripped.match(/export\s+default\s+(\[[\s\S]*\])\s*;?\s*$/);
        if (!match) continue;
        const items = JSON.parse(match[1]);
        for (const item of items) {
          if (item.status === 'open' || item.status === 'in_progress') {
            allTodos.push({ ...item, paperId: paperDir, rootName });
          }
        }
      } catch {}
    }
  } catch {}
}

console.log(JSON.stringify(allTodos));
" 2>/dev/null)
elif command -v npx &>/dev/null; then
  todos_json=$(npx --yes tsx -e "
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const feedbackDir = '$FEEDBACK_DIR';
const allTodos: any[] = [];

for (const paperDir of readdirSync(feedbackDir)) {
  const paperPath = join(feedbackDir, paperDir);
  try {
    for (const file of readdirSync(paperPath)) {
      if (!file.endsWith('.ts')) continue;
      const rootName = file.replace(/\.ts$/, '');
      try {
        const content = readFileSync(join(paperPath, file), 'utf-8');
        const stripped = content.replace(/^import\s+.*;\s*/m, '').replace(/\s+satisfies\s+\S+;\s*$/, ';');
        const match = stripped.match(/export\s+default\s+(\[[\s\S]*\])\s*;?\s*$/);
        if (!match) continue;
        const items = JSON.parse(match[1]);
        for (const item of items) {
          if (item.status === 'open' || item.status === 'in_progress') {
            allTodos.push({ ...item, paperId: paperDir, rootName });
          }
        }
      } catch {}
    }
  } catch {}
}

console.log(JSON.stringify(allTodos));
" 2>/dev/null)
fi

if [ -z "$todos_json" ] || [ "$todos_json" = "[]" ]; then
  echo '{"count":0,"todos":[],"summary":"No open feedback."}'
  exit 0
fi

if command -v jq &>/dev/null; then
  count=$(echo "$todos_json" | jq 'length')
  critical=$(echo "$todos_json" | jq '[.[] | select(.priority == "critical")] | length')
  high=$(echo "$todos_json" | jq '[.[] | select(.priority == "high")] | length')
  medium=$(echo "$todos_json" | jq '[.[] | select(.priority == "medium")] | length')
  low=$(echo "$todos_json" | jq '[.[] | select(.priority == "low")] | length')

  summary="Open feedback: $count"
  [ "$critical" -gt 0 ] && summary="$summary | critical: $critical"
  [ "$high" -gt 0 ] && summary="$summary | high: $high"
  [ "$medium" -gt 0 ] && summary="$summary | medium: $medium"
  [ "$low" -gt 0 ] && summary="$summary | low: $low"

  top=$(echo "$todos_json" | jq -r '
    sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
    .[0:5] |
    .[] |
    "  [\(.priority)] \(.rootName): \(.summary // "(no summary)" | .[0:60])"
  ')

  if [ -n "$top" ]; then
    summary="$summary
$top"
  fi

  jq -n --argjson todos "$todos_json" --arg summary "$summary" \
    '{count: ($todos | length), todos: $todos, summary: $summary}'
else
  count=$(echo "$todos_json" | grep -o '"id"' | wc -l | tr -d ' ')
  echo "{\"count\":$count,\"todos\":$todos_json,\"summary\":\"$count open feedback item(s). Install jq for details.\"}"
fi

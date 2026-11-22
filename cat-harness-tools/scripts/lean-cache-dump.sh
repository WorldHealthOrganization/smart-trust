#!/usr/bin/env bash
# Delete all .witness files in content/ to force full Lean rebuild.
# Usage: ./scripts/lean-cache-dump.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

count=$(find "$REPO_ROOT/content" -name '*.witness' -type f 2>/dev/null | wc -l)
if [ "$count" -eq 0 ]; then
  echo "No witness files found — cache is empty."
  exit 0
fi

find "$REPO_ROOT/content" -name '*.witness' -type f -delete
echo "Removed $count witness file(s) — next build will re-validate all Lean files."

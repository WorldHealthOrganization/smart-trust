#!/usr/bin/env bash
# Print the cat-harness root this layer serves — the shell twin of
# scripts/lib/roots.ts `HARNESS_ROOT` (bean 70lx). A script that moved here
# from cat-harness computed "the harness" as `$(dirname "$0")/..`, which now
# means cat-harness-tools; it asks this instead.
#
# Order, as roots.ts: $CAT_HARNESS_ROOT, then the sibling ../cat-harness of
# this layer. Either must hold a cat-harness.json naming "cat-harness" — a
# directory that merely has the right name is not the harness. Nothing found
# is an error (exit 2), never a guess: a wrong root reads as an empty corpus.
set -euo pipefail
is_harness() { [ -f "$1/cat-harness.json" ] && grep -q '"name": *"cat-harness"' "$1/cat-harness.json"; }
tools_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -n "${CAT_HARNESS_ROOT:-}" ]; then
  if is_harness "$CAT_HARNESS_ROOT"; then (cd "$CAT_HARNESS_ROOT" && pwd); exit 0; fi
  echo "harness-root: \$CAT_HARNESS_ROOT=$CAT_HARNESS_ROOT holds no cat-harness.json naming cat-harness" >&2; exit 2
fi
sibling="$(cd "$tools_root/.." && pwd)/cat-harness"
if is_harness "$sibling"; then echo "$sibling"; exit 0; fi
echo "harness-root: no cat-harness found — set CAT_HARNESS_ROOT, or place cat-harness beside $tools_root" >&2
exit 2

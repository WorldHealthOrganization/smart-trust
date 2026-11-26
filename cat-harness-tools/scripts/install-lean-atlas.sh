#!/usr/bin/env bash
# Provision Lean Atlas (https://github.com/NyxFoundation/lean-atlas, MIT) for a
# content repo, so the formal dependency graph can be extracted authoritatively
# instead of falling back to the approximate `--scan` mode.
#
# Atlas is NOT a standalone binary: it is a Lake require declared in the CONTENT
# repo's lakefile.toml, built by that repo's Lake. So this script operates on a
# content repo (qou, …), not on folio-assistant itself. folio-assistant supplies
# the toolchain floor and this provisioning step; the content repo owns the pin.
#
# Usage:
#   scripts/install-lean-atlas.sh [content-repo-root]   # default: $PWD
#   LEAN_ATLAS_REV=<sha> scripts/install-lean-atlas.sh  # pin a commit
#   scripts/install-lean-atlas.sh --check               # probe only, no writes
#
# Network: needs github.com egress at RUN time (Lake fetches the require), not
# just at image-build time.
#
# See: cat-harness/scenarios/capabilities/lean-atlas.json
#      pipeline/lean-atlas-ingest.ts
set -euo pipefail

# Atlas requires Lean >= 4.17.0 (v4.28.0 tested upstream).
MIN_LEAN_MAJOR=4
MIN_LEAN_MINOR=17
LEAN_ATLAS_REV="${LEAN_ATLAS_REV:-main}"

CHECK_ONLY=0
ROOT="$PWD"
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) ROOT="$arg" ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }

# ── 1. Toolchain floor ───────────────────────────────────────────────────────
# Prefer the content repo's own pin: elan installs it on demand, and building
# Atlas against a different toolchain than the project is what produces the
# version-skew failures Lean Refactor's paper describes.
command -v lake >/dev/null 2>&1 || fail "lake not found on PATH — install elan first (see Dockerfile)."

if [ -f "$ROOT/lean-toolchain" ]; then
  PIN="$(tr -d '[:space:]' < "$ROOT/lean-toolchain")"
  echo "content repo pins: $PIN"
  VER="${PIN##*:v}"
else
  VER="$(lean --version 2>/dev/null | sed -n 's/.*version \([0-9][0-9.]*\).*/\1/p')"
  echo "no lean-toolchain at $ROOT; using ambient lean $VER"
fi

MAJOR="${VER%%.*}"
REST="${VER#*.}"
MINOR="${REST%%.*}"
if [ -z "${MAJOR:-}" ] || [ -z "${MINOR:-}" ]; then
  fail "could not parse a Lean version from '$VER'."
fi
if [ "$MAJOR" -lt "$MIN_LEAN_MAJOR" ] ||
   { [ "$MAJOR" -eq "$MIN_LEAN_MAJOR" ] && [ "$MINOR" -lt "$MIN_LEAN_MINOR" ]; }; then
  fail "Lean $VER is below Atlas's floor of ${MIN_LEAN_MAJOR}.${MIN_LEAN_MINOR}.0.
Raise the content repo's lean-toolchain (and re-verify its Mathlib pin).
Until then, use the approximate fallback:
  bun run cat-harness-tools/pipeline/lean-atlas-ingest.ts --scan"
fi
echo "Lean $VER satisfies Atlas's floor (>= ${MIN_LEAN_MAJOR}.${MIN_LEAN_MINOR}.0) ✓"

LAKEFILE="$ROOT/lakefile.toml"
[ -f "$LAKEFILE" ] || fail "no lakefile.toml at $ROOT — is this a content repo root?"

if grep -q 'name *= *"lean-atlas"' "$LAKEFILE" 2>/dev/null; then
  echo "lean-atlas require already present in $LAKEFILE"
  ALREADY=1
else
  ALREADY=0
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  if [ "$ALREADY" -eq 1 ] && (cd "$ROOT" && lake exe atlas --help >/dev/null 2>&1); then
    echo "atlas is provisioned and runnable ✓"
    exit 0
  fi
  echo "atlas NOT provisioned (run without --check to install)"
  exit 1
fi

# ── 2. Declare the require ───────────────────────────────────────────────────
# Appended, never rewritten: lakefile.toml is authored content in the content
# repo and may carry ordering the owner cares about.
if [ "$ALREADY" -eq 0 ]; then
  echo "adding lean-atlas require to $LAKEFILE (rev: $LEAN_ATLAS_REV)"
  cat >> "$LAKEFILE" <<EOF

# Formal dependency-graph extraction — consumed by
# pipeline/lean-atlas-ingest.ts --ingest. MIT.
# Pin \`rev\` to a commit for reproducible graphs.
[[require]]
name  = "lean-atlas"
scope = "NyxFoundation"
git   = "https://github.com/NyxFoundation/lean-atlas"
rev   = "$LEAN_ATLAS_REV"
EOF
fi

# ── 3. Fetch + build ─────────────────────────────────────────────────────────
cd "$ROOT"
echo "running: lake update lean-atlas  (needs github.com egress)"
lake update lean-atlas

echo "verifying: lake exe atlas --help"
lake exe atlas --help >/dev/null 2>&1 || fail "atlas built but is not runnable — check the Lake build output above."

cat <<'EOF'

lean-atlas provisioned ✓

Next — export the graph and ingest it:

  lake exe atlas graph-data --output /tmp/atlas-graph.json --pretty
  # adapt to folio's JSONL shape, then:
  bun run cat-harness-tools/pipeline/lean-atlas-ingest.ts --ingest /tmp/atlas-deps.jsonl
  bun run cat-harness-tools/pipeline/lean-atlas-ingest.ts --stale

NOTE: the graph-data JSON schema has not been verified against a live run in
folio-assistant, so the adapter to folio's JSONL still has to be written
against a real export. Do not assume the field names match.
EOF

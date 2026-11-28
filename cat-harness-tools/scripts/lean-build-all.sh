#!/usr/bin/env bash
# Build all Lean projects from the root Lake workspace.
#
# Discovers paper directories containing a lean-toolchain file and runs
# `lake build <target>` for each from the repo root (not a per-paper
# `cd`), so cross-package deps (e.g. qou → ugb) resolve via the root
# manifest instead of a possibly-stale per-paper manifest.
# Can be invoked from any directory.
#
# Usage:
#   ./scripts/lean-build-all.sh             # build all papers
#   ./scripts/lean-build-all.sh --paper quantum-observable-universe
#   ./scripts/lean-build-all.sh --cache     # fetch Mathlib cache first
#   ./scripts/lean-build-all.sh --update    # run lake update first
#   ./scripts/lean-build-all.sh --log-dir DIR   # logs + sidecar (default build-logs/)
#   ./scripts/lean-build-all.sh --commit-sidecar  # also commit + push the sidecar
#
# Every run writes a committable sidecar `<log-dir>/lean-build-status.json`
# (per-paper pass/fail, failing modules, extracted errors + sorry locations)
# alongside raw `<paper>.log` files (gitignored). Commit the JSON to share a
# build failure via the repo instead of copy-pasting terminal output.
#
# Exit code: 0 if all builds succeed, 1 if any fail.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTENT_DIR="$REPO_ROOT/content"

export PATH="$HOME/.elan/bin:$HOME/.local/bin:$PATH"

# ── Parse args ────────────────────────────────────────────────────
FILTER_PAPER=""
DO_CACHE=false
DO_UPDATE=false
DO_COMMIT=false
LOG_DIR="$REPO_ROOT/build-logs"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --paper)          FILTER_PAPER="$2"; shift 2 ;;
        --cache)          DO_CACHE=true; shift ;;
        --update)         DO_UPDATE=true; shift ;;
        --log-dir)        LOG_DIR="$2"; shift 2 ;;
        --commit-sidecar) DO_COMMIT=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--paper NAME] [--cache] [--update] [--log-dir DIR] [--commit-sidecar]"
            echo "  --paper NAME      Build only the named paper"
            echo "  --cache           Run 'lake exe cache get' before building"
            echo "  --update          Run 'lake update' before building"
            echo "  --log-dir DIR     Write logs + sidecar here (default build-logs/)"
            echo "  --commit-sidecar  Commit + push build-logs/lean-build-status.json"
            echo "                    (only that file; uses your configured git remote, e.g. SSH)"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# ── Pre-check ─────────────────────────────────────────────────────
if ! command -v lake &>/dev/null; then
    echo "Error: lake not found. Install Lean via: curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh"
    exit 1
fi

# ── Discover Lean projects ────────────────────────────────────────
# A Lean project is a directory under content/<paper>/lean/ that
# contains a lean-toolchain file.
LEAN_DIRS=()

for paper_dir in "$CONTENT_DIR"/*/; do
    paper_name=$(basename "$paper_dir")

    # Filter if --paper was given
    if [ -n "$FILTER_PAPER" ] && [ "$paper_name" != "$FILTER_PAPER" ]; then
        continue
    fi

    lean_dir="$paper_dir/lean"
    if [ -f "$lean_dir/lean-toolchain" ]; then
        LEAN_DIRS+=("$lean_dir")
    fi
done

if [ ${#LEAN_DIRS[@]} -eq 0 ]; then
    if [ -n "$FILTER_PAPER" ]; then
        echo "No Lean project found for paper: $FILTER_PAPER"
    else
        echo "No Lean projects found in $CONTENT_DIR"
    fi
    exit 1
fi

echo "Found ${#LEAN_DIRS[@]} Lean project(s):"
for d in "${LEAN_DIRS[@]}"; do
    paper=$(basename "$(dirname "$d")")
    toolchain=$(cat "$d/lean-toolchain" 2>/dev/null)
    echo "  $paper  ($toolchain)"
done
echo ""

# ── Root-workspace prep (update / cache once) ─────────────────────
cd "$REPO_ROOT"

if [ "$DO_UPDATE" = true ]; then
    echo "  → lake update (root workspace)"
    # Check PIPESTATUS[0] (lake), not the pipeline's exit (tail always 0).
    lake update 2>&1 | tail -5
    [ "${PIPESTATUS[0]}" -ne 0 ] && echo "  ⚠ lake update had warnings (continuing)"
fi

if [ "$DO_CACHE" = true ]; then
    echo "  → lake exe cache get (root workspace)"
    lake exe cache get 2>&1 | tail -5 || true
fi
echo ""

# ── Log dir + structured sidecar setup ────────────────────────────
mkdir -p "$LOG_DIR"
: > "$LOG_DIR/_status.tsv"   # truncate the per-run status table

# ── Build each project ────────────────────────────────────────────
TOTAL=0
PASSED=0
FAILED_PAPERS=()

for lean_dir in "${LEAN_DIRS[@]}"; do
    paper=$(basename "$(dirname "$lean_dir")")
    TOTAL=$((TOTAL + 1))

    echo "═══════════════════════════════════════════════════════"
    echo "  Building: $paper"
    echo "  Directory: $lean_dir"
    echo "═══════════════════════════════════════════════════════"

    # Build from the root workspace so cross-package deps resolve via
    # the root manifest (a per-paper `cd` + `lake build` trips on a
    # stale per-paper manifest, e.g. qou's path dep on ugb).
    cd "$REPO_ROOT"

    # Derive the Lake library target (defaultTargets) from the paper's
    # lakefile, e.g. quantum-observable-universe → QOU.
    target=$(grep -E '^[[:space:]]*defaultTargets' "$lean_dir/lakefile.toml" 2>/dev/null \
                 | grep -oE '"[^"]+"' | tr -d '"' | head -1)
    # Fallback to the package `name` if defaultTargets is absent, so a
    # lakefile without an explicit defaultTargets is still built (Lake
    # builds the default target when run in the package dir).
    if [ -z "$target" ]; then
        target=$(grep -E '^[[:space:]]*name[[:space:]]*=' "$lean_dir/lakefile.toml" 2>/dev/null \
                     | grep -oE '"[^"]+"' | tr -d '"' | head -1)
    fi
    if [ -z "$target" ]; then
        # Count as a failure, not a silent skip — the script advertises
        # that exit 0 means every discovered project built.
        echo "  ✗ no defaultTargets or package name in $lean_dir/lakefile.toml — cannot build"
        FAILED_PAPERS+=("$paper")
        printf '%s\t%s\t%s\t%s\t%s\n' \
            "$paper" "(none)" "fail" "0" "$paper.log" >> "$LOG_DIR/_status.tsv"
        continue
    fi

    # Build — tee full output to a per-paper log. `set -o pipefail`
    # (above) preserves lake's exit status through the tee pipe.
    echo "  → lake build $target"
    BUILD_START=$(date +%s)

    if lake build "$target" 2>&1 | tee "$LOG_DIR/$paper.log"; then
        status="ok"; PASSED=$((PASSED + 1))
    else
        status="fail"; FAILED_PAPERS+=("$paper")
    fi
    BUILD_END=$(date +%s)
    elapsed=$((BUILD_END - BUILD_START))

    if [ "$status" = "ok" ]; then
        echo ""
        echo "  ✓ $paper built successfully (${elapsed}s)"
    else
        echo ""
        echo "  ✗ $paper build FAILED (${elapsed}s) — see $LOG_DIR/$paper.log"
    fi

    # Append a row to the status table consumed by the sidecar generator.
    printf '%s\t%s\t%s\t%s\t%s\n' \
        "$paper" "$target" "$status" "$elapsed" "$paper.log" >> "$LOG_DIR/_status.tsv"
    echo ""
done

# ── Summary ───────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  Results: $PASSED/$TOTAL passed"
if [ ${#FAILED_PAPERS[@]} -gt 0 ]; then
    echo "  Failed:  ${FAILED_PAPERS[*]}"
fi
echo "═══════════════════════════════════════════════════════"

# ── Structured sidecar (committable failure log) ──────────────────
SIDECAR_GEN="$REPO_ROOT/scripts/lib/lean-build-sidecar.py"
SIDECAR_JSON="$LOG_DIR/lean-build-status.json"
if command -v python3 &>/dev/null && [ -f "$SIDECAR_GEN" ]; then
    python3 "$SIDECAR_GEN" "$LOG_DIR" || echo "  ⚠ sidecar generation failed (raw logs remain in $LOG_DIR)"
    echo "  Sidecar: $SIDECAR_JSON"

    if [ "$DO_COMMIT" = true ]; then
        # Commit + push ONLY the sidecar JSON (pathspec-scoped, so any
        # other staged/dirty work is left untouched), and only when it
        # actually changed. Push uses the repo's configured remote
        # (e.g. SSH) — no token handling here.
        if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- "$SIDECAR_JSON" 2>/dev/null)" ]; then
            branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
            git -C "$REPO_ROOT" add -- "$SIDECAR_JSON"
            if git -C "$REPO_ROOT" commit -q \
                    -m "build: lean-build sidecar (${PASSED} ok / ${#FAILED_PAPERS[@]} failed)" \
                    -- "$SIDECAR_JSON"; then
                if git -C "$REPO_ROOT" push origin "$branch"; then
                    echo "  ✓ sidecar committed + pushed to origin/$branch"
                else
                    echo "  ⚠ sidecar committed locally; push failed — run: git push origin $branch"
                fi
            else
                echo "  ⚠ sidecar commit failed (see git output above); JSON is at $SIDECAR_JSON"
            fi
        else
            echo "  (sidecar unchanged — nothing to commit)"
        fi
    elif [ ${#FAILED_PAPERS[@]} -gt 0 ]; then
        rel="${SIDECAR_JSON#"$REPO_ROOT"/}"
        echo "  Share this failure with the agent (no copy-paste):"
        echo "    git add $rel && git commit -m 'build: failure sidecar' && git push"
        echo "  (or re-run with --commit-sidecar to do that automatically)"
    fi
else
    echo "  (python3 not found — JSON sidecar skipped; raw logs in $LOG_DIR)"
fi

[ ${#FAILED_PAPERS[@]} -eq 0 ]

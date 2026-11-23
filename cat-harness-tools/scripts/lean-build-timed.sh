#!/usr/bin/env bash
# Timed per-file Lean build with slow-file stats.
#
# Builds each QOU module individually and measures wall-clock time.
# Prints a sorted report of the slowest files.
#
# Usage:
#   ./scripts/lean-build-timed.sh          # build all, print report
#   ./scripts/lean-build-timed.sh --top 5  # show only top 5 slowest
#   ./scripts/lean-build-timed.sh --threshold 10  # only files >10s

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEAN_DIR="$REPO_ROOT/content/quantum-observable-universe/lean"
TIMING_LOG="/tmp/qou-build-timing.csv"
REPORT="/tmp/qou-build-timing-report.txt"

export PATH="$HOME/.elan/bin:$HOME/.local/bin:$PATH"

TOP=${TOP:-20}
THRESHOLD=${THRESHOLD:-0}

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --top) TOP="$2"; shift 2 ;;
        --threshold) THRESHOLD="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if ! command -v lake &>/dev/null; then
    echo "Error: lake not found. Use MCP tool: lean_setup"
    exit 1
fi

cd "$LEAN_DIR"

# Collect all .lean files under QOU/ (excluding .lake/)
mapfile -t LEAN_FILES < <(find QOU/ Fred2005* -name '*.lean' -not -path '*/.lake/*' 2>/dev/null | sort)

echo "module,seconds,status" > "$TIMING_LOG"

TOTAL_START=$(date +%s)
TOTAL_FILES=${#LEAN_FILES[@]}
BUILT=0
FAILED=0

echo "═══════════════════════════════════════════════════════"
echo "  QOU Timed Build — $TOTAL_FILES files"
echo "  $(date)"
echo "═══════════════════════════════════════════════════════"
echo ""

for f in "${LEAN_FILES[@]}"; do
    # Convert file path to module name: QOU/Foo/Bar.lean → QOU.Foo.Bar
    mod=$(echo "$f" | sed 's|/|.|g; s|\.lean$||')

    FILE_START=$(date +%s%N)

    if lake build "$mod" > /tmp/qou-build-"$mod".log 2>&1; then
        status="ok"
        BUILT=$((BUILT + 1))
    else
        status="FAIL"
        FAILED=$((FAILED + 1))
    fi

    FILE_END=$(date +%s%N)
    # Elapsed in milliseconds
    elapsed_ms=$(( (FILE_END - FILE_START) / 1000000 ))
    elapsed_s=$(awk "BEGIN {printf \"%.2f\", $elapsed_ms/1000}")

    echo "$mod,$elapsed_s,$status" >> "$TIMING_LOG"

    # Print progress with timing
    if [ "$status" = "FAIL" ]; then
        printf "  %-55s %8ss  *** FAILED ***\n" "$mod" "$elapsed_s"
    elif (( elapsed_ms > 5000 )); then
        printf "  %-55s %8ss  [SLOW]\n" "$mod" "$elapsed_s"
    else
        printf "  %-55s %8ss\n" "$mod" "$elapsed_s"
    fi
done

TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_END - TOTAL_START))
TOTAL_MINS=$((TOTAL_ELAPSED / 60))
TOTAL_SECS=$((TOTAL_ELAPSED % 60))

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Build complete: ${TOTAL_MINS}m ${TOTAL_SECS}s"
echo "  OK: $BUILT   Failed: $FAILED   Total: $TOTAL_FILES"
echo "═══════════════════════════════════════════════════════"

# Generate sorted report
{
    echo ""
    echo "── Slowest files (top $TOP, threshold ${THRESHOLD}s) ──"
    echo ""
    printf "  %-55s %10s  %s\n" "MODULE" "TIME (s)" "STATUS"
    printf "  %-55s %10s  %s\n" "------" "--------" "------"
    tail -n +2 "$TIMING_LOG" \
        | awk -F',' -v thresh="$THRESHOLD" '$2+0 >= thresh+0 {print}' \
        | sort -t',' -k2 -rn \
        | head -"$TOP" \
        | while IFS=',' read -r mod secs stat; do
            printf "  %-55s %10s  %s\n" "$mod" "$secs" "$stat"
        done
    echo ""

    # Profiler output: extract declarations that took >500ms
    echo "── Slow declarations (from profiler, >500ms) ──"
    echo ""
    for f in /tmp/qou-build-QOU.*.log; do
        [ -f "$f" ] || continue
        grep -iE 'took [0-9]+(\.[0-9]+)?(ms|s)' "$f" 2>/dev/null \
            | while read -r line; do
                # Extract time value
                ms=$(echo "$line" | grep -oE '[0-9]+(\.[0-9]+)?ms' | grep -oE '[0-9.]+' | head -1)
                s=$(echo "$line" | grep -oE '[0-9]+(\.[0-9]+)?s' | grep -v 'ms' | grep -oE '[0-9.]+' | head -1)
                total_ms=0
                if [ -n "$ms" ]; then
                    total_ms=$(awk "BEGIN {printf \"%.0f\", $ms}")
                elif [ -n "$s" ]; then
                    total_ms=$(awk "BEGIN {printf \"%.0f\", $s * 1000}")
                fi
                if [ "$total_ms" -ge 500 ] 2>/dev/null; then
                    mod=$(basename "$f" .log | sed 's/^qou-build-//')
                    echo "  $mod: $line"
                fi
            done
    done
    echo ""
} | tee "$REPORT"

echo "Full CSV: $TIMING_LOG"
echo "Report:   $REPORT"

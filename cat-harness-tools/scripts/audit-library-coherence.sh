#!/usr/bin/env bash
# Library coherence audit.
#
# Counts how many in-repo Python compute scripts under
# folio-assistant/computations/ import each of the QOU library packages,
# and flags any library package with zero in-repo consumers as
# "alpha / external-only" — i.e. shipped to PyPI / npm but not yet
# adopted by the in-repo compute layer.
#
# Run from repo root:   ./scripts/audit-library-coherence.sh
# In CI, --strict exits non-zero when a NEW zero-import library appears
# (relative to the snapshot baked into this script — update it when you
# intentionally add a new external-only package).
#
# Snapshot 2026-06-01 (docs/ARCHITECTURE.md "Library coherence status";
# anchored regex on `^(import|from) <pkg>([ .]|$)` — excludes inline
# mentions in comments / strings / other identifiers):
#   qou-substrate    : 7
#   pyhecke          : 19
#   pyhecke-native   : 15
#   qou-mass         : 1  (alpha; canonical wiring example —
#                         qou_mass_canonical_wiring_example.py)
#   witness-schema   : 1  (alpha; same wiring example)

set -uo pipefail

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
COMPUTE_DIR="$REPO_ROOT/folio-assistant/computations"

if [ ! -d "$COMPUTE_DIR" ]; then
    echo "error: $COMPUTE_DIR not found — run from repo root" >&2
    exit 2
fi

STRICT=0
JSON=0
for arg in "$@"; do
    case "$arg" in
        --strict) STRICT=1 ;;
        --json)   JSON=1 ;;
        -h|--help)
            sed -n '2,21p' "$0"
            exit 0
            ;;
    esac
done

PACKAGES=(
    "qou_substrate"
    "pyhecke"
    "pyhecke_native"
    "qou_mass"
    "witness_schema"
)

# Snapshot of intentionally-alpha (zero-import) packages.  Update this
# list when you intentionally ship a new external-only package.
# qou_mass + witness_schema were here until 2026-06-01 when
# qou_mass_canonical_wiring_example.py became the first in-repo
# importer of both — now they're "wired" (1 importer each) and the
# audit will flag a regression to 0 as unexpected.
KNOWN_EXTERNAL_ONLY=()

count_importers() {
    local pkg="$1"
    # Match `import <pkg>` or `from <pkg>` at start of line.  Exclude
    # _deprecated/ and the package's own tree.
    grep -rln -E "^(import|from) ${pkg}([ .]|$)" \
        --include="*.py" "$COMPUTE_DIR" 2>/dev/null \
        | grep -v "/_deprecated/" \
        | wc -l \
        | tr -d ' '
}

is_known_external() {
    local pkg="$1"
    for known in "${KNOWN_EXTERNAL_ONLY[@]}"; do
        [ "$pkg" = "$known" ] && return 0
    done
    return 1
}

declare -A COUNTS
UNEXPECTED_ZERO=()
for pkg in "${PACKAGES[@]}"; do
    n=$(count_importers "$pkg")
    COUNTS[$pkg]=$n
    if [ "$n" = "0" ] && ! is_known_external "$pkg"; then
        UNEXPECTED_ZERO+=("$pkg")
    fi
done

if [ "$JSON" = "1" ]; then
    printf '{\n'
    printf '  "snapshot_date": "%s",\n' "$(date -u +%Y-%m-%d)"
    printf '  "compute_dir": "folio-assistant/computations/",\n'
    printf '  "importers": {\n'
    first=1
    for pkg in "${PACKAGES[@]}"; do
        [ $first -eq 0 ] && printf ',\n'
        printf '    "%s": %s' "$pkg" "${COUNTS[$pkg]}"
        first=0
    done
    printf '\n  },\n'
    printf '  "known_external_only": ['
    first=1
    for pkg in "${KNOWN_EXTERNAL_ONLY[@]}"; do
        [ $first -eq 0 ] && printf ', '
        printf '"%s"' "$pkg"
        first=0
    done
    printf '],\n'
    printf '  "unexpected_zero": ['
    first=1
    for pkg in "${UNEXPECTED_ZERO[@]}"; do
        [ $first -eq 0 ] && printf ', '
        printf '"%s"' "$pkg"
        first=0
    done
    printf ']\n}\n'
else
    echo "Library coherence audit ($(date -u +%Y-%m-%d))"
    echo "  scanning: folio-assistant/computations/*.py (excluding _deprecated/)"
    echo
    printf '  %-18s %8s   %s\n' "package" "imports" "status"
    printf '  %-18s %8s   %s\n' "-------" "-------" "------"
    for pkg in "${PACKAGES[@]}"; do
        n="${COUNTS[$pkg]}"
        if [ "$n" = "0" ]; then
            if is_known_external "$pkg"; then
                status="alpha / external-only (expected)"
            else
                status="ZERO IMPORTERS — unexpected"
            fi
        else
            status="wired"
        fi
        printf '  %-18s %8s   %s\n' "$pkg" "$n" "$status"
    done

    if [ ${#UNEXPECTED_ZERO[@]} -gt 0 ]; then
        echo
        echo "WARN: ${#UNEXPECTED_ZERO[@]} package(s) had zero importers but are NOT in the known-external-only snapshot:"
        for pkg in "${UNEXPECTED_ZERO[@]}"; do
            echo "  - $pkg"
        done
        echo
        echo "If this is intentional (newly published external-only library),"
        echo "add the package to KNOWN_EXTERNAL_ONLY in $(basename "$0")."
    fi
fi

if [ "$STRICT" = "1" ] && [ ${#UNEXPECTED_ZERO[@]} -gt 0 ]; then
    exit 1
fi
exit 0

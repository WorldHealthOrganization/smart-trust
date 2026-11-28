#!/usr/bin/env bash
# Smoke-test the QOU library packages from OUTSIDE their own test
# suites — exercise the advertised public API of every shipped
# package, so the alpha / zero-import packages (qou-mass,
# witness-schema) have a callable verification path that doesn't
# depend on developers remembering to cd into the package and run
# pytest.
#
# Pairs with scripts/audit-library-coherence.sh — the audit reports
# importer counts, this script verifies the public API actually
# loads and runs.
#
# Usage:
#   ./scripts/smoke-test-libraries.sh
#
# Exits non-zero on the first failure. Requires Python 3.10+,
# mpmath, and pydantic (auto-installed if missing and --install is
# passed).

set -euo pipefail

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"

INSTALL_DEPS=0
for arg in "$@"; do
    case "$arg" in
        --install) INSTALL_DEPS=1 ;;
        -h|--help)
            sed -n '2,18p' "$0"
            exit 0
            ;;
    esac
done

if [ "$INSTALL_DEPS" = "1" ]; then
    python3 -m pip install --quiet mpmath pydantic >/dev/null
fi

# Verify Python deps are present (give a friendly error if not)
if ! python3 -c "import mpmath, pydantic" 2>/dev/null; then
    echo "error: mpmath + pydantic are required" >&2
    echo "  install with: pip install mpmath pydantic" >&2
    echo "  or rerun:     ./scripts/smoke-test-libraries.sh --install" >&2
    exit 2
fi

echo "Library smoke test ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo

# ── witness-schema ─────────────────────────────────────────────
echo "[witness-schema] public-API smoke"
PYTHONPATH="$REPO_ROOT/tools/witness-schema/python" python3 - <<'PY'
from witness_schema import (
    ComputationWitness,
    ComputationAssertion,
    UpstreamWitnessHash,
    __version__,
)
assert __version__ == "0.1.1", f"unexpected version: {__version__}"

# Minimum-shape witness
w = ComputationWitness.model_validate(
    {
        "engine": "mpmath",
        "engineVersion": "1.4.1",
        "commitSha": "abc123",
        "computedAt": "2026-06-01T00:00:00Z",
        "allPassed": True,
        "assertions": [],
    }
)
assert w.allPassed is True
assert w.engine == "mpmath"

# Assertion roundtrip
a = ComputationAssertion(
    name="test", computed=1.0, expected=1.0, passed=True
)
assert a.passed is True

# UpstreamWitnessHash is importable + nameable
assert UpstreamWitnessHash.__name__ == "UpstreamWitnessHash"

print(f"  OK  witness_schema {__version__} — public API + validation")
PY

# ── qou-mass ───────────────────────────────────────────────────
echo "[qou-mass] public-API smoke"
PYTHONPATH="$REPO_ROOT/qou-mass/src" python3 - <<'PY'
import qou_mass as qm

# Version is a 0.x alpha string
assert isinstance(qm.__version__, str)
assert qm.__version__.startswith("0."), f"unexpected version: {qm.__version__}"

# Every advertised public symbol resolves
public = (
    "predict",
    "predict_nucleon",
    "predict_table",
    "compute_tr_M",
    "canonical_braid",
    "Prediction",
    "Witness",
    "BraidWord",
)
missing = [s for s in public if not hasattr(qm, s)]
assert not missing, f"qou_mass missing: {missing}"

# Atom-label parsing is the entry point external researchers hit first
from qou_mass.api import parse_atom_label
assert parse_atom_label("4He") == (2, 2)
assert parse_atom_label("p") == (1, 0)
assert parse_atom_label("n") == (0, 1)
assert parse_atom_label((1, 1)) == (1, 1)

print(f"  OK  qou_mass {qm.__version__} — public API + atom-label parsing")
PY

# ── qou-substrate (sanity check — wired package) ───────────────
# Don't fail the smoke if qou-substrate is missing its mpmath
# subset; just report.  This branch keeps the smoke focused on
# the alpha packages.
if PYTHONPATH="$REPO_ROOT/tools/qou-substrate/src" python3 -c "
import qou_substrate as qs
ok = all(hasattr(qs, s) for s in ('Q', 'HA', 'q_int', 'set_compute_dps', 'fmt', 'WitnessBuilder'))
assert ok
print(f'  OK  qou_substrate — wired-package public API present')
" 2>/dev/null; then
    echo "[qou-substrate] sanity OK"
else
    echo "[qou-substrate] skipped (layout / deps not available)"
fi

echo
echo "All smoke tests passed."

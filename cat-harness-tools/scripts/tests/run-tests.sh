#!/usr/bin/env bash
# Test runner — delegates to bun test (TypeScript).
#
# Usage:
#   ./scripts/tests/run-tests.sh              # run all tests
#   ./scripts/tests/run-tests.sh --json       # output TestReport JSON
#   ./scripts/tests/run-tests.sh lean         # run only lean project tests
#   ./scripts/tests/run-tests.sh coverage     # run only coverage tests
#   ./scripts/tests/run-tests.sh infra        # run only infrastructure tests
#
# Tests are TypeScript files using bun:test. Schema types are shared
# with the build pipeline via schemas/formalization-types.ts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check bun is available
if ! command -v bun &>/dev/null; then
    echo "Error: bun not found. Install: curl -fsSL https://bun.sh/install | bash" >&2
    exit 1
fi

cd "$SCRIPT_DIR"

case "${1:-all}" in
    --json)
        bun run report.ts
        ;;
    lean)
        bun test lean-projects.test.ts
        ;;
    coverage)
        bun test latex-lean-coverage.test.ts
        ;;
    infra)
        bun test infrastructure.test.ts
        ;;
    all|"")
        bun test
        ;;
    *)
        echo "Usage: $0 [all|lean|coverage|infra|--json]" >&2
        exit 1
        ;;
esac

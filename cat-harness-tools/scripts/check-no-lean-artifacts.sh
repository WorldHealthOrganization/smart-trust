#!/usr/bin/env bash
# Pre-commit hook: block commits that include Lean build artifacts.
# Also detects if lakefile.toml changed and reminds to run lake update.

set -uo pipefail

STAGED=$(git diff --cached --name-only 2>/dev/null)

# ── Check for Lean build artifacts in staged files ────────────────
ARTIFACTS=""
while IFS= read -r file; do
    case "$file" in
        content/quantum-observable-universe/lean/.lake/*|content/quantum-observable-universe/lean/lake-packages/*|content/quantum-observable-universe/lean/build/*|.lake/*)
            ARTIFACTS="$ARTIFACTS $file"
            ;;
    esac
done <<< "$STAGED"

if [ -n "$ARTIFACTS" ]; then
    echo "BLOCKED: Lean build artifacts staged for commit:"
    for f in $ARTIFACTS; do
        echo "  - $f"
    done
    echo ""
    echo "These are generated files and must not be committed."
    echo "Run: git reset HEAD $ARTIFACTS"
    exit 1
fi

# ── If lakefile.toml changed, check that lake-manifest.json is also staged ─
if echo "$STAGED" | grep -q "lakefile.toml"; then
    if ! echo "$STAGED" | grep -q "lake-manifest.json"; then
        echo "WARNING: lakefile.toml is staged but lake-manifest.json is not."
        echo "Did you run 'cd lean && lake update' after modifying lakefile.toml?"
        echo "If so, also stage lake-manifest.json."
        # Warning only, don't block
    fi
fi

exit 0

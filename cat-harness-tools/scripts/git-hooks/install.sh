#!/bin/sh
# Install git hooks from scripts/git-hooks/ into .git/hooks/
# Run from repo root:  ./scripts/git-hooks/install.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

for hook in "$SCRIPT_DIR"/post-checkout "$SCRIPT_DIR"/pre-commit "$SCRIPT_DIR"/pre-push; do
    name="$(basename "$hook")"
    [ -f "$hook" ] || continue
    cp "$hook" "$HOOK_DIR/$name"
    chmod +x "$HOOK_DIR/$name"
    echo "Installed $name"
    [ "$name" = pre-push ] && echo "  (its gates are off by default; opt in: git config cat.gates.prePush true)"
done

# Git aliases that auto-commit feedback/ before branch operations
FEEDBACK_SCRIPT="scripts/git-hooks/auto-commit-feedback.sh"
git config alias.co  "!sh -c '$FEEDBACK_SCRIPT && git checkout \"\$@\"' --"
git config alias.sw  "!sh -c '$FEEDBACK_SCRIPT && git switch \"\$@\"' --"
git config alias.pl  "!sh -c '$FEEDBACK_SCRIPT && git pull \"\$@\"' --"
echo "Installed git aliases: co (checkout), sw (switch), pl (pull)"

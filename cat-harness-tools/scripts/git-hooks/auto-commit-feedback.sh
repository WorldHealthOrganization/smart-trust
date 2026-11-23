#!/bin/sh
# Auto-commit any dirty files under feedback/ so branch switches
# and pulls don't fail.  Called by git aliases (co, sw, pl) or
# manually before any operation that requires a clean worktree.
#
# Usage:  ./scripts/git-hooks/auto-commit-feedback.sh

cd "$(git rev-parse --show-toplevel)" || exit 1

# Check for any changes (staged or unstaged) under feedback/
if git diff --name-only HEAD -- feedback/ 2>/dev/null | grep -q . ||
   git diff --cached --name-only -- feedback/ 2>/dev/null | grep -q . ||
   git ls-files --others --exclude-standard -- feedback/ 2>/dev/null | grep -q .; then
    git add feedback/
    git commit -m "auto-save feedback before branch switch" --no-verify -- feedback/
    echo "[feedback] auto-committed"
fi

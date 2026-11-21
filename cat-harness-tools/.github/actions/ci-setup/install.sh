#!/usr/bin/env bash
# Install the root's dependencies: frozen when the root commits a bun.lock
# (the same rule as `.github/actions/mount-layers`), otherwise without saving.
set -euo pipefail
[ -f package.json ] || exit 0
if git ls-files --error-unmatch bun.lock >/dev/null 2>&1; then
  exec bun install --frozen-lockfile
fi
exec bun install --no-save

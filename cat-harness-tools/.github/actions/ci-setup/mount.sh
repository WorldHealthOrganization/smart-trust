#!/usr/bin/env bash
# Mount (or, with --check, verify without network) every layer the CALLER's
# index.lock.json pins, from the repository root.
#
# The caller's own `.github/mount-from-lock.sh` when it has one (an index
# such as folio-assistant: it fetches the replayer at the commit its lock pins
# for cat-harness-tools); otherwise the replayer that ships with this action
# (`scripts/mount-from-lock.ts`, which imports only node:*, so it runs before
# anything is installed). Either way every tree digest is the lock's.
#
# Usage: mount.sh [--check]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [ -f .github/mount-from-lock.sh ]; then
  exec bash .github/mount-from-lock.sh --root . "$@"
fi
exec bun run "$here/../../../scripts/mount-from-lock.ts" --root . "$@"

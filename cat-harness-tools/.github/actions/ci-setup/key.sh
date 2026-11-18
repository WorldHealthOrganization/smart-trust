#!/usr/bin/env bash
# The CI image's key: one tag per set of inputs that decide what it holds.
#
# Everything the image carries is a function of these and nothing else:
#   index.lock.json  — which commit of every mounted layer (and its digest)
#   bun.lock, package.json — node_modules, and so Playwright's Chromium build
#   this action's own files (cat-harness-tools .github/actions/ci-setup/*) —
#     how it is built and read
#   the Bun version and the runner OS — native modules are built for them
# A change to any of them is a new tag; nothing else makes one. A job whose
# key has no image yet falls back to the mount-and-install steps
# (this action), so a missing image costs time, never a result.
#
# Usage: key.sh [repo root]   → prints the 64-hex key
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="${1:-.}"
cd "$root"
{
  for f in index.lock.json bun.lock package.json; do
    if [ -f "$f" ]; then printf '%s %s\n' "$f" "$(sha256sum < "$f" | cut -d' ' -f1)"; else printf '%s absent\n' "$f"; fi
  done
  # Sorted, so the key does not depend on directory order.
  (cd "$here" && find . -type f -print0 | sort -z | xargs -0 sha256sum)
  printf 'bun %s\n' "$(bun --version)"
  printf 'os %s %s\n' "${ImageOS:-$(uname -s)}" "$(uname -m)"
} | sha256sum | cut -d' ' -f1

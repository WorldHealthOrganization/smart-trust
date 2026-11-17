#!/usr/bin/env bash
# Build the CI image for this checkout and push it to <ref> (registry/name:tag).
# The one recipe both jobs of a caller's image workflow run (through the `ci-image` action): the pull-request job pushes to
# a throwaway local registry and restores from it, the main/dispatch job
# pushes to GHCR. Layers are zstd: smaller than gzip and several times faster
# to unpack, and fetch.sh streams them.
#
# Usage: build.sh <ref> [insecure]   (from the CALLER's repository root, after setup-bun)
set -euo pipefail
ref="$1"; insecure="${2:-}"
tmp="${RUNNER_TEMP:-$(mktemp -d)}"
here="$(cd "$(dirname "$0")" && pwd)"

bash "$here/mount.sh"
bash "$here/install.sh"
# Browsers only: their system libraries come from the runner (apt), which no
# file carrier can provide; ci-setup installs those on the jobs that ask.
PLAYWRIGHT_BROWSERS_PATH="$tmp/pw" bunx playwright install chromium
bash "$here/prepare.sh" . "$tmp/pw" "$tmp/ctx"

docker buildx create --name ci-image --driver docker-container --driver-opt network=host --use >/dev/null
out="type=image,name=${ref},push=true,compression=zstd,compression-level=3,force-compression=true,oci-mediatypes=true"
[ "$insecure" = insecure ] && out="${out},registry.insecure=true"
docker buildx build --provenance=false --sbom=false \
  --build-arg SOURCE="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}" \
  --output "$out" "$tmp/ctx"

#!/usr/bin/env bash
# Restore the prepared CI image onto the runner, streaming: each layer goes
# registry → sha256 check → zstd/gzip → tar straight into its destination, all
# layers at once. Nothing is written twice (a `docker pull` would unpack into
# Docker's store and `docker cp` would copy it out again), and no Docker daemon
# is involved.
#
# Exit 0: restored. Exit 3: there is no image for this key (or the registry
# refused us) — the caller falls back to mounting and installing. Any other
# exit: a restore started and failed; the caller falls back too, after
# clearing what was half-written.
#
# Integrity: every layer's bytes are hashed as they stream and compared with
# the digest its manifest names, and the caller then runs `mount.sh --check`,
# which re-hashes every mounted layer against the committed lock. The tag is
# only ever written by a caller's image workflow (the `ci-image` action) on main or a dispatch.
#
# Usage: fetch.sh <image ref without tag> <key> <workspace> <browsers dir> [roles]
#   roles: which layers to restore, "ws" or "ws pw" (default) — a job that
#   runs no browser skips the Chromium layers.
#   REGISTRY_TOKEN (optional): a token with packages:read, for a private image.
set -uo pipefail
image="$1"; key="$2"; ws="$3"; pw="$4"; want=" ${5:-ws pw} "
host="${image%%/*}"; name="${image#*/}"
scratch="$(mktemp -d)"; trap 'rm -rf "$scratch"' EXIT
t0=$(date +%s.%N)

# CI_IMAGE_SCHEME=http is for the image workflow's own test against a throwaway
# local registry, which has neither TLS nor a token service.
scheme="${CI_IMAGE_SCHEME:-https}"
if [ "$scheme" = http ]; then
  H=()
else
  if [ -n "${REGISTRY_TOKEN:-}" ]; then auth=(-u "token:${REGISTRY_TOKEN}"); else auth=(); fi
  token="$(curl -fsS --retry 3 "${auth[@]}" "https://${host}/token?scope=repository:${name}:pull&service=${host}" | jq -r '.token // empty')" || true
  [ -n "$token" ] || { echo "ci-image: no pull token for ${image} (private, or the registry is unreachable)"; exit 3; }
  H=(-H "Authorization: Bearer ${token}")
fi
accept='application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.docker.distribution.manifest.list.v2+json'

manifest() { curl -fsS --retry 3 "${H[@]}" -H "Accept: ${accept}" "${scheme}://${host}/v2/${name}/manifests/$1"; }
m="$(manifest "$key" 2>/dev/null)" || { echo "ci-image: no image ${image}:${key}"; exit 3; }
# An index (buildx writes one with attestations): take the linux/amd64 image.
if jq -e '.manifests' >/dev/null <<<"$m"; then
  d="$(jq -r '[.manifests[] | select(.platform.os=="linux" and .platform.architecture=="amd64")][0].digest // empty' <<<"$m")"
  [ -n "$d" ] || { echo "ci-image: ${image}:${key} has no linux/amd64 image"; exit 3; }
  m="$(manifest "$d")" || exit 4
fi
cfg="$(jq -r '.config.digest' <<<"$m")"
roles="$(curl -fsSL --retry 3 "${H[@]}" "${scheme}://${host}/v2/${name}/blobs/${cfg}" |
  jq -r '.config.Labels["ci-image.layers"] // empty')" || exit 4
mapfile -t digests < <(jq -r '.layers[].digest' <<<"$m")
mapfile -t types < <(jq -r '.layers[].mediaType' <<<"$m")
read -r -a role <<<"$roles"
[ "${#role[@]}" -eq "${#digests[@]}" ] || { echo "ci-image: label names ${#role[@]} layers, manifest has ${#digests[@]}"; exit 4; }
echo "ci-image: ${image}:${key} — ${#digests[@]} layers, $(jq '[.layers[].size] | add / 1048576 | floor' <<<"$m") MiB compressed"

mkdir -p "$ws" "$pw"
pids=()
for i in "${!digests[@]}"; do
  case "$want" in *" ${role[$i]} "*) ;; *) echo "${digests[$i]#sha256:}" > "$scratch/$i.sum"; continue ;; esac
  dig="${digests[$i]}"; dest="$ws"; [ "${role[$i]}" = pw ] && dest="$pw"
  case "${types[$i]}" in *zstd) dec=(zstd -dc) ;; *gzip) dec=(gzip -dc) ;; *) dec=(cat) ;; esac
  mkfifo "$scratch/$i.fifo"
  sha256sum < "$scratch/$i.fifo" | cut -d' ' -f1 > "$scratch/$i.sum" &
  pids+=($!)
  (
    curl -fsSL --retry 3 "${H[@]}" "${scheme}://${host}/v2/${name}/blobs/${dig}" |
      tee "$scratch/$i.fifo" |
      "${dec[@]}" | tar -x -C "$dest" --strip-components=1 --no-same-owner
    s=("${PIPESTATUS[@]}"); for x in "${s[@]}"; do [ "$x" -eq 0 ] || exit 5; done
  ) &
  pids+=($!)
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done
for i in "${!digests[@]}"; do
  got="sha256:$(cat "$scratch/$i.sum")"
  [ "$got" = "${digests[$i]}" ] || { echo "ci-image: layer $i digest mismatch (${got} ≠ ${digests[$i]})"; fail=1; }
done
[ "$fail" -eq 0 ] || exit 5
awk -v a="$t0" -v b="$(date +%s.%N)" 'BEGIN { printf "ci-image: restored in %.1f s\n", b - a }'

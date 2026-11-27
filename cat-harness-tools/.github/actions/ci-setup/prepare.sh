#!/usr/bin/env bash
# Lay out the image's build context from a checkout that has been mounted and
# installed: layers/1..5 hold workspace files (each under ws/), layers/6 and 7
# hold Playwright's browsers (under pw/). Hard links, so it copies nothing.
#
# What goes in is every instance index.lock.json mounts, plus node_modules —
# read from the lock, not listed here, so a new mount is carried without
# editing this file. The state mounts (beans/, fsh-guts/, …) never go in: they
# move with every write to their branches, and a job mounts them itself.
#
# Usage: prepare.sh <workspace> <playwright browsers dir> <context dir>
set -euo pipefail
ws="$(cd "$1" && pwd)"; pw="$(cd "$2" && pwd)"; ctx="$3"
rm -rf "$ctx"; mkdir -p "$ctx"/layers/{1,2,3,4,5}/ws "$ctx"/layers/{6,7}/pw
cp "$(dirname "$0")/Dockerfile" "$ctx/Dockerfile"
mapfile -t inst < <(jq -r '.instances[].instance' "$ws/index.lock.json")
for d in "${inst[@]}" node_modules; do
  [ -d "$ws/$d" ] || { echo "prepare: $d is not on disk — mount and install first" >&2; exit 2; }
done
# node_modules is the biggest single tree, so it is spread by package.
mapfile -t tops < <(printf '%s\n' "${inst[@]}"; cd "$ws" && find node_modules -mindepth 1 -maxdepth 1)
# Biggest first, round-robin by size into five layers, so they finish together.
mapfile -t bysize < <(cd "$ws" && du -s "${tops[@]}" | sort -rn | cut -f2)
sizes=(0 0 0 0 0)
for d in "${bysize[@]}"; do
  i=0; for j in 1 2 3 4; do [ "${sizes[$j]}" -lt "${sizes[$i]}" ] && i=$j; done
  mkdir -p "$(dirname "$ctx/layers/$((i + 1))/ws/$d")"
  cp -al "$ws/$d" "$ctx/layers/$((i + 1))/ws/$d"
  sizes[$i]=$(( sizes[i] + $(du -s "$ws/$d" | cut -f1) ))
done
# State mounts nested INSIDE an instance (cat-harness's health results are
# cat-harness/test/health/results/) are not the instance's pinned bytes: they
# would make `mount.sh --check` fail on every restore. Their markers say where.
gd="$(git -C "$ws" rev-parse --git-path branch-mounts)"
case "$gd" in /*) ;; *) gd="$ws/$gd" ;; esac
if [ -d "$gd" ]; then
  for f in "$gd"/*.json; do
    [ -e "$f" ] || continue
    into="$(jq -r '.into // empty' "$f")"
    [ -n "$into" ] && for l in 1 2 3 4 5; do rm -rf "$ctx/layers/$l/ws/$into"; done
  done
fi
# Browsers: the largest entry in layer 6, the rest in layer 7.
mapfile -t b < <(cd "$pw" && du -s -- * .[!.]* 2>/dev/null | sort -rn | cut -f2)
[ "${#b[@]}" -gt 0 ] || { echo "prepare: no browsers in $pw" >&2; exit 2; }
cp -al "$pw/${b[0]}" "$ctx/layers/6/pw/"
for e in "${b[@]:1}"; do cp -al "$pw/$e" "$ctx/layers/7/pw/"; done
du -sh "$ctx"/layers/* >&2

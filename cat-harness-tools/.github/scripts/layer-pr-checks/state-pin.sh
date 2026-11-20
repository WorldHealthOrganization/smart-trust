#!/usr/bin/env bash
# Serve the branch-kept graphs (`cat/*` state branches) at the tips this run
# pinned, so the base and head sides mount each graph at the same commit.
#
#   state-pin.sh <pin/state.json> <mirror-dir>
#
# state.json is `{ "owner/repo": { "<branch>": "<sha>" } }`, read once per run
# by the pin step. For each repository it builds a local bare mirror holding
# exactly those branches at those commits, and prints the `GIT_CONFIG_*`
# exports that rewrite `https://github.com/<owner/repo>.git` to the mirror.
# The caller evaluates them around the state mount only. It works whatever
# version of the mount code the lock pins, because it changes what the
# remote serves, not how the code reads it.
#
# Read live per side, the tips were minutes apart, and a bean pushed in
# between was charged to the PR (smart-base#107, run 38884159693). A branch
# created after the pin is not in the mirror, so it is absent on both sides.
# A repository whose pinned commits cannot be fetched is left unrewritten
# (read live) with a warning, never a failure.
set -euo pipefail
pins="$1"
[ -f "$pins" ] || { echo "export GIT_CONFIG_COUNT=0"; exit 0; }
mkdir -p "$2"
mirrors="$(cd "$2" && pwd)"  # absolute: the rewrite is a file:// URL
n=0
for repo in $(python3 -c 'import json,sys; print(" ".join(sorted(json.load(open(sys.argv[1])))))' "$pins"); do
  mirror="$mirrors/${repo//\//__}.git"
  git init -q --bare "$mirror"
  git -C "$mirror" config uploadpack.allowFilter true
  git -C "$mirror" config uploadpack.allowAnySHA1InWant true
  refs="$(python3 -c 'import json,sys
for b, s in sorted(json.load(open(sys.argv[1]))[sys.argv[2]].items()): print(s, b)' "$pins" "$repo")"
  if [ -n "$refs" ]; then
    # shellcheck disable=SC2046
    if ! git -C "$mirror" fetch -q --depth 1 --no-tags "https://github.com/${repo}.git" $(awk '{print $1}' <<<"$refs") >&2; then
      echo "::warning::could not fetch the pinned state tips of ${repo}; its graphs are read live on this side" >&2
      continue
    fi
    while read -r sha branch; do
      git -C "$mirror" update-ref "refs/heads/$branch" "$sha"
    done <<<"$refs"
  fi
  echo "export GIT_CONFIG_KEY_$n='url.file://$mirror.insteadOf' GIT_CONFIG_VALUE_$n='https://github.com/${repo}.git'"
  echo "${repo}: $(wc -l <<<"$refs" | tr -d ' ') branch(es) served at the run's pinned tips" >&2
  n=$((n + 1))
done
echo "export GIT_CONFIG_COUNT=$n"

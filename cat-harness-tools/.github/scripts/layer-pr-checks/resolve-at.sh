#!/usr/bin/env bash
# resolve-at.sh <owner/repo> <ref> [<time>]: the commit <ref> named at <time>.
#
# cat-harness-tools#397. The base and head sides of a run are prepared by two
# jobs that start at different moments, and a branch moves in between. The
# separate `pin` job used to resolve the index once for both, at the cost of
# a second wait for a runner (5 min on smart-base run 38866215814, 33 min on
# run 38869216177). Here each job resolves the same answer on its own: the
# newest first-parent commit of the branch at <time>, the moment of the event
# that started the run, so both sides read the same commit however far apart
# they start. A 40-hex <ref> is returned as it is; a tag is read from the
# remote; with no <time> (a manual dispatch has none) the branch's tip now.
set -euo pipefail
repo="$1" ref="$2" at="${3:-}"
url="https://github.com/${repo}.git"
if printf '%s' "$ref" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "$ref"; exit 0
fi
refs="$(git ls-remote "$url" "refs/heads/$ref" "refs/tags/$ref" "refs/tags/$ref^{}")"
branch="$(printf '%s\n' "$refs" | awk -v r="refs/heads/$ref" '$2 == r { print $1 }')"
if [ -z "$branch" ]; then
  # A tag: an annotated tag's commit, else a light tag.
  sha="$(printf '%s\n' "$refs" | awk -v r="refs/tags/$ref^{}" '$2 == r { print $1 }')"
  [ -n "$sha" ] || sha="$(printf '%s\n' "$refs" | awk -v r="refs/tags/$ref" '$2 == r { print $1 }')"
  [ -n "$sha" ] || { echo "::error::'$ref' names no branch or tag of $repo" >&2; exit 2; }
  echo "$sha"; exit 0
fi
if [ -z "$at" ]; then
  echo "::warning::no event time: $repo $ref is read at its tip now, so two jobs of this run may read different commits" >&2
  echo "$branch"; exit 0
fi
work="$(mktemp -d)"
git -C "$work" init -q
git -C "$work" fetch -q --filter=tree:0 --depth=500 "$url" "refs/heads/$ref"
sha="$(git -C "$work" rev-list -1 --first-parent --before="$at" FETCH_HEAD)"
rm -rf "$work"
[ -n "$sha" ] || { echo "::error::no commit of $repo $ref at or before $at in its last 500" >&2; exit 2; }
echo "$sha"

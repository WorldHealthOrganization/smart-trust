#!/usr/bin/env bash
# Serve the branch-kept graphs (`cat/*` state branches) at the tips this run
# pinned, so the base and head sides mount each graph at the same commit.
#
#   state-pin.sh <pin/state.json> <mirror-dir> [<pin/state-live.json>]
#
# state.json is `{ "owner/repo": { "<branch>": "<sha>" } }`, read once per run
# by the pin step. state-live.json, when given and present, is that same read
# kept aside when the pin step took main's record's tips instead: a branch
# (or a repository) the record does not name, because it was created after
# main's last push, is served at its tip in that read. Without it, a branch
# seeded after main's last push was served by an empty mirror, so it read
# "unmounted" on both sides of every first-attempt PR run (dth-sfp#13:
# cat/dth-sfp/beans and todos, seeded 40 min after main's record).
#
# A beans branch (`cat/<instance>/beans`) the record DOES name but that has
# moved since is served at the live tip when that tip descends from the
# record's (within STATE_PIN_DEPTH commits, default 200): records pushed
# after main's last push, approval records among them, are then read on a
# PR's first attempt. A live tip that does not descend from the record's
# (a rewritten branch), or whose history does not reach it, keeps the
# record's tip. Both sides decide from the same two files, so they agree. For each repository it builds a local bare mirror holding
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
live="${3:-}"
if [ -n "$live" ] && [ -f "$live" ]; then
  # The record's tips win; the live read fills in only what it lacks, and
  # moves a beans branch forward (below).
  merged="$mirrors/state.json"
  ahead="$mirrors/ahead.tsv"
  : > "$ahead"
  python3 - "$pins" "$live" "$merged" <<'PY'
import json, sys
pins, live = (json.load(open(p)) for p in sys.argv[1:3])
for repo, tips in live.items():
    for branch, sha in tips.items():
        pins.setdefault(repo, {}).setdefault(branch, sha)
json.dump(pins, open(sys.argv[3], "w"), sort_keys=True, indent=1)
PY
  # Beans branches whose live tip differs from the record's: repo, branch,
  # recorded sha, live sha.
  python3 - "$merged" "$live" > "$ahead" <<'PY'
import json, re, sys
pins, live = (json.load(open(p)) for p in sys.argv[1:3])
for repo, tips in sorted(live.items()):
    for branch, sha in sorted(tips.items()):
        if re.fullmatch(r"cat/[^/]+/beans", branch) and pins[repo][branch] != sha:
            print(repo, branch, pins[repo][branch], sha)
PY
  scratch="$mirrors/ancestry.git"
  while read -r repo branch recorded tip; do
    [ -n "$repo" ] || continue
    rm -rf "$scratch"; git init -q --bare "$scratch"
    if git -C "$scratch" fetch -q --depth "${STATE_PIN_DEPTH:-200}" --no-tags "https://github.com/${repo}.git" "$tip" >&2 \
      && git -C "$scratch" cat-file -e "${recorded}^{commit}" 2>/dev/null \
      && git -C "$scratch" merge-base --is-ancestor "$recorded" "$tip"; then
      python3 - "$merged" "$repo" "$branch" "$tip" <<'PY'
import json, sys
f, repo, branch, tip = sys.argv[1:]
pins = json.load(open(f))
pins[repo][branch] = tip
json.dump(pins, open(f, "w"), sort_keys=True, indent=1)
PY
      echo "${repo} ${branch}: served at the live tip ${tip:0:11}, ahead of main's record (${recorded:0:11})" >&2
    else
      echo "${repo} ${branch}: the live tip ${tip:0:11} does not descend from main's record within reach; served at the record's ${recorded:0:11}" >&2
    fi
  done < "$ahead"
  rm -rf "$scratch" "$ahead"
  pins="$merged"
fi
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

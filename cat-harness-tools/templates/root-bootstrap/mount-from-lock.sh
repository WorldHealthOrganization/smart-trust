#!/usr/bin/env bash
# Lay down every remote mount `index.lock.json` records, on a checkout that has
# none of them yet.
#
# The replayer is `scripts/mount-from-lock.ts` in cat-harness-tools (in
# cat-harness until bean 70lx moved the harness's code out), and that instance
# is itself one of the mounts — so on a fresh clone the tool that would mount
# it is not on disk. This breaks that loop the smallest way: read the commit
# the lock pins for it, fetch ONLY that one file at that commit, and run
# it. The script imports nothing but `node:*` (see its header), so one file is
# all it needs; every decision — instances, commits, directories, digests — is
# still the lock's, and the script still verifies each tree digest.
#
# CI calls this before anything else in a job, and so does the session-start
# hook. It is idempotent: a mount already on disk and intact is reported
# `current`. Extra arguments go to the replayer (e.g. `--check`).
#
# Usage: .github/mount-from-lock.sh [--root <dir>] [replayer args…]
set -euo pipefail

root="."
if [ "${1:-}" = "--root" ]; then root="$2"; shift 2; fi
lock="$root/index.lock.json"
# No lock at the target is not an error: a folio that remote-mounts nothing
# has none, and the replayer (fetched below from the platform's own lock)
# reports it `not-enabled` and exits 0. Exiting here instead failed every such
# folio's staging at "Mount the folio's own layers" (smart-ra#32).

# The replayer comes from the cat-harness-tools the TARGET's lock pins — or,
# for a lock older than 70lx, its cat-harness; a folio whose lock mounts
# neither (it is replayed by a platform checked out beside it) uses the pin of
# the platform checkout this script sits in.
own_lock="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/index.lock.json"
candidates="$(bun -e '
  const fs = require("node:fs");
  for (const f of process.argv.slice(1)) {
    if (!fs.existsSync(f)) continue;
    const l = JSON.parse(fs.readFileSync(f, "utf-8"));
    const pins = ["cat-harness-tools", "cat-harness"]
      .map((n) => (l.instances ?? []).find((x) => x.instance === n))
      .filter(Boolean);
    if (pins.length) { for (const i of pins) console.log(i.repository, i.sha); process.exit(0); }
  }
  console.error("mount-from-lock: no lock pins a cat-harness-tools or cat-harness instance: " + process.argv.slice(1).join(", "));
  process.exit(2);
' "$lock" "$own_lock")"

prefix="${CAT_MOUNT_URL_PREFIX:-https://github.com}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
found=""
while read -r repo sha; do
  [ -n "$repo" ] || continue
  rm -rf "$work/r" && git init -q "$work/r"
  # --filter=blob:none fetches the commit's trees but no file bodies; the
  # checkout below then fetches the one blob it needs. A pin older than the
  # replayer's move has no such file, and the next candidate is tried.
  git -C "$work/r" fetch -q --depth 1 --filter=blob:none "${prefix%/}/${repo}.git" "$sha" &&
    git -C "$work/r" checkout -q FETCH_HEAD -- scripts/mount-from-lock.ts 2>/dev/null &&
    { found="$work/r/scripts/mount-from-lock.ts"; break; }
done <<< "$candidates"
[ -n "$found" ] || { echo "mount-from-lock: no pinned commit carries scripts/mount-from-lock.ts" >&2; exit 2; }

export CAT_MOUNT_CACHE_DIR="${CAT_MOUNT_CACHE_DIR:-$HOME/.cache/cat-mount}"
# The layers cache: the replayer reads it from `CAT_LAYERS_URL`, else from the
# root's own origin. An IG's origin usually carries no `refs/cat/layers/*`, so
# when it has none and the root names a shared cache in `.github/layers-url`
# (one URL on one line), that remote is used instead. The replayer still
# verifies each layer's digest and fetches any layer the cache lacks.
if [ -z "${CAT_LAYERS_URL:-}" ] && [ "${CAT_LAYERS_CACHE:-1}" != "0" ] && [ -f "$root/.github/layers-url" ]; then
  if [ -z "$(git -C "$root" ls-remote origin 'refs/cat/layers/*' 2>/dev/null | head -1)" ]; then
    shared="$(head -1 "$root/.github/layers-url" | tr -d '[:space:]')"
    [ -n "$shared" ] && export CAT_LAYERS_URL="$shared"
  fi
fi
status=0
bun "$found" --root "$root" "$@" || status=$?
# A full replay that succeeded stamps the lock it laid down, so `.github/cat.ts`
# can tell, with one file hash, when the lock has moved past the mounts on disk
# (a re-pin pulled in by `git pull`) and replay again. `--check` and the other
# modes change nothing on disk, so they never stamp.
if [ "$status" -eq 0 ] && [ "$#" -eq 0 ] && [ -f "$lock" ]; then
  stamp="$(git -C "$root" rev-parse --git-path cat-mounted-lock 2>/dev/null || true)"
  if [ -n "$stamp" ]; then
    case "$stamp" in /*) ;; *) stamp="$root/$stamp" ;; esac
    bun -e 'const c=require("node:crypto"),fs=require("node:fs");fs.writeFileSync(process.argv[2],c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex")+"\n")' "$lock" "$stamp" || true
  fi
fi
exit "$status"

---
# folio-assistant-3ds9
$schema: bean/1.0.0
title: 'SPIKE: can CI and a fresh agent container both push to and read an orphan qa-reports branch through the proxy?'
status: completed
type: task
priority: high
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-01T08:53:39Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §4 item 1.2. **This spike can falsify part A**, so it goes before any mechanism is built.

Write path, as in lake-cache `cmd_seed`: hash-object, then mktree, then commit-tree, then push to a throwaway `qa-reports-spike`.
Read path: `git fetch --depth=1 --filter=blob:none origin +qa-reports-spike:refs/qa-reports-read`, then `git show`.

Measure:
- (1) push from a code-quality-gates job, with `contents: write`;
- (2) push from a fresh claude.ai/code container;
- (3) the read latency for one file and for all of `kg-qa/` from a cold container (budget: under 20 s added to `bun run cat gates`, proposal §6);
- (4) two concurrent writers to disjoint paths, both of which survive.

Delete the spike branch only on the owner's go (`deletion-requires-confirmation`).

## Done when
- [x] (1)–(4) are measured, with the commands recorded:
  - [x] (1) push from CI (`contents: write`, `pull_request`): **RAN and succeeded**, run 36839049862 on PR #1764
  - [x] (2) push from a fresh claude.ai/code container
  - [x] (3) cold read latency: one file, all of `kg-qa/`, and the whole results tree
  - [x] (4) two concurrent writers to disjoint paths, both survive
  - [x] (extra) dedup: a second `main/<sha>` with identical content
- [x] a verdict is recorded against D1: branch confirmed, or a fallback medium is named

## Spike results

Run 2026-10-01 from a claude.ai/code container (git 2.43.0, through the agent
proxy, `https://github.com/litlfred/folio-assistant`). Source: `cat-harness/test/results/`
at main `cdb0a018c4a06e56ec30296b6342cfa85e3fbad5` — **966 files, 7,898,557 bytes**
(`kg-qa/`: 487 files, 772,896 bytes). Every writer and reader was a fresh, empty
repository (`git init` + `remote add origin`), so nothing was borrowed from a
checkout. Timings are `date +%s.%N` deltas, one run each — not a distribution.
Writer prototype: Appendix A.

### Numbers

| step | what | result |
|---|---|---|
| 1 | build entry tree (per-file `hash-object -w` + nested `mktree`, bash) | 12.13 s |
| 1 | same tree via a private index (`GIT_INDEX_FILE=… git add` + `write-tree --prefix`) | **0.09 s**; tree `fb0ae13` == `HEAD:cat-harness/test/results` |
| 1 | push, cold writer (orphan, no parent) | **3.18 s**; pack 1084 objects, **364.01 KiB** (852 deltas); commit `304d4b6` |
| 2a | `fetch --depth=1 --filter=blob:none` of the branch | **1.01 s** (124 objects, 46.34 KiB) |
| 2a | `git show` of one file (lazy blob fetch) | 0.56 s → **1.56 s cold total** |
| 2b | batch-fetch the 487 `kg-qa/` blobs + `git archive \| tar -x` | 0.64 s + 0.08 s → **1.72 s cold total**; `diff -r` identical |
| 2c | whole tree, blob:none + batch-fetch 966 blobs + archive | 0.95 + 0.79 + 0.08 = **1.82 s**; `diff -r` identical |
| 2c′ | whole tree, unfiltered `fetch --depth=1` + archive | 0.87 + 0.18 = **1.05 s** (369.45 KiB) |
| 3 | writer A `main/61b1e74…`, attempt 1 | pushed `b53ece1` (2.90 s) |
| 3 | writer B `pr/9999/1541e36…`, attempt 1 | **rejected**: `cannot lock ref 'refs/heads/qa-reports-spike': is at b53ece1… but expected 304d4b6…` |
| 3 | writer B, attempt 2 (re-fetch, re-splice) | pushed `5ce93c7` (2.65 s); tip holds **both** entries plus the step-1 entry |
| 4 | stored size of the tip, depth-1 full fetch, before → after a duplicate `main/afae46e…` | 1090 → 1092 objects; 347,412 → 347,719 bytes (**+307 B**, +0.09 %) |
| 4 | wire size of that push, default `pack.useSparse=true` | 1084 objects, 368.24 KiB — **no wire dedup** |
| 4 | wire size of a second duplicate `main/791528a…`, `pack.useSparse=false` | **5 objects, 666 bytes** (`76893ba`, 2.08 s) |

Read budget (§6, 20 s added to `bun run cat gates`): the worst cold read measured is
**1.82 s**, about a tenth of the budget.

### Commands

```sh
# fresh writer (step 1; w2/w3 for step 3 likewise)
git init -q --bare .spike/w1 && git --git-dir=.spike/w1 remote add origin https://github.com/litlfred/folio-assistant
git archive cdb0a018 cat-harness/test/results | tar -x -C $SCRATCH/src1
bash qa-write.sh .spike/w1 qa-reports-spike main/cdb0a018c4a06e56ec30296b6342cfa85e3fbad5 $SCRATCH/src1 cdb0a018…

# cold read (step 2), each in its own fresh `git init` + `remote add`
git fetch -q --depth=1 --filter=blob:none origin +qa-reports-spike:refs/qa-reports-read
git show refs/qa-reports-read:main/<sha>/manifest.json                      # 2a
git ls-tree -r --object-only refs/qa-reports-read:main/<sha>/cat-harness/test/results/kg-qa \
  | git -c fetch.negotiationAlgorithm=noop fetch -q --stdin --no-tags --no-write-fetch-head \
        --filter=blob:none origin                                           # 2b: ONE round trip
git archive refs/qa-reports-read:main/<sha>/cat-harness/test/results/kg-qa | tar -x -C out/
git fetch -q --depth=1 origin +qa-reports-spike:refs/qa-reports-read        # 2c′

# concurrency (step 3): both started together as background jobs, 6th arg holds
# attempt 1 open 5 s between fetch and push so the race is certain, not lucky
bash qa-write.sh .spike/w2 qa-reports-spike main/61b1e747… $SCRATCH/src1 61b1e747… 5 &
bash qa-write.sh .spike/w3 qa-reports-spike pr/9999/1541e368… $SCRATCH/src2 1541e368… 5 &

# dedup (step 4)
bash qa-write.sh .spike/w1 qa-reports-spike main/afae46ee… $SCRATCH/src1 afae46ee…
git --git-dir=.spike/w1 config pack.useSparse false
bash qa-write.sh .spike/w1 qa-reports-spike main/791528a1… $SCRATCH/src1 791528a1…
```

### Findings that change §2.2

1. **Read the blobs in ONE batch, never lazily.** `git show` on a blob:none
   clone fetches one blob per round trip (0.56 s measured for one file); per file
   over 487 files that extrapolates to minutes, not seconds. The batch fetch above
   brought all 487 in 0.64 s. `qa:fetch` must batch, or fetch unfiltered — the
   whole branch tip is ~370 KiB today.
2. **The writer must disable the sparse object walk.** With git's default
   `pack.useSparse=true` the walk is path-scoped, so identical blobs under a NEW
   `main/<sha>/` path are not seen as already on the remote and the push resends
   all of them (368 KiB). With `-c pack.useSparse=false`: 666 bytes. Storage dedups
   either way (+307 B); only the wire cost differs.
3. **Hash through a private index, not per-file `hash-object`.** 0.09 s against
   12.1 s, same tree id; still never touches a worktree or the checkout's index.
   The CI draft uses it.
4. **The server's ref lock is the concurrency primitive.** The losing writer is
   rejected atomically (`cannot lock ref … expected <old tip>`), and the
   fetch → splice → `commit-tree -p tip` → push loop recovers on attempt 2 with
   no `-f`. History stays linear (`304d4b6 ← b53ece1 ← 5ce93c7`).
5. Every push printed `fatal: expected 'acknowledgments', received 'packfile'` /
   `warning: push negotiation failed; proceeding anyway`. It is harmless (the push
   then succeeds) and comes from push-side negotiation through the proxy; a real
   writer should not treat stderr as failure.

### Step 5 — CI write path (drafted, NOT run)

`.github/workflows/qa-reports-spike.yml`, committed in its own commit in the spike
worktree and **not pushed**: `pull_request`, paths-filtered to itself,
`permissions: contents: write`, per-PR concurrency group. It writes
`pr/<n>/<head-sha>/` to `qa-reports-spike-b` with the private-index build, the
same splice-on-tip loop, no `-f`, 3 attempts. `bun run cat check:workflows`:
`Workflows: 34 ✓ all parse; no duplicate keys; no attacker-controlled expression
in a run body; …` (after `git submodule update --init` for `bootstrap-tools`,
without which the gate cannot load). Prior evidence that it will work:
`feature-staging.yml` already pushes `gh-pages` from `pull_request` with
`contents: write`. Known limit: a FORK PR's token is read-only, so a `pr/<n>`
entry from a fork cannot be written by this job (bears on D3).

### Verdict against D1

**D1 (a), the orphan `qa-reports` branch, is confirmed for the agent-container
direction**: write, cold read, concurrent disjoint writers and dedup all hold, and
the read costs ~1.8 s against a 20 s budget. **The CI direction is not yet
measured**; it is the one remaining falsifier. If that run cannot push, the
fallback medium is **D1 (b), release assets plus an index** — but a failure there
would also contradict the `gh-pages` pushes CI already makes, so it is unlikely.
No fallback is needed on present evidence.

Left in place for the owner to decide (`deletion-requires-confirmation`): remote
branch `qa-reports-spike` at `76893ba` (5 entries). `qa-reports-spike-b` was not
created (it is the CI draft's target).

### Appendix A — writer prototype (`qa-write.sh`, not committed)

```bash
#!/usr/bin/env bash
# qa-write.sh — worktree-free writer for an orphan qa-reports branch (spike 3ds9).
# Model: lake-cache.sh cmd_seed (hash-object -w -> mktree -> commit-tree -> push),
# minus force-push: fetch tip -> splice our subtree onto it -> commit-tree -p tip
# -> push (no -f), up to 3 attempts.
#
# usage: qa-write.sh <git-dir-or-repo> <branch> <prefix> <src-root> <source-sha>
#   prefix   e.g. main/<sha>  or  pr/9999/<sha>
#   src-root directory holding the files to publish, laid out as on main
#            (e.g. a dir containing cat-harness/test/results/**)
set -euo pipefail
repo=$1 br=$2 prefix=$3 src=$4 srcsha=$5
export GIT_DIR; GIT_DIR=$(git -C "$repo" rev-parse --absolute-git-dir)
gid=(-c user.name=folio-qa-bot -c user.email=folio-qa-bot@users.noreply.github.com)

# --- build: one tree per directory, bottom-up (nested mktree) ---------------
build() { # $1 = abs dir -> prints tree sha
  local d=$1 e name
  {
    while IFS= read -r -d '' e; do
      name=${e##*/}
      if [ -d "$e" ]; then printf '040000 tree %s\t%s\n' "$(build "$e")" "$name"
      else
        local mode=100644; [ -x "$e" ] && mode=100755
        printf '%s blob %s\t%s\n' "$mode" "$(git hash-object -w -- "$e")" "$name"
      fi
    done < <(find "$d" -mindepth 1 -maxdepth 1 -print0)
  } | git mktree
}
# --- splice: tree with <path> replaced by <sub>; $1 may be empty ------------
splice() { # $1 base-tree-or-empty  $2 path  $3 sub-tree
  local base=$1 path=$2 sub=$3 head rest child=""
  [ -z "$path" ] && { printf '%s\n' "$sub"; return; }
  head=${path%%/*}; rest=${path#"$head"}; rest=${rest#/}
  if [ -n "$base" ]; then
    child=$(git ls-tree "$base" -- "$head" | awk '$2=="tree"{print $3}')
  fi
  local newchild; newchild=$(splice "$child" "$rest" "$sub")
  { [ -n "$base" ] && git ls-tree "$base" | awk -F'\t' -v h="$head" '$2!=h'
    printf '040000 tree %s\t%s\n' "$newchild" "$head"; } | git mktree
}

t0=$(date +%s.%N)
payload=$(build "$(cd "$src" && pwd)")
nfiles=$(find "$src" -type f | wc -l)
nbytes=$(find "$src" -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
manifest=$(printf '{\n  "$schema": "qa-reports-manifest/v1",\n  "source": "%s",\n  "prefix": "%s",\n  "files": %s,\n  "bytes": %s,\n  "written_at": "%s"\n}\n' \
  "$srcsha" "$prefix" "$nfiles" "$nbytes" "$(date -u +%FT%TZ)" | git hash-object -w --stdin)
entry=$( { git ls-tree "$payload"; printf '100644 blob %s\tmanifest.json\n' "$manifest"; } | git mktree)
t1=$(date +%s.%N)
echo "built entry tree $entry ($nfiles files, $nbytes bytes) in $(echo "$t1-$t0" | bc) s" >&2

for attempt in 1 2 3; do
  tip=""
  if git fetch -q --depth=1 --filter=blob:none origin "+refs/heads/$br:refs/qa-tip/$br" 2>/dev/null; then
    tip=$(git rev-parse "refs/qa-tip/$br")
  fi
  base=""; [ -n "$tip" ] && base=$(git rev-parse "$tip^{tree}")
  if [ -n "$base" ] && [ -n "$(git ls-tree "$base" -- "$prefix")" ]; then
    echo "entry $prefix already present on $br; refusing to overwrite (exit 0, no-op)" >&2; exit 0
  fi
  tree=$(splice "$base" "$prefix" "$entry")
  msg="qa-reports: $prefix ($nfiles files, $nbytes bytes)"
  if [ -n "$tip" ]; then commit=$(git "${gid[@]}" commit-tree "$tree" -p "$tip" -m "$msg")
  else commit=$(git "${gid[@]}" commit-tree "$tree" -m "$msg"); fi
  # spike only: widen the fetch->push window on attempt 1 to force a race
  [ "$attempt" -eq 1 ] && [ "${6:-0}" != 0 ] && { echo "holding ${6}s before push (race window)" >&2; sleep "$6"; }
  t2=$(date +%s.%N)
  # NO -f: a non-fast-forward is rejected and we rebuild on the new tip.
  ok=0; out=$(git push --progress origin "$commit:refs/heads/$br" 2>&1) && ok=1
  printf '%s\n' "$out" | tr '\r' '\n' \
    | grep -E 'Writing objects: 100%.*done|^Total|rejected|error|fatal|->' >&2 || true
  if [ "$ok" -eq 1 ]; then
    t3=$(date +%s.%N)
    echo "PUSHED attempt=$attempt commit=$commit tip_was=${tip:-none} push_s=$(echo "$t3-$t2" | bc)" >&2
    echo "$commit"; exit 0
  fi
  echo "push rejected (attempt $attempt); refetching tip" >&2
  sleep "$(awk -v a="$attempt" 'BEGIN{srand(); print a + rand()*2}')"
done
echo "gave up after 3 attempts" >&2; exit 1
```


## CI result, 2026-10-01 08:52Z — D1 CONFIRMED in both environments
Workflow run 36839049862 (`qa-reports spike (3ds9)`, `pull_request` on #1764, head `95bcbbe9`) concluded **success**. It pushed `43c8b09a` (author `folio-qa-bot`) to `qa-reports-spike-b`: `pr/1764/95bcbbe9c574…/`, 966 files, 7,898,557 bytes. That was verified with `git ls-remote` and a blob:none fetch from this container. The default `GITHUB_TOKEN` with `contents: write` is enough for a same-repo PR. Fork PRs get a read-only token; that is a D3 note for `16ei`.

## Summary of Changes
Measured the orphan-branch medium in an agent container and in CI: cold push 3.2 s, worst cold read 1.8 s (budget 20 s), concurrent disjoint writers both survive without `-f`, a duplicate entry adds +307 B. **Verdict: D1 (a) confirmed; no fallback needed.** Design inputs for `16ei`: batch reads, `pack.useSparse=false`, a private index for hashing, and tolerating the `push negotiation failed` stderr. The spike workflow is reverted. Both remote spike branches are left in place until the owner rules on deleting them.

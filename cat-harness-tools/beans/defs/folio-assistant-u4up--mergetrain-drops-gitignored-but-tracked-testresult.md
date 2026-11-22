---
# folio-assistant-u4up
$schema: bean/1.0.0
title: merge:train drops gitignored-but-tracked test/results files
status: completed
type: bug
priority: high
created_at: 2026-10-04T16:44:20Z
updated_at: 2026-10-07T05:13:00Z
parent: folio-assistant-d33q
---

Measured 2026-10-04 building merge-train-2026-10-04a (#2113):

1. The built train tree omitted `cat-harness/test/results/lsi/cat-harness/skills.lsi.json` and its tool-run sidecar (tracked on main, gitignored), so `lsi:skills:check` and `lsi:viz:check` went red in CI while green locally. Restored by hand in 1635342194. Same family as 8j9e (#2090 fixed `merge-base.ts`, not the train tool).
2. Take-base on the same file failed for #1898 ("is in the index, but not at stage 2"), ejecting it.

## Done when
- [x] `merge:train` keeps tracked-but-ignored paths, and its post-merge check runs `git diff --diff-filter=D <base> HEAD -- '*/test/results/*'` and refuses on any drop.
- [x] take-base resolves a gitignored-tracked conflict without the stage-2 error; a test covers both.

## Also in merge:main (2026-10-04 ~17:55Z)
Not train-only. `merge:main` on `claude/gracious-mendel-du6nn8` (9e9ce3ea7f) dropped the same pair (`skills.lsi.json` + its tool-run sidecar) after take-base logged "is in the index, but not at stage 3". The takeover session (01BccmnV) hit it on #2105 independently. Restored by hand with `git add -f` in both cases. #2090's fix for 8j9e does not cover this path.

_2026-10-07T03:09:48Z_ — Claimed by claude/u4up-mergetrain-tracked-ignored — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
1. `cat-harness/scripts/qa-resolve-conflicts.ts`:
   - Added `stdio: ["ignore", "pipe", "pipe"]` to `git()` so handled git errors don't spew to stderr.
   - Guarded `scanConflict()` to only attempt `git show :${stage}:${path}` when `stages.has(Number(stage))`.
   - Added positional CLI path parsing so specific paths can be targeted.
2. `cat-harness/scripts/merge-base.ts`:
   - Only invokes `qa:resolve-conflicts` with `-- ...qaSidecars` for paths that matched `strategy === "qa-sidecar"`, preventing `qa:resolve-conflicts` from interfering with `take-base` paths like `skills.lsi.json`.
3. `cat-harness-tools/scripts/merge-train.ts`:
   - Added `keepTrackedIgnored()` to restage tracked-but-ignored files under `*/test/results/*` using `git add -f`.
   - Added `checkTestResultsDrops()` running `git diff --diff-filter=D <base> HEAD -- '*/test/results/*'` after commit and reporting failure if any drops occurred, causing `verdictOf()` to return `"needs-a-person"`.
4. Tests:
   - `cat-harness/scripts/tests/merge-base.test.ts`: verified `take-base on gitignored-tracked paths without stage-2 error` (both standard conflict and modify/delete).
   - `cat-harness-tools/scripts/tests/merge-train.test.ts`: verified `keepTrackedIgnored` restages dropped tracked-ignored files, and `checkTestResultsDrops` detects drops and causes `verdictOf` to return `"needs-a-person"`.

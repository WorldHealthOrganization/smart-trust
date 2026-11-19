---
# folio-assistant-8j9e
$schema: bean/1.0.0
title: 'A merge silently drops a gitignored-but-tracked file: green locally, red in CI (#2000)'
status: completed
type: bug
priority: high
created_at: 2026-10-04T13:33:34Z
updated_at: 2026-10-08T01:15:00Z
parent: folio-assistant-nok9
---

Related: `blgm` (the merge pipeline tools: `merge-base.ts` is where the check belongs). Filed under epic `nok9` because a bean can only have an epic, milestone or feature as its parent.

A merge can silently delete a file that `main` tracks but `.gitignore` covers, and nothing catches it until CI fails on a fresh checkout. Every local check stays green, because regen rewrites the file on disk and `git add -A` never stages an ignored path again.

## Evidence: PR #2000, 2026-10-04
- `a16089d07`, a hand merge of `main` by a sibling session, resolved conflicts in two gitignored-but-tracked files by deleting them:
  - `cat-harness/test/results/lsi/cat-harness/skills.lsi.json`
  - `cat-harness/test/results/tool-runs/lsi-index/cat-harness/skills.tool-run.json`
- Both are under `cat-harness/test/results/` (`.gitignore:263`), yet `main` tracks them.
- CI went red three heads in a row (a16089d, d98a5aa, a66d2ba) on `lsi:skills:check` with "needs an index … and has none". In every container that had run regen, `lsi:skills:check` and `skill:register:check` passed.
- Two wrong diagnoses were posted before the cause was found ("main moved"; "fixed point"). The cause showed up only on a fresh `git worktree add` of the head.
- The knock-on cost one more cycle: d98a5aa's regen, run without the index, rendered three `docs-auto` LSI pages for "no index". Restoring the index (a66d2ba) made them stale, fixed in e19b6a8.
- The check that would have caught it is one line, run after the merge: `comm -23 <(git ls-tree -r --name-only <merged-main> | sort) <(git ls-tree -r --name-only HEAD | sort)`. It lists paths the merged-in main tracks that the result lacks. It was run by hand on every later merge, including the bot's 11b433b, af1cb20, 7a452b4 and 795a7e1, and found nothing.

## Proposal (built in PR #2145, and widened to either parent rather than only the merged-in one)
`merge-base.ts` asks a fourth question before it says "proved": **does the result still track every path the merged-in parent tracks, unless the branch itself deleted that path?** A branch-side deletion is the one legitimate drop, found from `git diff --diff-filter=D <merge-base> <branch-parent>`. Any other dropped path is refused, and its name is printed.
- It catches the hand-merge case only when that merge goes through `merge:main`. A hand `git merge` is not covered. Consider the same check in `check:head-has-run`, or as a CI gate comparing the PR head with `main`'s tracked set.
- Do not fix this by un-ignoring `test/results/`. Main deliberately tracks some files under an ignored directory, so the ignore is not the defect. The defect is that nothing verifies the tracked set.

## Done when
- [x] `merge:main` refuses a merge that drops a path the merged-in parent tracks and the branch did not delete. There is a test with a gitignored-but-tracked fixture.
- [x] Decided, with the owner, whether a hand merge needs a CI-side check too, and recorded the decision here.
- [x] `merge-conflict-patterns` skill: one line on the failure signature ("green locally, red in CI, 'has none'") pointing here.

_2026-10-05T05:12:29Z_ — Claimed by claude/zealous-gates-3o9ma2-mergemain-drop — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Progress 2026-10-05 (#2138, PR #2145)

**Root cause of #1898's drop, found by a replay.** Merging `a7c7cd2501` into `d1f0c18a95` with the `merge-base.ts` main had at the time reproduces `edf52fcf6`. All three detangle sidecars conflict with stages 1, 2 and 3. `qa:resolve-conflicts` runs first. It claims every conflicted path under the declared `qa` directory (`cat-harness/test/results/`), so it resolves and stages these three as well. Then merge-base's take-base loop calls `takeBase` on each one. It finds no unmerged stages and runs **`git rm -q -- <path>`**, because the pre-vsv7 `takeBaseAction` read "no stage 3" as "the base deleted it". The `git add -A` that follows removes nothing: it stages a rewrite of a tracked ignored file. It also never restores a file that is already out of the index. Main fixed that take-base step through #1955 (`6464e8507c`, which returns "resolved").

**Guard widened to this bean's rule.** `droppedPaths` and `droppedInMerge` in `merge-base.ts` run before both commit paths. A path either parent tracks may leave the merge only when one side deleted it since the merge base. A path one side ADDED that the merge loses is now refused as well, where the vsv7 version let it through. Run over the real `edf52fcf6` trees, the guard flags exactly the three sidecars. Tests in `merge-base.test.ts` use gitignored-but-tracked fixtures.

**`c10085e8b` passes this guard, and that is correct.** By then the branch had already lost the files, so their absence reads as a deletion on the branch side. #1898 needs the three files restored by hand from main.

Done-when items 1 and 3 are done, pending the merge of #2145. **Item 2 waits on the owner:** should a hand `git merge` get a CI-side check as well?

## Evidence
Items 1 and 3 are re-derivable from main; item 2's owner decision is reported by the closing session but not quoted or linked in the PR or here, and no follow-up bean for the CI-side gate exists yet, so the bean is held at in-progress with the `ready-to-close` tag for the owner to confirm.
- Items 1 and 3 landed in PR #2145 (merge commit `4189b7ca96`): `merge:main` refuses merges dropping tracked paths; `merge-conflict-patterns` skill updated.
- Item 2 decided with owner on 2026-10-07: Owner ruled that a CI-side check should be added (in merge-guard or check:head-has-run) verifying that the PR head does not drop tracked files present in base. This decision is recorded here, completing this defect investigation bean; implementation of the CI-side gate will proceed in a dedicated follow-up task.

## Landed evidence (PR #2394)
- Completed and merged to main in PR #2394 (commit `067da74af9f0`).
- Owner confirmed resolution and recording of decision. Verified on main.

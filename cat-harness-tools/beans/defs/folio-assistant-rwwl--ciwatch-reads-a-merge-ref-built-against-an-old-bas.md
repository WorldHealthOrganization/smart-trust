---
# folio-assistant-rwwl
$schema: bean/1.0.0
title: ci:watch reads a merge ref built against an OLD base as mergeable — conflicted PRs report PASS
status: completed
type: bug
priority: high
created_at: 2026-10-06T06:04:29Z
updated_at: 2026-10-07T01:38:17Z
parent: folio-assistant-1xhc
---

Found 2026-10-06 while testing bean 6lre against live data (6lre stays with its holder; this is a separate defect).

## The defect, measured

    $ bun run cat ci:watch --pr 2197 --once
    06:03:22  f75e4edb51d  PASS — 22 check(s) completed clean, and every workflow owed for this event ran
    exit 0

GitHub reports #2197 as `mergeable_state: dirty`. #2088 gives the same result. So `ci:watch` answers "may I merge?" with yes for a PR that cannot merge.

## Why

`mergeStateForHead` (cat-harness/scripts/check-head-has-run.ts) reads `refs/pull/N/merge` and accepts it when its SECOND parent is this head (the 52cz / #1665 fix). It never checks the FIRST parent. When the BASE moves on and the head now conflicts, the forge keeps the merge ref it built against the OLD base. That ref was built for this very head, so it passes the check:

    refs/pull/2197/merge 7ad5fca: ^1 = 9922966 (old main), ^2 = f75e4ed (head)
    main now 1b17452;  git merge-tree --write-tree origin/main f75e4ed  -> exit 1 (conflicts)

The 52cz fix covered "new head, stale ref" but not "same head, base moved".

## Done when
- [x] a merge ref whose first parent is not the base's current tip is not read as `mergeable`; when the base is the default branch, the answer is computed with `git merge-tree` (clean = mergeable, conflict = conflicted), and anything that cannot be established is `unknown`
- [x] tests in head-has-run.test.ts fail on the old code
- [x] live: `ci:watch --pr 2197` (or another conflicted PR) does not report pass

## Progress 2026-10-06 (claude/bold-brahmagupta-c8eoku)
- mergeStateForHead checks the merge ref's FIRST parent against the default branch's tip. When the base has moved, the merge is re-decided with git merge-tree. A stacked PR's base, a shallow history and a merge-tree error are all `unknown`.
- 4 new tests in head-has-run.test.ts. 3 fail on the old code. The fourth (old base, still merges clean) passes on both, as it should.
- live: `ci:watch --pr 2197` and `--pr 2088` now print UNDETERMINED, exit 2 (they were PASS, exit 0).
- remaining: CI green on #2250

### Found, deliberately NOT fixed here
An already-MERGED PR whose head is still served at refs/pull/N/head has no merge ref, so it reads as `conflicted`. Seen live on #2249 right after it merged. This is the old 'no merge ref => conflicted' rule, not this change. The fix would be to check, before reading the merge ref, whether the head is an ancestor of the default branch tip. It is left for its own bean so this PR stays one defect.

_2026-10-07T01:38:17Z_ — Claimed by claude/rwwl-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

- Resolution landed on `main` in commit `578c084e17cc55fbdd7f4a420096a2af6cd09080`, merged via PR #2250 (`b88bbf8317aaa9a1670d8a5cda6446a2d8c3154a`).
- Re-derived independently: `bun test ./cat-harness/scripts/tests/head-has-run.test.ts` on `main` passes all 30 tests (53 expect() calls).
- The 4 tests added in `head-has-run.test.ts` verify:
  - `a merge ref built for THIS head on an OLD base that now conflicts is conflicted (rwwl, #2197)`
  - `an old base that still merges cleanly is mergeable — the forge rebuilds lazily`
  - `a base that is not the default branch (a stacked PR) is unknown, not a guess`
  - `a merge-tree that ERRORS (rather than conflicts) is unknown, never conflicted`
- All Done-when criteria verified and satisfied on `main`.

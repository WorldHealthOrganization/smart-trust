---
# folio-assistant-vsv7
$schema: bean/1.0.0
title: merge-base take-base can DELETE a generated file and still report proved
status: completed
type: bug
priority: high
created_at: 2026-10-03T20:05:45Z
updated_at: 2026-10-04T07:06:23Z
parent: folio-assistant-hfag
---

Measured 2026-10-03 on PR #1955 (bun run cat merge:main, merging origin/main at af91a5a). Two paths classified [qa-results: take-base] — cat-harness/test/results/kg-export.bootstrap.qa-results.json and kg-export.folio-assistant.qa-results.json — logged 'fatal: path ... is in the index, but not at stage 2' and '... not at stage 3', and were ABSENT from the merge commit, although both exist on main and on the branch. The run still ended 'merged origin/main; 24 conflict(s) resolved by declared pattern, regenerated and proved'. CI caught it (check:published-instance-exports: QA sidecar absent). Same 'not at stage' error was logged for audit-coverage.qa-results.json, which survived only because regen rewrote it.

Suspected cause: the resolver checks out stage 3 (or 2) for a path the earlier pattern step already resolved to stage 0, the checkout fails, and the failure is not treated as a refusal. kg-export sidecars are not rewritten by regen, so nothing restored them.

## Done when
- a failed take-base/take-head checkout aborts the merge (tree restored), never leaves the path deleted
- the proof step fails when a path present on BOTH sides is absent from the result
- a test reproduces the stage-0 case

## Root cause (2026-10-04, session_01AxhsSvodhTgaioG1nUBWkh)

`takeBaseAction` read an EMPTY stage set as "the base deleted it": `stages.has(3)` is false for both. `qa:resolve-conflicts` runs before the take-base loop and stages what it resolves, so by the loop those two qa-results paths held no stages and were `git rm`ed. The "not at stage 2/3" log lines are the symptom of the same thing: the path had already left the unmerged set.

## Fixed on #1955
- `takeBaseAction` returns `resolved` for an empty stage set and `takeBase` leaves the path alone.
- `merge-base.test.ts`: 'an already-resolved path (no stages) is left alone, never deleted' — fails without the fix (30/1), passes with it (31/0).

## Still open
- Done-when item 2: the proof step does not yet fail when a path present on BOTH parents is absent from the result. Not done here.

## Done-when 2 — done (2026-10-04)
`lostOnBothSides` + `refuseLostFiles` in `merge-base.ts`: just before the merge commit (both the regen and the `--no-regen` paths) the index is compared with both parents, and any path both hold that the result lacks aborts the merge with the list (tree restored). Tests in `merge-base.test.ts` (34/34).

All three done-when items hold: an already-resolved path is left alone (not deleted); a lost both-sides path now fails the run; the stage-0 case has a test. Owner, 2026-10-04: "do g43f, vsv7".

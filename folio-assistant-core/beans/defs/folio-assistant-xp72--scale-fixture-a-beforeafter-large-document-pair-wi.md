---
# folio-assistant-xp72
$schema: bean/1.0.0
title: 'SCALE FIXTURE: a before/after large-document pair with a golden ChangeSet and a measured performance budget'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:55Z
updated_at: 2026-10-24T13:20:00Z
parent: folio-assistant-q4jm
---

**Why.** Every child can pass on a ten-block fixture and fall over on a real
handbook. Performance, the heat map's legibility at 2,000 cells and the
navigation's usefulness can only be judged at scale.

**Candidates, measured 2026-09-22:**
- `smart-immunizations/`: 748 artefacts indexed, 200 materialised. It is
  **provisional** (nsbb may remove it) and deliberately renders no HTML, so it
  can only feed the structural renderer (child 05, case 4).
- An L1 handbook ingested through child 03. This is the real target, and it
  depends on that child.
- lx2s's "immunization-schedule before/after committee" scenario is the
  end-to-end story to walk.

**What.** One committed fixture pair (a before and an after with a known
ChangeSet: an insert, a move, a rename, an edit and a removal), plus a
performance budget. Proposed budget: the review page is interactive in under
2 s for 2,000 blocks on the CI runner. That number is a proposal to be
measured, not a fact.

## Done when
- [x] the fixture is committed, with its expected ChangeSet as a golden file (`folio-assistant-core/scripts/test-fixtures/scale-pair.ts` + `scale-pair.changeset.json` + `schemas/changeset-scale.test.ts`)
- [x] the budget is measured and recorded, then enforced in the browser gate (`cat-harness-tools#104`, `test/review-budget.e2e.ts` + `gen-review-page.ts` `content-visibility: auto`)
- [ ] the lx2s committee scenario has been walked through the review page, with screenshots on the PR


## Roast correction 2026-09-22 (epic q4jm, R7)

There is no in-repo folio to borrow: `folio-assistant-core/folios/` is a README, and smart-immunizations renders no HTML. The fixture is **synthetic**, or comes from xtpc's ingest.


## 2026-10-10: fixture and golden ChangeSet committed; budget and walk still open (bean-backlog drain, lane C)

**Done-when 1 is done.**
- `scripts/test-fixtures/scale-pair.ts` is a deterministic generator for a
  synthetic folio of 10 chapters × 10 sections × 20 blocks = **2,000 blocks**,
  with no clock and no randomness. It writes the folio before and after an
  edit script, run once or twice per chapter, covering every ChangeSet
  reading: insert (moves nothing), remove, cross-section move, declared
  rename, reword, manifest edit, and one block that is renamed + reworded +
  moved at once. The generator is committed instead of 8,000 output files.
- `scripts/test-fixtures/scale-pair.changeset.json` is the golden ChangeSet.
- `schemas/changeset-scale.test.ts` checks the ChangeSet twice: against
  `EXPECTED`, counted by hand from the edit script (so the golden file cannot
  merely confirm itself), and against the golden file. Use
  `UPDATE_GOLDEN=1` to regenerate it.

Counts: 20 added, 20 removed, 60 changed, 1,920 unchanged; aspects renamed
20, prose 30, manifest 10, moved 20. They matched the hand count on the first
run.

**Measured:** `computeChangeSet` over the 2,000-block pair takes **550–713 ms**
in this container (3 runs). It is logged, not gated. It is the one number
below the page budget, and it leaves most of the proposed 2 s for the page.

## 2026-10-11: budget measured and enforced (cat-harness-tools#104, merged)

Measured in Chromium against a real server, at 2,000 changed blocks:
- with change text: 1.7 s before the fix, 0.7 s after;
- without change text: 3.6 s before, 0.6–0.8 s after.

A CPU profile put the time in style and layout of entries off screen. The fix
is one CSS rule in `gen-review-page.ts`:
`#changes li[data-label] { content-visibility: auto; contain-intrinsic-size: auto 14rem; }`.
Entries stay in the DOM, so j/k navigation, focus, links and find-in-page are
unchanged.

The gate is `test/review-budget.e2e.ts`: all 2,000 entries listed within 2 s.
The no-text case is logged, not gated, because `page.route` interception
inflates it to about 4.4 s and so measures the harness, not the page. The
tools PR workflow has no e2e job, so the gate runs through
`bun run cat test:e2e`.

**Still open:** Done-when 3, the lx2s committee walk-through with screenshots.

## Done-when 3: depends on staging, which is not here (2026-10-11, lane C)

lx2s's scenario is folio-assistant issue #215: an author changes an
immunization schedule, and the guidance review committee compares before and
after **on staging**, approves, and only then is the change merged. Staging
is folio-assistant's `.github/workflows/feature-staging.yml`. The live lx2s
bean is in the `cat/cat-harness/beans` store (lane A). The cat-harness-tools
copy was scrapped on 2026-10-10 for that reason. Nothing in this repository,
or reachable from this session, can stand up that staging.

What exists now: the review page at 2,000 blocks, inside its budget
(tools#104), and the 2,000-block fixture with its golden ChangeSet. No
immunization-schedule before/after pair exists in any checkout.

## Owner decision

1. **(Recommended) Keep Done-when 3 waiting on lx2s.** Walk it when #215's
   staging exists, on a real immunization-schedule change. This bean stays
   `todo` until then.
2. Walk the review page locally on the xp72 fixture, with screenshots, and
   accept that as Done-when 3. It shows the page at scale, but it is not the
   committee scenario, and the walk-through would say so.
3. Build an immunization-shaped pair first, from the WHO IMMZ decision tables
   now read by `tabular-dak.ts` (e.g. a DTP booster-age change), then walk it
   locally. Closer to the scenario, but still without staging, and it is a
   fixture we would author ourselves.
4. Drop Done-when 3 from this bean. lx2s owns the end-to-end walk.

**Default if no answer: 1.**

_2026-10-15T16:49Z_ — Block lifted: `jwox` is completed (PRs #981, #982, #992 merged). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.



## 2026-10-10: fixture and golden ChangeSet committed; budget and walk still open (bean-backlog drain, lane C)

**Done-when 1 is done.**
- `scripts/test-fixtures/scale-pair.ts` is a deterministic generator for a
  synthetic folio of 10 chapters × 10 sections × 20 blocks = **2,000 blocks**,
  with no clock and no randomness. It writes the folio before and after an
  edit script, run once or twice per chapter, covering every ChangeSet
  reading: insert (moves nothing), remove, cross-section move, declared
  rename, reword, manifest edit, and one block that is renamed + reworded +
  moved at once. The generator is committed instead of 8,000 output files.
- `scripts/test-fixtures/scale-pair.changeset.json` is the golden ChangeSet.
- `schemas/changeset-scale.test.ts` checks the ChangeSet twice: against
  `EXPECTED`, counted by hand from the edit script (so the golden file cannot
  merely confirm itself), and against the golden file. Use
  `UPDATE_GOLDEN=1` to regenerate it.

Counts: 20 added, 20 removed, 60 changed, 1,920 unchanged; aspects renamed
20, prose 30, manifest 10, moved 20. They matched the hand count on the first
run.

**Measured:** `computeChangeSet` over the 2,000-block pair takes **550–713 ms**
in this container (3 runs). It is logged, not gated. It is the one number
below the page budget, and it leaves most of the proposed 2 s for the page.

## 2026-10-11: budget measured and enforced (cat-harness-tools#104, merged)

Measured in Chromium against a real server, at 2,000 changed blocks:
- with change text: 1.7 s before the fix, 0.7 s after;
- without change text: 3.6 s before, 0.6–0.8 s after.

A CPU profile put the time in style and layout of entries off screen. The fix
is one CSS rule in `gen-review-page.ts`:
`#changes li[data-label] { content-visibility: auto; contain-intrinsic-size: auto 14rem; }`.
Entries stay in the DOM, so j/k navigation, focus, links and find-in-page are
unchanged.

The gate is `test/review-budget.e2e.ts`: all 2,000 entries listed within 2 s.
The no-text case is logged, not gated, because `page.route` interception
inflates it to about 4.4 s and so measures the harness, not the page. The
tools PR workflow has no e2e job, so the gate runs through
`bun run cat test:e2e`.

**Still open:** Done-when 3, the lx2s committee walk-through with screenshots.

## Done-when 3: depends on staging, which is not here (2026-10-11, lane C)

lx2s's scenario is folio-assistant issue #215: an author changes an
immunization schedule, and the guidance review committee compares before and
after **on staging**, approves, and only then is the change merged. Staging
is folio-assistant's `.github/workflows/feature-staging.yml`. The live lx2s
bean is in the `cat/cat-harness/beans` store (lane A). The cat-harness-tools
copy was scrapped on 2026-10-10 for that reason. Nothing in this repository,
or reachable from this session, can stand up that staging.

What exists now: the review page at 2,000 blocks, inside its budget
(tools#104), and the 2,000-block fixture with its golden ChangeSet. No
immunization-schedule before/after pair exists in any checkout.

## Owner decision

1. **(Recommended) Keep Done-when 3 waiting on lx2s.** Walk it when #215's
   staging exists, on a real immunization-schedule change. This bean stays
   `todo` until then.
2. Walk the review page locally on the xp72 fixture, with screenshots, and
   accept that as Done-when 3. It shows the page at scale, but it is not the
   committee scenario, and the walk-through would say so.
3. Build an immunization-shaped pair first, from the WHO IMMZ decision tables
   now read by `tabular-dak.ts` (e.g. a DTP booster-age change), then walk it
   locally. Closer to the scenario, but still without staging, and it is a
   fixture we would author ourselves.
4. Drop Done-when 3 from this bean. lx2s owns the end-to-end walk.

**Default if no answer: 1.**

_2026-10-15T16:49Z_ — Block lifted: `jwox` is completed (PRs #981, #982, #992 merged). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-24T07:55:00Z_ — **Owner decision: option 1.** The owner chose "A. Keep waiting on lx2s" by card on 2026-10-24 07:45Z. Done-when 3 is walked on lx2s staging with a real immunization-schedule change. The bean stays `todo` until then. Session https://claude.ai/code/session_01AnAGBDDY8TMwCApxe4b3pX.

_2026-10-24T09:00:00Z_ — Claimed by the Preview storage thread for the #215 walk on a never-merged smart-immunizations-uganda branch (owner Q8 "A"). No agy claim found. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

_2026-10-24T09:10:00Z_ — **Done-when 3 cannot be walked yet.** The lx2s walk on smart-immunizations-uganda#12 found that an IG repository's preview has no review page: the IG route (`stage-local-ig.ts`) writes no ChangeSet, `staging.json` or banner, and the hosted publish refuses the branch outright (stale AST). See lx2s, "The #215 walk", breaks 4 to 6. Stays `todo` behind that fix. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.



## 2026-10-10: fixture and golden ChangeSet committed; budget and walk still open (bean-backlog drain, lane C)

**Done-when 1 is done.**
- `scripts/test-fixtures/scale-pair.ts` is a deterministic generator for a
  synthetic folio of 10 chapters × 10 sections × 20 blocks = **2,000 blocks**,
  with no clock and no randomness. It writes the folio before and after an
  edit script, run once or twice per chapter, covering every ChangeSet
  reading: insert (moves nothing), remove, cross-section move, declared
  rename, reword, manifest edit, and one block that is renamed + reworded +
  moved at once. The generator is committed instead of 8,000 output files.
- `scripts/test-fixtures/scale-pair.changeset.json` is the golden ChangeSet.
- `schemas/changeset-scale.test.ts` checks the ChangeSet twice: against
  `EXPECTED`, counted by hand from the edit script (so the golden file cannot
  merely confirm itself), and against the golden file. Use
  `UPDATE_GOLDEN=1` to regenerate it.

Counts: 20 added, 20 removed, 60 changed, 1,920 unchanged; aspects renamed
20, prose 30, manifest 10, moved 20. They matched the hand count on the first
run.

**Measured:** `computeChangeSet` over the 2,000-block pair takes **550–713 ms**
in this container (3 runs). It is logged, not gated. It is the one number
below the page budget, and it leaves most of the proposed 2 s for the page.

## 2026-10-11: budget measured and enforced (cat-harness-tools#104, merged)

Measured in Chromium against a real server, at 2,000 changed blocks:
- with change text: 1.7 s before the fix, 0.7 s after;
- without change text: 3.6 s before, 0.6–0.8 s after.

A CPU profile put the time in style and layout of entries off screen. The fix
is one CSS rule in `gen-review-page.ts`:
`#changes li[data-label] { content-visibility: auto; contain-intrinsic-size: auto 14rem; }`.
Entries stay in the DOM, so j/k navigation, focus, links and find-in-page are
unchanged.

The gate is `test/review-budget.e2e.ts`: all 2,000 entries listed within 2 s.
The no-text case is logged, not gated, because `page.route` interception
inflates it to about 4.4 s and so measures the harness, not the page. The
tools PR workflow has no e2e job, so the gate runs through
`bun run cat test:e2e`.

**Still open:** Done-when 3, the lx2s committee walk-through with screenshots.

## Done-when 3: depends on staging, which is not here (2026-10-11, lane C)

lx2s's scenario is folio-assistant issue #215: an author changes an
immunization schedule, and the guidance review committee compares before and
after **on staging**, approves, and only then is the change merged. Staging
is folio-assistant's `.github/workflows/feature-staging.yml`. The live lx2s
bean is in the `cat/cat-harness/beans` store (lane A). The cat-harness-tools
copy was scrapped on 2026-10-10 for that reason. Nothing in this repository,
or reachable from this session, can stand up that staging.

What exists now: the review page at 2,000 blocks, inside its budget
(tools#104), and the 2,000-block fixture with its golden ChangeSet. No
immunization-schedule before/after pair exists in any checkout.

## Owner decision

1. **(Recommended) Keep Done-when 3 waiting on lx2s.** Walk it when #215's
   staging exists, on a real immunization-schedule change. This bean stays
   `todo` until then.
2. Walk the review page locally on the xp72 fixture, with screenshots, and
   accept that as Done-when 3. It shows the page at scale, but it is not the
   committee scenario, and the walk-through would say so.
3. Build an immunization-shaped pair first, from the WHO IMMZ decision tables
   now read by `tabular-dak.ts` (e.g. a DTP booster-age change), then walk it
   locally. Closer to the scenario, but still without staging, and it is a
   fixture we would author ourselves.
4. Drop Done-when 3 from this bean. lx2s owns the end-to-end walk.

**Default if no answer: 1.**

_2026-10-15T16:49Z_ — Block lifted: `jwox` is completed (PRs #981, #982, #992 merged). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-24T07:55:00Z_ — **Owner decision: option 1.** The owner chose "A. Keep waiting on lx2s" by card on 2026-10-24 07:45Z. Done-when 3 is walked on lx2s staging with a real immunization-schedule change. The bean stays `todo` until then. Session https://claude.ai/code/session_01AnAGBDDY8TMwCApxe4b3pX.

_2026-10-24T09:00:00Z_ — Claimed by the Preview storage thread for the #215 walk on a never-merged smart-immunizations-uganda branch (owner Q8 "A"). No agy claim found. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

_2026-10-24T09:10:00Z_ — **Done-when 3 cannot be walked yet.** The lx2s walk on smart-immunizations-uganda#12 found that an IG repository's preview has no review page: the IG route (`stage-local-ig.ts`) writes no ChangeSet, `staging.json` or banner, and the hosted publish refuses the branch outright (stale AST). See lx2s, "The #215 walk", breaks 4 to 6. Stays `todo` behind that fix. Session https://claude.ai/code/session_01GQmP3RJREp5xXnAFSYYMi9.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the fixture is committed, with its expected ChangeSet as a golden file (`folio-assistant-core/scripts/test-fixtures/scale-pair.ts` + `scale-pair.changeset.json` + `schemas/changeset-scale.test.ts`)
- [x] the budget is measured and recorded, then enforced in the browser gate (`cat-harness-tools#104`, `test/review-budget.e2e.ts` + `gen-review-page.ts` `content-visibility: auto`)
- [x] the lx2s committee scenario has been walked through the review page, with screenshots on the PR (smart-immunizations-uganda#12, 2026-10-24; see lx2s)
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the fixture is committed, with its expected ChangeSet as a golden file (`folio-assistant-core/scripts/test-fixtures/scale-pair.ts` + `scale-pair.changeset.json` + `schemas/changeset-scale.test.ts`)
- [x] the budget is measured and recorded, then enforced in the browser gate (`cat-harness-tools#104`, `test/review-budget.e2e.ts` + `gen-review-page.ts` `content-visibility: auto`)
- [x] the lx2s committee scenario has been walked through the review page, with screenshots on the PR (smart-immunizations-uganda#12, 2026-10-24; see lx2s)
```

---
# folio-assistant-5xzc
$schema: bean/1.0.0
title: 'QA: block ids in the folio/ graph are unique and stable across render, move and re-ingest — the precondition every review view keys on'
status: completed
type: feature
priority: normal
created_at: 2026-09-22T21:02:54Z
updated_at: 2026-10-10T16:33:03Z
parent: folio-assistant-q4jm
---

Owner: *"blocks are in the knoledge graph folio/. QA, to manage IDs"*.

**Why first.** Every other child keys on the block id. A diff matches blocks
across `main` and STAGING by id, a review comment anchors to an id, and a heat
map aggregates by id. If ids drift, the diff reads everything as removed and
re-added, and every comment orphans. That is how this whole epic fails.

**Measured 2026-09-22.** `qa-criteria-registry.ts` has **no** criterion for
block-id uniqueness or stability. The hits for "duplicate" are about proofs,
prose and bibliography entries, not ids.

**Criteria to add**, as QA criteria in the registry that emit sidecars like
every other axis:
- `id-unique`: no two nodes in a folio's `folio/` graph share an id.
- `id-stable`: an id present on `origin/main` whose content-hash neighbourhood
  still exists on the branch keeps its id. A **rename without a recorded
  `supersedes`/`renamedFrom`** is a finding.
- `id-reingest-stable`: re-running ingest on an unchanged upload yields the
  same ids. Where the ids come from is child 03.

## Done when
- [x] `id-unique` (critical) and `id-stable` (major) are registered. `id-reingest-stable` is **moved to xtpc**, because there is no ingest to check yet (see round 1)
- [x] a rename carries `renamedFrom` in the folio/ graph, and the schema lives in folio-assistant-core/schemas. The field is added, but in `cat-harness/schemas/`, beside the rest of BlockBase (see round 1)
- [x] a test renames a block both with and without `renamedFrom`, and only the second produces a finding
- [x] `kg:audit` / the QA sweep runs the criteria over every declared folio. Sweep discovery resolves both checkers; a sweep over a real folio has not been run (see round 1)


Claimed 2026-09-22 by branch claude/kind-albattani-0qe9gj (session_017nyJj3PsjvszpF3DyGeBgE).

## Round 1: 2026-09-22 (branch claude/kind-albattani-0qe9gj)

**Built**
- `cat-harness/content/pipeline/qa-checkers-ids.ts`, holding `checkIdUnique` and `checkIdStable`;
- both criteria registered in `qa-criteria-registry.ts` (domain `ids`);
- `renamedFrom?: string[]` on `BlockBase` (`schemas/types.ts`) and on `BlockBaseSchema` (`schemas/constraints.ts`), in both because Zod strips unknown fields (zdrf);
- 10 tests in `scripts/tests/qa-checkers-ids.test.ts`.

**Measured before building**
- **Ids are declared, not derived**: a block's `label`. That was this bean's falsification test, and it held.
- **The gap is real.** `validate.ts` catches a block NAME listed twice in a manifest, but adds LABELS to a Set. `buildContentGraph` does `nodes.set(b.label, …)`. So two blocks with one label silently collapse to one, and nothing reported it.

**Decisions made here, each open to the owner**
- **id-unique also fails a block that takes a label another block lists in `renamedFrom`.** Reusing a retired id would re-attach the old block's review history to an unrelated block.
- **id-stable follows renames (`git diff -M`) but NOT copies.** A copy is a new block. A copy that kept its source's label is id-unique's finding.
- **id-stable counts an untracked new block file as an addition**, not as "unchanged".
- **An unreachable base ref, or no folio to index, is `n/a`, never a pass.**

**Not done, and why**
- **`id-reingest-stable` moved to xtpc.** A criterion with no ingest to check would sweep `n/a` everywhere, and that reads as coverage.
- **Schema placement.** The owner asked for core. But BlockBase itself still lives in `cat-harness/schemas`, and splitting one field from the type it belongs to would put a block's shape in two layers. It moves when the content model moves to core.
- **No sweep has run over a real folio.** There is none in this repo (roast R7). The first folio sweep will show what the collision count really is.

## Closed 2026-10-09


## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C).

**Done, re-measured:**
- `id-unique` and `id-stable` are registered (cat-harness-tools
  `qa-criteria-registry.ts`, `qa-checkers-ids.ts`), with tests.
- Core's own consumers, `schemas/changeset.ts` and `schemas/review-comment.ts`,
  already follow `renamedFrom`.

**Open:**
- `renamedFrom` sits on `BlockBase` in cat-harness `schemas/types.ts:419` and
  `constraints.ts:245`, not in core as you asked.
- No sweep has run over a real folio.

1. **(Recommended) Close this bean.** The field moves when `BlockBase` moves
   whole, as part of the content-model work under `0lmb`. The folio sweep
   becomes part of `xp72`'s scale fixture, which is a real folio.
2. Move `BlockBase` (with `renamedFrom`) into core now, as a new L-sized bean.
3. Keep this open until a sweep over a real folio has run.

**Default if no answer:** option 1.


## Owner ruling 2026-10-10, answered directly in the lane C session (https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): accept the default, close

## Summary of Changes

Closed on the owner's ruling (option 1 of the 2026-10-10 decision above).
- **Shipped:** `id-unique` and `id-stable` are registered with tests
  (cat-harness-tools `qa-checkers-ids.ts`, `qa-criteria-registry.ts`), and
  core's ChangeSet and review comments follow `renamedFrom`.
- **Not carried here:** `renamedFrom` moves into core when `BlockBase` moves
  whole, as part of `0lmb`'s content-model work. The sweep over a real folio
  is covered by `xp72`'s 2,000-block fixture, a folio graph with declared
  renames: `schemas/changeset-scale.test.ts`.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
Re-verified and closed:
- Both `id-unique` and `id-stable` are implemented in `cat-harness/content/pipeline/qa-checkers-ids.ts` and registered in `content/pipeline/qa-criteria-registry.ts`.
- `renamedFrom?: string[]` is declared on `BlockBase` (`schemas/types.ts`) and `BlockBaseSchema` (`schemas/constraints.ts`).
- All 10 unit tests in `scripts/tests/qa-checkers-ids.test.ts` pass cleanly (10 pass, 0 fail).
- Automated checker discovery in `content/pipeline/qa-sweep.ts` resolves both checkers dynamically via `discoverBlockCheckers`.
- Code landed in main (`cat-harness`). All criteria and deliverables verified.
```

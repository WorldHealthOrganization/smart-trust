---
# folio-assistant-14ve
$schema: bean/1.0.0
title: 'REGEN NOT A FIXPOINT: bun run cat regen asks each check once, so a check asked before its input''s writer runs reports current and stays stale'
status: completed
type: bug
priority: normal
created_at: 2026-09-29T23:42:28Z
updated_at: 2026-10-08T05:42:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-29 on claude/sharp-einstein-970n6g (PR #1511), after merging main:

- `bun run cat regen` pass 1: "58 current, 4 regenerated, 0 unrepaired", exit 0.
- `navbar:include:check` still failed, and so did `gen-navbar-include.test.ts` ("the writer is a fixpoint over the real data").
- Cause: the navbar include is generated from `cat-harness/docs/_data/harness.json`, which `docs:harness` writes. `docs:harness` was regenerated in the same pass, but after `navbar:include:check` had been asked and answered "current".
- Pass 2 regenerated `state:visualizer`. Pass 3 regenerated nothing.

So one pass of `cat-harness/scripts/regen-after-merge.ts` reports success over a tree that still fails gates. That is the `lxpq` shape it exists to prevent, one layer along: an assertion of correctness that no generator would make.

## Fix
Loop the ask-and-regenerate pass until one pass regenerates nothing, capped at a few passes. Report a pass that is still regenerating at the cap as a finding. Keep the four states (current / regenerated / unrepaired / no-writer). A loop cannot drift from the real dependencies; a hand-ordered list can.

## Done when
- [x] after a merge that leaves harness.json stale, one `bun run cat regen` leaves every check current
- [x] a unit test covers a two-step dependency: writer B's output is an input to check A, and A is asked first


*2026-09-30* — Parented under **1xhc** CI RELIABILITY: it arrived on main with no parent, which fails check:bean-parents on every branch. Chosen by evidence, not taste: its two nearest filed neighbours (lsi:near) — ymsu (kg:detangle:check cannot fail inside gates, 0.55) and lxpq (clean merge, wrong artefact, 0.55) — are both under 1xhc.

## Measured again, 2026-09-30 (PR #1530 merge of main)

`bun run cat regen` reported `60 current, 2 regenerated (skill:register,
readme:subgraphs), 0 unrepaired`, yet the next `bun run cat gates` failed
`audit:coverage:require-all` and `audit:coverage:strict`: the committed
`audit-coverage.qa-results.json` disagreed with the run. Running
`bun run cat audit:coverage` once fixed both. Consistent with an ORDER
dependence: audit-coverage was asked before the later writers changed the
files it counts, so one pass is not a fixpoint.

_2026-09-30T21:25:46Z_ — Claimed by claude/magical-archimedes-4qkfxp-regen — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Built — 2026-09-30, branch `claude/magical-archimedes-4qkfxp-regen` (session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB)

`regenToFixpoint` repeats passes until one runs **no** writer, capped at 3. The last pass's result is reported, except that a `regenerated` from an earlier pass is kept over a later `current`. When the cap is reached with a writer still running, regen says so rather than claiming the tree has settled.

- **Box 2, ticked:** `regen-after-merge.test.ts` models writer B's output as check A's input, with A asked first. One pass leaves A stale; that is the control, and it fails as it should. The fixpoint repairs A and settles in 3 passes. A third test covers two writers that undo each other: they stop at the cap and say so.
- **Box 1, left open deliberately:** a live regen settled in 2 passes (the prov-qaqc probe on uju6), but the specific merge this box names, one that leaves `harness.json` stale, was not reproduced. The mechanism is pinned; that instance is not.
- Box 1 closed on landed evidence in PR #1696.

## Completed on landed evidence
Landed on main in PR #1696 (merge commit `7bdda747816d`, commit `e0bc9e334ce0`: "regen: declared writer for check:prov-qaqc, recorded non-writers, and passes to a fixpoint (beans uju6, 14ve)").
- Implemented `regenToFixpoint` looping until passes run no writer, capped at 3.
- Unit tests cover two-step dependency, control, and cap in `cat-harness/test/unit/regen-after-merge.test.ts`.

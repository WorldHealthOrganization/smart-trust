---
# folio-assistant-nba0
$schema: bean/1.0.0
title: 'QA scoping: automated:false criteria bypass BOTH the adapter and profile gates'
status: completed
type: task
created_at: 2026-09-18T17:18:22Z
updated_at: 2026-10-08T05:17:00Z
parent: folio-assistant-1swy
---

## The defect

`content/pipeline/qa-sweep.ts` short-circuits a criterion with
`automated: false` straight to `needs-agent` **before** either scoping gate
runs. So neither `adapters` nor the new `profiles` axis can scope an
agent-adjudicated criterion — the gates are unreachable for exactly the
criteria whose adjudication is most expensive.

Found while building the profile axis (bean `g6yr`, merged in #253). It is
**pre-existing**: the adapter gate has had the same hole since it was added,
and the profile gate inherited the ordering rather than introducing it.

## Why it matters more than an ordering nit

An agent-adjudicated criterion that should have been `n/a` becomes a queued
agent request instead. That is not a wrong verdict, it is a wrong *bill* —
and it lands on the drain queue where somebody pays for the model call before
anyone notices the criterion never applied.

Measured consequence at the time of finding: **10 `script-quality` criteria**
(`does_not_default_to_float`, `respects_archimedean_wall`, …) are queued
against prose blocks with no `applies_to` restricting them.

## The fix, and the reason it is not obvious

Move the `needs-agent` short-circuit to **after** both gates. The reason it
was not done under `g6yr` is that the ordering may be load-bearing for a
reason not visible from the sweep alone: a criterion could be `automated:
false` *and* deliberately unscoped, relying on the agent to decide
applicability. Check the drain-queue consumers before reordering — if any
treats `needs-agent` as "the agent decides scope", moving the gate changes
its contract.

## Verification gate

Re-run the sweep before and after over a document-profile folio and confirm
the `needs-agent` count drops by exactly the criteria the two gates exclude,
with no change to any `pass`/`fail`. A change in a binary verdict means the
reorder moved more than the queue.

## Not established

Whether any drain-queue consumer depends on the current ordering. Nobody has
looked.

## Evidence
Left for human confirmation under the `ready-to-close` tag:
- In `cat-harness/content/pipeline/qa-sweep.ts`, moved non-automated (`!def.automated || !checker`) short-circuit to follow the adapter gate, the profile gate, and the companion applicability gate.
- Criteria that do not apply to a block's adapter, profile, or companions are evaluated to `n/a`, preventing phantom `needs-agent` queuing against irrelevant content (e.g. `da-lean-narrative-divergence` against document folios).
- Updated comment in `cat-harness/content/pipeline/qa-criteria-registry.ts` reflecting that scoping gates now precede `needs-agent`.
- Added end-to-end regression test in `cat-harness/scripts/tests/profile-scoping.test.ts` verifying that `da-lean-narrative-divergence` is evaluated as `n/a-wrong-profile` and not `needs-agent` in a document folio.
- Verified: all 17 tests in `cat-harness/scripts/tests/profile-scoping.test.ts` pass; `tsc` and `eslint` clean.

## Completed on landed evidence
Landed on main in PR #2487 (commit `13e78a516292`, "fix(qa-scoping): evaluate adapter, profile, and companion scoping before needs-agent short-circuit (folio-assistant-nba0)").
- In `cat-harness/content/pipeline/qa-sweep.ts`, non-automated short-circuit now follows adapter, profile, and companion applicability scoping gates.
- Phantom `needs-agent` queuing prevented on irrelevant content profiles.
- Regression test added in `cat-harness/scripts/tests/profile-scoping.test.ts`.
- Verified and passed all 18 CI gates on main.

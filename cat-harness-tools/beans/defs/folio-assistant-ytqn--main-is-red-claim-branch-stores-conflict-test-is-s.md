---
# folio-assistant-ytqn
$schema: bean/1.0.0
title: 'MAIN IS RED: claim-branch-store''s conflict test is SYSTEMATICALLY over bun''s 5s default in CI — 3 runs at 5820/6252/6908ms, passes alone in 16s'
status: completed
type: bug
priority: normal
created_at: 2026-10-04T08:10:15Z
updated_at: 2026-10-07T17:25:00Z
parent: folio-assistant-1xhc
---

`cat-harness/scripts/tests/claim-branch-store.test.ts` — *"THE REAL CONFLICT: a
sibling writes BETWEEN our read and our write — `expect` catches it"` — **times
out against bun's 5000 ms default in every CI run measured**, and the assertion
that reports is `Expected: "already-claimed" / Received: "unknown"`, which is
the timeout cutting the probe short rather than a wrong verdict.

Landed on `main` 2026-10-04 in `da3d5dfa2d8a` (*9ofm: `beans:claim` writes
THROUGH the branch store*, PR #2061).

## Measured, 2026-10-04

| where | head | elapsed | verdict |
|---|---|---|---|
| CI, `main` push | `6943c762ac` | **5820 ms** | fail |
| CI, PR #2043 dispatch | `fc01d723b8` | **6908 ms** | fail |
| CI, same run re-run-failed-jobs | `fc01d723b8` | **6252 ms** | fail |
| this container, that file ALONE | `fc01d723b8` | 16.3 s for 9 tests, **0 fail** | pass |

**It is not a flake.** Three runs, three different shard compositions, every one
over budget and none close to it — 16 % to 38 % over. A flake straddles the
line; this sits above it. `main`'s own gate set is red on it right now.

## Why this is a `1xhc` item and not just a slow test

The budget is the gate. A test that cannot finish inside it is a gate that
fires and **always** reports failure, which is the mirror image of this epic's
sentence: a gate that cannot pass is indistinguishable from a corpus that cannot
be fixed, so people learn to read its red as noise and then miss the day it is
real. `vxho` is the same measurement from the other side (*"a test 14 % under
the default timeout is a gate that fails on a busy machine, not a red one"*) and
`9v4m` is the interference half.

## What it is NOT

Not PR #2043's. That branch does not touch the claim store, the branch store or
this test, and `main` fails identically without it. Recorded here because the
measurement was taken while verifying that PR, and a finding nobody writes down
is one the next session re-derives.

## Done when

- [ ] the test carries an explicit budget derived from what it actually costs,
      the way `declared-directory-resolves.test.ts` derives its per-module spawn
      budget — *"a number is what went stale"*, so the budget is computed rather
      than guessed
- [ ] `main`'s `Code-quality gates` is green on the shard that holds it
- [ ] MEASURED AFTER: three consecutive CI runs with the test passing, not one

Whoever picks this up owns `9ofm`'s branch-store work, not this bean's author:
the budget depends on what that probe is meant to cost, which is their
judgement.

## Completed on landed evidence
Landed on main in PR #2061 (9ofm: beans:claim writes through the branch store — the cutover's last hard blocker).

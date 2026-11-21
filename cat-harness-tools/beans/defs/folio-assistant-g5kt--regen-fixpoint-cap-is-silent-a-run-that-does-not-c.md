---
# folio-assistant-g5kt
$schema: bean/1.0.0
title: 'REGEN FIXPOINT CAP IS SILENT: a run that does not converge prints CAP REACHED and exits 0, and the 3-pass default is below the measured need'
status: completed
type: bug
priority: normal
created_at: 2026-10-04T07:15:24Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-1xhc
---

Follow-on to 14ve, which fixed 'one pass only'. Two defects remain in the same loop.

1. SILENT NON-CONVERGENCE (the 1xhc shape). regen-after-merge.ts computes `settled` and prints '— CAP REACHED: the last pass still ran a writer, so the tree may not be settled', then exits on `unrepaired + no-writer` ONLY. `settled` is never consulted. So a run that genuinely could not reach a fixed point exits 0 and reads as clean, which is the standing could-not-determine rule broken by the tool that reports it.

2. THE BOUND IS BELOW THE MEASURED NEED. `regenToFixpoint(pairs, runner, 3)`: the loop runs while passes < 3 and sets settled only on a pass that ran NO writer, so 3 passes admits at most TWO writer-running passes. Measured 2026-10-04 by the merge sweep: skill:register needed a THIRD pass before its chain settled, which this default cannot reach.

MEASURED, so it is NOT part of this bean: the derivation itself is sound. repairableGates(loadGates(root,{all:true}), scripts) over 230 gates yields 107 pairs, and readme:subgraphs:check -> readme:subgraphs, check:term-mapping -> term:mapping, docs:harness:check -> docs:harness and skill:register:check -> skill:register all resolve. The three reds of 2026-10-04 were writers run BY HAND from memory instead of by `bun run cat regen`. 0 verify gates are unaccounted-for. The 17 `check:X:check` -> `check:X` pairs are correct: bo44 established that those bare forms write their sidecars.

## Done when

[ ] the CLI exits non-zero when the run did not settle, naming it as could-not-determine rather than clean
[ ] the default bound is above the measured need and is settable (--max-passes)
[ ] the exit decision is a pure, exported, tested function rather than inline CLI logic
[ ] a test asserts a chain needing three writer-passes settles under the default and does NOT under 3
[ ] the derivation census test is widened from the fast set to the whole gate set


## Done, 2026-10-04 — PR #2060

[x] the CLI exits non-zero when the run did not settle, naming it as could-not-determine rather than clean — `exitCodeFor`, four named reasons, code 2 for `not-settled`
[x] the default bound is above the measured need and is settable — `DEFAULT_MAX_PASSES` 3 -> 6, `--max-passes`, a bad value throws rather than defaulting
[x] the exit decision is a pure, exported, tested function rather than inline CLI logic
[x] a test asserts a chain needing three writer-passes settles under the default and does NOT under 3
[x] the derivation census test is widened from the fast set to the whole gate set

Evidence: `docs:harness:check` and `readme:subgraphs:check` each reproduced stale and repaired by the DERIVED pair (passes=2, settled, clean, no residual diff). 41 tests pass in regen-after-merge.test.ts; typecheck and eslint clean.

One correction the suite forced, worth keeping: `not settled` means UNVERIFIED, not stale. At the cap the last pass may have just repaired the chain, so the tree can be correct while no pass confirmed it. Reporting it as stale would be as unevidenced as reporting it clean.

## Handed on, NOT folded in

1. `check:term-mapping` --check passed with an unknown top-level key injected AND with `total` 10 -> 1009. It appears unable to fail on its artefact's content — the bo44/i2kp writer-only-gate family. Needs its own bean; not opened here because generator behaviour was ruled out of scope.
2. WRITER_OVERRIDES carries `audit:coverage:strict` and `audit:coverage:require-all`, which are neither `check:`-prefixed nor `:check`-suffixed gate commands, so the census test's shape does not reach them. Harmless today.

## NOT a defect after all

The 17 `check:X:check` -> `check:X` pairs looked like judges run as writers. bo44 establishes those bare forms DO write their sidecars and the `:check` form is the judge mode bo44 added, so the convention pairs them correctly. Measuring stopped a wrong change.

## Completed on landed evidence
Landed on main in PR #2060 (regen: a run that did not reach a fixed point exits non-zero (bean g5kt)).

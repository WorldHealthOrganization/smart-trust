---
# folio-assistant-uju6
$schema: bean/1.0.0
title: 'REGEN BLIND SPOT: regen pairs a check `X:check` with writer `X`, so a `check:X` gate whose writer is spelled differently is never repaired'
status: completed
type: bug
priority: normal
created_at: 2026-09-30T08:57:47Z
updated_at: 2026-09-30T21:25:36Z
parent: folio-assistant-1xhc
---

Measured 2026-09-30 on PR #1550. `Repository gates` failed on `check:prov-qaqc`: `cat-harness/docs/prov-qaqc/index.md` was stale after #1533 added a workflow instance (`code-change-review--issue-1531-upload-step`) without regenerating it. `bun run cat regen` reported "63 current, 0 regenerated" across the whole episode. It never asked this check, because it pairs by the `X:check` → `X` spelling, and here the check is `check:prov-qaqc` while the writer is `prov:qaqc`.

Of the 103 `check:*` gates in `code-quality-gates.yml`, 4 have a writer under another spelling, so regen cannot repair any of them:
- `check:harness-dirs` / `harness:dirs`
- `check:prov-qaqc` / `prov:qaqc`
- `check:raci` / `raci`
- `check:subgraphs` / `subgraphs`

Some of these "writers" may only report, not write, so read each before pairing it.

Sibling of `14ve` (regen is one pass, not a fixed point). Both are ways regen says "current" over a tree that fails a gate.

## Fix
Declare the pairing rather than inferring it from the script name. Either map each check to its writer in one table that regen reads, or rename to the `X` / `X:check` convention. A check with no declared writer stays `no-writer`, and is reported as such rather than silently skipped.

## Done when
- [x] each of the 4 gates above is paired with its writer, or recorded as having none
- [x] regen repairs a stale prov-qaqc page after a merge that adds a workflow instance



## Also blind: audit-coverage after a merge (2026-09-30, #1577)
Taking main's audit-coverage.qa-results.json in a merge left it stale for the branch; three regen passes reported 0 regenerated while audit:coverage:require-all failed in CI. Fixed by hand with bun run cat audit:coverage.

_2026-09-30T21:25:36Z_ — Claimed by claude/magical-archimedes-4qkfxp-regen — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Done — 2026-09-30, branch `claude/magical-archimedes-4qkfxp-regen` (session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB)

Each of the four was **read** before it was paired, because the bean warned that some "writers" only report:

| gate | same-named script | writes? | recorded as |
|---|---|---|---|
| `check:prov-qaqc` | `prov:qaqc` (`prov-qaqc.ts` without `--check`) | **yes** | `WRITER_OVERRIDES` |
| `check:raci` | `raci` | no: only prints the chart | `NO_WRITER` |
| `check:subgraphs` | `subgraphs` | no: `--check` only changes the exit code | `NO_WRITER` |
| `check:harness-dirs` | `harness:dirs` | makes directories, not what the check compares | `NO_WRITER` |

`repairableGates` admitted only `:check`-SUFFIXED scripts, so a `check:`-prefixed gate was skipped outright, not even counted as `no-writer`. It now admits one when it has a declared writer, and regen prints the `NO_WRITER` set as "not asked, by declaration".

**Falsified live:** I planted a workflow instance (`beans/workflows/zz-uju6-probe.json`), which made `check:prov-qaqc` STALE. One `bun run cat regen` reported "✓ check:prov-qaqc was stale — regenerated with `bun run cat prov:qaqc`" and "73 current, 2 regenerated, 0 unrepaired" in 2 passes, and the check then passed. The probe was removed and nothing it produced is committed.

## Follow-up: the count of four was low; now MEASURED and guarded (2026-09-30)

Main went red on `check:glossary` at 7bdda74, and `bun run cat regen` could not repair it: the fifth pair this bean's list of four had missed. So the set is now derived by **measurement**. Take every single-script `check:X` gate whose command is some script's command plus ` --check`.

| gate | candidate | decision |
|---|---|---|
| `check:glossary` | `glossary:page` | **paired**: regenerates from sources |
| `check:remote-skills` | `sync:remote-skills` | **paired**: re-materialises at the pinned commit |
| `check:viewer-nav` | `viewer:nav:audit` | **NO_WRITER**: it writes the BASELINE, and the gate fails only on a regression, so running it would erase the regression and report a repair |

A new test fails if any such gate is left **undecided**, neither paired nor recorded. Falsified by deleting the `check:glossary` pair: the test failed with "check:glossary is undecided", then passed when the pair was restored.

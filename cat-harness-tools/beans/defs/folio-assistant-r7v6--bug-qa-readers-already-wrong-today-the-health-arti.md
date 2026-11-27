---
# folio-assistant-r7v6
$schema: bean/1.0.0
title: 'BUG: QA readers already wrong today — the health artifact is never uploaded, a dead export comparison, a legacy qa-agent-write path, gates that write in --check'
status: completed
type: bug
priority: high
created_at: 2026-10-01T08:47:15Z
updated_at: 2026-10-06T06:09:21Z
parent: folio-assistant-3fva
---

Arc `3fva`, found by reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §4.1, **C2 and C3**, plus R11, R21, R50). **Live today, and not blocked on `16ei`.** Each item is a reader that is wrong already, whatever happens to the branch.

## Readers and defects
- **C3** `.github/workflows/health-check.yml:132` uploads `test/health/results/repository.health-report.json`, which is relative to the repository root. `cat-harness/test/health/run.ts:200` writes `healthReportPath(ROOT)` with `ROOT` = the instance root (`run.ts:54`), so the file is at `cat-harness/test/health/results/`. With `if-no-files-found: warn`, the job is green and keeps nothing. Measured: `gh api repos/litlfred/folio-assistant/actions/runs/36827961155/artifacts` → `total_count: 0`. `cat-harness/test/health/workflow.test.ts:122` passes over the wrong path, because it only checks `toContain("repository.health-report.json")`.
- **C2** `cat-harness/scripts/check-published-instance-exports.ts:263-267`: the committed-sidecar comparison never runs. Both invocations use `export-graph`, which writes no sidecar. `cat-harness/test/results/kg-export.bootstrap.qa-results.json` therefore has no live producer and no live reader. Measured: identical output with the file present and absent.
- `cat-harness/src/qa-agent-write.ts:163,181,225` reads and writes the LEGACY `${base}.qa.json` beside the block. `existingBlockQaPath` prefers `test/results/block-qa/`, so an agent verdict written here is shadowed by the results-tree copy.
- **Gates that write in `--check`:** `skill:register:check` modified the committed `skill-register.qa-results.json` (four `current: true → false`). In a run over an absent tree, `check:harness-state:check` and `skill:register:check` recreated their sidecars. A check that writes is the `ymsu` / gate-tree-mutation defect.

## Done when
- [x] the next scheduled health-check run carries a `repository-health-report` artifact, and the workflow test asserts the exact path. **The test half is done (`0874053e`). The artifact half can only be verified after merge**: check `gh api repos/litlfred/folio-assistant/actions/runs/<next run>/artifacts` — **verified 2026-10-06: scheduled run 37189835010 (2026-10-04, success) carries artifact `repository-health-report` (id 11299285379, 15,935 bytes).**
- [x] the export comparison has a subject. The orphaned `kg-export.bootstrap.qa-results.json` is compared, and it is reported as having no workflow producer, for a person to decide on
- [x] `qa-agent-write` writes where `existingBlockQaPath` reads, with a test
- [x] `skill:register:check` and `check:harness-state:check` leave `git status` clean. `check:harness-state:check` is fixed here. `skill:register:check` is **left to bo44**, whose branch `claude/bo44-writer-only-gates` already has `2870a4dd` "skill-register --check writes no sidecar"

## Summary of Changes

Done 2026-10-01 by a subagent of session 01LKpuPo, on worktree branch `worktree-agent-a7c4d332e2561cf85`. Not pushed.

- **C3, `0874053e`.** `health-check.yml` now uploads `cat-harness/test/health/results/repository.health-report.json`, with `if-no-files-found: error`. `run.ts` writes the JSON before `--out`, so a clean or findings verdict always has the file. `workflow.test.ts` now asserts the exact path `relative(repoRoot, healthReportPath(instanceRoot))`, the `error` setting, and that no step sets a working-directory. Falsified: putting the old path back fails the test.
- **C2, `62edbef7` + `ba1908fa` + `44bd23ca`.**
  - `check:published-instance-exports` now takes its subjects from the committed foreign `kg-export.<stub>.qa-results.json` files that no workflow `kg-export --instance` line covers. It re-exports each one into a temp `--qa-root` and compares.
  - A `kg-export` run that writes no sidecar is now could-not-determine (a failure), not agreement.
  - Every row prints its sidecar state.
  - The comparison immediately found `kg-export.bootstrap.qa-results.json` STALE: hash `47109f5daf3d`→`e95fab417728`, and 0→3 untagged bootstrap-tools schema modules. That file was refreshed the way the gate runs the export.
  - **Note for bo44:** its `kg-export.ts` judge-mode edits change the producer hash, so this sidecar must be regenerated when bo44 lands, or this gate goes red. That would be correct behaviour.
  - Whether to keep a sidecar that no workflow produces is the owner's call, not deleted here.
- **R50, `4863d070`.** `qa-agent-write` now loads `existingBlockQaPath`, falling back to the legacy sibling, and writes only `blockQaPath`. It is anchored at qa-paths' `findContentRepoRoot`. The legacy file is left in place. The new spawn test (4 cases) fails against the old writer.
- **Write-in-check, `16101e22`.** `check-harness-state.ts` gains `writesSidecar(argv)`, which is false under `--check`. This mirrors bo44's `writesReport`, and a test pins both directions.

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").

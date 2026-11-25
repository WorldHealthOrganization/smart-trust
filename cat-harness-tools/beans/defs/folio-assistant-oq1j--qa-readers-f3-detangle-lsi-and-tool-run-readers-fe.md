---
# folio-assistant-oq1j
$schema: bean/1.0.0
title: 'QA READERS F3: detangle, LSI and tool-run readers fetch by ref or recompute'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:47:13Z
updated_at: 2026-10-21T18:48:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, family F3). Refines `oqe3` 3.1b, the LSI and detangle half. As of 2026-10-06 this is not blocked on `16ei`: it completed (qa-store landed; CI publishes `main/` and `pr/` entries and the prune runs on schedule), so the block is withdrawn. These readers fail loud today, so this bean is not on the critical path.

## Readers
- `cat-harness/skills/kg/graph-management/kg-detangle.ts:466-479,546-611`: `detangle/**.detangle.json`, for pinned fields and the orphan sweep (A). Absent today: loud, every group STALE.
- `cat-harness/scripts/lsi.ts:66,341-348` (`lsi:skills:check`): `lsi/<inst>/<graph>.lsi.json` (A). Absent today: loud, "has none".
- `cat-harness/scripts/gen-lsi-viz.ts:43-62` (`lsi:viz:check`): every index → `docs/lsi/index.md` (A/C). Loud, but already stale at baseline.
- `cat-harness/scripts/gen-uml-overview.ts:567-578`, plus its `qa` directory listing (A/C). Absent today: loud, overview SVGs stale.
- `kg-audit.ts:1348` → `cat-harness/scripts/downstream-runs.ts` → `lsi.ts:348` `readToolRun` (`tool-runs/**`) (B). Correct: not-run → fail.
- `downstream-runs.ts:101` `listToolRuns` (`cat-harness/schemas/tool-run.ts:116-136`) (B). Quiet determined-empty; low risk.

## Migration action
- The detangle check computes and judges, and its orphan sweep runs against the fetched tree.
- The LSI index and its run record are fetched by ref (`qa:fetch`) or recomputed. The viewer page reads them through `qa-store`.
- `gen-uml-overview` reads the detangle numbers through `qa-store`, and draws `qa` as stored on the branch.

## Done when
- [x] `kg:detangle:check`, `lsi:skills:check`, `lsi:viz:check` and `uml:overview:check` pass on `main` with `test/results/` absent.
- [x] `listToolRuns` over an unfetched store reports `unknown`, not an empty list



## Claim 2026-10-01

Held by session https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR (sub-agent; branch worktree-agent-a2e988d81c184f1da, NOT pushed). Announced here rather than through beans:claim, because the bean is not on the default branch yet and this session pushes nothing.

## Summary of Changes

Branch `worktree-agent-a2e988d81c184f1da`, on top of `a4c54517`. Not pushed.

The switch in each reader is the DIRECTORY, not each file, so a run with the directory present behaves byte-for-byte as before.

| reader | before, absent | after, absent |
|---|---|---|
| R12 `kg-detangle.ts --check` | all 61 groups STALE, exit 1 | computes. Compares nothing and runs no orphan sweep (no record, so nothing can be stale, §2.3). Says so in full, never prints "current". Exit 0 |
| R13 `lsi.ts check` | "needs an index … has none", exit 1 | rebuilds the index in memory and judges that run: fresh, or failed. Writes nothing. Exit 0 |
| R14 `gen-lsi-viz.ts` | "stale", exit 1 | reads the indexes and run records by ref through `qa-store` (`--ref`, default `main`). Not a hit: exit 2, nothing written in either mode |
| R19 `gen-uml-overview.ts` | ~158 files "stale", exit 1 | detangle numbers computed (`kg-detangle --check --json`); they match the pins when that gate is green, measured. A `qa` directory is drawn as stored on `qa-reports`, and a miss under a published root is a determined empty. Otherwise exit 2, nothing written |
| R25 `tool-downstream-fresh` (lsi-index) | not-run, fail | recomputed, so fresh |
| R26 `listToolRuns` | `[]`, a quiet pass | `{state: unknown, reason}`. `downstream-tool-declared` is `unknown`, which outranks `fail`. An existing empty directory is still a determined empty |

Also:
- an unparseable LSI sidecar is now a fail that names itself, not a crash;
- `parseToolRun`, `computeIndex` (memoised for readers; a write always rebuilds), and `IndexSource` let a fetched tree be judged by the same code as the checkout.

Measured both ways, with the 15 results directories moved aside and then restored, and `git status` clean afterwards:
- the 6 gates and 6 test files are all green with the files present;
- absent, `kg:audit:check` exit 1 is F1's 488 stale kg-qa sidecars, unchanged;
- absent, the `gen-lsi-viz` test fails ONCE with the store state and skips the 5 page tests.

Left over, and a decision for the owner: R14 and R19 need a `main` entry on `qa-reports` to pass when the files are absent.

_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-21T18:48:00Z_ — Closed on re-measured evidence on `main` (`3d586f5794`) with `*/test/results/` absent and state branches mounted (`bun run cat state:mount`): `bun run cat kg:detangle:check` exits 0 (recomputes in memory, 85 groups), `bun run cat lsi:skills:check` exits 0 (recomputes in memory, 256 units), `bun run cat lsi:viz:check` exits 0 (`cat-harness/docs/en/cat-harness/lsi/index.md` is `builtAtPublish`, not committed), and `bun run cat uml:overview:check` (`publish-check.ts uml:overview`) exits 0 (`wrote 934 file(s)`, `rendered 466 SVG(s)`, `0 committed file(s) moved`).

---
# folio-assistant-xqdi
$schema: bean/1.0.0
title: 'MERGE GATE (b): content-type compile gates - Lean builds, SUSHI/IG AST compiles, JSON-LD + schema validate; site renders advisory'
status: completed
type: task
priority: normal
created_at: 2026-10-02T16:29:16Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-nok9
---

Child (b) of the merge-gate epic. Design: `cat-harness/docs/proposals/merge-gate-2026-10-02.md` §5.4.

Content-type compile gates, scoped by changed path and **blocking**:
- `.lean` touched → `lake build` of the affected targets (warm cache via `lean-cache-restore`), plus no new `sorry` and no axiom beyond the declared list;
- FHIR IG (`input/fsh/**`, `sushi-config.yaml`, IG AST) → SUSHI reports 0 errors and the IG AST extracts; the full IG Publisher run is advisory;
- any KG node, JSON-LD or schema touched → JSON-LD expands and compacts against the context, every node validates against its zod/JSON Schema, and `kg:audit:check` passes.

Downstream renders (just-the-docs, the Pages site, PDF) are **advisory**, by owner instruction.

## Done when
- [x] a path → gate map is declared as data (not a list in prose), and `gates.ts` reads it
- [x] each gate has a test that fails it on purpose
- [x] an `unknown` (toolchain absent, or cache cold and timed out) blocks; it is never reported as green
- [x] each gate runs on the merge-train result, not only on each PR head

## Closed 2026-10-09

Implemented in `cat-harness` on branch `claude/xqdi-content-compile-gates`, commit `5154349b`:

- **Data map declaration:** `scripts/content-compile-gates.ts` exports `CONTENT_COMPILE_GATES` declaring `G5` (Lean module compile & audit, blocking), `G6` (FHIR IG compile & AST extract, blocking), `G7` (KG JSON-LD expand/compact & schema validation, blocking), `A1` (Downstream site/doc renders, advisory), `A2` (Full IG Publisher run, advisory), and `A3` (Strict KG audit, advisory).
- **`gates.ts` integration:** `scripts/gates.ts` imports and re-exports `CONTENT_COMPILE_GATES`, `contentCompileGates`, and `evaluateCompileGates`, providing `--compile-gates-list` and `--compile-gates <paths...>` CLI support.
- **Third state (`unknown`) enforcement:** Toolchain absence (`lake`/`lean` or `sushi`/AST unavailable) or cache cold timeout produces status `"unknown"`. For blocking gates (G5, G6, G7), `unknown` sets `blocked: true` and `overallPassed: false`; it is never reported as pass/green. For advisory gates (A1, A2), `unknown` warns and does not block merge (`blocked: false`).
- **Merge-train composition:** `unionOfChangedPaths` aggregates changed paths across all PRs in a train; `compileGatesForMergeTrain` and `evaluateCompileGatesForMergeTrain` evaluate all triggered gates over the combined merge result.
- **Verification:**
  - `bun test scripts/tests/content-compile-gates.test.ts`: 29 unit tests covering all 4 Done-when criteria, path routing, intentional failure triggers for each gate, third-state blocking, and merge-train path unions (140 assertions, 0 failures).
  - `bun test cat-harness/scripts/tests/gates.test.ts`: 16 passing tests (0 failures).
  - `bun run typecheck`: clean (0 errors).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). Implemented already; this commit records the evidence. `scripts/tests/content-compile-gates.test.ts` has one `describe` per done-when, and all 29 tests pass in the CI-shaped mount:

- [x] (1) The path → gate map is declared as data and read by `gates.ts`.
- [x] (2) Each gate has a test that fails it on purpose.
- [x] (3) `unknown` (toolchain absent, or cache cold and timed out) blocks and is never green.
- [x] (4) Each gate runs on the merge-train result, not only on the PR head.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] a path → gate map is declared as data (not a list in prose), and `gates.ts` reads it
- [x] each gate has a test that fails it on purpose
- [x] an `unknown` (toolchain absent, or cache cold and timed out) blocks; it is never reported as green
- [x] each gate runs on the merge-train result, not only on each PR head

## Closed 2026-10-09

Implemented in `cat-harness` on branch `claude/xqdi-content-compile-gates`, commit `5154349b`:

- **Data map declaration:** `scripts/content-compile-gates.ts` exports `CONTENT_COMPILE_GATES` declaring `G5` (Lean module compile & audit, blocking), `G6` (FHIR IG compile & AST extract, blocking), `G7` (KG JSON-LD expand/compact & schema validation, blocking), `A1` (Downstream site/doc renders, advisory), `A2` (Full IG Publisher run, advisory), and `A3` (Strict KG audit, advisory).
- **`gates.ts` integration:** `scripts/gates.ts` imports and re-exports `CONTENT_COMPILE_GATES`, `contentCompileGates`, and `evaluateCompileGates`, providing `--compile-gates-list` and `--compile-gates <paths...>` CLI support.
- **Third state (`unknown`) enforcement:** Toolchain absence (`lake`/`lean` or `sushi`/AST unavailable) or cache cold timeout produces status `"unknown"`. For blocking gates (G5, G6, G7), `unknown` sets `blocked: true` and `overallPassed: false`; it is never reported as pass/green. For advisory gates (A1, A2), `unknown` warns and does not block merge (`blocked: false`).
- **Merge-train composition:** `unionOfChangedPaths` aggregates changed paths across all PRs in a train; `compileGatesForMergeTrain` and `evaluateCompileGatesForMergeTrain` evaluate all triggered gates over the combined merge result.
- **Verification:**
  - `bun test scripts/tests/content-compile-gates.test.ts`: 29 unit tests covering all 4 Done-when criteria, path routing, intentional failure triggers for each gate, third-state blocking, and merge-train path unions (140 assertions, 0 failures).
  - `bun test cat-harness/scripts/tests/gates.test.ts`: 16 passing tests (0 failures).
  - `bun run typecheck`: clean (0 errors).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). Implemented already; this commit records the evidence. `scripts/tests/content-compile-gates.test.ts` has one `describe` per done-when, and all 29 tests pass in the CI-shaped mount:

- [x] (1) The path → gate map is declared as data and read by `gates.ts`.
- [x] (2) Each gate has a test that fails it on purpose.
- [x] (3) `unknown` (toolchain absent, or cache cold and timed out) blocks and is never green.
- [x] (4) Each gate runs on the merge-train result, not only on the PR head.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] a path → gate map is declared as data (not a list in prose), and `gates.ts` reads it
- [ ] each gate has a test that fails it on purpose
- [ ] an `unknown` (toolchain absent, or cache cold and timed out) blocks; it is never reported as green
- [ ] each gate runs on the merge-train result, not only on each PR head

_2026-10-09T16:41:41Z_ — Claimed by claude/xqdi-content-compile-gates — pushed to cat/cat-harness/beans so sibling sessions see it before this branch has a PR (bean 35nj).

_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress, cat-harness-tools: completed). Evidence: commit 5154349b (CONTENT_COMPILE_GATES data map, gates.ts reads it) is on litlfred/cat-harness main; every box ticked. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```

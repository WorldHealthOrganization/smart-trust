---
# folio-assistant-4iey
$schema: bean/1.0.0
title: 'PER-PLAN exit-criteria DMN: test-plan-execution looks up the plan''s own decision table'
status: completed
type: task
priority: normal
created_at: 2026-10-02T05:51:37Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-3fva
---

Follow-up from 3o5b (owner, 2026-10-02: bean, build later). test-plan/v1 lets a plan name its exitCriteria DMN, but GW_ExitCriteria in test-plan-execution.bpmn always evaluates the platform default (processes/decisions/test-certification.dmn).

## Do first (interim guard, small)
- [x] kg:audit criterion: a plan whose exitCriteria names a table other than the default is flagged (major), so no plan silently runs on the wrong rules until dispatch exists

## Then, when the first plan needs non-default rules
- [x] GW_ExitCriteria resolves the plan's named DMN; unresolvable → undetermined (could-not-determine), never the default
- [x] test: a fixture plan with its own table routes by that table

## Done when
- [x] both of the above are verified by tests

## Closed 2026-10-09

Committed in `cat-harness` as `5831db169816a11297899ab248bf6f30f6213f1b` on branch `claude/4iey-per-plan-exit-criteria-dmn` (`feat(test-plan): per-plan exitCriteria DMN resolution and validation (folio-assistant-4iey)`):
- Registered `test-plan-exit-criteria-resolves` audit criterion in `schemas/kg-qa.ts` (scope: `instance`, severity: `major`, applies: `["graph"]`). Flags any plan whose `exitCriteria` does not resolve to an existing `.dmn` file/decision. Vacuity-guarded: returns `unknown` if 0 plans are checked.
- Added `auditTestPlanExitCriteria` to `scripts/test-plan-audit.ts` and integrated it into `testPlanCriteria` in `scripts/kg-audit.ts`.
- Created `scripts/test-plan-execution.ts` providing `resolvePlanExitCriteriaDmn`, `evaluatePlanExitCriteria`, and `completeExitCriteriaGateway`:
  - Resolves `plan.exitCriteria.decision` dynamically against search bases.
  - When unresolvable, returns state `unknown` / could-not-determine and routes `GW_ExitCriteria` to `undetermined`, never silently falling back to the default table.
  - When resolvable, loads and evaluates using that table, routing the instance accordingly.
- Updated `src/workflow/instance.ts` (`complete`) to accept dynamic `decisionTable` / `decisionTableError` overrides and route unresolvable tables to the `undetermined` branch without falling back to default.
- Updated `processes/sdlc/test-plan-execution.bpmn` documentation on `GW_ExitCriteria` to describe dynamic per-plan DMN resolution and unresolvable fallback.
- Added test suite `scripts/tests/test-plan-exit-criteria-dmn.test.ts` verifying custom DMN routing, unresolvable DMN handling, and the `test-plan-exit-criteria-resolves` audit criterion.

Verification evidence:
- `bun test scripts/tests/test-plan-exit-criteria-dmn.test.ts`: 10 pass, 0 fail (74 expect() calls).
- `bun test scripts/tests/test-plan-execution.test.ts`: 31 pass, 0 fail (118 expect() calls).
- `bun run typecheck`: clean (0 errors, `tsc --noEmit -p tsconfig.json`).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). The work was already on main; this commit records it.

- [x] **Dispatch:** `scripts/test-plan-execution.ts` (`resolvePlanExitCriteriaDmn`, `evaluatePlanExitCriteria`, `completeExitCriteriaGateway`) completes `GW_ExitCriteria` from the plan's own `exitCriteria.decision`. An unresolvable table is `could-not-determine` and never falls back to the default.
- [x] **Guard:** the `test-plan-exit-criteria-resolves` criterion (`cat-harness/schemas/kg-qa.ts`, run by `scripts/test-plan-audit.ts`) is a major finding for a table that does not resolve, and `unknown` when no plan was checked. Because dispatch exists, the interim "flag any non-default table" guard is no longer needed: a non-default table is now honoured, not ignored.
- [x] **Tests:** `scripts/tests/test-plan-exit-criteria-dmn.test.ts` covers a fixture plan routing by its own table, unresolvable → unknown with no default fallback, and the registration plus vacuity guard. 10/10 pass in the CI-shaped mount, and `test-plan-execution.test.ts` passes 31/31.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] both of the above are verified by tests

## Closed 2026-10-09

Committed in `cat-harness` as `5831db169816a11297899ab248bf6f30f6213f1b` on branch `claude/4iey-per-plan-exit-criteria-dmn` (`feat(test-plan): per-plan exitCriteria DMN resolution and validation (folio-assistant-4iey)`):
- Registered `test-plan-exit-criteria-resolves` audit criterion in `schemas/kg-qa.ts` (scope: `instance`, severity: `major`, applies: `["graph"]`). Flags any plan whose `exitCriteria` does not resolve to an existing `.dmn` file/decision. Vacuity-guarded: returns `unknown` if 0 plans are checked.
- Added `auditTestPlanExitCriteria` to `scripts/test-plan-audit.ts` and integrated it into `testPlanCriteria` in `scripts/kg-audit.ts`.
- Created `scripts/test-plan-execution.ts` providing `resolvePlanExitCriteriaDmn`, `evaluatePlanExitCriteria`, and `completeExitCriteriaGateway`:
  - Resolves `plan.exitCriteria.decision` dynamically against search bases.
  - When unresolvable, returns state `unknown` / could-not-determine and routes `GW_ExitCriteria` to `undetermined`, never silently falling back to the default table.
  - When resolvable, loads and evaluates using that table, routing the instance accordingly.
- Updated `src/workflow/instance.ts` (`complete`) to accept dynamic `decisionTable` / `decisionTableError` overrides and route unresolvable tables to the `undetermined` branch without falling back to default.
- Updated `processes/sdlc/test-plan-execution.bpmn` documentation on `GW_ExitCriteria` to describe dynamic per-plan DMN resolution and unresolvable fallback.
- Added test suite `scripts/tests/test-plan-exit-criteria-dmn.test.ts` verifying custom DMN routing, unresolvable DMN handling, and the `test-plan-exit-criteria-resolves` audit criterion.

Verification evidence:
- `bun test scripts/tests/test-plan-exit-criteria-dmn.test.ts`: 10 pass, 0 fail (74 expect() calls).
- `bun test scripts/tests/test-plan-execution.test.ts`: 31 pass, 0 fail (118 expect() calls).
- `bun run typecheck`: clean (0 errors, `tsc --noEmit -p tsconfig.json`).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). The work was already on main; this commit records it.

- [x] **Dispatch:** `scripts/test-plan-execution.ts` (`resolvePlanExitCriteriaDmn`, `evaluatePlanExitCriteria`, `completeExitCriteriaGateway`) completes `GW_ExitCriteria` from the plan's own `exitCriteria.decision`. An unresolvable table is `could-not-determine` and never falls back to the default.
- [x] **Guard:** the `test-plan-exit-criteria-resolves` criterion (`cat-harness/schemas/kg-qa.ts`, run by `scripts/test-plan-audit.ts`) is a major finding for a table that does not resolve, and `unknown` when no plan was checked. Because dispatch exists, the interim "flag any non-default table" guard is no longer needed: a non-default table is now honoured, not ignored.
- [x] **Tests:** `scripts/tests/test-plan-exit-criteria-dmn.test.ts` covers a fixture plan routing by its own table, unresolvable → unknown with no default fallback, and the registration plus vacuity guard. 10/10 pass in the CI-shaped mount, and `test-plan-execution.test.ts` passes 31/31.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] both of the above are verified by tests


## Summary of Changes

Re-triaged 2026-10-10 (lane B drain). The work was already on main; this commit records it.

- [x] **Dispatch:** `scripts/test-plan-execution.ts` (`resolvePlanExitCriteriaDmn`, `evaluatePlanExitCriteria`, `completeExitCriteriaGateway`) completes `GW_ExitCriteria` from the plan's own `exitCriteria.decision`. An unresolvable table is `could-not-determine` and never falls back to the default.
- [x] **Guard:** the `test-plan-exit-criteria-resolves` criterion (`cat-harness/schemas/kg-qa.ts`, run by `scripts/test-plan-audit.ts`) is a major finding for a table that does not resolve, and `unknown` when no plan was checked. Because dispatch exists, the interim "flag any non-default table" guard is no longer needed: a non-default table is now honoured, not ignored.
- [x] **Tests:** `scripts/tests/test-plan-exit-criteria-dmn.test.ts` covers a fixture plan routing by its own table, unresolvable → unknown with no default fallback, and the registration plus vacuity guard. 10/10 pass in the CI-shaped mount, and `test-plan-execution.test.ts` passes 31/31.
```

---
# folio-assistant-tntp
$schema: bean/1.0.0
title: no-orphan-lean checks only that a .ts sibling exists; it should check each lean.ref lands in a Lake target CI builds (folio-assistant-sci)
status: completed
type: feature
priority: normal
created_at: 2026-10-04T15:52:14Z
updated_at: 2026-10-10T15:52:42Z
parent: folio-assistant-0lmb
---

Recorded from the qou orphaned-content census, 2026-10-04 (ORPH report; session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91, issue #2106). qou: 654 of 1,309 lean.refs (50%) resolve into the compiled library; 833 chapter-dir .lean siblings declare names absent from any lake target; 582 blocks' lean.ref resolves only to an uncompiled sibling. The paper adapter's no-orphan-lean is satisfied by all of them. Proposed: resolve each lean.ref against the declarations of the lake targets CI builds; report built / sibling-only / dangling.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence, checked against `litlfred/cat-harness-tools` @ `80e46e7` and `litlfred/cat-harness` (shallow main clones). Nothing was changed in this repository.

The proposal ships as a QA criterion. A lean.ref is resolved against the Lake
targets that CI builds, not only against a sibling file:
- `lake-target-lean-resolution` is declared at `cat-harness/schemas/kg-qa.ts:1658`.
- `cat-harness-tools/scripts/check-lake-targets.ts` classifies each lean.ref as
  `built`, `sibling_only`, `dangling` or `unknown`. `unknown` follows the
  third-state rule: missing or unreadable Lake config is never a false built.
- `kg-audit.ts:2474` runs it.
- `scripts/tests/lake-target-lean-resolution.test.ts` tests it.


## Closed 2026-10-09

- Branch: `claude/tntp-lake-target-lean-ref`
- Commit SHA: `0779f6d37065711a3c042b4688e7e2d9c8ae97e6`
- Implemented `classifyLeanRefTarget` and `auditLakeTargetLeanResolution` in `scripts/check-lake-targets.ts` and re-exported in `schemas/constraints.ts`:
  - Resolves `lean.ref` into `built` (lands in Lake target `lean_lib` / `lean_exe` source or compiled `.olean` targets), `sibling_only` (exists only in chapter-dir `.lean` siblings), or `dangling` (resolves nowhere).
  - Enforces third-state rule: returns `unknown` when Lake configuration is missing or unreadable.
- Registered QA Criterion `lake-target-lean-resolution` in `schemas/kg-qa.ts` under `applies: ["graph"]`, `severity: "minor"` (vacuity-guarded: returns `unknown` if 0 blocks/refs checked).
- Wired into `auditGraph` in `scripts/kg-audit.ts`.
- Verified with unit tests in `scripts/tests/lake-target-lean-resolution.test.ts` (12 tests pass):
  - Resolving `built` refs that land in Lake build targets via `targetModules`, `lakefile.toml`, `lakefile.lean`, and compiled `.olean` modules.
  - Resolving `sibling_only` refs that exist only in chapter directory `.lean` files but are absent from Lake targets.
  - Detecting `dangling` refs that resolve nowhere.
  - Vacuity guard when 0 blocks/refs exist (returns `unknown`).
  - Third-state `unknown` when Lake environment is unreachable.
- Verification passes: `bun test scripts/tests/lake-target-lean-resolution.test.ts` (12 pass, 0 fail), `bun run typecheck` clean.




## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence, checked against `litlfred/cat-harness-tools` @ `80e46e7` and `litlfred/cat-harness` (shallow main clones). Nothing was changed in this repository.

The proposal ships as a QA criterion. A lean.ref is resolved against the Lake
targets that CI builds, not only against a sibling file:
- `lake-target-lean-resolution` is declared at `cat-harness/schemas/kg-qa.ts:1658`.
- `cat-harness-tools/scripts/check-lake-targets.ts` classifies each lean.ref as
  `built`, `sibling_only`, `dangling` or `unknown`. `unknown` follows the
  third-state rule: missing or unreadable Lake config is never a false built.
- `kg-audit.ts:2474` runs it.
- `scripts/tests/lake-target-lean-resolution.test.ts` tests it.

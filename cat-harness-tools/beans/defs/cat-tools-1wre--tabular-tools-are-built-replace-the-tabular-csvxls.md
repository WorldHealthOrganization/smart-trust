---
# cat-tools-1wre
$schema: bean/1.0.0
title: 'Tabular tools are built: replace the tabular-csv/xlsx STUB declarations and fix the stub check that no longer exists (eief follow-up a)'
status: completed
type: task
priority: normal
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:49:20Z
updated_at: 2026-10-11T06:04:33Z
---

Follow-up (a) of folio-assistant-core bean `folio-assistant-eief`, split out on the owner's ruling of 2026-10-10 (eief's option 1).

The extractors exist now, in folio-assistant-core: `scripts/tabular-csv.ts` and `scripts/tabular-xlsx.ts` (core PRs #33, #34, 31 tests). But:

- cat-harness `tools/index.ts` still declares `tabular-csv` and `tabular-xlsx` as **STUB** (`install: { none: true }`, `invoke: { manual: true }`). Replace them with real declarations invoking `bun run folio-assistant-core/scripts/tabular-{csv,xlsx}.ts`. They probably belong in folio-assistant-core's own `tools/index.ts` beside `dublin-core-render`, since the code is core's.
- `package.json` here names `check:tabular-stubs` → `cat-harness-tools/scripts/check-tabular-stubs.ts`, and `scripts/tests/tabular-csvw.test.ts` imports `../check-tabular-stubs.ts`. **That file exists in no repository** (checked 2026-10-10 in cat-harness-tools, cat-harness and folio-assistant-core). Its test asserts both tools are in the stubbed set, which must invert once they are built.
- `install: { none: true }` cannot mean "stub": `dublin-core-render` carries it as a working tool. Mark a stub explicitly, or drop the stub reading once no stub remains.

## Done when
- [ ] neither tool is declared STUB, and each invokes its core script
- [ ] the stub check exists where its package script says, or the script entry and test are removed
- [ ] `tabular-csvw.test.ts` asserts the built state, not the stubbed one


## Progress 2026-10-10 (lane B drain)

- **Correction to the bean:** `scripts/check-tabular-stubs.ts` **does exist** in cat-harness-tools (it came across in 70lx, commit d8d42ab), and `scripts/tests/tabular-csvw.test.ts` loads and passes on main (17/17 in the CI-shaped mount). The "exists in no repository" check above was mistaken.
- [x] **Done-when #3, partly; bullet 3 above:** `stubbedTools` read `install: { none: true }` as "stub", which would mislabel `dublin-core-render`. It now requires `install.none && invoke.manual`, with a test that an install-free runnable tool is not a stub (PR, lane B).
- [ ] **Done-when #1, outside this repository:** replace the two STUB declarations in cat-harness `tools/index.ts` (or move them to folio-assistant-core's `tools/index.ts` beside `dublin-core-render`) with real ones invoking `bun run folio-assistant-core/scripts/tabular-{csv,xlsx}.ts`. Once that lands, flip the assertion in `tabular-csvw.test.ts` ("the stubbed set is READ…") from `has(...) === true` to `false`. The ratchet then makes any leftover `fac:stub` an `expired` finding.

## Summary of Changes

Completed 2026-10-11 (lane C), finishing lane B's 2026-10-10 progress:
- **Done-when 1:** neither tool is declared STUB, and each invokes its core
  script. The working declarations moved to folio-assistant-core
  `tools/index.ts`, beside `dublin-core-render` (core#48), because tabular
  metadata is content vocabulary that cat-harness may not name. The STUBs left
  cat-harness `tools/index.ts` (cat-harness#127). core's
  `tools/tabular-tools.test.ts` checks that both are declared, not stubs,
  point at scripts that exist, and satisfy `tabular-metadata`.
- **Done-when 2:** `scripts/check-tabular-stubs.ts` exists where its package
  script says. This bean's original claim that it existed nowhere was wrong;
  the search had not followed a symlink. Lane B corrected that.
- **Done-when 3:** `tabular-csvw.test.ts` no longer pins which tools are
  stubs (#96). It checks the predicate on fixtures, and that any current stub
  names a skill.
Merge order kept one id from ever being declared twice: #96, then
cat-harness#127, then core#48.

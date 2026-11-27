---
# folio-assistant-id4s
$schema: bean/1.0.0
title: 'QA READERS F2a: qa-results.ts core (writeQaResult, qaResultState) and the export comparisons read through qa-store'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:47:13Z
updated_at: 2026-10-06T06:09:22Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-16ei
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, family F2a). Refines `oqe3` item "also: check-version-bump / check-published-instance-exports". Blocked on `16ei`.

## Readers
- `cat-harness/scripts/qa-results.ts:171-184` `writeQaResult`: the prior `<stem>.qa-results.json`, to skip an unchanged write. It has 22 callers. Absent today: correct (it writes).
- `qa-results.ts:209,255` `readQaResult` / `qaResultState`: the four-state compare. Absent today: correct (`absent` / `unreadable`).
- `cat-harness/scripts/check-version-bump.ts:233-234`: `kg-export.qa-results.json` (A). Absent today: it prints `? ABSENT` and exits 0. STALE also exits 0, so this half of the gate is advisory.
- `cat-harness/scripts/check-published-instance-exports.ts:263-267`: `kg-export.<stub>.qa-results.json` (A). Absent today: **FALSE-CLEAN (C2)**. The comparison never runs, because both invocations use `export-graph`, which writes no sidecar. The defect itself is fixed in the live-defects bean. This bean migrates whatever survives that fix.

## Migration action
- `qaResultState` / `readQaResult` become thin wrappers over `readQa(ref, path)` (hit / miss / corrupt / unknown).
- `writeQaResult` becomes `publishQa`. Its prior-key skip reads the branch, not the tree.
- `check-version-bump` gains `--against`. Decide whether an ABSENT baseline is advisory, and say so in the gate.

## Done when
- [x] no caller composes `<root>/test/results/` by hand (grep `QA_RESULTS_DIR` outside `qa-store`)
- [x] `check:version-bump` reports `unknown` (not `current`) when the branch has no baseline, and its exit on that state is documented
- [x] its tests run with `test/results/` absent


## Summary of Changes (2026-10-01, branch `qa-readers-f2-id4s-0dav`, not pushed)

- `qa-results.ts` (commit 545b3c49): `readBaseline` / `readQaResultFrom` read a committed QA result from the working copy, or from the `qa-reports` branch with `--against <ref>` through qa-store's `readQa`. Both use qa-store's four states (hit/miss/corrupt/unknown), and a miss carries no text. `qaResultState` and `readQaResult` are now thin wrappers over them. `qaResultState` gains a fifth state, `unknown`. Also added: `againstRef` (a bad ref is a usage error, not a miss), `diffFindings` (new/inherited/resolved), `judgeQaResult`, `qaResultsFile`, and `mayLeaveMain`/`OFF_MAIN_KINDS`.
- **Decision: `writeQaResult` stays a working-copy writer.** Proposal §2.4 says a writer still writes `<instance>/test/results/`, and `qa:publish` pushes the tree once per CI run. Making its prior-key skip read the branch would put a network fetch in front of ~22 callers to save a local write. The skip is correct in both states (absent means it writes). This is documented on the function.
- `check:version-bump` (9d29a95b): takes `--against <ref>`. An absent, unreadable or unknown kg-export baseline now prints UNKNOWN ("no baseline is NOT unchanged"). The exit on that state is documented as **0, with or without `--strict`**.
- `check:published-instance-exports` (9d29a95b): when the results directory was absent, the committed-sidecar subject used to vanish silently with exit 0 (C2 again). `sidecarSubjectsFrom` now reports UNKNOWN in that case, and `--against` lists and compares the subjects from the branch. An absent or unknown baseline no longer fails a row. A STALE one still fails, as r7v6 ruled.
- Tests: the new `tests/qa-baseline.test.ts` exercises a real bare remote over `file://`. `qa-results.test.ts` reads the kg-export result via `readQaResultFrom`.

Verified both ways (results present, then every `*/test/results` and `test/health/results` moved aside):
- `check:version-bump` and `check:published-instance-exports`: exit 0 in both runs, and the absent run says UNKNOWN.
- `--against main` against the real remote returns `miss` and prints UNKNOWN.

### Done when
- [x] no caller composes `<root>/test/results/` by hand. `QA_RESULTS_DIR` now appears only in `qa-results.ts` and in its own test, which asserts that the constant mirrors the declaration.
- [x] `check:version-bump` reports `unknown` (not `current`) when the branch has no baseline. Its exit on that state is documented: 0.
- [x] its tests run with `test/results/` absent (`check-published-instance-exports.test.ts`, `qa-baseline.test.ts`, `instance-versioning.test.ts`). Still failing when absent are three witness/badge tests in `qa-results.test.ts`. They read `test/results/witnesses`, which is F6's subject (docs publishing).

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").

---
# folio-assistant-loxz
$schema: bean/1.0.0
title: 'regen reports audit:coverage:strict current while the artefact on disk differs from what its writer produces'
status: completed
type: bug
parent: folio-assistant-1xhc
priority: normal
created_at: 2026-10-04T12:18:57Z
updated_at: 2026-10-22T16:45:00Z
---

A verify/write pair whose CHECK is a judge-mode baseline rather than a byte comparison cannot detect a stale artefact, and `regen` counts it as `current`. So "0 unrepaired" is not evidence that every generated artefact matches its writer.

MEASURED on the #1898 branch, 2026-10-04, in one worktree, in this order:

1. `regen` run with `fsh-guts/` NOT mounted (main has cut it over, so it is absent from the checkout). It wrote `cat-harness/test/results/audit-coverage.qa-results.json` with `state: "undetermined"` for the fsh-guts row, dropped the `fsh-guts` entry, and `total: 78`.
2. `bun run cat state:mount` — `fsh-guts` mounted, 147 files.
3. `regen` again. Reported **`113 current, 0 regenerated, 0 unrepaired, 0 with a failing writer`**, settled in one pass. `audit:coverage:strict` among the "current".
4. `bun run cat audit:coverage` — the WRITER — on that same mounted tree. It rewrote the file: `state: "empty"`, the `fsh-guts` entry restored, `total: 79`. Byte-identical to what `main` carries.

So step 3 declared current an artefact that step 4 proves the writer disagrees with. The stale copy was the unmounted run output, and nothing in the pipeline noticed.

WHY. `audit:coverage:strict` is `audit-coverage.ts --check --strict --against main`: judge mode against a `qa-reports` baseline over three categories — `kinds-unaudited`, `kinds-typed-only`, `gates-undeclared`. It prints *"judge mode, wrote nothing: OK — no finding the gate fails on"* and exits 0. It never asks whether the committed sidecar equals the writer output, so a `state` or `total` that moved is invisible to it. The pair is declared, the check runs, it passes — and it was never the question.

This is the `1xhc` family: a step that did not fire must not look like one that passed. Here it is narrower and worse, because the step DID fire — it just answered a different question than the pairing implies, and `regen`\s summary line reports it in the same column as the pairs that do compare bytes.

Bean `0qjq` is the sibling for CI (a green PR page is not evidence gates RAN — count runs AND distinct names). This is the same defect inside `regen`.

## Done when
- [x] `regen` distinguishes a pair whose check COMPARES THE ARTEFACT from one whose check is a judge/baseline verdict, and says which in its summary rather than counting both as `current`
- [x] for the judge-mode pairs, either a byte comparison is added or the pair is declared as not-a-staleness-check (the same honesty `check:viewer-nav`/`check:harness-dirs` already get with "no writer, by declaration")
- [x] a test writes a stale artefact for one judge-mode pair, runs `regen`, and asserts it is NOT reported as `current`
- [x] the fsh-guts case specifically: an UNMOUNTED tree must not be able to leave a committed sidecar that a mounted `regen` then blesses

## Closed 2026-10-09

Resolved in `cat-harness` commit `469086028e239aa1270b8e007887da1c65e3675b` on `main`:
1. `scripts/regen-after-merge.ts`:
   - Added `Outcome = ... | "judged"` and `JUDGE_CHECKS` set identifying judge-mode checks (`audit:coverage:strict`, `audit:coverage:require-all`, etc.).
   - Updated `isJudgeCheck(check, pair)` helper and pass execution: passing judge-mode checks record `outcome: "judged"` rather than `"current"`.
   - Updated summary reporting to distinguish `X current` from `Y judged` (`✓ <check> passed (judge mode, wrote nothing)`).
   - Added `"judged"` to `CLEAN_OUTCOMES` and hash recording.
2. `scripts/regen-after-merge.ts` & `scripts/task-io.ts`:
   - Removed `audit:coverage:strict` and `audit:coverage:require-all` from `OWN_WRITER_OVERRIDES`.
   - Declared both in `NO_WRITER` ("judge-mode baseline check against qa-reports, not an artefact staleness check").
   - Tagged both with `judge: true` in `OWN_TASK_IO`.
3. `scripts/audit-coverage.ts`:
   - In writer mode (`!check`), refuses to write `audit-coverage.qa-results.json` and exits 1 if undetermined graphs exist (`undet.length > 0`), guarding against unmounted trees writing incomplete census sidecars.
4. `scripts/tests/regen-after-merge.test.ts`:
   - Added suite `describe("judge-mode pairs are distinguished from artefact staleness checks — bean loxz", ...)` verifying `NO_WRITER` declarations, `isJudgeCheck`, passing judge checks yielding `"judged"` (never `"current"`), clean exit 0 handling, and unmounted refusal in writer mode.
   - Verification: `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Completed on landed evidence (2026-10-10)

Closed by a session that did not write it, on evidence rather than authorship (`bean-coordination` §"Closing a bean whose work has already landed"). The work landed in litlfred/cat-harness `46908602` (2026-10-09, "fix(regen): distinguish judge-mode checks from artefact staleness checks (bean loxz)") and moved here with the code in `d8d42ab` (70lx stage 1a). Nobody updated the status.

Each Done-when item, checked against `main` at `0d5841e`:

- **regen distinguishes the two kinds of pair.** It now has a separate `judged` outcome. The summary reports "N judged" and prints "passed (judge mode, wrote nothing)" for those checks. That is in `scripts/regen-after-merge.ts`, in the `Outcome` type, `isJudge` and the summary line.
- **Judge-mode pairs are declared as not staleness checks.** `audit:coverage:strict` and `audit:coverage:require-all` sit in the no-writer declarations, each with its reason ("judge-mode baseline check against qa-reports, not an artefact staleness check").
- **A test proves it.** In `scripts/tests/regen-after-merge.test.ts`, under "judge-mode pairs are distinguished from artefact staleness checks — bean loxz", a passing judge-mode check is reported as `judged`, never `current`.
- **The fsh-guts case is handled.** `audit-coverage.ts` refuses to write `audit-coverage.qa-results.json` when any declared graph is undetermined, which is the unmounted case. Its message tells the user to mount the required remotes first.

Verified 2026-10-10: `bun test ./cat-harness-tools/scripts/tests/regen-after-merge.test.ts -t loxz` gives 6 pass, 0 fail. This ran in an index checkout with cat-harness and cat-harness-tools both at their `main`.

The full file gave 51 pass and 14 fail. The 14 failures are all script-table lookups (a writer resolves as `undefined`), not loxz. They come from that mixed checkout: the index's other instances are mounted at their locked refs while these two are at `main`. They are not evidence about this bean.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] `regen` distinguishes a pair whose check COMPARES THE ARTEFACT from one whose check is a judge/baseline verdict, and says which in its summary rather than counting both as `current`
- [x] for the judge-mode pairs, either a byte comparison is added or the pair is declared as not-a-staleness-check (the same honesty `check:viewer-nav`/`check:harness-dirs` already get with "no writer, by declaration")
- [x] a test writes a stale artefact for one judge-mode pair, runs `regen`, and asserts it is NOT reported as `current`
- [x] the fsh-guts case specifically: an UNMOUNTED tree must not be able to leave a committed sidecar that a mounted `regen` then blesses

## Closed 2026-10-09

Resolved in `cat-harness` commit `469086028e239aa1270b8e007887da1c65e3675b` on `main`:
1. `scripts/regen-after-merge.ts`:
   - Added `Outcome = ... | "judged"` and `JUDGE_CHECKS` set identifying judge-mode checks (`audit:coverage:strict`, `audit:coverage:require-all`, etc.).
   - Updated `isJudgeCheck(check, pair)` helper and pass execution: passing judge-mode checks record `outcome: "judged"` rather than `"current"`.
   - Updated summary reporting to distinguish `X current` from `Y judged` (`✓ <check> passed (judge mode, wrote nothing)`).
   - Added `"judged"` to `CLEAN_OUTCOMES` and hash recording.
2. `scripts/regen-after-merge.ts` & `scripts/task-io.ts`:
   - Removed `audit:coverage:strict` and `audit:coverage:require-all` from `OWN_WRITER_OVERRIDES`.
   - Declared both in `NO_WRITER` ("judge-mode baseline check against qa-reports, not an artefact staleness check").
   - Tagged both with `judge: true` in `OWN_TASK_IO`.
3. `scripts/audit-coverage.ts`:
   - In writer mode (`!check`), refuses to write `audit-coverage.qa-results.json` and exits 1 if undetermined graphs exist (`undet.length > 0`), guarding against unmounted trees writing incomplete census sidecars.
4. `scripts/tests/regen-after-merge.test.ts`:
   - Added suite `describe("judge-mode pairs are distinguished from artefact staleness checks — bean loxz", ...)` verifying `NO_WRITER` declarations, `isJudgeCheck`, passing judge checks yielding `"judged"` (never `"current"`), clean exit 0 handling, and unmounted refusal in writer mode.
   - Verification: `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Completed on landed evidence (2026-10-10)

Closed by a session that did not write it, on evidence rather than authorship (`bean-coordination` §"Closing a bean whose work has already landed"). The work landed in litlfred/cat-harness `46908602` (2026-10-09, "fix(regen): distinguish judge-mode checks from artefact staleness checks (bean loxz)") and moved here with the code in `d8d42ab` (70lx stage 1a). Nobody updated the status.

Each Done-when item, checked against `main` at `0d5841e`:

- **regen distinguishes the two kinds of pair.** It now has a separate `judged` outcome. The summary reports "N judged" and prints "passed (judge mode, wrote nothing)" for those checks. That is in `scripts/regen-after-merge.ts`, in the `Outcome` type, `isJudge` and the summary line.
- **Judge-mode pairs are declared as not staleness checks.** `audit:coverage:strict` and `audit:coverage:require-all` sit in the no-writer declarations, each with its reason ("judge-mode baseline check against qa-reports, not an artefact staleness check").
- **A test proves it.** In `scripts/tests/regen-after-merge.test.ts`, under "judge-mode pairs are distinguished from artefact staleness checks — bean loxz", a passing judge-mode check is reported as `judged`, never `current`.
- **The fsh-guts case is handled.** `audit-coverage.ts` refuses to write `audit-coverage.qa-results.json` when any declared graph is undetermined, which is the unmounted case. Its message tells the user to mount the required remotes first.

Verified 2026-10-10: `bun test ./cat-harness-tools/scripts/tests/regen-after-merge.test.ts -t loxz` gives 6 pass, 0 fail. This ran in an index checkout with cat-harness and cat-harness-tools both at their `main`.

The full file gave 51 pass and 14 fail. The 14 failures are all script-table lookups (a writer resolves as `undefined`), not loxz. They come from that mixed checkout: the index's other instances are mounted at their locked refs while these two are at `main`. They are not evidence about this bean.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] `regen` distinguishes a pair whose check COMPARES THE ARTEFACT from one whose check is a judge/baseline verdict, and says which in its summary rather than counting both as `current`
- [x] for the judge-mode pairs, either a byte comparison is added or the pair is declared as not-a-staleness-check (the same honesty `check:viewer-nav`/`check:harness-dirs` already get with "no writer, by declaration")
- [x] a test writes a stale artefact for one judge-mode pair, runs `regen`, and asserts it is NOT reported as `current`
- [x] the fsh-guts case specifically: an UNMOUNTED tree must not be able to leave a committed sidecar that a mounted `regen` then blesses

## Closed 2026-10-09

Resolved in `cat-harness` commit `469086028e239aa1270b8e007887da1c65e3675b` on `main`:
1. `scripts/regen-after-merge.ts`:
   - Added `Outcome = ... | "judged"` and `JUDGE_CHECKS` set identifying judge-mode checks (`audit:coverage:strict`, `audit:coverage:require-all`, etc.).
   - Updated `isJudgeCheck(check, pair)` helper and pass execution: passing judge-mode checks record `outcome: "judged"` rather than `"current"`.
   - Updated summary reporting to distinguish `X current` from `Y judged` (`✓ <check> passed (judge mode, wrote nothing)`).
   - Added `"judged"` to `CLEAN_OUTCOMES` and hash recording.
2. `scripts/regen-after-merge.ts` & `scripts/task-io.ts`:
   - Removed `audit:coverage:strict` and `audit:coverage:require-all` from `OWN_WRITER_OVERRIDES`.
   - Declared both in `NO_WRITER` ("judge-mode baseline check against qa-reports, not an artefact staleness check").
   - Tagged both with `judge: true` in `OWN_TASK_IO`.
3. `scripts/audit-coverage.ts`:
   - In writer mode (`!check`), refuses to write `audit-coverage.qa-results.json` and exits 1 if undetermined graphs exist (`undet.length > 0`), guarding against unmounted trees writing incomplete census sidecars.
4. `scripts/tests/regen-after-merge.test.ts`:
   - Added suite `describe("judge-mode pairs are distinguished from artefact staleness checks — bean loxz", ...)` verifying `NO_WRITER` declarations, `isJudgeCheck`, passing judge checks yielding `"judged"` (never `"current"`), clean exit 0 handling, and unmounted refusal in writer mode.
   - Verification: `bun test scripts/tests/regen-after-merge.test.ts` (65 pass, 0 fail).
```

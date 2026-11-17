---
# folio-assistant-lfxa
$schema: bean/1.0.0
title: 'QA: write the proof-no-placeholder-stub checker (and drop the QOU literal from its description)'
status: completed
type: task
created_at: 2026-09-18T17:43:01Z
updated_at: 2026-10-07T04:43:00Z
parent: folio-assistant-1swy
---

## What

`proof-no-placeholder-stub` was declared `automated: true` with **no checker
function anywhere in the repo** — no dispatch-table entry, no `check*`
function. Found by bean `fg6z` while closing the coverage gap in
`scripts/tests/qa-criterion-source-file.test.ts`.

`qa-sweep` resolves a checker with

    AUTOMATED_CHECKERS[id] ?? DAK_AUTOMATED_CHECKERS[id]

and falls through to `needs-agent` when that is `undefined`. So the
criterion was silently queueing an **agent adjudication** on every
applicable block — billing a model call for a check nobody had written, and
arriving downstream indistinguishable from a criterion legitimately marked
`automated: false`.

`fg6z` set it to `automated: false`, which changes no runtime behaviour and
makes the registry say what the code does. The test now asserts **zero**
automated criteria without a checker, so this cannot recur silently.

## The work

Write the checker and flip it back to `automated: true`. The criterion is
mechanical: does the block's `.lean` consist only of a placeholder-stub
marker rather than mathematical content. A grep for the marker plus a
content-emptiness test should do it.

Where it goes: `content/pipeline/qa-checkers-vacuity.ts` is the closest fit
(it already hosts `lean-no-vacuous-instance-data`,
`lean-no-definitional-laundering`, `lean-docstring-honesty`), or a new file
— the guard test globs `qa-checkers-*.ts`, so a new file is covered
automatically. Add an explicit `source_file` either way.

## Second defect in the same entry

The description reads:

> Block's `.lean` file is NOT a bare placeholder stub marked with
> `# QOU... — placeholder stub`

**`QOU` is one folio's literal sitting in platform code.** Same class as the
`QOU.` module prefix and the hardcoded `quantum-observable-universe` paths
that `AGENTS.md` records removing from `generate-readme.sh`. The marker
convention should come from the folio, or the description should describe
the shape without naming a folio's namespace.

Whoever writes the checker must not hardcode `QOU` in it.

## Verification gate

The criterion flips to `automated: true` and
`scripts/tests/qa-criterion-source-file.test.ts` stays green (it will fail
if the checker is not where the registry says). Plus a unit test with both
directions: a real stub fails, a `.lean` with actual content passes.

## Provenance

Measured 2026-09-18 by `bun test` and by reading `qa-sweep.ts:443`. Not
re-measured since.

## Evidence

- Implemented `checkProofNoPlaceholderStub` in `cat-harness/content/pipeline/qa-checkers-vacuity.ts` and registered it in `VACUITY_AUTOMATED_CHECKERS`.
- Replaced the `QOU...` literal in the description in `cat-harness/content/pipeline/qa-criteria-registry.ts` with generic placeholder stub marker description, set `source_file: "content/pipeline/qa-checkers-vacuity.ts"`, and flipped `automated: true`.
- Updated `cat-harness/content/pipeline/script-sidecars/proof-no-placeholder-stub.script.json` with new `source_file` and computed `script_hash`.
- Added unit tests in `cat-harness-tools/scripts/tests/qa-checkers-vacuity.test.ts` covering both directions (bare stubs failing, stubs with imports/docstrings failing, substantive files passing, comments mentioning stub passing, and n/a handling).
- Ran `bun test cat-harness-tools/scripts/tests/qa-checkers-vacuity.test.ts` (66 pass, 0 fail).
- Ran `bun test folio-assistant-sci/scripts/tests/qa-criterion-source-file.test.ts cat-harness/scripts/tests/qa-checker-discovery.test.ts` (18 pass, 0 fail).
- Ran `bun test test/bean-store-hygiene.test.ts` (3 pass, 0 fail).

_2026-10-07T04:41:20Z_ — Claimed by claude/lfxa-proof-no-placeholder-stub — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

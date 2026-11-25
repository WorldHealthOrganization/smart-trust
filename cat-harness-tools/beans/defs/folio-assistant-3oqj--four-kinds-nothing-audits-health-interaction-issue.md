---
# folio-assistant-3oqj
$schema: bean/1.0.0
title: 'FOUR KINDS NOTHING AUDITS: health, interaction, issue-marks, todos - 13 files, 0 criteria, 0 gates'
status: completed
type: task
priority: normal
created_at: 2026-09-24T05:44:17Z
updated_at: 2026-09-24T13:08:49Z
parent: folio-assistant-1swy
---

Measured 2026-09-24 by `bun run cat audit:coverage` (bean `xutg`). Four declared
graph kinds hold files that **no `kg-audit` criterion and no gate declaring
`@covers` reaches**:

| kind | files | directories |
|---|---|---|
| `health` | 1 | `cat-harness/test/health/results` |
| `interaction` | 1 | `interaction` |
| `issue-marks` | 2 | `issue-marks` |
| `todos` | 9 | `todos` |

## This is an UPPER bound, not a verdict

10 of 141 gates have not declared what they cover (`3srh`). Close that first, or
a criterion gets written for a kind something already audits.

## Two of the four are read at session start

`interaction/` is the `context` graph read at the start of every session, and
`issue-marks/` holds the two timestamps `issue-working` tracks. Both are *read*
by the harness and validated by nothing, so a malformed node fails at the moment
an agent needs it rather than in CI. That is the same shape as `health`, whose
one result file carries every threshold's basis.

`state-visualizer` renders dashboards over all four and declares `@covers none`
deliberately: rendering is a currency check on the render, not a verdict on the
graph. Do not count it as coverage without deciding that it should be one.

## Done when

Either each kind has something that judges its nodes, or its row says in the
sidecar **why it needs nothing** — never by the row quietly reading clean.

## Summary of Changes

Resolved 2026-09-24. The four were **two findings**, and `check:kind-validators`
is what split them.

### The real gap: two kinds declared no validator

`interaction` and `issue-marks` had a `schema` (a TypeScript module) and nothing
runnable. Both now declare `nodeSchemas`, their real nodes parse, and
`check:kind-validators` reaches them.

The cost was measured, not supposed: `interaction/interaction.json` is read at
the start of **every** session by jq in a shell script whose failure branch
prints `(could not parse … — read it by hand)`. A malformed node degrades to a
line nobody acts on, in the first file every sibling session reads.

Two things surfaced while fixing it:

- **`interaction`'s `schema` pointed at the wrong module** — `harness-config.ts`,
  which holds the *path* to the node, not its shape. A pointer to where a fact is
  NOT written is worse than none.
- **`saveSeen` was not writing `$schema`.** Consumers route by the tag and skip a
  file without one, so every mark the mechanism produced would have been passed
  over by the check the new schema exists to feed — the two hand-written files
  would have been the only ones ever validated. *A validator over the nodes
  nobody produces is not coverage.*

### The report's own defect: `health` and `todos` were over-reported

Both were already typed. They read `unaudited` only because the gate that types
them declares `@covers computed`, which the report counts as neither coverage nor
gap.

New state **`typed-only`**: nodes a validator types, judged by nothing. It is
**still a finding** — `--strict` fails on it, as its own family — because typing
is not judging, and a state that turned a finding into a pass would be `dh4f`
wearing this report's own design.

Falsified: pulling `interaction`'s validator drops it back to `unaudited` (1
there, 3 typed-only); restoring gives 4 typed-only and 0 unaudited. `--strict`
exits 1 throughout.

### Considered and rejected

The `waiver` graph, for "this kind knowingly needs nothing". Its `gate` field is
a closed enum for confirmation rights; a waiver over a non-waivable rule fails to
parse by design. Wrong tool.

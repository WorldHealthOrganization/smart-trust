---
# folio-assistant-dxqm
$schema: bean/1.0.0
title: 'UNREACHABLE DECLARED ARTEFACTS: a declared executable artefact nothing can reach reads exactly like a decision nobody takes — measured on merge-priority.dmn (kg-qa says pass, no caller can evaluate it) and merge-queue.ts (only importer is its own test)'
status: completed
type: task
priority: normal
created_at: 2026-10-04T05:49:00Z
updated_at: 2026-10-07T18:03:00Z
parent: folio-assistant-1xhc
---

`1xhc` one level deeper. The epic's line is *a gate that does not fire is
indistinguishable from one that passed*. This is: **a declared executable
artefact that nothing can reach is indistinguishable, from outside, from a
decision nobody takes.**

Two instances found by the merge steward 2026-10-04, both past all 217 CI gates:

1. **`cat-harness/scripts/merge-queue.ts`** — docblock says *"a library the
   merge steward and the tile call"*. Nothing called it: no `package.json`
   script, no workflow, no tool, and its **only importer is its own test**. So
   `merge-priority.dmn`'s ordering could not be asked for, and the queue was
   ordered by hand.
2. **`cat-harness/processes/sdlc/decisions/merge-priority.dmn`** — `not("green")`
   in `Rule_HeadNotGreen` since it was drawn. `unaryTest` throws
   `UnsupportedDmn` on `not(...)`, so the table was unevaluable by **any**
   caller. Its committed `kg-qa` sidecar read `"result": "pass"`, because
   `decision-outcomes-used` calls `loadDecisionTable` + `possibleOutcomes` and
   **neither parses a unary test**. Load is not evaluability.

Both fixed on PR #1952. This bean is the GATE and the GUIDANCE.

## Done when

- [ ] every declared `.dmn` decision is checked EVALUABLE — not merely loadable
      — against this repo's own evaluator, and an unevaluable one is a hard
      failure
- [ ] the evaluability question is asked of `decision-table.ts` itself, never by
      restating the FEEL grammar in a gate (two spellings of one grammar are
      free to disagree)
- [ ] every declared `.bpmn` is checked reachable through the engine's own entry
      point, with stem and `bpmn:process` id ambiguity a failure
- [ ] a module whose only importer is its own test is reported, with a
      declaration (`@entrypoint`) as the way to say how it IS reached
- [ ] the measurement is a committed sidecar, so "never audited" cannot read as
      "audited clean"
- [ ] wired into `.github/workflows/code-quality-gates.yml`, so `gates.ts`
      derives it

## Measured before building, 2026-10-04

| question | denominator | findings |
|---|---|---|
| declared `.dmn` decisions evaluable | 10 | **1** (`merge-priority#Decision_MergePriority`) |
| declared `.bpmn` reachable by `processFiles` | 85 | 0 |
| stem collisions / duplicate `bpmn:process` ids | 85 | 0 / 0 |
| `.bpmn` that will not load | 85 | 0 |
| modules whose ONLY importer is a test | 1834 tracked `.ts` | **9** |
| modules "unreferenced" by pure inference | 1834 | **710** — unusable |

The last row is the whole argument for a declaration over a grep, and it is
`audit-coverage`'s gate half for the same reason: inference fails in both
directions at once. 710 of 1834 is not a finding list, it is noise, and a gate
keyed on it would be switched off in a week. The 9-item slice is crisp because
it names a *relation* — the only thing that reaches this module is the thing
that proves it works — and `merge-queue.ts` is the first of the 9.

_2026-10-04_ — **Shipped as `bun run cat audit:reachability`, PR #2043.**

The sharpest thing found, and it belongs here rather than in a commit message:
**the committed `kg-qa` sidecar for `merge-priority.dmn` read
`"result": "pass"`.** `kg-audit`'s `decision-outcomes-used` criterion calls
`loadDecisionTable` and `possibleOutcomes`, and **neither parses a unary
test** — the loader never looks inside a rule, and `possibleOutcomes` reads the
output column. So a gate recorded a clean verdict over a table no caller could
evaluate. That is this epic's sentence in its strongest form so far: not a gate
that failed to fire, but one that fired and *passed* over something unevaluable.

**Load is not evaluability.** The check asks the question by running the
EVALUATOR (`unreadableExpressions`, in `decision-table.ts` beside the grammar),
never by restating what FEEL this engine accepts — two spellings of one grammar
are free to disagree, and nothing would say which is wrong.

### What it measures

| family | question | fails |
|---|---|---|
| `decision-unevaluable` | can this repo's evaluator read EVERY cell of every declared `.dmn`? | `--check` |
| `process-unreachable` | would `workflow_start` find this diagram? | `--check` |
| `process-ambiguous` | do two diagrams answer to one stem or one `bpmn:process` id? | `--check` |
| `entrypoint-claim-broken` | does `@entrypoint script:<name>` name a real script? | `--check` |
| `entry-point-orphan` | is the only thing reaching this self-declared executable its own test? | `--strict` |
| `entry-point-latent` | a dead CLI branch on a live library | reported |

Three traps the evaluability walk had to avoid, each a way to miss a finding:
a comma-separated test cannot be handed to `unaryTest` whole (`parts.some`
returns before reading `[1..5]` in `0, [1..5]`); the probe is `0`, the one value
reaching every branch without a type complaint, so a `DecisionError` under it
means *can never evaluate for any fact*; and output cells count, because
`possibleOutcomes` reads only the first column.

### The gap that was closed, and how

The third check nearly shipped as noise. Asking the broad question — *is any
module reached by nothing?* — answered **710 of 1834**. Narrowing the SIGNALS
(requiring an invocation verb beside the mention) still left **34**. What worked
was narrowing the **SUBJECT**: a `#!` shebang or an `import.meta.main` guard is
a module SAYING it is runnable, which is a declaration inside the file, and
*"does anything run it?"* then has one right answer. **440 declare it, 6 are run
by nothing**, `scripts/merge-queue.ts` among them.

So `audit-coverage`'s rule gains a corollary worth keeping: *prefer a
declaration where inference fails both ways* — and when there is no declaration
to prefer, **find the one the corpus already carries and make that the
subject.**

A mention is not a caller, and that decided everything: `merge-train.bpmn` and
`merge-priority.dmn` both name `merge-queue.ts` in `<bpmn:documentation>`, and
the generated glossary carries that prose into a third file — so a grep over
mentions *clears the very defect this exists to catch*.

### Stated gaps, deliberately not gated

- **`--strict` is not wired in CI.** Six orphans is a backlog, not a defect, and
  a gate refusing every push until somebody wires six old scripts gets switched
  off in a week. It bites through STALENESS instead: a seventh makes the
  committed sidecar disagree with the tree, `--check` fails, and the author's
  regeneration puts the new module in the diff.
- **The 710-module question is not answered and should not be.** Printed, never
  committed. Inference cannot tell a directory-scanned corpus from a dead
  module, and a count in a sidecar would be stale on every commit.
- **Activity `<skill ref>` resolution was NOT re-implemented.** `check:workflow-refs`
  is already hard on a dangling ref and `kg-audit`'s `skill-*` criteria locate
  the same relation. A third reader of one fact is a third answer.

### Measured

`decision-unevaluable` 1 of 11 (fixed by #1952, not here). Diagrams 86 of 86
reachable, 0 stem clashes, 0 id clashes, 0 load failures — a guard over a
property the repo HAS, which is this epic's own conclusion when it wired
fourteen unrun gates. `bun run cat gates`: 6 of 225 failed on the first post-merge
run; 4 were this branch's and are fixed (the artefact-verification declaration,
and three stale writers), 1 is the known `9zok` unextractable command, and the
last is `audit:reachability:check` itself on the defect #1952 fixes. Two
`bun test` failures triaged to the `vxho`/`sff8` contention class — both pass
alone.

## Evidence: Closed on Landed Work

Delivered and landed in commits `b6a532774e8a`, `798bdf1162d4`, and `975e0aa0b3aa`:
- Audit-reachability sidecar committed under `cat-harness/test/results/`.
- Wired into CI via `audit:reachability:check` gate in `.github/workflows/code-quality-gates.yml`.

---
input: schemas/skills/dmn-authoring/input.schema.json
output: schemas/skills/dmn-authoring/output.schema.json
conformsTo:
  - omg-dmn-1.3
  - bpmn-io-di
---

# dmn-authoring

> Skill id: `dmn-authoring` · Package: `workflow` ·
> Named by `l2-dak-authoring.bpmn` step **Decision logic · DMN tables**, in the
> `Business analyst` lane.

Author DMN decision tables — a DAK's clinical decision logic, and the tables
that back this repository's own computed gateways.

## Inputs and outputs

`schemas/skills/dmn-authoring/`:

- **in** — `decisionName` (required), `inputVariables` (required), `sourceLogic`
- **out** — `dmnFile`, `decisionTableCount`, `ruleCount`, `hitPolicy`

## A computed gateway is not a chosen one

In this repository a DMN table has a second job: an exclusive gateway carrying
`<cat-harness.processes:decision ref="decisions/<file>.dmn#<Decision_Id>"/>` has its branch
**computed** from the table rather than picked by the agent.

`workflow_complete` **refuses a hand-supplied `outcome`** at such a gateway.
Asserting the answer would defeat the point of writing the table. You pass
`facts` — e.g. `{ failCritical: 0, failMajor: 2 }` from `qa_sweep` totals — and
the table returns the branch.

Adding one means adding the `.dmn`, the `cat-harness.processes:decision` ref, and nothing else:
the loader checks that **every outcome the table can return names a real
outgoing flow**, so a table that can route somewhere the diagram cannot go is a
load error rather than a surprise at the moment of decision.

## The FEEL subset this interpreter implements

`src/workflow/decision-table.ts` implements a deliberate subset: `-` (any),
literals, comparisons, and one-of. It **refuses** ranges, `not()` and function
calls rather than mis-evaluating them.

Write within that subset: a table using a construct the interpreter rejects
fails at load, rather than being mis-evaluated at the moment of decision.

## Three states belong in the table

Encode "could not determine" as an outcome in its own right — `pages-live-gate.dmn` returns `live`, `not-yet` **and**
`unknown`; `folio-intent.dmn` returns `ask` when the filesystem cannot decide.

A gate whose only outcomes are pass and fail forces an unmeasured input to be
rendered as one of them, and it is always rendered as pass. If your decision has an input that may be unavailable, give it a branch.

## Hit policy

Say it explicitly. `FIRST` is the usual choice here and is what
`folio-intent.dmn` uses — rules are ordered, the first match wins, and the
ordering is then part of the logic and must be reviewed as such.

## When a layer above transforms it

A layer built on this one may render decision tables for human review or
derive other artefacts (questionnaires, for instance) from them. Then the DMN
is a **source artefact**, not documentation of one; that layer's own tooling
skill has the mechanics and the caveats, and this one names no layer above
it.

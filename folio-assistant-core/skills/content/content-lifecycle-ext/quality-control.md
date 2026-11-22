---
input: schemas/skills/quality-control/input.schema.json
output: schemas/skills/quality-control/output.schema.json
---

# quality-control

> Skill id: `quality-control` · Package: `content-lifecycle-ext` ·
> Named by `draft-to-publication.bpmn` here, and by the QC gates of processes
> in the layers built on this one — which bind it from above, so this skill
> names none of them.

Apply the publication quality gates to an aggregate of QA output, and decide
whether it clears.

## Inputs and outputs

`folio-assistant-core/schemas/skills/quality-control/`:

- **in** — `checkType` (required), `targetPath` (required), `checklistSections`
- **out** — `overallResult`, `findings`, `checklistResults`

## Two of the three lanes are human, and that is the design

A QC gate is a **decision**, and the processes put it in a reviewer's lane —
`QC reviewer`, `PR reviewer / QC reviewer` — not the build's. The build's lane
runs the checks; the reviewer's lane rules on them.

The `qc-reviewer` role holds `qa-reporting` as a permission, and `qa-reporting`
is also held by `ci-pipeline` and `ig-publisher-service`. That a build system
and a human share a permission is deliberate: **emitting** a QA report is
mechanical, **ruling** on it is not.

`editing-hci-validation.bpmn` marks `Task_ReviewFindings` and
`Gateway_EditorDecision` `relaxable="false"`: the editor seeing the findings,
and the decision itself, are the gate.

## Compute the gate, do not assert it

Where a gateway carries `<cat-harness.processes:decision/>`, pass the **facts** — e.g.
`{ failCritical: 0, failMajor: 2 }` from `qa_sweep` totals — and let the DMN
table return the branch. `workflow_complete` refuses a hand-supplied `outcome`
at such a gateway.

`decisions/draft-qa-gate.dmn` is the table; `dmn-authoring` is how to change
it.

## Severity is the gate's vocabulary

The corpus-wide convention, and what the tables read:

- **critical** — a broken reference: something names a thing that does not
  exist, and a consumer following it gets nothing. Blocks.
- **major** — a missing join: intact, but a question has no answer.
- **minor** — coverage. Has legitimate instances, so it must not gate; forcing
  a fake entry onto a real step is worse than the gap.

**`unknown` is never counted as a pass**, and it is not promoted either — it
counts at its own criterion's severity: a check that did not run has not
cleared.

## What to run

`qa_sweep` for content, `bun run cat kg:audit` for the process/role/skill graph,
and the content type's own conformance validator where its layer provides one
(for a FHIR IG, that layer's validation skill). `checklistSections` narrows the pass;
`findings` and `checklistResults` are what the reviewer reads — not
`overallResult` alone, which is a summary of them rather than a substitute.

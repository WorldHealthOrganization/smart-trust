---
name: guideline-gap-report
description: >
  The QA report smart-guideline-end-to-end writes after every stage: where a
  guideline's chain from L1 recommendation to L2 asset to L3 resource is
  broken, which source figures and tables are not yet computable, and which
  assets have no review requested, a review pending, or a review sent back.
  Each gap names the asset, the stage that closes it and the role that
  reviews it. It is staged with the stage's output and linked from every
  review request, so each reviewer sees where their asset sits and what is
  still missing. A report, never a gate. Read after any stage of
  smart-guideline-end-to-end or dth-authoring, and when asked "what is left
  to do on this guideline?".
input: schemas/skills/guideline-gap-report/input.schema.json
output: schemas/skills/guideline-gap-report/output.schema.json
---

# guideline-gap-report

> Skill id: `guideline-gap-report` · Package: `authoring-who-smart-guidelines` ·
> Run after every stage of [`smart-guideline-end-to-end`](smart-guideline-end-to-end.md)
> (§*The gap report*), and after each L2 track of `dth-authoring`.

**A gap is a missing link in the chain, never a judgement.** The report says
what is not there yet and who closes it. It does not say whether an asset is
right; that is the reviewer's verdict, recorded in its `QaReview`.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/guideline-gap-report/input.schema.json) and [`output.schema.json`](../../../schemas/skills/guideline-gap-report/output.schema.json).

- **In:** the guideline's `l1Kg`, its `l2Assets` and `ig` (whatever stages
  have run so far), the `reviews` recorded (`qa-review/v1`), and the `stage`
  just finished.
- **Out:** the `gaps`, one row each, with the counts per kind in `summary`,
  and the staged page it is published on in `stagingLinks`.

## What counts as a gap

Each kind is read off links the stages already write: `wasDerivedFrom` and
`implementedBy` edges, their `adjudication` property, and the `QaReview`
records. The report adds no data of its own.

| kind | the gap | closed by | reviewing role |
|---|---|---|---|
| `l1-uncovered` | a normative sentence of an L1 source with no recommendation, remark or exclusion node | stage 2 (`recommendation-extraction`; `l1-coverage` for a DTH) | `l1-extraction-reviewer` |
| `figure-not-computable` | a figure or table in an L1 source not yet transcribed, or transcribed but not yet modelled as an L2 asset (§*Figures and tables become computable in steps*) | stage 2 (transcribe), stage 4 (model) | Clinical SME |
| `l1-no-l2` | an L1 recommendation in scope of the use case with no L2 asset deriving from it | stage 4 | Clinical SME |
| `l2-no-l1` | an L2 asset that names no L1 node in `wasDerivedFrom`: local policy or invention until the KG says which | stage 4 | Clinical SME |
| `l2-no-l3` | an L2 asset with no L3 resource implementing it, once stage 6 has started | stage 6 | FHIR modeller |
| `l3-no-l2` | an L3 resource that names no L2 asset (the order rule's finding) | stage 6 | FHIR modeller |
| `no-test-client` | a business process or decision table with no dummy client (test scenario) walking it, so its SME review has nothing to run | stage 4 (component 9) | Clinical SME |
| `review-not-requested` | a created or changed asset with no review item opened | the stage that made it | the role in §*Per-asset review* |
| `review-pending` | a review item open with no verdict | — (waiting on the role) | that role |
| `review-sent-back` | a `request-changes` or `reject` verdict not yet answered by a new version | the stage that made it | that role |
| `rejected-upstream` | an asset derived from one whose review was rejected, not yet re-derived | the stage that made it | that role |

`review-pending` is not the agent's to close, and the report never asks the
agent to. It lists the waiting role so the programme manager can follow it
up.

## Who reads it

The report is written for the people who review, not for developers:

- **Per role.** The staged page groups the gaps by reviewing role, so a
  clinical SME opens the page and sees only the items waiting on clinical
  judgement, each linked to its review item in the form that role reads
  (§*Review by expertise*). No gap row shows FSH, JSON or CQL.
- **Per stage.** The summary counts each kind per stage, so the programme
  manager sees how far the guideline has come and what is holding it.
- **Linked from every review request.** Each request carries the link to the
  report, anchored at the asset's own row.

## Steps

1. Read the inputs. A stage that has not run yet is reported as not run,
   never as having no gaps.
2. Walk the chain L1 → L2 → L3 and the review records, and write one row per
   gap with `kind`, `asset`, `stage`, `role`, and the `reason` in a sentence.
3. Write the summary, per kind and per stage.
4. Stage the report beside the stage's output (`feature-staging`) and put its
   link in every review request the stage opens.

## Tools that are still missing

| gap | until it exists | layer |
|---|---|---|
| A script that writes the report from the KG and the `QaReview` records | the agent walks the edges and writes the rows, and says it did so by hand | smart-base, beside `l3-readiness`'s check, which reads the same edges |
| A staged page grouping the rows per role | a Markdown table per role on the staged site | smart-base, rendered by the docs pipeline |

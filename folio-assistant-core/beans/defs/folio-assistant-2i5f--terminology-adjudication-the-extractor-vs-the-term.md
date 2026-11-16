---
# folio-assistant-2i5f
$schema: bean/1.0.0
title: 'TERMINOLOGY / adjudication: the extractor vs the terminology, and judge vs judge — call the existing process, restate nothing'
status: completed
type: task
priority: normal
created_at: 2026-09-25T04:51:47Z
updated_at: 2026-10-24T08:35:00Z
parent: folio-assistant-5yhm
---

Under `5yhm`. **Two disagreements, not one**, and only the second is already
solved here.

1. **The extractor and the terminology disagree.** The corpus uses a word the
   authorised vocabulary spells differently, or does not carry at all. A
   *content* decision — change the prose, author a local term with its reason,
   or record that the vocabulary is wrong for this domain. Nothing covers this.
2. **Two judges disagree about a mapping.** Already
   [`adjudication`](../../../cat-harness/skills/process/process-core/adjudication.md) plus
   [`untainted-verification`](../../../cat-harness/skills/process/process-core/untainted-verification.md).
   This must **call** them, never restate them: `adjudication.md` already
   defines the entry condition (*"entries for ONE criterion disagree"*) and
   consensus (*"entries of different kinds agree on one criterion"*), and
   `untainted-verification` already carries the three independence rules.

## What LCSHBench adds that is genuinely NOT here

`library/arxiv-2606.04382v1` never collapses a disagreement. It records which
library asserted which heading and releases three answer-key views —
per-catalog, merged/union (its default) and unanimous — so a consumer chooses
the strictness rather than inheriting the benchmark's. Its independence rule
(agency-level, MARC 040, so a copy-catalogued record is not a second
judgement) is an instance of discipline this repo already holds in
`untainted-verification`, not a novelty.

Here, adjudication always collapses to one verdict, which is right for a gate.

## The artefact that visibly wants the un-collapsed form

Re-checked 2026-09-29, still true: **`cat-harness/library/image-verdicts.json`
has exactly one `inspected_by`** at the top of the file, covering every
document in it (two so far). A second agent inspecting the same image
overwrites the first, and the format cannot record that two readings differed.

`m4xy` exists because one agent's reading — *"fragments of one composite
architecture figure"*, *"byte-identical"*, *"383 descriptions would be
fabrication"* — was wrong on all three counts, and a second independent
inspection is exactly what would have caught it. Whether verdicts should carry
dissent is the owner's call, and it is a **separate bean if wanted**, not this
one; noted here because it is where the evidence points.

## Done when

- [x] the two disagreements are named and kept apart
- [ ] case 2 CALLS `adjudication` and `untainted-verification`, restating neither
- [x] case 1 has an outcome set, each outcome saying what is written and where
- [ ] whether a term mapping keeps its dissent or collapses — owner's call


## Design recorded 2026-09-30, NOT built — owner chose "Wait; record the design"

The check exists now and returns **0 mapped on both targets** (2669
candidates, `skos` and `fhir`). Leg 2 — two judges disagreeing about a
mapping — has therefore no instance to be built against, and a skill written
over zero instances is one nothing has exercised: the shape this repository
has paid for repeatedly and the reason the owner chose to wait.

### The entry condition, so the next agent does not re-derive it

Build leg 2 when `check:term-mapping` reports a **non-zero `mapped` count on
either target**, which is the first moment two judges can disagree about
anything. Until then the disagreement is hypothetical and its fixtures would
be invented.

### What it must CALL and never restate

- **`adjudication`** already defines the entry condition (*"entries for ONE
  criterion disagree"*) and consensus (*"entries of different kinds agree on
  one criterion"*). A mapping disagreement is exactly one criterion —
  "is this candidate that concept" — so it is an instance of that skill, not
  a parallel one.
- **`untainted-verification`** already carries the three independence rules. A
  second judge that has read the first's answer is not a second judge.

Restating either is the failure mode: two copies of one rule drift, and the
copy the reader finds first is the one with no test.

### Leg 1 is the genuinely uncovered half, and is NOT blocked

The extractor and the terminology disagree: the corpus uses a word the
authorised vocabulary spells differently or does not carry at all. That is a
**content** decision with three outcomes — change the prose, author a local
term with its reason, or record that the vocabulary is wrong for this domain —
and nothing here covers it.

It does not depend on the mapped count: `check:term-mapping` already produces
2669 `unmapped` rows, and each is a candidate this corpus coined that no
authority carries. Some of those are right to coin; the skill is what says how
to tell. Buildable today, and deliberately not built, because the owner's
answer was to wait and record rather than to split the bean.

### What the record's shape already supports, so the skill need not invent it

`folio-term-mappings/v1` keeps `mapped` / `unmapped` / `undetermined` per
target with `exact` and `concept` always both present, and a determined row
may not carry a reason. So an adjudication has somewhere to land that cannot
be confused with a vocabulary nobody could reach — which is the distinction
any judgement here has to preserve.

### Open, and inherited rather than opened by this bean

`cat-harness/library/image-verdicts.json` still carries exactly **one**
`inspected_by` for the whole file, so two inspectors of two different entries
are indistinguishable. Not this bean's to fix — it is the same *shape* as leg
2 one corpus over, and worth naming here so the two are not solved twice.



Claimed by claude/terminology-followups (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH), stacked on #1837 — issue #1836. Slice: LEG 1 only, on the owner's 2026-10-02 ruling: *"split: build leg 1 now as a skill + an outcome schema"*. Leg 2 keeps waiting.

## Leg 1 BUILT 2026-10-02 (#1846, stacked on #1837) — leg 2 still waiting

Owner, 2026-10-02 (issue #1836): *"split: build LEG 1 now as a SKILL + an
OUTCOME SCHEMA … Leg 2 (two judges disagree about a mapping) stays waiting —
do not build it."*

- Skill [`term-disagreement`](../../../cat-harness/library/skills/library-core/term-disagreement.md)
  (library-core): which `exact`/`concept` rows are disagreements at all (the
  concept-only pair always; a miss only where the authority is MEANT to cover
  the word; `undetermined` never), the three questions that choose an
  outcome, who decides (a person), and why `local-term` is the only route to
  a CONFIRMED mapping now that automated ones are published.
- Schema `folio-term-adjudications/v1` (`cat-harness/schemas/term-adjudication.ts`):
  one variant per outcome, `OUTCOME_WRITES` as the what/where table, and the
  refusals — an undetermined or exact subject, `local-term` with `exactMatch`
  (that is `change-prose`) or `relatedMatch` (an authored term cannot carry
  it, so the outcome could not be written), a blank reason, an in-repo
  `<scheme>:<id>` where an IRI is required, two outcomes for one disagreement.
- `check:term-mapping` validates every `*.term-adjudications.json` beside the
  schemes (fails on an invalid one) and reports each record as applied /
  pending / holds / stale. No file exists: a record is a decision, never
  seeded.

Against `## Done when` above: the first and third items are ticked there.
The two disagreements are kept apart in the skill's first section and in the
schema header, and the outcome set states what is written and where
(`OUTCOME_WRITES`). The second and fourth items stay open. They are leg 2,
which waits on its entry condition: non-zero `mapped` on either target, and
both were 0 when measured on 2026-10-02.

_2026-10-24T07:50:00Z_ — Re-measured: `check:term-mapping` reports 3751 candidates, 0 mapped on `skos` and `fhir`. Leg 2's entry condition (non-zero mapped) is still unmet, so it keeps waiting. Session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU.

## OWNER, 2026-10-24: split leg 2 out, close this for what is built (structured question Q7, 08:29Z: "A + B")

Leg 1 (the extractor and the terminology disagree) is built and stays here, with its outcome set and skill (#1846). Leg 2 (two judges disagree about a mapping) moves to bean `nvhg`, with this bean's two open boxes: case 2 CALLS `adjudication` and `untainted-verification`, and whether a mapping keeps its dissent. It waits on its entry condition: non-zero `mapped` on either target (0 of 3,751 on 2026-10-24). The connected agent's OCL run, bean `q7ds`, is the first thing that could make it non-zero. Session https://claude.ai/code/session_01FABZmtqnNeBaTcHsXrtyK7.

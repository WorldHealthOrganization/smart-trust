---
name: adjudication
description: >-
  Settle a review that reached no mechanical or consensus agreement. What makes
  a disagreement adjudicable, the shape its implementations share, why the
  adjudication LEADS the criterion while the checker's entry is kept beneath
  it, and the dispensation that records the reason — scoped to a version,
  never precedent.
---

# Adjudication — judgement, when the mechanism ran out of facts

> Skill id: `adjudication` · Package: `sdlc-core`

## What it is

Adjudication is a judgement of the feedback of one or more feedback providers,
when a review reached no mechanical or consensus agreement. It carries the same
dispensation process: the reason for the choice, as per contextual
requirements. These activities are adjudications:

| where | the decision, in its own words |
|---|---|
| `translation-workflow` · `Task_Adjudicate` | *"The round trip establishes that two readings differ. Which one is right is a human call."* |
| `ingest-l1-completeness-gate` · `Task_FlagDrift` | *"A machine can detect that two readings differ. Which one is right is a human call."* |
| `refresh-materialized` · `Task_Adjudicate` | *"A human or agentic decision, never a merge rule. Which side wins depends on why the local edit was made, and a process that picked automatically would be choosing without the one fact that decides it."* |
| `review-narrative` · `Task_AdjudicateVoice` | *"Three outcomes, all legitimate: the register is wrong for this genre; the criterion does not belong in this genre; or the block is a stated exception and a reviewer entry records why."* |
| `voice-review` · `Task_Adjudicate` | *"The same three outcomes … fix the prose; scope it on the voice; or the rule applies and this block is an exception."* |
| `src/routes/relevance.ts` | *"writing `human_adjudicated` alongside — never overwriting — the agent's `assessed_by`. Both survive."* |
| `schemas/library/bib-verification.ts` | a discriminated `Verifier` union, agent-only vs human-adjudicated, *"and *also* carry `human_adjudicated` if a human has subsequently"* ruled |

Each restated the same rule because nothing generalised it; this skill is that
generalisation.

## The judgement and its outcomes are separate processes

Callers ask different questions: whether a drift is real, whether a passage is
acceptable, whether two entries agree, which side wins a conflict, whether a
finding stands. Only the QA-criterion question has a criterion to scope or a
dispensation to grant, and a `callActivity` runs the whole subprocess, so the
outcomes cannot live in the shared process. The branches live with the caller,
not in an enum passed to it, because the codes select different tasks: a
caller's `local-wins` would point at `A_ScopeCriterion`.

So the split is **at the judgement**:

| what | where it lives | why there |
|---|---|---|
| entry condition, untainted dispatch, person-or-agent restriction | `adjudication.bpmn` | it must not vary, and restating it per caller is how it drifts |
| the three QA-criterion outcomes, `A_RecordEntry`, the dispensation | `criterion-adjudication.bpmn` | it depends on what was asked |
| a requirements document's sign-off: `approve amend reject defer cancel` (code list `adjudication-requirement-set`), `A_RecordSignoff`, `GW_SignoffRecorded` | `crdm-signoff.bpmn` (`BA_Signoff`), `crdm-close.bpmn` (`BA_Confirm`); spec-kit's adjudicated status by the same codes | the answer moves a requirement SET's stage |

**The requirement-set caller records before it branches.** Every answer goes
to `A_RecordSignoff`, which appends a `requirement-signoff` attestation (the
`attestations` graph, `test/attestations/requirement-signoff/<set>.attestations.json`):
who — `kind`, `id`, `actor`, the QA reviewer's identity fields — when, about
what (the set or one member), the outcome, the stage it moves the set to, the
reason and the permalink to the issue comment. `GW_SignoffRecorded` then reads
the record BACK through `decisions/requirement-signoff-recorded.dmn`, with facts
`check:requirements --signoff-facts <reqset:slug>` computes from the store, so a
sign-off nobody recorded loops back rather than proceeding.

### What that means when you call it

`A_Adjudicate` declares `<cat-harness.processes:adjudication defers="caller"/>` — it IS an
adjudication and the permitted answers are yours. Declared rather than left as
a missing `codes`, so a marker lost by accident and a deferral on purpose do
not parse the same.

- **Asking the QA-criterion question?** Call `Process_CriterionAdjudication`
  and declare `<cat-harness.processes:adjudication accepts="stands scope dispensation"/>`. The
  engine compares your list with what that process actually offers.
- **Asking something else?** Call `Process_Adjudication` and declare
  `<cat-harness.processes:adjudication codes="…"/>` on your own call activity, with your own
  gateway coding the same set. The engine refuses a mismatch between the two,
  and refuses a partly-coded gateway, which reads as complete.
- **Declaring nothing** is legal and **reported** by `check:workflow-refs`.
  Some callers are in that state on purpose: what each should ask is open, and
  guessing would make an undecided thing look checked.

Whatever you ask, `A_RecordEntry`'s rule follows the outcome: **a judgement
nobody wrote down is indistinguishable from a checker that was never run.** It
is `relaxable="false"` wherever it lands, which is with the caller that
records, because the entry written depends on what was adjudicated.

## Two senses of the word, and only one is this

The corpus also uses *adjudicated* as an adjective meaning **settled**:
`evidence-retrieval` calls published DAKs *"already-adjudicated guidance"*, and
`ingest-extract-structure` says extracted candidates are *"never adjudicated
verdicts"*. Both are correct English and neither is this process. Grepping for
the word finds them; only the activity list above is the process.

## What makes a disagreement ADJUDICABLE

Not "somebody is unhappy". `schemas/sdlc/block-qa.ts` already declares the three
reviewer kinds — `script`, `agent`, `human` — and allows **multiple entries per
criterion**, which makes the entry condition computable rather than declared:

| state | what it is |
|---|---|
| **mechanical agreement** | the `script` entry passes |
| **consensus** | entries of different kinds agree on one criterion |
| **adjudicable** | entries for ONE criterion **disagree** |

So you are in adjudication when the sidecar holds two entries for the same
criterion that do not agree. Anything else is a review, a complaint, or a bug
report, and each of those has somewhere else to go.

**A missing entry is not a disagreement.** One reviewer and no checker is a
review; one checker and no reviewer is a gate. Adjudication needs both sides
present, which is why it cannot be entered by an actor simply declaring it —
and why `adjudication.bpmn`'s first gateway leaves the process rather than
guessing.

## The adjudicator is dispatched, not briefed

**This skill does not restate the parties — [`untainted-verification`](untainted-verification.md)
owns them**, and the split matters more here than anywhere else, because the
adjudicator is the party best placed to ruin the measurement:

> **adjudicator** | is given `adjudicator_sees` and the checker's output —
> **never the artefact itself** | produces `pass` / `warn` / `fail`, each drift
> named

An adjudicator shown the artefact can talk itself into any reading of the
finding, and that failure raises no error: it produces a verdict that measured
nothing. `UntaintedDispatch` declares the context per criterion and
`untaintedPartitionDefects` reports `overlap` when both parties can read the
same file. Read that skill before you dispatch one.

## The adjudication LEADS; the checker's entry is KEPT

`voice-review.bpmn`, and this is the rule the whole skill turns on:

> *"The adjudication LEADS the criterion and the script entry is kept beneath
> it: **a disagreement between a checker and a reviewer is information**."*

Do not resolve the disagreement away. Both entries stay in the sidecar, the
human's on top under the sweep's *"most-recent matching-hash entry wins"* rule.
A sidecar showing only the winning answer has lost the fact that a checker read
it differently — which is exactly what somebody re-running the check next month
needs to know.

The same rule holds outside the diagrams: `/api/relevance/adjudicate` writes
`human_adjudicated` *alongside* `assessed_by`, and `bib-verification.ts`
carries the same pair on a discriminated union. Neither shares code with the
diagrams, which is evidence that it is the right rule rather than a local
convention.

This is also the answer to *"adjudication if code and narrative disagree"*:
record the disagreement, lead with the judgement, keep the other entry.

## The dispensation is a VERSION, never a precedent

The outcome carries its reason. That mechanism already exists and is
schema-backed — `block-qa/v1`'s multi-reviewer primitive, documented at length
in `q-usage-watcher` (the science layer):

- a `kind: "human"` entry with `result: "pass"` overrides the script's `fail`
  for the same criterion;
- **only while its `field_hash` matches the current source files**;
- `notes` carries the reason — *"reason for choice as per contextual
  requirements"*.

**That hash gate is the design, not a limitation.** A dispensation is scoped to
the version it was granted against: change the block and it lapses, and must be
re-granted. So a dispensation never becomes precedent, and there is nothing to
overturn later — the source moving overturns it.

A dispensation with no `notes` is not a dispensation. It is an override
somebody applied to get to green, and nobody can review it afterwards. So
`A_Dispensation` is marked `relaxable="false"` in
**`criterion-adjudication.bpmn`**, with `A_RecordEntry`. **The judgement is
free and the record is not**, because a judgement nobody wrote
down is indistinguishable from a checker that was never run.

## Who adjudicates — a skill that spreads, an entitlement that does not

| object | what it is |
|---|---|
| `feedback-provider` (role) | offers a finding — a checker, a review agent, a reader, an SME. **Plural by design**: one or more feedback providers. |
| `adjudicator` (role) | settles it, with a reason. Inherits `reviewer`. |
| `adjudication` (**permission**) | may WRITE the settling entry. |

**Knowing the discipline and being entitled to apply it are different, and the
repository already separates them.** `permissions.json`: *"a permission
CROSS-CUTS roles"*.
Adjudication happens in four lanes bound to four different roles
(`narrative-reviewer`, `translation-adjudicator`, `reviewer`, `user`), so:

- the **skill** is carried by every role whose lane holds an adjudicate
  activity, because each of them has to be able to tell an adjudicable
  disagreement from a complaint;
- the **permission** `adjudication` is held by the actor, alongside
  `review-comments` (*record a finding*) and `approval-authority` (*accept a
  change*). It is neither: settling a disagreement between two findings is not
  reporting one and not accepting the change.

**A reviewer reports; an adjudicator settles.** That is why `review-task.bpmn`
keeps accept-or-send-back in one lane: a process where every reviewer could
settle has no way to say who decided.

`translation-adjudicator` is a specialisation of `adjudicator`.

## Where it sits against its neighbours

| store | holds | skill |
|---|---|---|
| `todos/feedback/` | a person's feedback ON content — the **intake** | [`todo-review`](../../authoring/authoring-core/todo-review.md) |
| `test/attestations/block-qa/` | the adjudicated (non-script) reviewer entries per criterion — the **record**, on `main` | the `qa-*` family; schema `qa-attestations/v1` |
| `test/results/block-qa/` | the derived report, which keeps a **projection** composed from the store; its record is on the `qa-reports` branch | the `qa-*` family |
| `beans/` | the work plan | `todo-manager` (opt-in `cat-harness.work-plan`) |

Adjudication **consumes an intake and writes a record**. It is not a rival to
either, and `todo-review`'s own disambiguation block — which separates itself
from `todo-manager` and is silent about verdicts — is the seam it fits into.

## What this does NOT cover

**The narrative-asserts-code axis.** Whether prose asserts what an artefact
actually does is a different question, currently answered only for Lean
(`proof-narrative-lean-equiv`).
[`code-node-review`](../../kg/kg-core/code-node-review.md) asks whether a NODE is correct — that
it declares what it is, that its references resolve — not whether the prose
matches. This skill does not generalise it.

## Related

- [`untainted-verification`](untainted-verification.md) — the parties and what
  each is given. Adjudication is what happens when they disagree.
- `q-usage-watcher` (the science layer) — the
  dispensation mechanism, documented where it was first applied.
- [`code-node-review`](../../kg/kg-core/code-node-review.md), [`voice-editorial-review`](../../authoring/authoring-core/voice-editorial-review.md),
  `voice-overlay-review` — the reviews that produce
  the findings this settles.
- `schemas/sdlc/block-qa.ts` — the reviewer kinds, and why a model's own claim is
  not the same kind of evidence as a person's.

---
name: evidence-review
description: >-
  Evidence review as an instance of untainted verification — the separation of
  the appraising party from the drafting party, what recurring surveillance in
  a living guideline shares with a stale QA verdict, and which of guideline
  methodology's rules are fenced rather than shipped.
---

# Evidence review — the same rule, a second instance

> Skill id: `evidence-review` · Package: `folio-core`

[`untainted-verification`](../../process/process-core/untainted-verification.md)
states a generic discipline. Evidence review — the appraisal of the evidence
behind a recommendation — is one instance of it; the translation round trip is
another. Two unrelated instances are evidence that the discipline is generic,
where one would only be an example.

## The rule

> The party that drafted the recommendation does not write the evidence
> appraisal for it.

Guideline methodology already separates the **systematic review team** from
the **guideline development group** for the same reason: a party assessing its
own output is comparing a thing with its own paraphrase of itself.

| `untainted-verification` | here |
|---|---|
| producer | whoever drafts the recommendation |
| **checker** — given the artefact, and nothing that would let it shortcut | the appraisal, given the question and the evidence, **not** the draft's conclusion |
| **adjudicator** — given the intent and the checker's output, never the artefact | the evidence-to-decision judgement |

An appraiser shown the drafted recommendation is told the answer before being
asked the question; its *"the evidence supports it"* measures the instruction,
not the literature.

## Recurring surveillance is staleness, generalised

A **living guideline** is updated as evidence appears, so its appraisal is a
verdict with an expiry. A QA verdict is hashed to its subject and stales when
the subject is edited; a living-guideline verdict stales when **the evidence
base changes**, even though the subject did not.

The `field_hash` covers only inputs in the repository; an external corpus is
not covered. Either way, *"verified on DATE against THESE inputs"* is a
different claim from *"verified"*, because a reader given the second cannot
tell a current verdict from a lapsed one. A folio implementing surveillance gives each
verdict an explicit expiry, as
`bean-blocking` (opt-in `cat-harness.work-plan`) does for
a block: a verdict with no expiry cannot be told from an abandoned one.

## The fencing analysis — which rules are the platform's, and which are not

Run through `domain-fencing` (opt-in `cat-harness.kg-ops`)'s three
questions, in order, first-to-answer wins:

| candidate rule | Q1 rationale survives translation? | Q2 domain in mechanism or vocabulary? | Q3 needs the domain installed? | verdict |
|---|---|---|---|---|
| appraiser ≠ drafter | **yes**, word for word | vocabulary | no | **platform** — it IS the spine |
| a verdict carries what it was verified against, and when | **yes** — it is the `field_hash` argument | vocabulary | no | **platform** |
| a finding is upheld by opening the cited source, never by trusting the rule's wording | **yes** | vocabulary | no | **platform** — and already the practice in `voice-who-guideline-development` |
| certainty rated across the GRADE domains | no | **mechanism** | yes | **fence** |
| PICO question formulation | no | **mechanism** | yes | **fence** |
| evidence-to-decision framework tables | no | **mechanism** | yes | **fence** |
| a search strategy is re-runnable — databases, dates, query recorded | yes *in rationale* | **mechanism** is bibliographic | yes | **fence the mechanism**, keep the rationale (it is the row above) |

Three rows are platform rules; the four fenced rows are a folio's methodology,
not a backlog. **Nothing is shipped for the fenced rows** — empty criteria
would let a consumer scan nothing and report a clean run. A folio that wants
them declares them in its own repository.

## What this skill does NOT do

**It asserts no clinical or empirical claim, and the platform must not.** The
mechanism carries *process* — who may rule on what, given what. The evidence
is the folio's and the judgement is the guideline group's; a platform that
shipped a default answer to either would be asserting on their behalf.

## Related

- `untainted-verification` — the discipline. Read
  it first; this skill adds only what evidence review instantiates.
- [`translation-manager`](../../../library/skills/library-core/translation-manager.md) §"The agentic round trip" —
  the other instance.
- `voice-who-guideline-development` in the IRIS replica's style guide — how a recommendation
  is **worded**: the language of normative statements, not the process that
  produces them, which is this skill.
- `domain-fencing` — the three
  questions, and why a fenced rule is correctly located rather than missing.

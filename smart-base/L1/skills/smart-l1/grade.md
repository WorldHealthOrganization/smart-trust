---
name: grade
description: >
  GRADE — the grading system a WHO guideline folio declares for certainty of
  evidence, and the Evidence-to-Decision judgement a recommendation rests on.
  Read when a folio's `Task_AppraiseGrade` runs under GRADE, before recording a
  certainty, an EtD judgement or a recommendation's direction and strength.
---

# grade

> Skill id: `grade` · Package: `authoring-who-smart-guidelines` · The grading
> SYSTEM that [`evidence-appraisal`](../../../../cat-harness/skills/authoring/content-lifecycle/evidence-appraisal.md)
> applies when a folio declares GRADE. Origin: the GRADE Working Group
> (gradeworkinggroup.org); Evidence-to-Decision frameworks per Alonso-Coello et
> al., *BMJ* 2016; WHO applies it through the *WHO Handbook for Guideline
> Development*.

`evidence-appraisal` is the procedure and names no system; the folio declares
one. GRADE applies to certainty of evidence for a **health recommendation**,
over the body of evidence answering one PICO question — not to platform or
architecture decisions, which are `kepner-tregoe`, recorded per `madr`.

**Every value below is a code.** Each vocabulary is a `folio-code-list/v1` in
this layer's `code-lists/`, with a definition and source per code,
published as SKOS beside the glossary. Record a code, never a paraphrase:

| list | codes |
|---|---|
| `grade-certainty` | `high` · `moderate` · `low` · `very-low` |
| `grade-rating-down` | `risk-of-bias` · `inconsistency` · `indirectness` · `imprecision` · `publication-bias` |
| `grade-rating-up` | `large-effect` · `dose-response` · `plausible-confounding` |
| `grade-etd-criterion` | the twelve Evidence-to-Decision criteria |
| `grade-recommendation-direction` | `for` · `against` |
| `grade-recommendation-strength` | `strong` · `conditional` |

## It has a slot waiting

folio-assistant-core's `processes/content/evidence-retrieval.bpmn` frames the
question as PICO, retrieves candidates across three classes, and runs
`Task_AppraiseGrade` — *"Certainty of evidence per the grading system the folio
declares."* GRADE fills that slot when declared; the diagram does not name it.

## Certainty, in four levels

**High · Moderate · Low · Very low** — the certainty that the true effect lies
close to the estimate. Randomised trials start High and observational evidence
starts Low; then:

- **rated down** for risk of bias, inconsistency, indirectness, imprecision,
  publication bias;
- **rated up** for a large effect, a dose-response gradient, or where plausible
  confounding would have reduced an observed effect.

**The grade attaches to the body of evidence per outcome, never to a citation.**
A single paper does not have a GRADE; the BPMN task sits after the join, not
inside the fan-out. Record every rating-down and rating-up with the code that
moved it — a certainty with no reasons cannot be re-examined.

## Evidence-to-Decision: certainty is one criterion of several

A recommendation does not follow from certainty alone. The EtD framework for
clinical and public-health recommendations judges each criterion explicitly:
problem priority · desirable effects · undesirable effects · certainty of
evidence · values · balance of effects · resources required · certainty of the
evidence of required resources · cost-effectiveness · equity · acceptability ·
feasibility (twelve, per Alonso-Coello et al. 2016).

Then a recommendation carries a **direction** (for / against) and a **strength**
(strong / conditional). **Strength is not certainty.** A strong recommendation
can rest on low-certainty evidence when the balance of effects is decisive, and
a conditional one can rest on high certainty when values differ across
populations; hence two code lists, not one score.

## What this platform must not do with it

- **No numeric aggregation of EtD criteria.** The framework judges each
  criterion and argues the recommendation; it does not sum them.
- **`could not determine` is not `very-low`.** Absent evidence and
  low-certainty evidence are different findings with different actions.
  `evidence-retrieval` ends such a case at `EndEvent_GapRecorded` (*"Gap
  recorded, no recommendation"*); `evidence-appraisal` names it a third state.
- **No empirical claim enters a formal proof.** A graded body of evidence
  supports a recommendation, never a theorem. In a paper folio the two live in
  different block kinds and must not be joined.

## Refusals

- **Never grade a single citation.** The body, per outcome.
- **Never report a recommendation without its direction and strength.** One
  without the other is not a GRADE recommendation.
- **Never table it in DMN.** See [`dmn`](../../../../cat-harness/methodologies/dmn.md) — tabling
  asserts a repeatability the method denies.

---
$schema: folio-methodology/v1
name: adequacy-for-purpose-modelling
title: Adequacy-for-purpose modelling — a model is judged against what it is FOR, not against reality
origin: >
  Kavya Ravichandran, "Algorithmic Approaches to Sequential Decision-Making
  and Social Epistemology", PhD thesis, Toyota Technological Institute at
  Chicago, August 2026; arXiv:2607.20636v1 [cs.DS], 22 July 2026. Chapter 5,
  "Why Algorithmic Approaches" — an essay inside the thesis rather than a
  result of it. Open access, ingested whole.

  The view it builds on is Wendy Parker's (2020) "adequacy-for-purpose",
  quoted directly in that chapter; the how-possibly / how-actually distinction
  is from the philosophy-of-explanation literature the chapter cites, and the
  confirmatory / applied prediction split is Elliott-Graves'. Ravichandran's
  contribution adopted here is the ORDERED three-purpose taxonomy and the
  evaluation rule that follows from it.
applies-when: >
  **A formal model is being built, and somebody will later ask whether it is
  right.** Use it when the artefact is a mathematical model of a process —
  agents, action and reward spaces, update rules — and the question is what
  the model is allowed to claim. It answers *what would count as this model
  succeeding*, and nothing else.

  Reach for it BEFORE the model is written, because its whole force is that the
  purpose is declared first and the evaluation follows from it. Reaching for it
  afterwards turns it into a defence of whatever the model happens to do.

  Do NOT reach for it to choose between options (`kepner-tregoe`), to grade
  evidence, to settle a recurring rule (`dmn`), or to pick an algorithm
  (`probabilistic-decision-analysis`, `mcdm-aggregation`). It is not a decision
  method at all: it is a rule for judging a model, and it is filed here because
  `methodology-adoption` routes "how do we evaluate X" to a methodology node.
evidence:
  - library/arxiv-2607.20636v1
---

# Adequacy-for-purpose modelling

**Adopted 2026-09-29**, from the source the owner supplied for the
decision-methodology cluster. It is the one part of that thesis that is a
METHOD rather than a result, and it is the part that bears on how this
repository writes anything formal.

## The rule

> **A model is evaluated against its declared epistemic purpose, never against
> "how accurately it reflects reality".**

Parker, quoted in the chapter: for a model to be adequate-for-purpose *"it must
stand in a suitable relationship not just with a representational target but
with a target, user, methodology, and background circumstances jointly."*

Ravichandran's framing of why this matters: *"I never claim that a model will
be correct in an absolute sense; the processes of abstraction and idealization
inherent to modeling necessarily excise the complexity, and often messiness, of
the real world."* The familiar "all models are wrong, but some are useful" is
taken as the starting point rather than the conclusion — the question becomes
*in which way* is this one useful.

## Three purposes, ordered, and a model must serve at least one

| purpose | what the model must do | how it is judged |
|---|---|---|
| **reproduce** | there exist initial conditions under which the model's outcome matches the observed one | consistency with the observation; it establishes SUFFICIENT conditions, not necessary ones |
| **explain** | posit a mechanism for *why*, modularised so the mechanism can be intervened on | the mechanism should be falsifiable, and must answer both *why the outcome occurs* and *what would change if the setting changed* |
| **suggest intervention** | name a place in the model where a change would move the outcome | utility under resource- and information-poor conditions, not accuracy |

The order is a ladder — each purpose subsumes the one before — and the
chapter's claim is that *"typically, a model should achieve at least one"*.
Reproduction alone is worth something on its own terms: it *"proposes a
sufficient set of conditions under which the phenomenon of interest occurs,
which is valuable even without establishing necessity"*.

## Two distinctions that decide what a model may claim

**How-possibly against how-actually.** A how-actually explanation says this is
how the phenomenon does arise; a how-possibly explanation says only that the
outcome is *not impossible*, giving a mechanism without claiming it is the
operative one. The chapter defends how-possibly explanations as legitimate in
specific circumstances rather than treating them as failed how-actually ones.
**A model that supports only the weaker claim must say so**, and that is the
single most transferable rule here.

**Confirmatory against applied prediction** (Elliott-Graves). Confirmatory
prediction tests a theory and is judged on accuracy and variance; applied
prediction is made in order to intervene and is judged on usefulness where data
and resources are short. They are different products, and a model built for one
is not thereby good at the other.

## What the chapter says models CANNOT do

- **Nothing is evaluable without a declared purpose.** Stated as the first
  caveat: a model can only be judged relative to what it was for, at the level
  of both the overall goal and the specific phenomenon.
- **An unrealistic assumption is not automatically a defect.** The chapter's own
  example is the oracle — ERM oracles are assumed routinely although ERM is
  hard — because an absurd assumption can *"evince structure in a problem that
  gets to the heart of what is difficult"*. So "the assumptions are unrealistic"
  is not a finding on its own; what it costs depends on the purpose.
- The freedom is the point: *"by accepting the limitations of the model, we can
  use it to its fullest in its legitimate setting."*

## What this repository takes, and what it refuses

**Taken.** The declare-the-purpose-first rule, the three-purpose ladder, and the
how-possibly / how-actually distinction as something a model must state about
itself.

**Refused: the thesis's own models are not adopted.** The improving-bandit
results, the pessimism-trap subsidy scheme and the grit model are this author's
research, not a method for anyone else's, and nothing here depends on them.
Their figures are described in `library/corpus/image-verdicts.json` as readings of
charts, never as findings imported into this corpus.

**Refused: this is not a licence to put empirical claims into formal work.** The
chapter is about models of social and algorithmic processes, where an empirical
target exists. A formal mathematical result in a folio has no such target, and
the owner's standing rule — *"I do not want empirical predictions to enter
formal math proofs"* — is untouched by it. If anything this node sharpens that
rule: a how-possibly mechanism is exactly the kind of claim that must not be
laundered into a theorem.

## See also

- [`methodology-adoption`](../skills/process/process-core/methodology-adoption.md) — the
  protocol that routes a question to a methodology in the first place.
- [`consensus-grounded-subject-evaluation`](consensus-grounded-subject-evaluation.md)
  — the same instinct one level down: judge against a declared standard, and
  never let one aggregate stand for the thing being judged.

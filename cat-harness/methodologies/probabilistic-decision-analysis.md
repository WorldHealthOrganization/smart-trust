---
$schema: folio-methodology/v1
name: probabilistic-decision-analysis
title: Probabilistic decision-making algorithms — and what their regret bounds are claims ABOUT
origin: >
  Agustinus Kristiadi (Western University and Vector Institute, Canada),
  "Introduction to the Analysis of Probabilistic Decision-Making Algorithms";
  arXiv:2508.21620v2 [cs.LG], 23 May 2026. A monograph, open access, ingested
  whole. Its stated aim is accessibility: *"theoretical analyses in the
  literature are often inaccessible to non-experts"*, and it assumes only
  basic probability and statistics plus some Gaussian processes.
applies-when: >
  **The alternatives can be TRIED, repeatedly, and what you learn from one try
  changes what you should try next.** Bandits, Bayesian optimisation and tree
  search all live here. The defining features are that the alternative set is
  sampled rather than scored, that information is gathered adaptively, and that
  each trial costs something — the monograph's motivating setting is scientific
  discovery, *"where experiments are costly"*.

  Reach for it also when the question is not which algorithm to run but **what
  an existing bound entitles anyone to say**: the monograph is an analysis text
  first, so it is the right source for reading a regret guarantee rather than
  quoting one.

  Do NOT reach for it for a one-shot choice from a fixed matrix — that is
  `mcdm-aggregation` — nor for a recurring rule (`dmn`), a MUST/WANT decision
  (`kepner-tregoe`), or grading evidence. And do not reach for it when you
  cannot actually run the alternatives: adaptivity is the whole premise, and
  without it every guarantee in the book is vacuous.
evidence:
  - library/arxiv-2508.21620v2
---

# Probabilistic decision-making algorithms

**Adopted 2026-09-29** as one of the three decision-methodology sources the
owner supplied. What is adopted is the **frame** — which family of algorithm
answers which shape of question, and what its analysis does and does not
license — not any algorithm and not any bound.

## The load-bearing distinction, and it comes first in the monograph

Chapter 1 opens on the split between **Bayesian** and **frequentist** decision
theory, with a quotation about practitioners who *"nimbly skip among these
different ideas"* without saying which they are using. That is the frame worth
importing: the two answer different questions.

- **Bayesian** — a prior over the unknown, updated by evidence; the guarantee
  is about *expected* performance under that prior. Thompson sampling and
  Bayesian optimisation sit here.
- **Frequentist** — no prior; the guarantee is *high-probability* and holds for
  any fixed problem instance. Explore-then-exploit and UCB sit here.

An agent quoting a bound has to say which it is, because "regret is bounded by
…" means two different things across that line: an average over a prior nobody
committed to, or a statement that holds with stated probability for the
instance in front of you.

## What the monograph covers, as a map

| part | what it analyses |
|---|---|
| decision theory | Bayesian and frequentist formulations of the same problem |
| concentration inequalities | Gaussian tail bounds and the other inequalities every proof below reuses |
| frequentist bandits | explore-then-exploit, then UCB |
| Gaussian processes | posterior inference, RKHS, information capacity |
| Bayesian optimisation | discrete first, then continuous; GP-UCB high-probability regret, GP-TS expected regret |

Read as a selection aid, the table says the practical question is what you can
assume about the reward surface. A finite unstructured arm set gives a bandit;
a smooth surface over a continuous domain with a kernel you are willing to name
gives Bayesian optimisation; and the GP machinery in the middle is the price of
that smoothness assumption.

## Where this rendering stops

- **No algorithm is implemented or recommended.** The monograph does not rank
  them either; it analyses them.
- **No bound is quoted as a fact about anything here.** Every guarantee in it
  is conditional on assumptions — sub-Gaussian noise, a bounded RKHS norm, a
  known horizon — and a bound repeated without its assumptions is not a weaker
  claim, it is a different and false one.
- **It is a tutorial, not an empirical study.** There is no benchmark and no
  comparison, so nothing in it can support "method X beats method Y".
- **The application domain is not inherited.** Materials and drug discovery are
  the author's motivating examples.

## What it is evidence FOR, here

Chiefly that **"adaptive" is a precondition, not a bonus.** Every method in this
family earns its guarantee by choosing the next trial in light of the last, so
the family is simply inapplicable to a decision that is made once — which is
the cleanest line between this node and
[`mcdm-aggregation`](mcdm-aggregation.md), and the line
`decision-methodology-selector` most needs to be able to draw.

Second, and more narrowly: the Bayesian/frequentist split is a worked instance
of the rule this repository states as *reported, never graded*. Two numbers
that look alike, mean different things, and cannot be compared — the same shape
as `m4xy`'s declared-versus-placed and LCSHBench's exact-versus-concept.

## See also

- [`mcdm-aggregation`](mcdm-aggregation.md) — one-shot ranking from a fixed matrix.
- [`adequacy-for-purpose-modelling`](adequacy-for-purpose-modelling.md) — what a
  formal model of any of this may claim.
- [`decision-methodology-selector`](../skills/process/process-core/decision-methodology-selector.md)
  — the skill that reads these `applies-when` clauses and ranks them.

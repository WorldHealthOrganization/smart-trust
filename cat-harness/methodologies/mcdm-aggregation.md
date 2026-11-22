---
$schema: folio-methodology/v1
name: mcdm-aggregation
title: Aggregation-type MCDM — an alternatives-criteria matrix collapsed to one score per alternative
origin: >
  Zhiyuan Wang (Singapore University of Social Sciences) and Gade Pandu
  Rangaiah (National University of Singapore; Vellore Institute of
  Technology), "Multi-Criteria Decision-Making: Aggregation-Type Methods",
  Chapter 8 of a forthcoming volume; arXiv:2509.06388v1, 2026.

  **The copy ingested is the authors' preliminary draft manuscript**, produced
  in Word and carrying no arXiv stamp, headed "Preliminary Draft Manuscript"
  and paginated 8-1 onward. `_pdf_doc_id.py` reads the arXiv id off page one's
  text layer, so this copy derived no `arxiv-` slug and fell back to the
  basename. Filed instead under the author-year convention the repository's
  other non-arXiv entries use (owner, 2026-09-29), which is why the bib-slug
  and the citation differ: **cite arXiv:2509.06388v1**; the slug is a filing
  key and nothing more.
applies-when: >
  **A FIXED, FINITE set of alternatives is to be ranked against several
  explicit criteria, all known up front.** The input is an
  alternatives-criteria matrix: every alternative scored on every criterion,
  with weights obtainable. The output is a ranking. Use it when the decision is
  made ONCE, from data already in hand.

  Choose within the family by what you can supply. SAW and MEW need only
  weights and normalised scores. AHP needs pairwise comparisons, which grow as
  the square of the criteria count, and gives a consistency ratio in return.
  ANP needs those plus the interdependence structure, and is the only member
  that admits feedback between criteria. COPRAS, MOORA, FUCA and WASPAS sit
  between SAW and AHP in what they ask for.

  Do NOT reach for it when the alternatives are explored REPEATEDLY and
  information accrues as you go — that is `probabilistic-decision-analysis`.
  Do not use it for a recurring rule (`dmn`), for a decision whose criteria are
  MUSTs and WANTs rather than weighted scores (`kepner-tregoe`), or for grading
  evidence. It also assumes the criteria set is complete: a criterion nobody
  wrote down is weighted zero, silently.
evidence:
  - library/wang-rangaiah-2026-mcdm-aggregation
---

# Aggregation-type MCDM

**Adopted 2026-09-29** as one of the three decision-methodology sources the
owner supplied, and rendered as a FAMILY with a selection rule rather than as
eight separate adoptions — which is what
[`decision-methodology-selector`](../skills/process/process-core/decision-methodology-selector.md)
needs from it.

## The load-bearing idea

> **Convert an alternatives-criteria matrix into a single performance score per
> alternative, by additive, multiplicative or hybrid manipulation, and rank on
> that score.**

Every method in the family differs only in *how* the collapse is done and *what
it asks you to supply first*. The chapter's own list of eight: Simple Additive
Weighting (SAW), Multiplicative Exponent Weighting (MEW), Analytic Hierarchy
Process (AHP), Analytic Network Process (ANP), Complex Proportional Assessment
(COPRAS), Multi-Objective Optimization on the basis of Ratio Analysis (MOORA),
Faire Un Choix Adéquat (FUCA) and Weighted Aggregated Sum Product Assessment
(WASPAS).

## AHP and ANP are the pair worth understanding, because they differ structurally

The chapter illustrates each method on one worked numerical example and shows
the software output. Two of its figures carry the distinction that actually
changes which method applies, and both are described in
`library/corpus/image-verdicts.json`:

- **AHP assumes a strict hierarchy** — Goal over Criteria over Alternatives,
  edges drawn without arrowheads, every criterion joined to every alternative
  (Figure 8.1). Its supermatrix has non-zero entries only where the hierarchy
  allows them; everything else is exactly 0.000000 (Figure 8.2(b)).
- **ANP admits feedback.** The same problem redrawn (Figure 8.3) gives every
  edge an arrowhead and joins the criteria to ONE ANOTHER with dash-dot
  double-headed arrows, and the alternatives point back up into the criteria.
  Its supermatrix is correspondingly non-zero off the hierarchy's diagonal
  blocks (Figure 8.4(a)), and the answer is read off the LIMIT supermatrix
  (Figure 8.4(b)), where every column has converged to the same vector.

So the question that picks between them is not effort: **is there feedback
between your criteria?** If there is, a hierarchy cannot express it; if there
is not, ANP costs more for nothing.

## Where this rendering stops

- **No method is implemented here, and none is endorsed over another.** The
  chapter is a tutorial: it presents eight methods with worked examples and
  does not rank them. Reporting one as best would be this node's opinion.
- **No numbers are adopted.** The figures' values are one worked example with
  three or four criteria and two to four alternatives, run in SuperDecisions.
  They illustrate an algorithm; they measure nothing.
- **The software is not adopted.** SuperDecisions is the chapter's tool, not an
  obligation, and several of its figures are screenshots of that application.
- **The draft status is inherited.** This is a preliminary manuscript, and
  where it and the published chapter differ the published chapter is right.

## The caveat that matters most for an agent

Aggregation methods are **total by construction**: every alternative gets a
score, so one always wins. Nothing in the family reports "these two are not
distinguishable on this evidence", and nothing reports that a criterion was
missing.

And the choice of method is itself load-bearing. The chapter's own abstract
promises *"a consolidated summary [that] shows how different methods can lead
to variations in the final rankings"* — so a ranking is a joint product of the
matrix, the weights AND the method, and reporting one without naming the method
states a conclusion the evidence does not carry on its own. That is the opposite of the three-state discipline the rest of this
repository keeps, and an agent handing a ranking to a person should say which
of the top scores are within the noise of the weights that produced them —
the chapter does not, because it is teaching the algorithms.

## See also

- [`kepner-tregoe`](kepner-tregoe.md) — the same shape when the criteria are
  binary MUSTs plus comparative WANTs rather than weighted scores.
- [`probabilistic-decision-analysis`](probabilistic-decision-analysis.md) —
  when the alternatives can be sampled repeatedly instead of scored once.
- [`dmn`](dmn.md) — when the decision recurs and should be a table.

---
$schema: folio-methodology/v1
name: kepner-tregoe
title: Kepner-Tregoe Decision Analysis
origin: Charles H. Kepner and Benjamin B. Tregoe, *The Rational Manager* (1965); *The New Rational Manager* (1981)
applies-when: >
  A decision with several candidate options and no recurring rule — a platform
  choice, an architecture question, which of three fixes to take. Contextual, not
  default: if the criteria recur, use `dmn`; if the question is certainty of
  evidence for a recommendation, use `grade`.
---

# Kepner-Tregoe Decision Analysis

**Adopted whole, 2026-09-20.** External method, rendered faithfully. Where this
text and the published method differ, the published method is right and this file
is wrong.

## The four steps

1. **State the decision.** One sentence naming the *kind* of thing being chosen,
   not the options. "Which cache strategy" — not "A or B".
2. **Separate MUSTs from WANTs.** A **MUST** is binary and mandatory: an option
   that fails one is eliminated, not penalised. A **WANT** is desirable and
   comparative.
3. **Evaluate.** MUSTs first, as a filter. Then WANTs across the survivors.
4. **Assess adverse consequences** of the leading option, and only then decide.

## What this platform adopts, and what it does not

**Adopted: the MUST/WANT split, and the adverse-consequence pass.**

A MUST is a real filter and needs no arithmetic — it kills an option outright, and
saying *why* it was killed is the record. This is the step that makes an options
analysis honest: most options die on a MUST, and an analysis that scores every
option on every axis hides that.

The adverse-consequence pass is the same act as
[`opening-brief`](../skills/conduct/conduct-core/opening-brief.md)'s *"what would falsify
the approach"*, arrived at independently. Asking it of the **leader** specifically
is KT's contribution: the option you are about to take is the one whose failure
mode you have thought about least.

**Not adopted: WANT weighting.**

KT scores each WANT 1–10 for importance, scores each option 1–10 against it, and
sums the products. **This platform does not.** The weights are invented, and the
arithmetic converts a judgement into a number that reads as a measurement — a
total of 7.4 against 6.9 looks like evidence and is not. That is the same failure
as a count quoted from prose, which
[`uses-editorial-review`](../skills/authoring/authoring-core/uses-editorial-review.md) and the
`kg:audit` reading rules already refuse.

So WANTs are **stated and compared in prose**, and the comparison says which way
each cuts. If two options survive every MUST and the WANTs genuinely do not
separate them, that is the finding — say so, and let the decision be made on
something else, rather than manufacturing a tiebreak.

## The shape of the output

MUSTs, the options each one eliminated, the surviving options with their WANTs
argued rather than scored, the leader's adverse consequences, and the decision.
Recorded per [`madr`](madr.md) when the context is a work item.

## Refusals

- **No weighted totals.** See above.
- **No option added to make a set look considered.** A straw option is worse than
  two real ones: it makes the analysis look thorough while narrowing it.
- **An option eliminated on a MUST is recorded, not dropped.** The next agent
  needs to know the dead end was entered deliberately — the same reason a work item is
  `scrapped` rather than deleted.

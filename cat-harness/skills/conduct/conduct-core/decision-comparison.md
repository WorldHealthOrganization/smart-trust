---
name: decision-comparison
description: >
  Lay a decision out as a comparison before you ask it — what each option does,
  its pro, its con, what it changes downstream, and how reversible it is — in
  the prose that precedes the question, never inside the option labels. Required
  whenever a choice is handed to a person.
---

# The comparison goes BEFORE the question, not inside the options

[`interaction-modality`](interaction-modality.md) §4.1 fixes the *order* —
context → options → recommendation → question — and requires each option to
carry what it costs. This says what "the comparison" has to contain, and where
it has to live.

**Not to be merged with [`decision-audit`](../../process/process-core/decision-audit.md).** That records
why a decision *was* made, after the fact, and governs overruling a QA finding.
This is about what a person is shown *before* they decide; a skill that tried
to be both would be read at the wrong moment.

## Why not in the option descriptions

A selection tool gives each option a short label and a short description. The
trade-offs do not go there:

1. **A reader sees one option at a time**, and a comparison is reading the rows
   *against each other*.
2. **There is no room.** Every trade-off gets compressed to its headline, and
   the second-order consequences are the first thing cut.
3. **It cannot be re-read.** The preamble stays in the transcript; a focused
   option label does not.

## What a comparison contains

Per option, five things:

| | |
|---|---|
| **What it does** | the mechanism, in one line |
| **Pro** | what it buys, stated as a benefit rather than an absence of harm |
| **Con** | what it costs to *do* |
| **Downstream impact** | what it changes for everything else, afterwards |
| **Reversibility** | how expensive it is to undo once taken |

Then, once, for the set: the **recommendation with its reasoning**, and the
**default** that applies if nobody answers.

### Cost and downstream impact are different

**Cost** is what the change takes: files touched, tests to rewrite, hours.
**Downstream impact** is what the world looks like afterwards: what becomes
easy, what becomes hard, what a future contributor now has to know, which other
decisions are now foreclosed or forced.

A cheap change with a large downstream impact reads best when only cost is
shown. Say both, separately.

### Reversibility

`opening-brief` triggers on **irreversibility and surprise**
rather than size, and the same measure applies here. Two options with identical
cost and impact are not equivalent if one can be undone in an afternoon and the
other is load-bearing within a week. State it per option.

## Where it lives

**In the prose that precedes the question.** A table is usually right — the
columns above are a table's columns, and a table is the one layout that shows
rows against each other.

**The options in the selection tool are then LABELS for choices already
explained.** A label names the option and, at most, restates its headline. A
reader who has read the preamble should be able to choose from the labels alone;
a reader who has not should find nothing new hiding in them. If the labels are
where the information is, the comparison was never made.

## When this does not apply

**A small, reversible choice does not earn a table**: the reader would pay
attention for something that did not need it. The trigger is the same as `opening-brief`'s: would getting this wrong be
expensive or surprising? If no, recommend and proceed.

**One-option "decisions" are not decisions.** If the honest comparison has one
viable row, do not manufacture alternatives to fill a table. Say what you are
doing, say why the obvious alternative loses, and proceed.

## Done properly, it also answers the count rule

`interaction-modality` §4.1 requires that with several decisions open you ask
**one in full and give a count for the rest**. A full comparison is what "in
full" means. The rest get a number, never a row from a table they cannot see.

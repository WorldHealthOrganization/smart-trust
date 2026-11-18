---
$schema: folio-methodology/v1
name: rasci
title: RASCI — RACI plus Supportive, for when doing the work and owning it come apart
origin: >
  **NOT ESTABLISHED FROM ANY SOURCE HELD HERE, and that is stated rather than
  guessed.** RASCI (also written RASIC) is the five-letter member of the
  responsibility-assignment-matrix family from project-management practice. No
  text for it is ingested in this repository and none was reachable when this
  node was written. The one RACI source this checkout does hold —
  `library/dusengumuremyi-2026-ai-mediated-raci` — was searched and contains
  ZERO occurrences of `rasci`, `racsi`, `supportive` or `five roles`, so it
  backs `raci` and expressly not this. The candidates are the same paid
  standards and books listed in `raci`'s §"The primary is still not held".
  See `literature-search`.
applies-when: >
  **Who is involved, when a role does the work without owning the
  deliverable.** Use it where a separate *Supportive* party is real — someone
  who contributes effort or resources to an activity that another role answers
  for. **If no such party exists, use `raci` instead**: a fifth letter nobody
  fills is a column that makes the chart look more considered than it is. Like
  `raci` it answers *who*, never *what* or *whether* — a one-off choice among
  options is `kepner-tregoe`, a recurring rule is `dmn`, certainty of evidence
  is `grade`, the record of a decision is `madr`, situation analysis is `swot`.
---

# RASCI — the fifth letter, and when it earns its place

**Adopted on the owner's ruling, 2026-09-23** (issue #1004), as a **parallel
track to `raci`, not a replacement for it.** `methodology-adoption`: *"Two or
more methodologies may answer the same question. Do not blend them… pick one
per decision, name it, and follow it."* A process here declares which it is
written in, and declaring nothing means `raci`.

> ## ⚠ This rendering is not backed by a source
>
> No RASCI source is ingested here, and nothing below is asserted on a
> source's authority. What follows is the method as commonly understood —
> weaker than a cited rendering, and marked as weaker on purpose.
>
> `check:methodology-evidence` reports this node as unbacked, correctly.
> **Do not remove that finding by pointing `evidence` at the RACI paper.** It
> was searched: zero occurrences of `rasci`, `racsi`, `supportive` or `five
> roles`. Citing it here would be the failure `methodology-adoption`
> §"Never write a method from recall and cite a paper nobody fetched" names,
> made worse by the citation being checkably about something else.

## The five letters

| letter | means | direction |
|---|---|---|
| **R**esponsible | does the work | may be several |
| **A**ccountable | carries the decision; answers for the outcome | **exactly one** |
| **S**upportive | contributes effort or resources to the work, without owning the deliverable | may be several |
| **C**onsulted | asked for input **before** | two-way |
| **I**nformed | told **after** | one-way |

Four of these are `raci`'s and are not restated here — the node is
[`raci.md`](raci.md), including the exactly-one-Accountable constraint, which
RASCI inherits unchanged.

## What S is, against its two neighbours

**S is not a weaker R.** The line is ownership of the deliverable, not quantity
of effort: a Supportive party may do more work than the Responsible one and
still be S, because the deliverable is not theirs to hand over.

**S is not a Consulted who happened to help.** C is asked for input and gives
an opinion; S does work. Collapsing them is the same error as collapsing C into
I — it turns a contribution into a conversation, and the chart still reads as
complete.

**The test:** if this role stopped participating, would the activity be
*late* (S), or merely *less well informed* (C)? A role whose absence changes
nothing but opinion was never S.

## When NOT to use it

A five-letter chart where every S column is empty is worse than a four-letter
one, because it advertises a distinction the author did not actually make.
**The fifth letter is justified by a Supportive party existing, not by wanting
a more complete-looking matrix.** `raci` remains the default here for exactly
that reason.

## How this platform applies it

**`S` is declarable; `R` still is not** — and the asymmetry is structural
rather than an omission.

A BPMN activity sits in **exactly one lane**, and that lane is Responsible. So
the lane is a discriminator, not a description: R is the owning lane, S is a
declared role that is not it, and no case can be both. This was checked against
the corpus before the letter was added — **no activity anywhere declares
`involvement="responsible"`** — so the premise holds and S inherits no
ambiguity from it.

It buys real expressiveness rather than a letter for its own sake: **BPMN
cannot place one activity in two lanes**, so before this there was no way to
say *"this role also does the work here"*.

A process opts in:

```xml
<bpmn:process id="Process_X">
  <bpmn:extensionElements>
    <cat-harness.processes:involvement vocabulary="rasci"/>
  </bpmn:extensionElements>
```

and may then declare `<cat-harness.processes:raci ref="<role>" involvement="supportive"/>`. In
a process that has not opted in, a `supportive` is a **reported breach** —
neither coerced to a neighbouring letter nor silently dropped. That refusal is
what makes this a choice rather than a spelling rule; `check:raci` and the
`raci-involvement-vocabulary` QA criterion carry it, and the skill
[`skills/process/raci/raci.md`](../skills/process/raci/raci.md) holds the platform overlay both
vocabularies share.

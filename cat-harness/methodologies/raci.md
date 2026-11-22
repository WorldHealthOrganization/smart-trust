---
$schema: folio-methodology/v1
name: raci
title: RACI — who is involved in an activity, and in which of four ways
origin: >
  **NO PRIMARY SOURCE IS HELD HERE, and the ingested one is SECONDARY.** RACI
  is a responsibility assignment matrix from project-management practice. The
  text this node cites renders the four roles but does not originate them — it
  attributes them onward to PMI's *PMBOK Guide* (2021), which is a paid
  standard nobody here has opened. The earlier Linear Responsibility Chart
  literature is the other commonly named ancestor. Both stay in §"The primary
  is still not held" as CANDIDATES TO FETCH, unverified, rather than asserted
  here as provenance. Rendering from an open secondary was the owner's ruling
  of 2026-09-23 — the route `swot` took. See `literature-search`.
evidence:
  - library/dusengumuremyi-2026-ai-mediated-raci
applies-when: >
  **Who is involved in an activity, and how.** Use it when a process or a
  breakdown exists and the question is participation — who answers for this,
  who must be asked first, who is told afterwards. Not a decision method: a
  one-off choice among options is `kepner-tregoe`, a recurring rule is `dmn`,
  certainty of evidence is `grade`, the record of a decision is `madr`, and
  situation analysis before any of them is `swot`. RACI answers *who*, never
  *what* or *whether*.
---

# RACI — involvement, in four kinds

**Adopted on the owner's ruling, 2026-09-22** (work item `2xfl`): RACI is a
methodology, not a house practice, so it has a node here. Until that ruling it
existed only as a skill, and the methodology graph reported five nodes where a
reader might reasonably expect it to report this one too.

> ## ⚠ The cited source backs ONE sentence of this node, and nothing else
>
> `evidence` points at Dusengumuremyi (2026), ingested 2026-09-23. It earns
> its place **only** as a secondary rendering of the four roles — its §2.1,
> verbatim from `sections/page-002.md`:
>
> > a classic project management instrument delineating four roles:
> > Responsible (doer), Accountable (owner), Consulted (input provider), and
> > Informed (notified).
>
> **Everything else in that paper is rejected, and the rejection is
> load-bearing rather than fastidious.** Its own Data Availability statement
> reads *"No new datasets were generated or analyzed during this study"* while
> its abstract claims 1,247 decision events and its §4.1 reports
> `t(1245)=47.3, p<.001`; its abstract's headline 92.4 % detection rate appears
> nowhere in its findings, which say 78.4 %; and its running head claims
> *Journal of International Business Studies* "Vol. 1, 2026" while its own
> reference list cites that journal at vol. 53 in 2022. Work item `thb1` holds the
> full assessment with every item checkable against the ingested pages.
>
> So: **cite this source for the four letters. Never cite it for a claim about
> what RACI achieves.** No efficacy, latency, error-rate or risk-detection
> statement anywhere in this repository may rest on it.
>
> That split is why `evidence` here is not the same kind of backing `swot` has.
> `swot` rests on two sources that survive reading whole; this rests on one
> paragraph of one paper that does not. `check:methodology-evidence` counts
> nodes with a resolvable source and will now count this one — the axis
> measures whether a citation resolves, not whether a reader would accept it,
> and conflating those is what this box exists to prevent.

## The four letters

| letter | means | direction |
|---|---|---|
| **R**esponsible | does the work | may be several |
| **A**ccountable | carries the decision; answers for the outcome | **exactly one** |
| **C**onsulted | asked for input **before** | two-way |
| **I**nformed | told **after** | one-way |

The axis that makes it a method rather than a list is **time and direction**:
C happens before and is a conversation; I happens after and is a broadcast.
Collapsing them turns consultation into notification, which is the failure the
letters exist to keep apart.

## Exactly one Accountable

The method's central constraint, and the one most often broken in practice. A
chart with two A's does not record a shared decision — it records that nobody
established who answers for the outcome, and it reads as complete while doing
so.

**Zero is also a breach**, once a row claims anything at all. A half-filled row
is worse than an empty one for the same reason: the chart looks answered.

**A row where the same party is both Accountable and Consulted is not a row
with two facts in it.** Asking yourself is not consultation, and that pairing
is how *consulted* becomes a formality while the chart still reads complete.

## What RACI is not

- **Not a decision method.** A is who answers for a decision, not how it is
  reached. Reaching it is `kepner-tregoe` or `dmn`; recording it is `madr`.
- **Not an approval gate.** Answering for an outcome and signing off on one are
  different acts, and a method that conflated them would let a chart stand in
  for a gate.
- **Not a permission model.** What a party may *do* in general is a different
  question from who is involved in this activity, and the two cross-cut.
- **Not a party registry.** RACI names roles in rows; it does not establish who
  exists. Something else has to say that first.

## The primary is still not held

A secondary rendering is cited above; **the primary is not, and the gap has
narrowed rather than closed.** `literature-search`'s outcome 3, recorded so the
next agent does not repeat the search: nothing was found because nothing could
be fetched. Measured 2026-09-22 — `doi.org`, `pmi.org` and every open-access
aggregator fail through this container's proxy; only `raw.githubusercontent.com`
answers.

Candidates worth fetching, **unverified and listed as leads rather than as
provenance**:

| candidate | why it is a candidate | access |
|---|---|---|
| PMI, *PMBOK Guide* — the responsibility assignment matrix (RAM) | the most commonly cited formal treatment | not open access |
| The Linear Responsibility Chart literature (Cleland & King and successors) | commonly named as the earlier form RACI descends from | books, not open access |

**RACI and `kepner-tregoe` were in the same bucket, and RACI has left it.** For
both, the commonly cited sources are books and paid standards, so no
open-access primary exists to fetch, and closing the gap needed either a copy
or a decision to render from an open secondary — the route `swot` took. The
owner made that decision for RACI on 2026-09-23. **`kepner-tregoe` is still in
the bucket**, and the same two exits are still open to it.

## How this platform applies it

**As an overlay on declarations that already exist**, never as a new table of
names — and R is *read* rather than declared, because a BPMN lane already says
who performs an activity.

That application, its three declared edge kinds, the `cat-harness.processes:raci` extension
element, the `check:raci` gate, and the procedure for running a RACI exercise
when initiating a project are in the skill:
[`skills/process/raci/raci.md`](../skills/process/raci/raci.md). The method lives here once;
the skill names it and does not restate it.

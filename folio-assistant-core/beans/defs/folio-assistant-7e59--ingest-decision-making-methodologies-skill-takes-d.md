---
# folio-assistant-7e59
$schema: bean/1.0.0
title: 'INGEST: decision-making methodologies — skill takes decision context as input, outputs ranked applicable methods with criteria and rationale. Source: qou bd0c2cb7 (3 arxiv PDFs: 2508.21620 probabilistic/bandits, 2509.06388 MCDM/AHP/SAW, 2607.20636 sequential/social). Covers all methodology families with when-to-use criteria.'
status: completed
type: task
parent: folio-assistant-slw1
created_at: 2026-09-25T15:38:03Z
updated_at: 2026-10-07T17:37:00Z
---

## Body added by a gate fix, not by this bean's author

**This is not the author's scoping.** `check:bean-bodies` was red on `main`
with `[empty-body]: "todo" with front matter and nothing else — a sibling
reading the store learns nothing about it`, and `check:bean-parents` was red
because this bean carried no `parent:`. Both were fixed here as part of
clearing `main`'s red gates, on the owner's "merge go". The author of this
bean should expand or replace everything below; nothing in it is a decision
about the work.

## What the title already says, unpacked so the store is readable

A skill that takes a **decision context** as input and returns the
**applicable methodologies, ranked**, each with its selection criteria and the
rationale for the ranking — rather than one methodology asserted as correct.

Sourced from `litlfred/qou` commit `bd0c2cb7`, three arXiv papers:

| arXiv | family |
|---|---|
| 2508.21620 | probabilistic methods, bandits |
| 2509.06388 | MCDM — AHP, SAW |
| 2607.20636 | sequential and social choice |

The title states the coverage claim: *"covers all methodology families with
when-to-use criteria."*

## What landed with it, and what did not

`cat-harness/skills/process/process-core/decision-methodology-selector.md` is on `main`.
Four things that should have accompanied it did not, and each was its own red
gate:

- it was absent from `skills/folio-core/package-manifest.json`, so
  `skill-manifest-coverage` failed;
- it had no generated reference page, so `skill-coverage` failed;
- its `kg-qa` sidecar had never been written, so `declared-directory-resolves`
  saw the tree go dirty on import;
- this bean had no parent, so `check:bean-parents` failed.

All four are generated or declared siblings of one authored file. That is the
shape worth noting for whoever picks this up: the skill itself is fine; what
was missing is everything that makes it *findable*.

## Done when

- [ ] The author replaces this body with the real scope.
- [ ] The skill's ranking output has a schema, or a stated reason it does not.
- [ ] The "covers all methodology families" claim is checked against the three
      sources rather than asserted.

_2026-09-30T00:16:22Z_ — Claimed by claude/magical-dijkstra-19yvml — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Completed on landed evidence
Landed on main in PR #1344 (Decision methodology selector — skill + schema and decision-making methodology ingest).

---
layout: default
title: Detangle
nav_order: 42
lang: en
---

# detangle

> Run it with `bun run cat kg:detangle`. The governing skill is
> [`graph-detanglement`](../../skills/kg/graph-management/graph-detanglement.md).

**Is this candidate subgraph really a subgraph?**

A candidate subgraph is a large collection of thematically related content that
is disconnected (maybe after some light detangling) from the rest of the
knowledge graph: the rest of the graph references it, and the **arrows run
mostly one way**.

That is **not** "a small cut". A candidate is a near-**sink**: the rest of the
graph depends on it, and it depends on almost nothing outside itself. Ten edges
in and ten out is a cut of twenty and cannot be lifted; fifty in and zero out is
a cut of fifty and lifts cleanly. An agent optimising for a small cut is
answering a different question.

## Nothing here decides anything

The scanner is a **mechanical reviewer**. It emits findings with a `script`
reviewer and a `severity`, in the shape `schemas/qa-review.ts` defines, and it
has no opinion about whether to carve. The carve is a `Decision` by a human or
agentic adjudicator, and it may overrule any finding here — a theme a scanner
cannot see is a real reason, and so is a boundary somebody intends to enforce
before the edges exist to prove it.

So do not carve a subgraph because the numbers look good, and do not argue that
a carve is wrong because they look bad. The numbers make the adjudication
**reviewable**: *"carved anyway, cohesion 0.31, because X"* is a durable claim
somebody can disagree with later.

## Running it

```sh
bun run cat kg:detangle
bun run cat kg:detangle --group cat-harness/processes
bun run cat kg:detangle --json
```

## Four roles, because "one way" does not mean "inward"

`oneWayness` (inbound share) scores **0.0** both for a group with fifty edges
each way — genuinely tangled — and for one with zero in and many out, which is
as one-way as a boundary can be. The measure is therefore direction-blind:

```
directionality = |2 · oneWayness − 1|
```

| role | arrows | how it separates |
|---|---|---|
| **sink** | in ≫ out | lifts out as a **dependency** — others declare they need it |
| **source** | out ≫ in | lifts out as a **dependent** — it declares what it needs |
| **tangled** | both, comparably | not separable without real work. The only role the word fits. |
| **isolated** | none | trivially separable, and *not* the same as tangled however alike a bare `oneWayness` of 0.0 looks |

## Arrows: is the direction even a fact?

Every cross-group edge is one of two kinds:

- **`enforced`** — reverse it and something breaks. A TypeScript `import`, a
  BPMN `calledElement`. The direction is a property of the system.
- **`recorded`** — the direction is *where the author put the pointer*.
  `<bootstrap.processes:skill ref="S">` is written on the diagram, so the arrow
  runs diagram → skill. Had the skill named its diagrams instead, the identical
  coupling would be stored the other way.

The test is **what breaks each way**. Delete a skill and `roles.json` has a
dangling ref; delete `roles.json` and every skill still works but no lane can
reach one. Both break — the coupling is **symmetric** and merely written down
once, on one side.

So `role` is read off **enforced edges alone**, and a boundary made only of
recorded ones is `undetermined`, because where a fact is recorded determines what
a metric over it means. Before you treat a direction as a fact, check
whether it is a filing decision.

## Reach is counted in groups, not references

The "light detangling" clause counts distinct target *groups*, which is what a
declared dependency list would hold. One skill referenced from 36 diagrams is
one dependency stated 36 times, not 36 problems.

## What it extracts

- **Four extractors**: `md-link`, `bpmn-skill`, `json-skill`, `ts-import`.
  BPMN `<bpmn:import>`, `calledElement` and `decisionRef` are extracted as
  edges. A skill ref resolves only to a skill, never to a diagram of the same
  basename. There is no full-text extractor — a skill that *mentions* another
  in prose is not depending on it. Under-counting makes a group look cleaner
  than it is, so the extractor list is printed with the results.
- **Dangling references** — to a node outside the scanned set — are reported
  separately and are *not* counted as outbound edges, because counting one
  would make a group with a broken link look entangled, which is a different
  finding calling for a different fix.
- **Only `wrong-direction` is classified mechanically**, by the same function
  `repo-partition.ts` uses on the module graph
  (`cat-harness/schemas/layer-direction.ts`). Here a node's layer is its
  layer, and what it may reach is its declared `needs` plus itself. The
  report's `wdir` column counts wrong-direction outbound edges and `undet`
  counts edges whose source layer declares no `needs` — undetermined, not
  clean. `restatement` and `essential` stay `unclassified`: they are the
  adjudication, and `--group` prints each edge's basis so the adjudicator
  starts from it. These counts are reported, not pinned; the pinned
  measurements are size, cohesion and authority counts.

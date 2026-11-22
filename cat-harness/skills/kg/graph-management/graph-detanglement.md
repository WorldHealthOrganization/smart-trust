---
name: graph-detanglement
description: >-
  Drive a tangled graph toward a clean partition, so a sub-graph can be split
  off when it grows too large or when a business reason separates it. The
  staged practice — declare in place, detangle, isolate, extract — and the
  seventeen moves for measurement, ordering, judgement and enforcement.
---

# Graph detanglement — the practice, not the migration

> Skill id: `graph-detanglement` · Package: `graph-management`

A repository grows until part of it wants to leave. Sometimes the reason is
size, sometimes it is semantic — *"split only where consumers or cadences
differ"* (`docs/concepts/architecture/migration-plan.md`). Either way the move is the
same and the mistake is the same: treating the split as a **migration** to be
executed rather than a **practice** to be run.

This skill is the practice. Its subject is any graph with directed edges whose
nodes are being partitioned: TypeScript modules into repositories, blocks into
chapters, skills into packages.

## The one rule, at four scales

**At block scale** — `pipeline/qa-criteria-registry.ts`, the
`detangler-no-dependency-cycle` criterion:

> "a cycle is reorder-invariant — when two blocks each `uses:` the other, or a
> longer loop closes, **NO chapter ordering removes the forward edge**. A cycle
> signals a genuine structural tangle: **prune one dependency edge, merge the
> mutually-defining blocks, or factor the shared content into a third block
> both depend on**."

**At repository scale** — `scripts/repo-partition.ts`, the gate's own failure
message:

> "A repo may not import one that depends on it. Either the CLASSIFICATION is
> wrong — **check the target's layer before the importer's** — or the import
> is."

**At knowledge-graph scale** — `kg-detangle.ts` (`bun run cat kg:detangle`),
over the layer stack each `<instance>.json` declares in `needs`.

The repository and knowledge-graph scales share ONE verdict function,
`schemas/kg/layer-direction.ts`. An edge is **wrong-direction**
exactly when its target layer is not among what the source layer declares it
may reach — `ALLOWED` for repos, `needs` plus itself for layers — and no
reasoned permit names it. A layer with no `needs` is **undetermined**,
reported in its own column, never read as clean. The function stops at
direction: whether an allowed edge is a *restatement* or *essential* is the
adjudicator's call, so those edges stay `unclassified` with the verdict as
their basis.

**The direction count is the one detangle number that is GRADED**, and it is
graded in a gate of its own — `bun run cat kg:detangle:direction`, blocking in
CI. Everything else
this tool measures stays **pinned**: `kg:detangle:check` fails on a stale or
orphaned sidecar and never on a number, because the carve is an adjudication a
person makes and grading it would be the tool overruling the adjudicator.

A module's **bucket** is taste. An edge whose target layer is not among what
the source layer's `<instance>.json` says it may reach is a **contradiction
between two declarations**, which no adjudication makes consistent, so it is the
one thing here a machine may refuse. Two flags, two scripts, two CI steps, so a
red run says which question broke.

Two things that gate **reports and refuses to grade**, both because grading them
would be grading a could-not-determine:

- **`undetermined` edges** — an endpoint's layer declares no `needs`. Failing
  on these would be the gate deciding a layering nobody declared.
- **the denominator** — the count is over the edges that **resolve**. Dangling
  refs are excluded before any edge is classified, so a `0` is *"0 among the
  edges that resolve"*. The gate prints the excluded count and its breakdown, so
  a pass cannot hide an edge that failed to resolve.

**It is not `check:partition`'s second opinion.** That tool's root is one
layer, so it partitions a **future** layout by path rule among that
layer's own modules; this checks the **present** layout against declared
`needs` across layers. Either can be green while the other is red, and
Phase I.1 of the migration plan needs both.

**At term scale** — a glossary declared `ordered` (logically tight, non
self-referential). Each term's
`requires` must point UP, and `checkDeclaredOrder` in
`schemas/kg/dependency-order.ts` names every forward, self and missing use. It is
the block-scale rule with terms for blocks: a forward `requires` is a forward
edge, and two terms defined by each other are a cycle **no ordering removes**,
so the moves are the same three — drop the use, merge the two terms, or factor
the shared idea into a term above both. The rule and its form on the page are
in `glossary-terms` §"Ordered glossaries".

Same rule, four scales, two vocabularies. **Prune, merge, or factor into a
third** are the only three moves, and "the classification is wrong" is the
fourth possibility the block- and term-scale versions do not have because a block's
chapter is not in doubt the way a module's layer is.

Everything below is machinery for finding out which of the four you are looking
at.

## The four stages, and each is a gate

Nothing moves until the stage before it measures zero. The stages are not
advice about sequencing; each is a state the graph is in.

### 1. Declare in place

The sub-graph is declared **where it already sits**. Still inside the
repository, still connected, nothing moved. The declaration gains a directory
entry with its `graphs[]` kinds; a sub-graph that owns its own layout gains a
nested declaration (`beans/beans.json`, `todos/todos.json`) whose paths resolve
against its own directory, **so the whole graph relocates by moving one
folder**.

**Declaring is cheap and extracting is expensive.** The
`methodology` graph typology is defined by exactly this property: *"extractable
(somebody else's work, adopted, so it lifts out with its declaration when the
field moves on)"*.

### 2. Detangle

Drive cross-edges toward zero. This is the long stage and the rest of this
skill is about it.

### 3. Isolate

The sub-graph carries its own declaration, its own namespace, its own published
artefact. `bootstrap/` is the demonstrated case: its own declaration, its
own `bootstrap:` namespace — the prefix IS the stub, see
[`kg-export`](../kg-core/kg-export.md) §"A prefix is the stub" — its own
graph document.

### 4. Extract

Only once edges are zero and the declaration stands alone. A directory move
rather than a file-by-file sift. The five-point gate is in
`docs/concepts/architecture/migration-plan.md` Phase II and is not restated
here.
For a Knowledge Graph leaving as its own repositories — a content repository
and a tools repository — the rest of the method, from splitting the tools out
to the cutover, is [`kg-separation`](kg-separation.md) and its process
`kg-separation.bpmn`.

## The seventeen moves

### Measurement

**1. Read the unassigned column before the edge count.** A low edge count over
an unclassified corpus is the same false comfort as a green check over an empty
one: *"these are not cross-edges — they are edges this tool declined to judge.
Do not read them as clean."* The same false comfort at a different join is
`covered-is-not-reachable`: a skill showing as covered is not evidence that its
code is reachable. Read that skill before concluding a corpus is covered.

**2. The count rises when the measurement improves, and that is correct.**
Folding previously-unjudged edges in raises the wrong-direction count. **A
detangling count that only ever falls is not being measured honestly.**

**3. Quote both numbers, not only the one that improved.** An edge can move
rather than vanish.

**4. An assignment is verified by re-running, never by being locally
reasonable.** The obvious move, even the one the tool's own message asks for,
can raise the count.

### Ordering

**5. Move the shared target first, then the importers.** Classifying leaves
before their shared schema targets adds edges; moving the targets first does
not.

**6. A schema moves with its script, or you mint the edge you meant to
retire.**

**7. Declaration and readers first, files second.** Update the declaration and
every consumer **while the files are still where they are**, verify green, and
only then `git mv`. The reverse order makes every gate red at once with no way
to tell which failure is which.

**8. Some fixes are two steps and only work in one order.** Reclassifying
handlers alone can make the composition root cross the line to mount them; a
step that is edge-neutral by itself (resolving routes by variable specifier)
can be what makes the reclassification a net win.

### Judgement

**9. Read what a module is FOR, never what directory it sits in.** Layer is
not by directory, and a name says what something is for while an argument list
says what it does.

**10. The triage question, in either of two equivalent forms.** *"Does it act
on the PLATFORM or on CONTENT?"* and *"does it need a folio to have anything to
do?"* A sharper cut: needed to RUN a process is tooling; DESCRIBES one is core.
And for the renderable side: if it renders, it is not the harness's.

**11. Check the TARGET's layer before the importer's.** The gate's failure text
says so.

**12. A keyword classifier gives false signals on filenames, and will keep
reclaiming.** `fsh` in `fsh-guts.ts` matches the FHIR-Shorthand keyword;
`content` in `content-type.ts` sends marker machinery to core. Every keyword
assignment is provisional against a read of the module, and removing a
misclassification needs an `exact` entry rather than deleting the old one,
because **a rule that classifies by name will keep reclaiming it**.

**13. Inverting a dependency does not remove the edge if the new holder sits in
the same layer.**

**14. The fix is not an exemption, it is the right owner.** An exemption is
what you write when ownership is genuinely ambiguous, and then it carries its
reason inline.

### Enforcement

**15. A check is an error only once its count is zero, and enforce per axis.**
Turning a red gate on teaches the next agent to append `|| true` (see the ruff
comment in `code-quality-gates.yml`).

**16. Watch the new gate FAIL before trusting it.** Re-introduce the defect
deliberately and see exit 1. A gate that cannot fail is indistinguishable from
one that passed.

**17. Merge main before trusting a local green; CI builds the merge ref.** A
gate that passes locally and fails in CI can be a newer, stricter gate on the
merge commit, not flakiness.

## Declare a falsifier, and mean it

State in advance the result that would show the classification wrong (for
example, *"if classifying these RAISES the cross-edge count, the classification
is wrong rather than the tool"*). When it fires, read the new edges rather than
arguing them away, and change the plan. A falsifier that never fires is
decoration.

## Measurements that are not measurements

- **A measurement you know to be inconclusive is not a measurement.** If an
  earlier rule (an `exact` list consulted first) means your change never
  applied, say the experiment was inconclusive.
- **An edge that several passes called intractable is an edge nobody read.**
  Open the file before deferring it.
- **A grep that under-reports reads exactly like a clean result.** A pattern
  like `from "\.\./*skills/` cannot match `../../skills/`, and an
  `export {}` block can hide consumers that `tsc` finds.
- **Enumerate dispatch points before proposing a mechanism.** It is how you
  find the ones already built, and as an audit it survives a bad hit rate
  where a choice between guesses does not.

## What the metric will not tell you

From the editorial side, measured on a real corpus:

> "an unconstrained search cleared 66 of 236 forward references — and a
> narrative review of its 53 moves found **18 of them made the paper worse**.
> Reducing the metric and improving the reading are different objectives, and
> they diverge often enough that the difference is not a rounding error."
>
> "Expect the reviewed yield to be roughly a third of what the raw metric
> promises, and prefer it."

So: **a guard is not an objective.** Pinned nodes, atomic families and
container boundaries constrain the search, and `split` and `merge` are never
auto-dischargeable — they rename things and ripple through every reference.

## Related

- [`graph-rendering`](graph-rendering.md) — drawing the graph being
  partitioned, with each group's detangle numbers beside it. The UML overview
  pages show them per sub-graph.
- `placement.md` — the sibling SOP, for where a NEW node goes. Same shape:
  numbered steps, a stop, a closing checklist.
- `covered-is-not-reachable` — the reachability half, and the rule that
  "reachability is PLURAL": the question is not which caller a mechanism should
  have but what should be able to START it.
- `docs/concepts/architecture/migration-plan.md` — the phased plan for this
  repository's own five-repo cut, including the Phase II per-repo gate.
- `scripts/repo-partition.ts` — the instrument.
- `schemas/kg/layer-direction.ts` — the one wrong-direction verdict both
  `check:partition` and `kg:detangle` call.

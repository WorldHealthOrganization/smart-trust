---
consulted: true
---

# Render order — flattening a dependency hierarchy, and the three stages

Two things live here: **the general subprocess** (flatten a hierarchy into one
order) and **the one pipeline this repository runs with it**. **A repeatable
subprocess has one implementation** — every caller that needs "run these in
dependency order" uses this one, because separate copies become several
topological sorts, subtly different and untested.

| | |
|---|---|
| the rules + the flattener | `cat-harness/schemas/kg/dependency-order.ts` |
| the pipeline that uses it | `cat-harness-tools/scripts/render-pipeline.ts` |
| see the order without running it | `bun run cat render:order` |
| run it | `bun run cat render` |
| check an order someone WROTE, rather than compute one | `checkDeclaredOrder` in the same module |

**Two questions, one module.** `flattenDependencies` answers a pipeline's
question — *give me an order that honours every `needs`*. `checkDeclaredOrder`
answers an authored list's — *does the order as written keep its promise*, each
item using only items above it and never itself. A glossary's order is the
second kind: it is part of what the author said, so it is checked and never
recomputed (see the glossary ordering discipline, §"Ordered glossaries").

## The four rules, and each is a decision rather than a default

1. **A node runs after everything it declares `needs`.** Nothing else implies
   order — not position in the list, not the id.
2. **Ties break on declaration order.** Sorting ties alphabetically makes the
   flattened order churn when a node is renamed, turning a no-op rename into a
   pipeline diff nobody can read.
3. **A cycle is reported, never broken.** Breaking one picks a winner silently
   and the pipeline then runs in an order nobody chose. **Every** node in the
   cycle is named — naming one sends the reader to fix the wrong edge.
4. **A missing dependency is reported, never dropped.** `needs: ["x"]` with no
   `x` is a claim that failed. Running the node anyway reports a clean pass
   over a broken graph.

Rules 3 and 4 share a consequence worth stating on its own: **a broken graph
yields NO order at all**, not a partial one. A partial order over a broken
graph is the thing that gets run.

## `fatal` is per STEP, and it is required

Some steps must stop the build on failure (the current-state json/jsonld and
the README) and the rest must not, so the runner cannot own one policy. The field is **required rather than defaulted**, for the same
reason a graph typology must state `holds`: a default lets a step ship without
anybody deciding, and the two policies are not interchangeable.

**A failure skips what NEEDED it**, computed transitively from `needs` — not
what merely follows it in the list. Two steps can be adjacent and unrelated,
and skipping an unrelated one loses a rendering for no reason. A skipped step
names the step that **broke**, not the nearest blocked neighbour.

### Three outcomes, and `pending` is the third

`ran`, `failed`, `skipped` — plus a step that is **declared but not yet
performable**, which the report marks `◻` and never a tick — so a step that
cannot yet do its job never reports success while doing something else.
Naming the gap costs a line; finding it from a wrong artefact costs a release.

## The three stages

| stage | renders | on failure |
|---|---|---|
| 1 | the CURRENT declared state as json/jsonld, then the README from it | **fatal** |
| 2 | the dynamic parts — viewers, visualisers, doc pages, diagrams | skip + log + QA |
| 3 | the DYNAMIC state, exported once stage 2 has contributed | **fatal** |

**Two exports, not one.** They are different documents. The first is what the declarations say
now; the second is what the graph became after the renderers ran.

**Stage 1 is fatal because everything below is derived from it.** A knowledge
graph that does not render is not a degraded build, it is an unknown one, and
a README generated from a half-read graph states a wrong fact in the file a
reader opens first. **Stage 2 is not**, because a missing visualiser costs one
rendering and nothing else.

**Bootstrap is the exception, and it is declared as one.** It depends on
nothing and nothing depends on it — that is what "as an exception" means here:
bootstrap is read when no harness is installed, so it cannot wait on the
graph and the graph must not wait on it. Same shape as its exemption from the
`visualiser` criterion in `check:subgraph-coverage`, and a **second criterion
rather than a hole**: it owes its own `.json`/`.jsonld` instead.

## What stage 3 writes: `<harness>/state.jsonld`

The workflow pages are the dynamic-state visualiser. `kg-dynamic` publishes
`<site>/<harness>/state.jsonld` (`scripts/dynamic-state-export.ts` in the
tools layer), and each workflow instance page reads it when it loads.

It is a different document from the stage-1 graph export, and a reader can
tell them apart without the path: it is typed `cat-harness:DynamicState`, its
`$schema` is `cat-harness-dynamic-state/v1`, and it holds only the running
instances, the steps their tokens sit on, and their stuck states. A work item store
that could not be read is named in `unreadStores`, so its instances read as
unknown, never as none. **Do not mint a published artefact name to close a gap
the author left open**; wait for the reader that names it.

## This declares the order; `docs-site.yml` still publishes

`render-pipeline.ts` is not a second CI workflow. It holds the order and the
policy in one readable, testable place and gives CI one thing to call. **A
pipeline order that exists only as the sequence of steps in a YAML file is an
order nobody can test.**

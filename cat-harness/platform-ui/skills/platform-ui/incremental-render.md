---
name: incremental-render
description: >
  Rendering only what changed — seeding a build from a previous render, the
  two edges that decide what must re-run, why a step declares GRAPH TYPOLOGIES
  rather than paths, and the rule that could-not-determine always re-renders
  rather than serving a stale page.
---

# Incremental render — the cache is easy, the cascade is the work

Three steps. **Only the third is hard**, and it is the one that fails quietly:

1. **Seed** — start from a previous render rather than from nothing.
2. **Re-render what changed** — the steps whose inputs moved.
3. **Re-render what DEPENDS on them.**

A page that was not re-rendered **looks exactly like a page that was**, so an
incremental render that gets the dependency graph wrong ships wrong pages and
reports a clean build.

## The two edges, one mechanism

| edge | example | one change means |
|---|---|---|
| **projection** | `<page>.html` ← `<source>.md` | one source file → one page |
| **index** | `community-list.html` ← every catalogue node | one **member** → the whole index |

The index edge is the one people forget: **an index is derived from a SET, so
it goes stale when a member changes even though the index file itself did
not.**

The runner treats both alike: if any declared input changed, the step
re-runs, and the step's own `--check` decides which outputs actually differ.
The downstream half uses `needs`, which already orders the pipeline: a step
whose dependency re-ran re-runs too.

## A step declares GRAPH TYPOLOGIES, not paths

`RenderStep` carries two ways to say what it reads, and the second is the one
to use:

| field | what it names | when |
|---|---|---|
| `inputs` | repository-relative files or directories | a path that is not a declared graph — a config file, a script's own fixtures |
| `inputGraphs` | graph **kinds** from `<name>.json` — `cat-harness`, `beans`, `schemas`, … | anything the declaration already locates |

`check:declared-paths` rejects a literal path to a declared graph. A second
answer to *where do the skills live* goes stale the moment a directory moves,
and the render then hashes a path that is not there, finds nothing, and
reports the step unchanged.

### The subprocess, and why there is one

`render-pipeline.ts` is in the **harness** layer. Resolving a graph typology means
`readDeclaration`, which validates **every** kind in the declaration — and this
repository declares a `folio` directory whose kind is registered by **core**,
on the argument (written on `schemas/kg/folio-graph-typology.ts`) that a layer which
cannot render must not own the renderable kind. So the harness layer cannot
resolve *any* kind in-process without importing core, which `check:partition`
rejects.

So it **asks across the boundary the way the pipeline asks every renderer it
runs** — by spawning one. `cat-harness-tools/scripts/declared-dirs.ts` is
core-layer and prints one line of JSON on stdout, `{graph: [dirs]}`.

**A failure prints nothing to stdout and exits non-zero**, so the caller cannot
read *could not resolve* as *declares nothing* — the distinction this whole
skill turns on. The pipeline reports it:

> `Graph typologies could not be resolved here, so every step that declared only
> graphs re-rendered: <reason>`

and every graph-declared step becomes undeclared, which always re-renders. Safe
direction, **said out loud**: a silent fall-back to a full render leaves the
cache inert with nothing in the output saying why.

### The cost: a graph is coarser than a file list

`kg-current` declares the whole `cat-harness` graph, and everything `needs` its
way back to `kg-current`, so **editing one skill re-renders every step**. That
is the right trade: over-declaring costs needless runs, under-declaring ships
stale pages that look fresh. A finer declaration is available whenever a
step's reads can be expressed without spelling a declared path.

## Hash content, never mtime

`mtime` is the obvious shortcut and it is wrong twice: a fresh checkout
rewrites every mtime, so CI would re-render everything; and a file touched but
unchanged re-renders for nothing. Hash the **content**, and hash the **path
alongside it** — moving a file is a change, and an index keyed on filenames
notices.

Sort before hashing, **by codepoint**. `readdirSync` order is not stable across
machines, and `localeCompare` is ICU-dependent — a seed written on one machine
would mismatch on another. `byCodepoint` in `render-selection.ts` is the
comparator.

## Could-not-determine always re-renders

Four states send a step to the "run it" pile, and **none of them is an error**:

| state | why it runs |
|---|---|
| inputs changed | the obvious one |
| something it `needs` re-ran | the cascade |
| the seed's manifest does not mention it | absent is not fresh — it may never have run |
| **it declares no inputs** | it has not said what it reads, so nothing can be concluded |

And three at the build level: **no manifest at all** is a full render; a
manifest that is unparseable or carries the wrong schema tag is treated as
absent; and **graph typologies that could not be resolved** turn every
graph-declared step into the fourth row above. **A corrupt manifest is never
partially believed** — half a cache is worse than none, because the half that
is wrong is invisible.

This is the repository's standing rule applied to rendering: *could-not-check
is never green.* Here it costs a re-render, which is the cheap direction.

## Under-declaring is the dangerous direction

A step whose real input is not listed keeps a stale output **and looks exactly
like one that re-rendered**. A step that over-declares costs one needless run.
So when unsure, list it.

`bun run cat render:order` names every step that declares no inputs, because those
are the ceiling on how incremental a build can be — and a step that always
re-renders should be a decision (`alwaysRun`, with a reason) rather than an
omission nobody noticed.

## Steps that always run

A narrower graph buys more caching: `beans` reaches only `docs-pages` and
`state-dashboards`. The two that always run are `bootstrap` (pending — nothing to cache yet) and
`kg-dynamic` (`alwaysRun`: it exports the running workflows' state, whose
stuck states are measured against the clock, so no source hash could make
caching it correct).

**Report the cached steps as cached, never as a pass.** In this pipeline a
"skip" already means *its input never rendered*, so a served-from-seed step
gets its own mark (`=`). The counts must add up: a cached step returns no
error, so it must not also be counted as having run. A build report that sums
to more than its own steps is one nobody trusts the rest of.

## Usage

```sh
bun run cat render                                   # full
bun run cat render:order                             # order + which steps are cacheable
bun run cat render --write-manifest <path>           # full, and record the inputs
bun run cat render --seed <path>                     # incremental against that record
bun run cat render --seed <old> --write-manifest <new>
```

## Not built

**Seeding from the published render.** The manifest and the selection are
here; copying a previous build's OUTPUT into place before the run is a
deployment step and belongs with `feature-staging.yml`. Until it exists, a
seeded run skips steps whose inputs are unchanged but has nothing to serve —
so use `--seed` only where the previous output is already in place.

## Related

- `scripts/render-selection.ts` — the selection, the manifest, and the hash.
- `scripts/declared-dirs.ts` — the graph-typology resolver, and why it is a process.
- [`directory-conventions`](../../../skills/kg/kg-core/directory-conventions.md) — what a graph typology is
  and where `<name>.json` declares it.
- [`ci-health`](../../../skills/process/process-core/ci-health.md) — the same third-state discipline one level out.

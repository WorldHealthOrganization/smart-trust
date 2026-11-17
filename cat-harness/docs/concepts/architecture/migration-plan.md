---
layout: default
title: Migration plan
parent: Architecture
nav_order: 4
---

# Migration plan — one repo to five
{: .no_toc }

1. TOC
{:toc}

---

> **Status: under way.** Phase 0.1 and 0.2 are built; the rest is proposed and
> written to be argued with before code moves.

## The governing principle

**Move wiring and script together.** Every boundary this migration creates can
reproduce two defects: a script deleted while its hook reference survives, and
a path computed from a script's own location that was correct before a split
and wrong after. At the last split such scripts —
[including a CI gate](current-state.html#the-failure-mode-this-repo-has-already-paid-for)
— passed silently over a corpus they could no longer read. **A green check is
the symptom, not the reassurance.**

Hence every phase gate below is a *positive* assertion (this tool read this
corpus and found this) rather than a negative one (nothing went red).

## Phase 0 — unblock, before anything moves

Phase I moves code around to prepare for change. Three things have to be true
first, and none of them is a move. Skipping them means discovering in Phase II that the target shape is unreachable.

### 0.1 — Make the dependency model able to carry the split · **decided and built**

**Decision: load-time registration.**

A dependency names a module in its `<name>.config.json`:

```jsonc
{ "contributes": "./contributions.ts" }
```

Its default export is called as the root walks the dependency tree, and returns
the block kinds, adapter and MCP tools it adds. `schemas/contributions.ts` holds
the registry; `loadContributions()` in `schemas/harness-config.ts` walks and loads.

**Gate met.** A synthetic two-repo fixture in which the dependency contributes
one block kind, one adapter and one MCP tool, and the root resolves all three —
plus a test that a kind claimed by a second contributor is **refused**.
13 tests, `schemas/contributions.test.ts`.

#### What the shape costs, and what was done about it

Load-time registration was chosen over a manifest validated before loading. It
is cheaper and more familiar, and it makes **load order semantically
significant** — the same five repos in a different listed order are a different
program. Two mitigations are built in, and neither changes the chosen shape:

**Collisions do not resolve by order.** A kind claimed by two contributors
throws, naming both. Last-writer-wins would make `adapterForKind` ambiguous —
the one property `schemas/block-kinds.ts` states it must keep — *and* would make
that ambiguity depend on listing order, which is the hardest kind of bug to
reproduce from a report. A dependency also may not redefine a kind or adapter
the platform already owns: shadowing `theorem` from a config file two repos away
would change what every existing folio validates against.

**A diamond is not a collision.** The proposed graph *is* a diamond —
`<dak-layer> → smart-kg → core` and `<science-layer> → core` — so a depth-first
walk reaches `core` twice. Re-registering identical content from the same
contributor is a no-op. Without that rule every realistic dependency tree throws
a false collision on first load; dropping the collision check is not the fix.

**The dependency entry's name is authoritative** over whatever the contributed
module says about itself. A contributor able to rename itself could claim
another's namespace and turn a collision into a silent merge.

**A declared-but-missing `contributes` module is a hard error**, not a silent
zero contribution — the "move wiring and script together" failure, caught where
it occurs.

#### Where it lives, and why that mattered

`schemas/contributions.ts`, not `src/core/`. The registry is about the content
model — which kinds exist, which adapter owns them — so it belongs with the
model, and putting it under `src/` would have added another
`cat-harness → <content-core>` import, already the largest
wrong-direction group. A mechanism built to enable the split must not deepen
what the split has to undo. MCP tool contributions are carried as opaque registrar callbacks for
the same reason, so the MCP SDK type never reaches the content model.

#### Still open under 0.1

There is no content-directory resolver. (`resolveSkillDirs` is wired: the
cross-layer skill overlay is built from it.) Writing it is finishing work,
not a design question, and does not block Phase I.

### 0.2 — Replace the filename heuristic with a real dependency scan · **done**

`bun run cat check:partition` (`scripts/repo-partition.ts`) builds the import graph,
partitions it across the five proposed repos, and reports the edges crossing a
boundary in the wrong direction. Gate met: 341 modules, 670 edges, **46
wrong-direction edges** named, **0 modules unassigned** (the 27 platform
meta-scripts were triaged by hand, and are reported with their own provenance so
a judgement stays visible as a judgement). Full results in
[current state](current-state.html#the-wrong-direction-edges--phase-is-worklist).

**Scope.** That scan's root is **one layer**, so its edge count is over modules under
that layer only and says nothing about imports between the layers already
sitting side by side in the checkout. The cross-layer axis is a separate
question with a separate tool — see I.1b below.

Two results change the plan below rather than merely confirming it:

- **`smart-kg` partitions to zero modules.** There is no L1 code to move, so
  that repo is new construction like the Test repos, not an extraction. It is
  re-sequenced accordingly.
- **21 of the 46 edges are `cat-harness` → the content core** — the
  harness importing the content-object model, which is its defining constraint
  failing in practice. Extracting the harness is therefore *harder* than
  extracting sci, not easier, and Phase II's order reflects that.

**When re-running this, read the unassigned column before the edge count** — a
low edge count over an unclassified corpus is the same false comfort as a green
check over an empty one. **The harness → core violation grows as ordinary work
lands**, because nothing stops a new `src/` module importing `schemas/types.ts`. Add `check:partition --strict` as a CI gate once
the count is driven down — the flag exists for it.

### 0.3 — Decide what `folio` is

Top-level `content/` becomes `folio/`; **`folio` becomes its own schema which
can contain zero or more Content instances**; the left-hand navbar gets a
section per node in the folio instance.

The rename is mechanical and wide — **2,408 literal `content/` occurrences
across 429 files**. The schema is not mechanical and is the part that matters:
today `<name>.config.json` has a single `contentType` and a single adapter, so
"a folio" and "a content instance" are the same object. Making a folio a
container of zero-or-more instances is a model change that touches
`adapterForKind`, the profile check, the render path and the viewer.

**Do the schema first and the rename last.** A rename lands cleanly on a settled
model; a settled model does not land cleanly on a corpus mid-rename.

## Phase I — move code to the target shape, still one repo

Everything here happens **inside** `litlfred/folio-assistant`. Nothing is
extracted. The output is a repo whose directory structure is the future state,
so Phase II can be `git filter-repo` plus a `<name>.config.json` rather than
archaeology.

| # | work | gate |
|---|---|---|
| I.1 | Resolve each wrong-direction cross-edge from 0.2 — invert the dependency, move the module, or record why it is legitimate | **both** axes below are empty, or every survivor has a written reason |
| I.1a | The **within-layer** axis: modules under this layer's root, bucketed into the five proposed repos by path rule — `bun run cat check:partition`, enforcing in CI | a new wrong-direction edge among this layer's own modules fails the PR that introduces it |
| I.1b | The **cross-layer** axis: edges between layers that already exist side by side, checked against each one's declared `needs` — `bun run cat kg:detangle:direction`, blocking in CI | a new edge from a layer into one that declares a dependency on it fails the PR that introduces it |
| I.2 | Introduce the `folio` schema (0.3); a folio holds 0..n content instances | `content_validate` passes on a zero-instance folio **and** a two-instance folio |
| I.3 | Rename `content/` → `folio/` | no `content/` path literal survives outside intentional content-instance paths; full test suite green **and** a synthetic-folio run proves each moved tool still reads its corpus |
| I.4 | LHS navbar renders a section per node in the folio instance | a two-instance folio shows two sections; a zero-instance folio renders without error |
| I.5 | Group modules into the five target trees | each tree builds with only its declared dependencies on the path |
| I.6 | Split QA **infrastructure** (harness) from QA **criteria** (downstream) | the criterion registry loads zero criteria without erroring; criteria come from a dependency |
| I.7 | Reconcile the three `todo-manager.md` copies | one canonical copy; every other is generated and checked |
| I.8 | **Every repo declares `stub` + `canonicalUrl` and publishes `<stub>.jsonld` / `<stub>.schema.json`** | `bun run cat kg:export` in each repo emits artefacts named after that repo, with absolute `@id`s under its own `canonicalUrl` |

**I.1 takes two gates.** `check:partition` resolves its root to **one
layer**, so its `0 wrong-direction edges` says nothing about edges between
layers side by side; `kg:detangle:direction` owns that axis. The two are not
each other's second opinion: `check:partition` partitions a **future** layout by
path rule, `kg:detangle:direction` checks the **present** layout against
declared `needs`. Either can be green while the other is red, and a survivor
recorded against one says nothing about the other. `kg:detangle` owns the
cross-layer axis because it already sees it; widening `check:partition`'s
root to the checkout would mean reclassifying every layer's modules, since
its path rules are written against layer-relative paths. Read
`check:partition`'s count with the scope it prints beside it.

**I.8 is what keeps five repos from becoming five vocabularies.** Each split
repo publishes its own knowledge graph, and the graphs are only mergeable if
their node IRIs do not collide. Naming every artefact after its repository and
minting `@id`s under that repository's `canonicalUrl` guarantees that by
construction: `cat-harness.jsonld` and `<content-core>.jsonld` cannot
assert the same node IRI, because the document IRI is part of every node's.

The rule the skill states and a test enforces: **artefacts are stub-named, the
declaration file is not** — the declaration is `<name>.json`, named for the
layer's `name` rather than its `stub`, which keeps it out of the stub-named
set. A consumer must be able to open a repository it has never seen without
knowing what it is called, and a resolver that computes the filename from the
directory finds nothing when a repo is cloned under a different name. So
`findDeclarationFile()` never computes the name from the directory:
it scans for a `*.json` whose stem equals the `name` **inside** it, and throws
when a directory holds two rather than picking one.
See [`directory-conventions`](../../../skills/kg/kg-core/directory-conventions.md)
§Naming and [`kg-export`](../../../skills/kg/kg-core/kg-export.md).

**I.3 is the one to stage carefully.** 2,408 occurrences is a scale at which a
single sweep is unreviewable. Split it by consumer — pipeline, scripts, docs,
workflows, CI — with the wiring for each moving in the same commit as its
targets.

## Phase II — separate repos, incrementally

One repo at a time, each becoming a folio-assistant layer in its own right.

**Order, cheapest-first, each proving something the next needs:**

| order | repo | proves | why here |
|---|---|---|---|
| 1 | the science layer | a dependency can contribute schemas, an adapter and MCP tools | hardest mechanism, cleanest boundary — 101 files that already cluster |
| 2 | `cat-harness` | the harness genuinely does nothing on its own | extracting it *from underneath* core is how you find out what core assumed |
| 3 | the DAK layer | a dependency-of-a-dependency resolves | the depth-first walk is exercised for real |
| 4 | `smart-kg` | the L1/L2 line holds | needs WHO context; least-built today |
| 5 | `smart-kg-tools`, `smart-base-tools` | the Tool/Content kind split | only worth doing once the parents are stable |

The content core is never extracted: it is what remains.

**Per-repo gate — all five required:**

1. `git filter-repo` preserves history for every moved file.
2. The extracted repo builds and tests **standalone**, with its declared
   dependencies and nothing else on the path.
3. The parent, with the extraction declared as a dependency, is green.
4. **Every moved tool is run against a synthetic folio and asserted to have read
   a non-empty corpus**. An empty corpus exits non-zero.
5. No wiring left behind: every hook, workflow and doc reference to a moved
   script is repointed in the *same* change.

**Rollback:** until gate 3 passes, the extracted repo is additive — the parent
keeps its copy. The cutover commit is the one that deletes the parent's copy,
and it is the only commit in Phase II worth reverting as a unit.

## Phase III — build on the harness

New construction, not migration. L4/L5 Content, Tool and Test repos built off
`cat-harness`, and healthworker- and individual-facing workflows
(immunizations, for example).

The Test repos are the substantive new thing, because
[no Test repo exists today](current-state.html#what-this-repo-is-authoritative-for-today):
test data, generation templates, FHIR Test Plans, Gherkin dialects, ITB
configuration. Their defining requirement is the taxonomy's — **test data assets
are themselves folio content types in the KG** — so that SME review of test data
is the same workflow, with the same QA sidecars and the same translation path,
as review of anything else.

**Phase III is the test of whether the split worked.** If a
healthworker-facing folio has to depend on the science layer to get a working
install, the boundary is in the wrong place and Phase II is not finished.

## Risks

| risk | why it bites here | mitigation |
|---|---|---|
| **Silent-success scripts** | proven at the last split: 30 scripts, 23 broken, a CI gate passing over 0 blocks | every gate is a positive assertion over a synthetic folio |
| **The dependency model stops carrying it** | a change makes a schema, adapter or MCP tool contribution unreachable from a dependency | Phase 0.1's contribution tests; the science layer is extracted first |
| **The rename swamps review** | 2,408 occurrences across 429 files | staged by consumer; schema before rename |
| **Folio specifics leak into a split repo** | a literal naming one folio is the most repeated platform defect | `platform-boundary-guard` subagent on every extraction; a TRAP entry per incident |
| **Boundaries drawn without domain context** | the L1/L2 line needs WHO knowledge this repo does not encode | `smart-kg` sequenced 4th; the line is drawn by a person, not inferred |
| **Five changelogs, one change** | a cross-cutting fix now needs five PRs | the ordering test: split only where consumers or cadences differ |

## What this plan does not decide

Stated plainly so the gaps are not mistaken for omissions:

- **Where the L1/L2 boundary falls** between `smart-kg` and the DAK layer.
- **Whether the viewer splits by content type** or exposes a registration point
  ([future state](future-state.html#the-content-core)).
- **Repo ownership, naming and hosting** — org, visibility, release cadence.
- **Whether the science layer depends on core only**, or
  also needs harness surface that core does not re-export.

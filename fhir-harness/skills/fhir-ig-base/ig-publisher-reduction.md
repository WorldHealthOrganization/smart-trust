---
name: ig-publisher-reduction
description: >
  The phased transition that reduces the IG Publisher to AST + QA — five
  phases, each with an exit criterion that is measured rather than asserted,
  and the staleness contract that makes an AST-backed staging build honest.
  Read before starting any phase, and before claiming one is done.
---

# ig-publisher-reduction

> Skill id: `ig-publisher-reduction` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`

Get to the point where the IG Publisher is needed **only** to produce an AST
and a QA record, with rendering owned by the just-the-docs pipeline. During
iteration and staging, an IG is rendered from its cached AST; its generated
`/html` is not mounted.

Two changes are separable: **stop mounting generated HTML** (a rendering
change) and **cache an AST** (a build change). The phases do the first before
the second, because the first is verifiable without a fork and the second is
not.

## What the Publisher does that a cache cannot fake

- **Profile validation** against the declared FHIR version.
- **Dependency-closure resolution** with version pinning —
  `hl7.terminology`, `hl7.fhir.uv.cql`, `hl7.fhir.uv.cpg`,
  `hl7.fhir.uv.crmi`, `hl7.fhir.uv.sdc` for the WHO SMART Base IG.
- **Terminology expansion** against a `tx` server.

None is reproducible from its own output. The end state is the Publisher
invoked *for these*, not the Publisher gone.

## The phases

| | does | exit criterion — MEASURED |
|---|---|---|
| **P0** | re-point the metadata→variables bridge; render one IG's `input/pages/` through just-the-docs | the **WHO SMART Trust IG**'s pages render with Publisher metadata populating the Jekyll variables, and every page the Publisher renders for that IG is accounted for as **exactly one** of: **matched** (this site renders it), **refused under P2** (an XML/Turtle view, in P2's refusal record), or **on the fork's ask** (rendered from data the Publisher does not export, listed with the data it needs). A page in none is a **gap**; P0 passes with zero gaps, and nothing is silently excepted |
| **P1** | derive navigation from `sushi-config.yaml`'s `pages:` and `menu:` | the derived navigation is diffed against the Publisher's, **one diff per IG**, and each difference is **empty or explained entry by entry**; the per-IG diffs are also reported **together**, answering "what are the differences in IG1, IG2, … IGN?" (`scripts/ig-nav-diff.ts`) |
| **P2** | JSON-only representations; XML/TTL dropped from the render path, and not linked | every dropped representation is **recorded as a refusal**, per IG with the same combined view as P1, so "publishes no Turtle" and "we ignored its Turtle" stay distinguishable (`scripts/p2-refusals.ts`, `p2:refusals:check`) |
| **P3** | AST dump behind a flag on the fork; staging renders from cached AST | a staging page built from cache carries a **visible** stale-until-full-run mark, and a reader can tell which facts are provisional — the AST comes **from the fork**, which is a prerequisite |
| **P4** | Publisher invoked for AST + QA only | a release is still cut from a full build, and the artefact **says which** it came from |

P4 in practice: the refresh rebuilds a stale cache incrementally; a release
step refuses an incremental AST (`ig-ast.ts build-kind --require-full`), and
the site's `folio-build.json` records which kind of build it came from
(`ast.kind`). See [`ig-build-pipeline`](ig-build-pipeline.md), "The AST cache
lifecycle".

`fsh-cone`'s source edges (below) are useful for rebuild cones, but they do
not replace the fork for P3: the AST is the Publisher's.

### P0 is a re-point, not a build

The metadata half: the `ig-site-data` tool writes `site.data.fhir` (`ig.*`
from the ImplementationGuide resource, `packageId`, `canonical`) for one IG
— **from the FHIR AST first** (the ImplementationGuide resource in
`output-ast/`), then `sushi-config.yaml` or a published IG's
`fhir-artifact-index` for what the AST lacks. It reports a field the AST and
sushi-config state differently, lists every field it cannot source instead of
writing an empty string, and refuses a source describing another package.
fhir-harness declares `site.data` as a **pass-through Liquid prefix**, so the
platform's value resolver leaves `{{ site.data.fhir.… }}` for Jekyll and the
Publisher alike.

The per-artefact half: `build-ig-site.ts` (`artifactVariables`) writes
`site.data.fhir.artifacts.<Type>__<id>` with the families and keys of
`generate_smart_liquid.py`'s variables — `url` (`canonical`, `page`, `json`),
`text.display`, `link.html` and `elements.<key>` — lifted, not redesigned.
They carry no `smart__` prefix (that prefix is WHO's) and are computed in the
same Jekyll run that consumes them, so the surface converges in one build.
There is no `url.xml` or `url.ttl` (P2).

### P1's exit criterion is a diff

"Navigation looks right" is not a criterion. `sushi-config.yaml`'s `pages:` is
an **ordered map** and `menu:` carries the grouping, so the derived navigation
is computable and so is the Publisher's — compare them. An entry that differs
is either a bug or a deliberate improvement, and saying which is the work.

### P3 is where the honesty lives

A staging build from cached AST is **provisional**: its indices and
dependencies may not be valid until a full IG Publisher run. The contract:

> **An AST is a CACHE, never an authority.** Anything rendered from one
> declares, in the artefact a reader sees, that its indices, dependency edges
> and versions are unverified until a full run.

A stale mark that exists only in a log does not satisfy it: a page that
silently serves stale dependencies looks exactly like one that does not.

### P3 is BLOCKED on more than a fork

Nothing in the Publisher's current exports carries dependencies among
Libraries, PlanDefinitions or Measures — **458 artefacts, 61 % of the WHO
SMART Immunizations IG** (Library 279 + PlanDefinition 138 + Measure 41 of
748), the CQL and decision-logic core. The index's field set is `canonical,
category, dak, description, id, key, materialization, name, published,
resourceType, title, version` — there is **no edge field**, so the exit
criterion is **unsatisfiable** against this export, not merely hard. An AST
that stops at terminology cannot support iterative deltas over the part of an
IG that actually changes. Re-derive that 61 % before quoting it.

#### A second route to the edges, with no fork

`scripts/fsh-cone.ts` builds the same IG's graph from **source** — `.fsh` +
`.cql` — where the index is the Publisher's output.
`scripts/measure-logic-layer-edges.ts` compares the two on the WHO SMART
Immunizations IG:

- The 458 map onto FSH source **1:1, zero unmatched ids**.
- After FSH `RuleSet` parameter substitution — what SUSHI does before the
  Publisher sees a resource — **458 of 458** logic artefacts carry an edge to
  another logic artefact, verified per resource type.

So P3 does not depend on a fork for the *existence* of logic-layer edges;
those are in the IG source at full per-artefact resolution. What the fork
uniquely delivers is **resolved, version-pinned, cross-package** edges.

Two things in `fsh-cone` make that true:

- **The Library→CQL edge** matches on `node.id ?? node.name`: Library
  instances usually omit `Id:` and rely on SUSHI's name→id default.
- **A library canonical inside a parameterised RuleSet** (`* library =
  Canonical({library}Logic)` in `PlanDefMain(library, version)`, or a string
  URL in `MeasureProportionBasic` reached through a second level) is found by
  `buildFshGraph` substituting the RuleSet's positional arguments into its
  body before scanning. Such edges are tagged `insert (parameter expanded)`.

Current figures on the WHO SMART Immunizations IG: 3,329 internal edges, 469
distinct targets across the 458, 354 nodes with no dependent, backward-cone
median 11, largest forward cone 856.

**Break any coverage number down by resource type.** An aggregate can read
99.8 % while every artefact points at the same shared `RuleSet`, so the graph
cannot tell one Library from another.

#### Rebuild fraction

Replaying 257 commits on the corrected graph, the mean rebuild per commit is
**23.5 %**; each graph with missing edges gave a lower figure (8.2–16.0 %).
**Do not quote a rebuild fraction without saying which graph produced it** —
an incremental build sized from an under-connected graph under-rebuilds,
which is the failure `fsh-cone`'s header calls dangerous. Whether ~24 % of an
IG per commit pays for the machinery is an **open question**, separate from
whether the edges exist.

#### What a source edge cannot carry

The source graph answers *which artefact* is stale, not *what a reader must be
told*. It cannot carry:

- **Version pinning.** `resolveRef` strips `|version`, and `PlanDefMain` takes
  `library` and `version` as separate parameters that are never associated. The
  graph cannot tell a dependency on `X|1.0.0` from one on `X|2.0.0`.
- **Cross-package references.** Dropped by design — `InstanceOf` contributes 3
  edges across the whole IG, because 179 of the 458 are `InstanceOf:` a
  cpg/cqfmeasures profile URL that resolves into a dependency package.
- **Rendering-time coupling.** Invisible to it; a cone is a **lower bound**.
- **Compiled truth.** RuleSet substitution is a partial reimplementation of
  SUSHI: it handles positional `{param}` substitution, nested inserts and
  multi-line argument lists, but not soft indexing, a RuleSet's defaults, or
  SUSHI's context-sensitive rules. An edge it derives is a claim about the
  **source**, not the compiled resource; the `insert (parameter expanded)`
  tag says which claims rest on that substitution.

So the source route supplies the **dependency-edge** third of P3's visible
mark and the rebuild set behind it, the **index** third only as a lower bound,
and the **version** third not at all. [`ig-publisher-fork`](ig-publisher-fork.md)
closes P3 for versions and package closure.

## What is NOT settled, and must not be decided by drift

- **`transform_dmn.py` emits HTML**, which the JSON-only contract does not take
  as a representation. Structured output, or embedded asset? Open.
- **"Parity-ish"** needs a stated checklist of asset types and page kinds
  before MVP is declared. The ceiling is a **data** limit: a page kind whose
  source the Publisher does not emit cannot be rendered at any effort, and
  belongs on the fork's ask rather than on the parity list.
- **Whether P4 keeps a `tx` dependency in staging.** Expansion is the slowest
  step and the one most likely to be unavailable offline.

## Do not

- Declare a phase done on an impression. Each criterion above is a measurement
  or a diff; if you cannot run it, the phase is not done.
- Collapse P2 into P0. Dropping representations while the renderer is also
  changing makes a missing page and a refused representation indistinguishable.
- Treat a green gate set as a rendered page. Look at the rendered site
  (`preview:site`): generator output can look right while kramdown gives many
  headings one anchor.

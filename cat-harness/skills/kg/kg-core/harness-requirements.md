---
name: harness-requirements
description: >
  What a layer OWES for every directory it declares — a visualiser, a
  documentation entry, a governing skill, json/jsonld/schema.json
  serialisations at the directory's URL and at every node beneath it, and a
  starting README of its own. Read before declaring a directory, before adding
  a graph typology, and when reading `check:subgraph-coverage`. Carries which
  obligations are ranked as unmet promises rather than unanswered questions,
  why the discriminator is "is this the static knowledge graph", and which
  single obligation a harness may never waive.
consulted: true
allowed-tools: Read Grep Glob Bash
---

# Harness requirements — what a layer owes for what it declares

**Declaring a directory is a promise** that this layer holds a graph of
that kind and a consumer may scan it. The obligations below make the promise
keepable. `bun run cat check:subgraph-coverage` measures them.

## The five obligations

| obligation | declared as | the question it answers |
|---|---|---|
| **visualiser** | by the HARNESS: an entry in its `<instance>.json` `visualisers` — `covers` (its directory ids) or `coversKinds`, `renderedBy` a Tool whose `renders` lists the kind — published at `<base>/<harness>/<id>/`; the directory keeps only its `tile:` look | can a person LOOK at this? |
| **docs** | by the PAGE: `documents:` in its front matter (or its manifest, or `<meta name="documents">` in generated HTML) names the kind or `<instance>/<id>` | can a person READ ABOUT this? |
| **skill** | by the SKILL: `graph-typologies:` names the kind, or `governs: [<instance>/<id>]` the one directory | is an agent handed something that GOVERNS this? |
| **serialisations** | `coverage.serialisations` | is each node ADDRESSABLE as json, jsonld and schema.json? |
| **README** | an `instance-readme` asset, inside the layer | can a reader ENTER this layer at all? |

The first four are per declared directory. The fifth is per layer and is
ranked harder: a layer with no starting README of its own cannot be
entered.

## Severities

- **major** — an obligation this kind OWES and the layer has not met, or a
  target declared and not resolving.
- **minor** — nobody has said yet, for a kind that never owed one.

They are ranked apart because an axis that cannot tell a broken promise from
an open question has a count that means nothing.

### Which kinds owe a visualiser

**Every kind that is not part of the static knowledge graph** — active
material about the work, such as `beans/`, `todos/` and `fsh-guts/`. Authored
subject matter can be read as itself; a record of where something got to
needs something that renders it.

The rule is `holds !== "content"` (`owesVisualiser()` in
`schemas/kg/cat-harness.ts`). `content` is *"authored nodes a reader or a tool
consumes as the subject matter… It stands on its own"*, so it needs no viewer.

Do not key the rule on `holds === "state"`: `fsh-guts` is `context` (no
running step writes it) and still owes a visualiser, and a kind moving between
`state` and `context` must not change what it owes.
**Any rule over this axis must pass that test.**

### Exemptions

- **`renderable` kinds are exempt by construction.** `docs` and `folio`
  render to pages, so the pages ARE the view and a separate viewer would be a
  second rendering of the same thing.
- **Bootstrap is exempt by LAYER, not by kind.** `bootstrap` has no
  visualiser, but it must have its json/jsonld. The exemption is keyed on the
  layer name, so every other layer declaring the same kind keeps the
  obligation, and an exemption by kind would stop checking the one thing
  bootstrap must have.
- **An unknown kind owes one.** A kind nobody has classified must not escape
  an obligation by being unmentioned. (This is the opposite of `graphLayer()`,
  whose `undefined` callers must *not* read as `content`; both fail safe.)

## Where a visualiser is published

| # | URL | what it is |
|---|---|---|
| 1 | `<base>/` | the ROOT's rendering — its `docs/` is installed by cat-harness, so no segment |
| 2 | `<base>/<instance>/` | the layer presented **as itself**, on its own theme |
| 3 | `<base>/<harness>/<visualiser>/<sub-graph>/` | a visualiser the harness DECLARES, over the full KG it covers (`<base>/<harness>/<visualiser>/`) or one sub-graph of it, with assets beneath (`…/<sub-graph>/<path to asset>`) |

The case-3 segments come from the harness's `visualisers` declaration and are
computed by `visualiserRoute` (`schemas/kg/visualiser-route.ts`) — never
composed by a generator, never claimed by a page. Two declarations on one
route are a declaration error, refused by `check:visualiser-routes`; see
[`harness-tiles`](../../ui/ui-core/harness-tiles.md) §"Where a tile goes".

So `docs/` has two roles at once: a directory cat-harness instantiates AND a
namespace under which the docs-kind assets of another subgraph are rendered,
e.g. `<base>/cat-harness/docs/<iris-replica>/`.

Case 3 is the **canonical** address; a bare `<base>/<visualizer>/` is an
opt-in alias (`alias` on the declaration, composed as a redirect) — see
[`schema-management`](schema-management.md) §"Where a viewer publishes". The
site owner's state dashboards are at `<base>/cat-harness/<id>/`, with the bare
URL (`/beans/`, `/todos/`, …) as their declared alias.

"Which directory holds it" and "which URL serves it" are different questions;
a visualiser's declaration answers the first. Never compose the second by
hand.

**The root's own documentation pages are the exception to case 1.** Pages
authored in cat-harness's `docs/` folder publish under
`<base>/docs/cat-harness/` — `concepts/architecture.md` →
`<base>/docs/cat-harness/concepts/architecture.html`, its locale copy at
`<base>/docs/cat-harness/concepts/fr/architecture.html`. Everything else keeps
its URL: the landing page `<base>/` and each locale landing `<base>/fr/`, the
layer sites (case 2), the viewers (case 3), the kind directories the same
tree publishes (`<base>/processes/`, `<base>/proposals/` …) and every root
export.

This is done with `permalink` defaults in that `_config.yml`, beside each
chapter's `parent`, so `baseurl` stays the site's and Jekyll's `page.url` is
the one answer. A generator that links to a docs page by its source path asks
`publishedPagePath` / `publishedHref` (`scripts/lib/jekyll-permalink.ts`)
rather than swapping `.md` for `.html`; an authored link in a docs page to
something outside `docs/cat-harness/` is written `{{ '/x' | relative_url }}`
(in a table row, `{{ site.baseurl }}/x`, whose missing `|` cannot split the
cell), because a relative one would resolve under `docs/cat-harness/`.

## Serialisations — the obligation that cannot be waived

A declared directory owes **two levels** of addressability:

| level | URL | what it asserts |
|---|---|---|
| the directory | `<base>/beans.json`, `.jsonld`, `.schema.json` | this graph exists and here is its shape |
| every node in it | `<base>/beans/<node-id>.json`, `.jsonld`, `.schema.json` | each node is individually in the graph |

Whatever form a node HAS is reachable; a missing form is not invented. A
`.schema.json` that 404s where no schema exists is honest. A `.jsonld` that
404s where the node exists is the defect.

### Why this one takes no `exempt`

Rendering, documenting and governing are choices about effort, so they are
waivable with a reason. Addressability is the **existence claim**: harnesses
cannot override a node being in the KG. A harness that could waive it could
declare a directory into the graph and make its contents unreachable — a
consumer scanning nothing and reporting a clean run. Even `bootstrap`, exempt
from a visualiser, keeps this obligation.

`SubgraphCoverageSchema.exempt` therefore carries three keys, not four, and
`tsc` enforces it, so a waiver for serialisations is a type error rather than
a silent `undefined` that reads as "not exempted".

### How it fits the render pipeline

Each graph's render pipeline is **reader → projection → viewer → gate**. The
serialisation obligation is a constraint on the **projection**, not a fifth
part: the projection must be reachable as the three content types at the
directory's URL and per node beneath it, so a graph that has done the pipeline
work has mostly done this. Do not compose these URLs by hand:
the directory's declaration answers which directory holds the nodes; the
published-URL resolver answers where they are served.

## Before you declare a directory

1. **Say what renders it, documents it and governs it**, or say why it needs
   none — `coverage.exempt.<criterion>` takes a reason, and a waiver with no
   reason is a silence list.
2. **Say what serialises it.** There is no waiver: a directory whose nodes are
   not addressable has not entered the graph.
3. **Declare only what exists.** A declared-but-absent directory makes a
   consumer scan nothing and report a clean run.
4. **Check the kind's layer.** If it is not `content`, you are promising a
   visualiser, so know who is building it before the declaration lands.

## Before you add a graph typology

`GraphTypologyDef` requires `renderable` and `holds`, so a kind cannot go
unclassified, and `tsc` enforces it. It does **not** carry the visualiser
obligation, which is derived from `holds`. Set `holds` on what a running
process DOES with the graph, never on what you would like the obligation to
be.

## Reading the axis

It is **advisory** — it reports, ranks and exits 0, because a hard gate over a
large backlog is a wall somebody switches off. It becomes fatal once the count
of unmet obligations is low enough to mean something.

- **`undetermined` is never a clean run.** An unreadable declaration is
  reported as such; a sweep blind on one layer has not cleared the others.
- **Never quote a count from prose.** Run it.
- **A finding is not a task list.** The obligations belong to whoever
  declared the directory, and `deletion-requires-confirmation` applies to
  every remedy that removes something.

## See also

- [`directory-conventions`](directory-conventions.md) — the declaration schema
  and every graph typology
- [`content-context-and-state-graphs`](content-context-and-state-graphs.md) —
  what `holds` means, and the one question that settles a kind
- [`kg-viewer`](../../ui/ui-core/kg-viewer.md) — the viewer this repository already ships
- `bun run cat check:subgraph-coverage` — the axis; `schemas/kg/cat-harness.ts`
  `owesVisualiser()` — the visualiser obligation, and
  `SubgraphCoverageSchema.serialisations` — the one that takes no waiver

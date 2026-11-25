---
layout: default
title: Harness layers
parent: Architecture
nav_order: 6
---

# What a harness layer IS — schematics, visualisations, tools
{: .no_toc }

1. TOC
{:toc}

---

## The sentence

> **A harness layer adds schematics to a knowledge graph, builds
> visualisations for them, and describes the tools to use and manage them.**

Each clause is a different obligation, and a layer that does one without
the others is incomplete rather than minimal:

| clause | what it obliges | where it is declared |
|---|---|---|
| *adds schematics to the KG* | declare the directories it scans and each one's graph typology | `<name>.json` — [directory conventions](../../../skills/kg/kg-core/directory-conventions.md) |
| *builds visualisations for it* | a declared subgraph a reader cannot see is a subgraph nobody checks | the renderer, per subgraph |
| *describes the tools* | a Tool is a KG node, not a shell string somebody remembers | `tools/` |

**Every time a layer names a directory as a subgraph, it needs a
visualiser and a documentation entry**, and it is a finding if there is no
skill and no tool for it. The declaration is cheap to write; the other two
are what make it real.

## The four directories every layer has

| directory | what it holds | who writes it |
|---|---|---|
| `docs/` | the documentation pipeline — rendered to gh-pages through just-the-docs | the pipeline, from authored pages |
| `library/` | ingested L1 sources | ingestion |
| `uploads/` | the incoming queue, before anything is decided about it | a person, or an agent on their behalf |
| `folio/` | **the active workspace** | whoever is working |

**`folio/` is not `docs/`.** `docs/` is what a
reader browses after the work is done; `folio/` is where the work happens —
publishing, managing the process, authoring and reviewing content. A layer
with a populated `docs/` and an empty `folio/` has a published record and no
workshop.

## The default rendering

A harness layer renders, by default, as one thing with two halves:

- **LHS navigation + `docs/`** — the documentation pipeline, one themed section
  per layer in dependency order. Collapsed, a section is information about
  that layer; opened, it shows that layer's docs navigation and the
  display subgraphs **that layer declares**. Attribution follows
  declaration, so a directory renders under the layer that declared it.
- **A folio/Miro-like board** — for accessing, authoring and reviewing content,
  with `beans/` and `todos/` managing the pipeline.

Both sit on the layer's **own theme's ground**: the theme's avatar art is
the background, the way a shared Miro board has one. Arbitrary art sits behind
the text, so scrim contrast is measured over pure black
([Theming](theming.html#contrast-is-measured-over-pure-black)).

It is a **readable** interface. It is a writable one *only* where there is a
writable datastore — a conditional, not a promise, and read-only is the floor.

### Layout is chosen, not fixed

A folio page may carry its own theme, but layout **defaults to choosing
dynamically** on display size and usability, best-fit among three:
**mobile**, **laptop** and **square**. The same three the theme art is already
cropped for: a layout with no crop for it has nothing to render on.

## Where the requirement starts — bootstrap is the exception

[The minimum `cat-harness`](cat-harness-minimum.html) carries a one-line
admission test:

> **If it produces something a human looks at, it is not the harness.**

That and "a layer renders by default" both hold because the requirement is
a *floor that rises*, not a rule applied uniformly.

| layer | visualiser / workflow visualiser | its own `.json` / `.jsonld` |
|---|---|---|
| `bootstrap` | **exempt** — it is the navbar **footer** | **required** |
| `cat-harness` | required | required |
| everything above | required | required |

**CatBootstrap is the exception, and what it owes instead is its graph**: a
layer that cannot emit its own `.json`/`.jsonld` has not shown it is a graph.
It trades the visualiser for a criterion it cannot fail quietly.

### The exemption is declared data, not a special case in a checker

`bootstrap/bootstrap.json` carries a `renderExemption` — `of`, `reason` and
`owes` — and the render check reads it through `isExemptFrom` rather than
testing a layer name: a name literal states a rule true only for the
layer somebody remembered, and a vendored or renamed bootstrap would
silently reacquire the obligation it was excused from.

**`owes` is required by the schema**: an exemption with no substitute is a
hole, and a list of holes is a silence list. bootstrap's names the two skills that govern its emission, and
a test asserts the files it names exist.

**The guard against spreading is global.** The declaration is local because
only the layer knows why; `renderExemptionProblems` takes every layer in
the repository, because "only the bottom layer may claim this" is a fact about
the stack that a per-instance check cannot see. A second claimant fails
`check:instance-render`. At most one, not exactly one: a repository that
vendors no bootstrap has nothing to exempt, and failing it would make it
declare something just to stay green.

What it owes lives in **`bootstrap/skills/`**, bootstrap's declared skills
subgraph, as
[`bootstrap-graph-emission`](https://github.com/litlfred/folio-assistant/blob/main/bootstrap/skills/bootstrap-graph-emission.md)
and
[`bootstrap-graph-publication`](https://github.com/litlfred/folio-assistant/blob/main/bootstrap/skills/bootstrap-graph-publication.md)
— performed by bootstrap-tools' `export-graph.ts` and typed by its
`GraphExportSchema`. The discipline is a declared skills subgraph rather than
code comments, so it is read rather than rediscovered.

**`cat-harness` is where the rest begins to apply**, because cat-harness
supplies the layers above with `folio/`, and a layer that hands its dependents
a folio must render one itself. Concretely: a minimal just-the-docs rendering
in `cat-harness/folio/` describing what a folio is, and `cat-harness/folio-render/`
for the renderer. The workflow split has the same shape: bootstrap keeps the
bare minimum, cat-harness elaborates.

## Open, and named rather than guessed

Three questions are open, and are not written as if decided, because a
guessed answer in a published document is how a wrong one becomes canon. The
first two are expensive to get wrong:

1. **Where does the background live?** A theme's `backdrop` is a
   *sticky-scoped* concept today. Making it the page ground is a different CSS
   surface — `body`, or a board element — and probably a different crop set: a
   sticky's crop is chosen for a **card**, and a page is a different aspect
   entirely.
2. **What is the writable datastore?** gh-pages is static. The artifact
   database, a local server, and a GitHub write path through editor links are
   three different answers with three different security postures.
3. **Which subgraphs are "display" subgraphs?** Every declared `graphs` entry,
   or an opt-in subset?

## KG-DS is the Knowledge Graph Data Store, and its machine is **git**

`bootstrap/scenarios/roles.json` declares a role with this id. Its machine is a
git repository, reached through the git CLI or a forge's API: it is where a
declaration and its graph are READ from and where a new layer's declaration
is WRITTEN to. Like any role played by a mechanical actor, it is a real role
whose skills are its **contract** — what it must do, which a test can hold it
to.

**This is why "writable interface *if* writable datastore" is a real
conditional.** Writing means a commit through the CLI or a forge API, which is
available to an agent with a checkout and credentials and *not* to a reader
browsing a static gh-pages site. The same page can be readable to everyone and
writable only to some, and that is a property of the store rather than of the
rendering.

## Related

- [Minimum `cat-harness`](cat-harness-minimum.html) — the layering this page
  builds on
- [Directory conventions](../../../skills/kg/kg-core/directory-conventions.md) —
  the declaration schema and every graph typology

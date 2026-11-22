---
layout: default
title: Subgraph viewers
nav_order: 14
lang: en
documents:
  - library
  - schemas
  - uploads
  - voices
---

# Subgraph viewers
{: .no_toc }

A harness layer declares the directories it holds and the **kind of graph**
in each. Some of those graphs have a page you can open; the sections below are
the list, and they are not counted here, because a typed count goes stale the
moment a viewer is added.

1. TOC
{:toc}

---

## What a declared subgraph is owed

**Every directory a layer names as a subgraph needs a visualiser, a
documentation entry, and a governing skill,** because a directory nobody can see
is one nobody checks. They are three requirements because they fail
differently: nothing renders it, nothing says what it is for, or nothing an
agent can invoke against it. This page is the documentation
entry for the graphs below; for `schemas/` and `library/` the governing skills
are [`schema-management`]({{ '/reference/skill-instructions/schema-management.html' | relative_url }})
and the library-ingestion skills.

`bootstrap` is exempt from the visualiser requirement and not from the others:
it is the navbar footer, and what it owes instead is its own `.json`/`.jsonld`.

## The schema graph

**[`/cat-harness/schemas/`]({{ '/cat-harness/schemas/' | relative_url }})** — every declaration in
every declared `schemas` directory, with the edges between them.

- A **faceted index**: search, filter by kind, filter by module.
- A **detail panel**: fields with their types, optionality and doc comments;
  what the declaration references and what references it.
- A **per-type UML neighbourhood**, drawn as a class box with its
  generalisations above it and its field references below, each labelled with
  the field it goes through.
- A **relationship diagram** at the top, collapsible and closed by default.

There is **no whole-corpus class diagram,** because hundreds of labelled boxes
render as a wall that looks like a data model and answers no question about one.

### The relationship diagram

A collapsible panel at the top draws the declarations the page is scoped to as
**UML class boxes wired by their edges, each edge labelled with the field it
goes through** — so you can read not just that `Role` is linked to `Skill`, but
that it goes through `skills`, and that it is a list.

**It is scoped, and refusing is an answer.** The diagram draws the page's scope
narrowed by the module filter; above 40 declarations it declines and says to
pick a module.

**One hop of context is drawn, faded.** A strict module filter cuts the edge
most worth seeing — `RoleDefSchema --skills--> SkillDefinitionSchema` spans two
files — so a declaration just outside the filter that a drawn one touches is
drawn too, dashed and dimmed, because counting a cut edge is not showing it.

Three edge kinds:

| kind | drawn | means |
|---|---|---|
| generalisation | solid, hollow triangle | `extends` |
| field reference | solid, open arrow | a reference **in the source** |
| id reference | **dashed** | an association **declared** with `@ref` |

A field reference is something the reader *found*; an id reference is something
an author *asserted*, because the target is a string id no syntactic reader can
see. Id references are dashed because drawing them alike would claim the reader
saw something it did not.

Clicking a box opens that declaration's definition.

The layout is **static**: computed once, deterministically, no simulation, and
boxes cannot be dragged.

## The library — the L1 corpus

**[`/cat-harness/library/`]({{ '/cat-harness/library/' | relative_url }})** — every entry, and the
`uploads/` queues feeding them.

Two views over one projection, because they answer different questions:

- **Listing** — every column sortable, every metadatum visible. *Which is
  biggest? Which has no OCR? Which came from which upload?*
- **Desktop** — the corpus as tiles. *What is in here*, before you know what
  you are looking for.

### Ingestion state is three states, and none of them is an error

OCR is the case that forces it:

| shown | means |
|---|---|
| `not scanned` | no `ocr/` directory at all — a **determined** answer, not a failure |
| `N OCR pages` | scanned |
| `ocr/ present, empty` | a third answer again, and the one worth looking at |

Rendering the first as "0" would say OCR *failed* on a document that was never
scanned.

### The uningested badge, and what it is computed from

Each queue carries a count of how many units are still waiting, **per
declaring layer and never merged** — two layers' queues shown as one
would report a set that does not exist.

The relation behind it is not a guess. Each `library/<slug>/manifest.jsonld`
carries `meta.source_file` and `meta.source_sha256`, and the reader
**recomputes the hash** rather than trusting it — so an entry's source is
*content-verified*, and a file replaced in the queue shows as `differs` rather
than passing as the same document.

A queued unit is a loose file, **or** a directory whose `intake.json` declares
a capture. An intake is **one** queued document however many files it declares:
counting a four-file capture as four would say four documents are waiting when
one is.

### It is read-only

Nothing on this page edits an asset: it does not start an ingest or materialise
an entry into a folio, because the write path is not yet decided.

## The voices — what each rule cites

**[`/cat-harness/voices/`]({{ '/cat-harness/voices/' | relative_url }})** — every voice
its layer declares, every rule, and **the passage the rule was read from**.

A voice is an editorial register asserted by a layer. Every rule carries
the page and the quote it was read from, and `check-voices.ts` checks that it
does. The rule row leads with the quote, and the citation is the one column
that cannot be filtered away, because a citation that is only machine-checked
is one the reader takes on trust.

### A rule citing nothing is drawn as a finding, not as a blank

`VoiceRuleSourceSchema` requires **exactly one** of an ingested source
(`libraryId` + `sectionId`) or a node of the layer's own knowledge graph
(`kgRef`), so a rule with neither cannot load. The viewer renders that state
anyway, in red, saying that something is loading voices without validating
them, because a reader cannot tell "no citation" from "citation not rendered"
in an empty cell.

### A declared directory that is not there gets a row

`agent-skills` declares a `voices` graph and ships none. It appears in the
directories table as **declared, not present**, rather than being omitted,
because those are different facts and a consumer that scans nothing must not
report a clean run.

`owesVisualiser` returns false for a `content` kind such as `voices` or
`library`, so `check:subgraph-coverage` does not require these viewers.

## Where they are published — two rules, not three

| rule | form | what it is |
|---|---|---|
| **1 — a handler renders a kind's assets** | `/<handler>/<kind>/<optional subject>` | `/cat-harness/library/<iris-replica>/` |
| **2 — a layer presents itself** | `/<instance>/` | `/<iris-replica>/` mocking the IRIS website |

The handler is the layer doing the rendering; the kind names what it
renders; the **subject is optional**, and a page without one is the view over
every subject.

A subject page is never published at `/<subject>/<kind>/` — that is rule 2's
namespace, and a viewer there would squat on the layer's own site.

### The subject pages

| page | shows |
|---|---|
| `/cat-harness/library/` | every declared `library/`, and every queue |
| `/cat-harness/library/<iris-replica>/` | the IRIS replica's three entries and its queue |
| `/cat-harness/library/agent-skills/` | its two entries |
| `/cat-harness/library/<science-layer>/` | its one entry |
| `/cat-harness/schemas/` | every declared `schemas/` |
| `/cat-harness/schemas/<instance>/` | that layer's modules and declarations |

One projection serves all of them — a scoped page filters client-side, because a
file per subject would repeat the same facts, free to disagree the moment one
is regenerated.
**Counts are scoped too**: a page reports only the edges among the declarations
it shows.

### `docs/` is the same shape, and its subject means something specific

`/cat-harness/docs/` is where the harness user documentation lives, so
`/cat-harness/docs/<iris-replica>/` is documentation **about** IRIS — how it is
ingested, what the handler does with it — and **not IRIS content relocated**.
The content stays in that layer's own `docs/`, and part of the handler's
job is to look for those directories.

Every layer's existing `docs/` is a **member** of the one declared `docs`
subgraph, and `docs` is a `perInstance` kind, so a dependent gets its own.

### Nothing composes a path

The rendered-content root is resolved from the declaration, the handler from
the layer's declared name, and the page's link back to its projection from
the page's own depth — so moving a directory moves its source, its URL and its
data link together.

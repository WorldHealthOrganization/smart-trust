# folio-assist-core

**The content layer.** What a *folio* is — the content-object model, the block
kinds, the adapters, and the `folio` graph typology itself.

It sits between `bootstrap/` (what an agent reads before anything is installed)
and the science layer, and it is composed **on top of** the agentic harness: it
may import from the harness, and the harness may never import from it. That
direction is checked — `bun run cat check:partition:edges` reports any edge running
the wrong way.

**Contents**

<!-- readme:toc:begin -->

- [Scope, stated so the boundary is checkable](#scope-stated-so-the-boundary-is-checkable)
- [What is here today](#what-is-here-today)
- [Three states, and there is no default](#three-states-and-there-is-no-default)
- [Why this is not in cat-harness/](#why-this-is-not-in-cat-harness)

<!-- readme:toc:end -->

## Scope, stated so the boundary is checkable

| in scope | out of scope |
|---|---|
| the content-object model: what a block, a chapter, a document IS | the skills, schemas and MCP server that *operate* on it — those are the harness's |
| the `folio` graph typology, and its registration | any particular folio's chapters, constants or vocabularies — those live in the folio's own repository |
| the `document` content adapter and the block kinds it declares (a higher layer adds its own, such as the science layer's `paper`) | the pipeline's transport and the tool surface |

**This is the platform, not the content.** If you are about to write subject
matter here, you are either in the wrong repository or writing something that
belongs in a folio as data.

## What is here today

| node | question it answers |
|---|---|
| [`schemas/dublin-core.ts`](schemas/dublin-core.ts) | what does the source system *say* about this item? |
| [`schemas/catalogue.ts`](schemas/catalogue.ts) | what collection does it sit in, and how big is that collection? |
| [`schemas/materialization.ts`](schemas/materialization.ts) | are the bytes here, and who decided they were allowed to be? |

They are one chain, read in that order. The third names one process wherever
remote content is held locally: a catalogue layer holding a few items of a
large collection, or `bootstrap` fetching a harness and landing it locally.

Outside that chain:

| node | question it answers |
|---|---|
| [`schemas/changeset.ts`](schemas/changeset.ts) | what changed in a folio between two refs, **block by block**: added, removed, renamed, reworded or moved? Keyed on the block label, which the `id-unique` / `id-stable` QA criteria guard. Read by the review page. |
| [`schemas/review-comment.ts`](schemas/review-comment.ts) | a reviewer's comment on one block, as a **todo kind** (`folio-review-comment/v1`, parent: the harness todo). It must name its block, has a closed lifecycle that only review-process tasks may move, is ingested idempotently from tagged PR comments, and follows renames. A removed block's comments are kept as orphaned. |

## Three states, and there is no default

`referenced` (we know it exists and where; we hold no bytes) · `materialized`
(the bytes are here) · `unknown` (we have not established which).

A node that does not declare its state is **invalid**, not `unknown` — "the
author did not say" and "the author said they could not tell" are different
facts, and only the second is something somebody can act on.

The state names and `FixitySchema` live one layer down, in
[`cat-harness-tools/schemas/kg/materialization-state.ts`](../cat-harness-tools/schemas/kg/materialization-state.ts),
and `schemas/materialization.ts` re-exports both. The five gates, the purposes
and the record stay here, because each gate is a decision about content. A
remote-KG subscription is a materialization whose minimum is the chosen
subgraphs' metadata under `library/<source>/`.

## Why this is not in `cat-harness/`

`BASE_GRAPH_TYPOLOGIES` carries the rule — *"skills/ schemas beans all in
cat-harness, voices, uploads library in folio-asst-core"* — and a Dublin Core
record is on the same side of that line as the library entry it describes. The
harness layer must not own a vocabulary for content it cannot render, which is
the argument `cat-harness/schemas/folio-graph-typology.ts` makes for `folio`
itself.

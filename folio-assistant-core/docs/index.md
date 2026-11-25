---
title: "folio-assistant-core"
description: "The content layer: what a folio is, its block kinds and adapters, and the folio graph typology itself."
has_children: false
---

# folio-assistant-core

**The content layer.** This layer defines what a *folio* is: the
content-object model, the block kinds, the `document` content adapter, and the
`folio` graph typology itself.

## Where it sits

It sits on [C@T Harness](https://github.com/litlfred/cat-harness) and may
import from it. The harness never imports from this layer;
`bun run cat check:partition:edges` reports any edge that runs the wrong way.
Layers such as WHO IRIS sit on top of this one, and the navbar orders them
by each declaration's `needs`.

## What it holds

The declaration
[`folio-assistant-core.json`](https://github.com/litlfred/folio-assistant-core/blob/main/folio-assistant-core.json)
lists every directory and the graph typologies each one holds. The section
below is generated from it, with the counts and the viewers published today.

{% include harness_details.html instance="folio-assistant-core" %}

## What a folio is made of here

A folio is a set of content objects. Each object is a typed manifest (`.ts`)
and a markdown body (`.md`); a higher layer's adapter may add a sibling, such
as the science layer's Lean file for a formal claim. This layer says which
kinds of block exist and what each one must carry. Each kind is a node in the
`block-kinds/` graph with a required profile, so no kind can go unclassified.
The `document` adapter serves structured prose; the science layer's `paper`
profile adds the kinds whose assertion is a formal mathematical claim.

The rest of the layer supports that model. `validators/` names the checks
the code provides, one node per graph typology and schema family. `glossary/`
holds the content vocabulary. `methodologies/` holds the authoring methods a
folio draws on. `processes/` holds the executable BPMN diagrams for the
authoring and review work. `skills/` holds the instructions an agent loads to
carry that work out.

## The rule this layer turns on

This repository is the platform, not the content. A folio's chapters,
constants and vocabularies live in that folio's own repository. If you are
about to write subject matter here, you are either in the wrong repository or
writing something that belongs in a folio as data.

The layer's
[README](https://github.com/litlfred/folio-assistant-core/blob/main/README.md)
sets out the scope boundary in full.

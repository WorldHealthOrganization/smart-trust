---
name: content-profiles
description: >
  Adapters and profiles are different axes and conflating them is costly. What
  a document folio is, how a paper extends it, which distinction needs code and
  which needs only rules, and what profile enforcement catches that schema
  validation structurally cannot.
consulted: true
---

# Content types — `document` is the base, a paper extends it

A **document** folio is structured prose: policy guidance, a standard, a report.
A **paper** is that plus the block kinds whose assertion is a formal
mathematical claim, backed by machine-checkable siblings and typeset through a
TeX pipeline.

**That relation is encoded, not merely described.** The paper adapter *extends*
the document adapter, and every block kind is a `folio-block-kind/v1` node
whose **required** `profile` field says which side it is on: `paper` for a
mathematical claim, `document` otherwise. A two-valued required field is what
makes the classification total by construction rather than by review — a kind
whose author did not choose does not parse.

**No module lists the kinds.** They are DISCOVERED from the `block-kinds/`
graphs their owning harnesses declare — the document kinds in
the content core, the math kinds in the science layer. Adding a kind is adding a node to the harness that owns it; the
`BLOCK_KINDS`, `MATH_BLOCK_KINDS` and `DOCUMENT_BLOCK_KINDS` values in
`schemas/content/block-kinds.ts` are computed from the nodes.

## Two axes, and conflating them is the costly mistake

| | what it does | how they relate |
|---|---|---|
| **Adapter** | partitions block kinds into **disjoint** namespaces | `adapterForKind` must stay **total and unambiguous** — it is what QA criterion scoping reads |
| **Profile** | says what a folio may **contain** | profiles **nest**: every document kind is also a paper kind |

Adapters must not overlap; profiles must. Making `document` a third *adapter*
would make `adapterForKind` **ambiguous on every kind the two share**, and a
scoping function that returns two answers cannot fail an audit, because nothing
can say which answer was meant.

**The question to ask when you add a content type:**

> Does it need different **code**, or only different **rules**?

If only rules, it is **a profile plus a subclass**, not an adapter, because a
new adapter is the expensive answer and usually the wrong one.

**The layer that ships a content adapter declares it; the harness never
names it.** `contentAdapters` in that layer's `<instance>.json` —
`contentType`, layer-relative `module`, `className`, and `extends` for the
type it specialises — is what `src/builtin-adapters.ts` discovers. `extends`
orders the fallback: the specialisation leads, because falling back *to* a
superset loses nothing and falling back *from* it loses its tools. The harness
holds no `../<instance>/adapters/…` path, because such a variable import is
invisible to static gates and ties the harness to the layer's repository;
`check:import-direction` fails on that shape.

## What profile enforcement catches that schema validation cannot

A profile check runs on every validation. It covers a structural gap:

- **A block kind is valid in isolation.** A `theorem` is a well-formed
  `theorem` whatever folio it sits in — the type says nothing about whether
  *this* folio may contain one.
- **The constraint layer cannot read the folio's configuration.** Which profile
  is active is a layer fact; the schema is a shared artefact. So the check
  has to live between them.

Two rules follow:

1. **The kind must be within the active profile.**
2. **In a document profile, no formal-proof field and no machine-checkable
   sibling** — several kinds *declare* that field as optional, so the **type
   permits what the profile forbids**.

## The render path a document profile actually uses takes no TeX

A document folio assembles to one Markdown file and goes through a
document-converter toolchain; the PDF comes from an HTML-to-PDF engine.

**It never falls back to the TeX pipeline**: a PDF that silently came out of
LaTeX would misreport what the folio needs in order to build. It is registered
for **both** content types, so a folio renders on a machine with no TeX.

## A normative statement is not a block kind

There is deliberately **no `recommendation` kind**. A normative statement is
carried by a labelled, titled prose block.

**Adding a real kind is about thirty files** — a builder, a schema, a label
prefix, viewer registration, constraint rows and QA criteria — and is done
whole or not at all: a kind that exists only in the type system validates,
renders as nothing, and is invisible to every audit.

**Known wrong:** intake guidance that maps guideline recommendations onto
`definition` is wrong for a document folio, where `definition`'s formal field
is required.

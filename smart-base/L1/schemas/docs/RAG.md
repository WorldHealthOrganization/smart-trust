# Ingestion contract

> **Migrated from WorldHealthOrganization/smart-kg `docs/RAG.md` at 3f5e477** (issue #359). smart-kg is deprecated (owner, 2026-10-16); this copy is the one to edit. Paths now point at smart-base: each layer is a named subgraph, `smart-base/<Layer>/schemas/` (L1, L2, L2-bpmn, L2-dmn, L3), the engine and these docs are in `smart-base/L1/schemas/`, and the generated JSON, contexts, Turtle and Cypher are in each layer's `generated/`. A command written `npx tsx <path>` runs from the repository root after `npm ci` in `smart-base/L1/schemas/`.

What a retrieval system may load from an L1 graph, and what it must carry with it. This is a
contract, not an implementation: no index, no embedding model, no vector store is specified or
shipped, for the same reason the starter kit's `ai/spine/INTERFACE.md` declares five operations
and implements none.

The reason to state it at all is that retrieval quietly destroys the two properties the rest of
this package spends its effort establishing. A chunk that has been embedded and returned has lost
its provenance and lost the distinction between what was derived and what was decided — and an
agent answering from it produces exactly the failure mode described in
the starter kit's `ai/METHODOLOGY.md`: not a wrong answer, a confident one with nothing behind it.

---

## What you are indexing, and where it comes from

This repository holds the **schema**. It holds no DAK data and never will — see
[`STORAGE.md`](STORAGE.md). What a retrieval system ingests is a DAK's own graph, published by that
DAK's Implementation Guide build, together with the ontology and shapes from here to interpret it.

So an index is built from three things, and all three are versioned: the graph document, the
`smart-base/L1/schemas/generated/l1.json` it declares an `ontologyVersion` against, and the
the class definitions in `smart-base/L1/schemas/generated/l1.json` that gives its nodes their fields.

## The retrieval unit is a node with its edges

Not a paragraph, not a fixed token window, not a file. One node from
[`smart-base/L1/schemas/generated/recommendation-graph.schema.json`](../generated/recommendation-graph.schema.json), rendered with:

- its `label`, `type` and the type's human-readable class name from `smart-base/L1/schemas/generated/l1.json`
- its `properties`, keyed by the element paths of the logical model in the class definitions in `smart-base/L1/schemas/generated/l1.json`
- **every edge where it is `source` or `target`**, with the qualifier, and the label of the node at
  the other end
- its `derivation`, and where that is not `derived`, its `note` and `evidence`
- the `wasDerivedFrom` entry for the DAK source it came from

Chunking on anything else breaks the graph precisely where it is load-bearing. A dictionary row
retrieved without its edges cannot answer which process uses it; a business process retrieved
without its lane edges cannot answer who performs it. The edges *are* the content.

**Both directions, always.** An indicator names the health interventions it references; nothing in
a health intervention names the indicators. Indexing only outbound edges makes half the graph
unreachable from the half a question usually starts at.

### Size

A node with its edges is small — tens of properties and typically under twenty edges. Where a unit
would be large (a business process with fifty tasks), split on the `task` backbone and repeat the
parent's identity and edges on each part. Do not split a node from its edges to fit a budget; drop
`properties` before dropping edges, because a retrieval unit without edges is not a graph node, it
is a paragraph.

---

## Four rules

**1. A retrieved claim carries its derivation.** `derived`, `inferred` or `decided` travels with
every node and edge into the context window and into any answer built from it. An answer resting on
an inferred edge says so. This is the same rule as §1 of the methodology, applied at the point
where it is easiest to lose: a `decided` edge and a `derived` edge look identical once they are
prose.

**2. A retrieved claim can be traced back.** Every unit carries the node's IRI, its `evidence`
location where it has one, and the hash-pinned source it came from. "Where did you get that" has an
answer that is a file and a line, not a description of one.

**3. The graph is derived data and is never the citation.** Cite the DAK — the BPMN element, the
spreadsheet row, the SOP page. The graph is an index over those things and is regenerated; a
citation into it is a citation into a cache. Where a graph node and its source disagree, the source
is right and the graph is stale.

**4. Retrieval never resolves a flag.** Nodes carrying a `flagRef`, and the `flags` array itself,
are open questions routed to an owner. Retrieval surfaces them as open. Answering from a flagged
node without saying it is flagged converts someone else's unanswered question into your assertion.

---

## Staleness

A graph is pinned to its sources by hash, and every unit carries that pin. An ingested corpus is
therefore checkable rather than merely old: re-hash the sources, and any unit whose pin no longer
matches is stale.

Stale is not the same as wrong, and the distinction is worth keeping. The mechanism is the audit
sidecar's, unchanged — an edited source expires everything derived from it, so nothing needs a
person to remember to invalidate it. What retrieval adds is that the expiry has to survive into the
index. An embedding computed in June from a dictionary edited in July has no way to announce
itself; the pin is what lets a loader announce it instead.

Rebuild on any change to: the source publication or DMN the graph was extracted from, or
`smart-base/L1/schemas/generated/l1.json` (the classes, their declared properties, and the licensed edges all move with
it).

---

## What the graph is good for, and what it is not

Good for questions the DAK answers structurally and no single file answers:

- Which L3 artifacts realize this business process, and which L2 rows do they trace back to?
- Which data elements does this decision table read that the dictionary does not define?
- Which personas appear in a BPMN lane and are not declared in the DAK?
- What breaks if this data element changes?

Not a substitute for reading the DAK. The graph carries structure and identity; the guidance itself
— the objectives, the definitions, the clinical intent — is prose in the source, and a question
about meaning is answered there.

And not evidence of fidelity. Every mechanical check over this graph verifies form. Whether the
graph faithfully represents the DAK is tier 3, it is a human ruling, and retrieval does not change
that. A retrieval system that presents a graph-derived answer as validated has made the same
mistake as a pipeline reporting a clean SUSHI compile as a correct artifact.

# Where the schema lives, and where the data lives

> **Migrated from WorldHealthOrganization/smart-kg `docs/STORAGE.md` at 3f5e477** (issue #359). smart-kg is deprecated (owner, 2026-10-16); this copy is the one to edit. Paths now point at smart-base: each layer is a named subgraph, `smart-base/<Layer>/schemas/` (L1, L2, L2-bpmn, L2-dmn, L3), the engine and these docs are in `smart-base/L1/schemas/`, and the generated JSON, contexts, Turtle and Cypher are in each layer's `generated/`. A command written `npx tsx <path>` runs from the repository root after `npm ci` in `smart-base/L1/schemas/`.

**This repository holds the schema. It holds no DAK data, and it should not start.**

That is the one rule this document exists to state, and everything below is why.

---

## Three layers

| Layer | What it is | Size | Changes | Lives in |
|---|---|---|---|---|
| **T-Box** — ontology | Classes and the relationships permitted between them | 40 classes, 95 edges across 4 layers (l1, l2, l2-bpmn, l2-dmn) | When the model does — rarely, with review | **here**, `ontology/` |
| **Shapes** — constraints | What a graph document must satisfy to be valid | 1 file | With the T-Box | **here**, `smart-base/L1/schemas/generated/recommendation-graph.schema.json` |
| **A-Box** — instances | The recommendations of one guideline; the processes, decisions and personas of one DAK | Hundreds of nodes per publication or DAK | Every guideline revision, every DAK release | **published with its source** |

The names come from description logic, where the terminological box holds what kinds of thing exist
and the assertional box holds what is actually the case. The distinction is worth keeping because
the two have almost nothing in common operationally: one is small, slow and reviewed by people; the
other is large, regenerated, and read by machines.

---

## Why instance data does not belong in git

**An extracted graph is derived.** Every node comes from a page of a PDF, a DMN rule, or a
spreadsheet row. Committing it creates a second copy of the source — one that will disagree with the
first the moment someone revises the guideline and does not re-run the extract. [`RAG.md`](RAG.md) already
forbids the consequence: *the graph is derived data and is never the citation; where a graph node
and its source disagree, the source is right.* A committed A-Box makes that rule unenforceable in
practice, because the stale copy is the one sitting in the repository looking authoritative.

**Scale.** A single guideline carries tens to hundreds of recommendations, each with PICO,
evidence and remarks; a DAK's data dictionary runs to hundreds of rows. Across the estate that is a
large amount of generated JSON in version control, diffed on every regeneration, reviewed by nobody.

**Lifecycle mismatch.** The ontology changes when the model changes — rarely, deliberately, with
review. An extracted graph changes whenever its source does. Putting them in one repository means
every guideline revision and every DAK release churns the repository that consumers pin for their
schema.

**There is already a precedent in this estate.** smart-base's
`input/scripts/generate_jsonld_vocabularies.py` runs *after* the IG Publisher and writes JSON-LD
vocabularies into the **built** Implementation Guide, published at a canonical URL. They are not
committed. A DAK graph is the same kind of artifact and should travel the same path.

---

## The shape of the whole thing

```
                        smart-base  (here)
                          L1/ L2/ L2-bpmn/ L2-dmn/ L3/  schemas/      T-Box, one named subgraph per layer
                          L1/schemas/generated/all.cypher  all.ttl     the lot, one file
                          L1/schemas/generated/recommendation-graph.schema.json   constraints
                          L1/schemas/  (engine)   L1/schemas/docs/
                             │
                             │  ontology + shapes, fetched by URL or pinned by version
              ┌──────────────┴───────────────┐
              ▼                              ▼
  ┌───────────────────────┐    ┌──────────────────────────────┐
  │ a guideline           │    │ a DAK IG build               │
  │  PDF → recommendations│    │  DMN  → citations      (l1)  │   ← the A-Box,
  │                       │    │  FSH  → nine components(l2)  │     published not committed
  │                       │    │  BPMN → interiors (l2-bpmn)  │
  │                       │    │  DMN  → interiors  (l2-dmn)  │
  └───────────────────────┘    └──────────────────────────────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
              triplestore / Neo4j  ←  where cross-guideline queries happen
```


### For a publisher of extracted graphs

Generate the graph during the build, beside the JSON-LD vocabularies smart-base already emits, and
publish it with its source:

```
https://smart.who.int/<dak>/dak.kg.jsonld
```

It should declare the `ontologyVersion` it was built against and carry `wasDerivedFrom` hashes for
every DAK source it read. Both are already required by
[`smart-base/L1/schemas/generated/recommendation-graph.schema.json`](../generated/recommendation-graph.schema.json), and both are what make a published
graph checkable rather than merely recent.

Add it to `.gitignore`. A graph that appears in a diff is a graph someone will eventually edit by
hand.

### For a query layer

Load the published graphs into a triplestore or Neo4j. That is where a question spanning several
guidelines or DAKs gets answered, and git is the wrong tool for it — git stores versions of files, not a
queryable graph. The store is a cache: rebuild it from the published documents rather than treating
it as a system of record.

### For this repository

Nothing. Not even a fixture.

[`smart-base/L1/schemas/test/negative.test.ts`](../test/negative.test.ts) builds the smallest documents that exercise
every rule — four of them, one per layer, a few nodes each — in memory, and CI checks those against
both the shapes and the ontologies. `--emit <dir>` writes them out for the tier-1 run and nothing
else. They are also what makes the cross-layer join testable: the L2-DMN document cites a citation
the L1 document defines, and the two are validated together as one graph.

A committed fixture large enough to be interesting is a dataset wearing a fixture's name.

If a real guideline or DAK graph ever appears in this repository, the rule at the top of this page
has quietly stopped holding.

---

## The one case for committing a graph

A **frozen snapshot accompanying a publication** — a graph as it stood for a named release,
kept so a result can be reproduced years later. That is an archival artifact, not working data, and
it belongs with the release it documents: a release asset, or a tagged directory in the source's
own repository. Not here, and not on a branch anyone is expected to keep up to date.

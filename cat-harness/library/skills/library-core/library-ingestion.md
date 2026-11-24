---
name: library-ingestion
description: >
  The BASIC ingestion flow every asset takes: an upload is accepted, its
  metadata goes into the knowledge graph, and the asset lands in
  `library/<slug>/` if it is materialized. The two entry points (a drop in
  `uploads/`, or materializing an asset a remote graph lists), what happens to
  the upload afterwards, and why content-type methods refine this flow from
  above rather than living in it. Command: `bun run cat ingest`.
graph-typologies:
  - library
  - uploads
---

# Library ingestion — the basic flow

`uploads/` and `library/` are two stages of **one** pipeline. `uploads/` is the
incoming queue — raw files as dropped, **not L1 and not greppable as corpus**.
`library/<slug>/` is where an ingested asset lives, and every knowledge-graph
reference to a source resolves *through* it. **Why that bites:** the
corpus-grep checklist searches `library/` only, so a file still in `uploads/`
makes a *clean grep* mean "nobody has done this" when the source is right
there. That is how a held result gets re-derived.

## The flow — four steps, and no content-type decision

cat-harness holds only the basic, high-level ingestion workflow, with very
little process context assumed: the uploaded asset's extracted metadata goes
into the KG, and the asset into `library/` if materialized.
`library/processes/document-ingestion.bpmn` (`Process_Ingestion`) is that
flow, executable:

1. **Accept** — the bytes reach the declared `uploads/` queue by a declared
   route ([`upload-routes`](upload-routes.md); names per
   [`upload-naming`](upload-naming.md); arrival noticed by
   [`uploads-watch`](uploads-watch.md)).
2. **Extract metadata into the KG** — [`asset-extraction`](asset-extraction.md):
   a container's INDEX goes in, its contents do not unless asked for.
3. **Materialized?** — the state vocabulary is `schemas/kg/materialization-state.ts`:
   `referenced`, `materialized` or `unknown`, with no default.
4. **Place in `library/<slug>/`** — this skill. A `referenced` asset is still
   catalogued: its record says where the bytes are and that we hold none.

The flow **calls no subprocess and decides nothing about content type.** Which
reader a PDF needs, what a complete L1 entry holds, how images or datasets are
described — those are **refinements**, and they live in a layer above this
one. The mechanism is inversion: a higher-layer process CALLS
`Process_Ingestion` as its first step and continues with its own work. Nothing
here names a refinement, because there is no BPMN extension point in the
corpus and a harness process naming a higher one would be an upward edge.
`methodology-from-source.bpmn`'s `Call_Ingest` is a harness caller of the same
flow.

## TWO entry points

Things enter the library through `uploads/` → `library/` document ingestion,
or through materializing an asset listed in an external KG that a dependent
harness declares.

| | **drop** | **materialize** |
|---|---|---|
| the source is | a file somebody put in `uploads/` | an asset listed in a remote graph a dependency declares |
| decided first | how it is read (a refinement's choice) | the five gates, and a purpose |
| entry | `bun run cat ingest uploads/FILE` | `materialize-remote.bpmn` |

**Neither is a shortcut past the other.** A materialized asset still arrives as
bytes that have to be read, so it re-enters at exactly the point a dropped file
does. Materialization adds what happens *before* there is a file: may we hold
it, what does holding it cost, for what purpose, and what if the source goes
away.

**Entry one** is `bun run cat ingest uploads/FILE` (`--dry-run` says what it would
do, and why). **Entry two** starts from `remoteGraphs` in a layer's
declaration (`schemas/kg/cat-harness.ts`, `RemoteGraph`): assets listed there are
`referenced` — we know they exist and where, and hold none.
`materialize-remote.bpmn` asks **purpose** (`working` or `archival`), then the
five gates, then fetches; the asset lands in `library/` with its provenance
and fixity, and a refusal leaves the node `referenced` rather than failing.
**A reference is not a fetch**: the KG viewer follows a remote graph to show
its hierarchy without materialising anything — navigable without being held.

### Who owns which half

- **This layer owns the basic flow and the reading CODE** — the `pdf-*` rungs,
  `ingest-document.ts`, `notebook-structure.ts`. Reading bytes is platform
  work, and **OCR stays here**. The method that chooses among them is a
  refinement above. The flow itself cannot move up: `uploads` and `library`
  are graph typologies this layer declares, and a flow above would make the
  harness's own `library` writable only from a layer above it — a
  wrong-direction, and circular, dependency.
- **The remote half's gates belong to the content layer above.** Only the
  state vocabulary lives here; the five gates, the purposes and the record
  binding them stay with the layer that owns content, because each gate is a
  decision about content. A harness that cannot hold content must not own the
  vocabulary for deciding to acquire it.
- **The `large-datasets` package owns the question before both**
  ([`library/skills/large-datasets/`](../large-datasets/materialize-remote.md)): how to
  enumerate a corpus and ask it for a subset (`source-descriptor.ts`). Neither
  entry point can start until something says what is out there.
- **Further down the tree**, a dependency's declared `remoteGraphs` is what
  makes the second path reachable at all, inherited the way directories are.

## A held PDF gets its page-1 cover BEFORE the upload is retired

The picture of a PDF entry is `library/<slug>/cover.png`, page 1 rendered by
`pdf-cover.py` — never its first figure, which can be any picture from deep in
the document. With no cover, the entry shows the book glyph.

- A new ingest writes it: `ingest-document`'s cover arm runs last.
- An entry without one gets it from `bun run cat library:covers`.
  Run it **in the checkout that holds the PDF** (the composed index, whose
  `uploads/` may be another repository's), and commit the cover into the
  repository that holds the entry.
- Run it **before the upload is retired**. Once the PDF moves to
  `fsh-guts/uploads/`, `library:covers` no longer finds it and skips the entry
  as "not held".
- `bun run cat library:covers:check` fails on a held, unwithheld PDF that has
  no cover.

## After ingestion the upload is RETIRED — never left, never deleted

Three places, and only `uploads/` is temporary: **queued** `uploads/FILE`; **derived** `library/<slug>/`, which may
not hold the source bytes (`check:l1-complete` reports an unexpected child);
**archived** `fsh-guts/uploads/FILE` beside a `folio-fsh-guts/v1` sidecar whose
`movedFrom` and `movedOn` are load-bearing. **Never `rm`** an ingested upload:
it is the only working-tree copy of the source. `bun run cat check:uploads-retired`
finds unretired ones by **sha256 against every declared library**, never by
filename, and refuses rather than passes when no library records a hash. It
reports and never moves anything. **Rename an upload before its first
ingest** — the slug follows the name.

The full rule — why the library cannot be the destination, the sidecar
convention, the blocking and advisory families, and renaming — is in
[`library-ingestion/uploads-retirement.md`](library-ingestion/uploads-retirement.md).

## When an ingested document names what else the library needs

Some documents say what they rest on, by number, in a section the content type
defines — and then the library is not complete until it holds those too. The
flow above is run again for each, and the citing document's graph is
regenerated once they are in, so a cited source the library HOLDS is described
from its own metadata rather than from a one-line reference.

The content type owns which section that is, how its citations resolve, and how
a cited source is acquired (for instance from a DSpace repository); it says so
in its own authoring skill. This layer owns only the rule: the flow above runs
once per cited source, and the citing document's graph is regenerated after.

## A second representation sits DOWNSTREAM of the entry

A content type may describe an ingested document a second time, in its own
schema — a WHO guideline is also an L1 knowledge graph. **The library is
upstream of L1: L1 points upstream, never downstream.** So that representation is derived from the entry and points at the entry's nodes
(the source document, its sections, its blocks); nothing in the library points
back, and the entry is never rewritten for it. It inherits whatever sectioning
this flow produced, so a better reader here improves it without a change there.
Whether a document gets one is recorded on its intake (`classifications`), by
a person, by the process that acquired it, or by a rule — the content type
owns which, and its skill says how.

## Related

- [`directory-conventions`](../../../skills/kg/kg-core/directory-conventions.md) — the graph typologies and who declares them; `uploads` and `library` are both declared by this layer
- [`content-acquisition`](content-acquisition.md) — accepting an offered resource, or asking for one, before this flow starts
- `library/processes/document-ingestion.bpmn` — the flow above, as `Process_Ingestion`

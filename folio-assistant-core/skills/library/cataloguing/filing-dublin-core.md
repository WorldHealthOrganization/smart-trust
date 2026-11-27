---
name: filing-dublin-core
description: >
  Cataloguing a source as it arrives — which facts are `dcterms`, which are
  this project's own, and why the line is drawn by the vocabulary rather than
  by convenience. The bibliographic layer only; the derived layer belongs to
  ingestion.
---

# Filing a source: what Dublin Core carries, and what it does not

This is the **librarian's** half of intake. A file lands in `uploads/`;
describing *what it is* is filing, and deriving structure from it is
`library-ingestion`
([`uploads-and-library-are-two-stages-of-one-pipeline`](../../../docs/source/guides-document-ingestion/uploads-and-library-are-two-stages-of-one-pipeline.md)).

## The line, and it is drawn by the vocabulary

`folio-assistant-core/docs/source/guides-document-ingestion/how-much-of-this-does-dublin-core-carry.md`
is the source of truth; in summary:

**Dublin Core covers the bibliographic layer well** — `dcterms:title`,
`creator`, `date`, `language`, `identifier`, `hasPart`, `format`, `extent`. A
per-folder record and an archive's part/whole structure sit comfortably there.

**It does not cover the derived layer.** A narrative description of a figure, a
transcript, a back-translation confidence, a sheet's column headers, and above
all the **provenance of a generated narrative** are not `dcterms` terms.

The house rule (`schemas/jsonld.ts`):

> **generalising is sound; inventing is not.**

Where an existing vocabulary has the term, use it. Where it does not, the term
goes in this project's own namespace, not into an approximate `dcterms` one:
consumers read a `dcterms` term by DCMI's definition, not ours.

## What is NOT decided, and must not be decided from memory

**Which vocabulary to reach for beyond Dublin Core is not yet decided.**
PROV-O is the obvious candidate for provenance. Do not mint a `prov:` term
because it sounds right: read the published specification, or leave the fact in
this project's namespace and say why.

The same applies to Dublin Core itself: before using a `dcterms` term not listed
above, read the DCMI specification (refinements and range constraints) rather
than inferring it from the name.

## What to record at INTAKE, and what waits

Filing captures how the thing arrived, which nobody can reconstruct later:

| fact | why it cannot wait |
|---|---|
| where it came from — the URL, the query, the person | a file in a queue has no origin written on it |
| when it was captured | the web changes; "now" is not recoverable next week |
| how it was captured | a PDF print and a crawl are different artefacts (see [`archiving-web-pages`](archiving-web-pages.md)) |
| what came with it | assets, sidecars, the parts of a multi-file capture |
| the identifier the source claims for itself | a DOI or an arXiv id is the publisher's identity, not ours |

The `.extraction.json` sidecars in a layer's `uploads/` model most of this —
`container`, `method`, `capturedAt`, `producer`, `readAt`, `assets[]`. Read one
before designing a new shape.

Everything else — sections, structure, OCR, derived narrative — is the
ingestion engine's and is recorded in `library/<bib-slug>/`.

## A sidecar is not a document

`<source>.extraction.json` describes the capture of `<source>`: metadata about
a queued unit, not a queued unit. **A file that describes another file in the
same queue is not itself waiting to be ingested.** An *orphan* sidecar, one
whose source has gone, must stay visible in the queue view.

## Identifiers are claimed, not assigned by us

A DOI, an ISBN, an arXiv id and a WHO publication number are the *publisher's*
identity for the thing. Record them as `dcterms:identifier` values with their
scheme; do not normalise them into one string, and do not treat the absence of
one as a defect. A working paper legitimately has none.

The slug under `library/` is **ours** and is a different kind of name: it is
how this corpus addresses the item, and every knowledge-graph reference
resolves through it. Do not derive one from the other silently: record the
mapping.

## A folio whose bibliography is CSL-JSON

A folio that cites its sources as CSL-JSON (`references/<key>.json` or
`<folio>/schema/references.ts`) and joins uploads to references in its source
ledger already holds the bibliographic facts. Do not re-type them into
records by hand: declare a `catalogue` directory and run the
`catalogue-from-references` Tool
(`bun run cat catalogue:from-references <instance> --apply`). It writes one
record and one item node per entry the ledger joins to exactly one reference,
leaves every other entry alone, and judges no licence (every gate stays
`unknown`). The reference stays the source of truth: change it and re-run,
never edit the generated record.

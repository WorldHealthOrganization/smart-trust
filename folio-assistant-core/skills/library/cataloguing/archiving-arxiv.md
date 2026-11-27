---
name: archiving-arxiv
description: >
  Materializing a paper from arXiv — why the version suffix is part of the
  identity rather than a detail, what to keep beside the PDF, and which facts
  must be read from the published API rather than recalled.
---

# Materializing from arXiv

## The version suffix is part of the identity

An arXiv id without a version (`2602.12670`) names *the latest* version, a
moving target. A paper can gain a version after you cite it, and then:

- the section you quoted may have moved, been rewritten, or gone
- a numbered result may refer to something else
- the PDF you archived and the PDF a reader fetches are different documents
  with the same name

**Record the versioned id, always** (`2602.12670v4`, what was read). If a
source arrived without a version, resolve and record the version at capture
time; do not leave it blank. The id is recorded as claimed, as
[`filing-dublin-core`](filing-dublin-core.md) states for identifiers generally.

## What to keep beside the PDF

The PDF is only the rendering (compare
[`archiving-web-pages`](archiving-web-pages.md)):

| artefact | why |
|---|---|
| the **versioned id** and the abstract-page URL | the canonical handle, and where the metadata lives |
| the **metadata record** — title, authors, date, categories, abstract | this is the `dcterms` layer, and it is authoritative from arXiv rather than inferred from the PDF |
| the **DOI**, when the submission has one | many arXiv papers are also published; the DOI is a different identity for a possibly different version |
| the **licence** the submission declares | see below — it varies per paper |
| the **e-print source**, where the licence permits | the PDF is typeset output; re-extraction from source beats OCR of a rendering |

## The licence is per submission, and it is not uniform

arXiv hosting does **not** imply a redistributable licence; terms vary per
submission. Record the declared licence with the capture. Whether this project
may redistribute a source is a **person's** decision, made from that record.

### The set a submitter chooses from

The submitter picks one, certifies they may grant it, and **cannot change it
afterwards**. Record it as a [`source-licence`](../../../../cat-harness-tools/schemas/library/source-licence.ts)
record, the one licence vocabulary that a library manifest carries in
`meta.licence` and an upload carries in `intake.json`.

| as arXiv names it | `id` to record | may a folio redistribute it? |
|---|---|---|
| CC BY 4.0 | `CC-BY-4.0` | yes, with attribution; commercial use allowed |
| CC BY-SA 4.0 | `CC-BY-SA-4.0` | yes, with attribution — **derivatives must carry the same licence** |
| CC BY-NC-SA 4.0 | `CC-BY-NC-SA-4.0` | non-commercially, share-alike |
| CC BY-NC-ND 4.0 | `CC-BY-NC-ND-4.0` | verbatim only, non-commercially — **no derivatives**, so an extracted-and-restructured L1 entry is not covered |
| CC Zero | `CC0-1.0` | yes, unconditionally |
| arXiv.org perpetual, non-exclusive licence 1.0 | `http://arxiv.org/licenses/nonexclusive-distrib/1.0/` | **no.** It licenses *arXiv* to distribute, and limits re-use by anyone else |
| (pre-2004 submissions) | `http://arxiv.org/licenses/assumed-1991-2003/` | **no.** Same effect — see below |

**The last two have no SPDX identifier** (the schema says "SPDX where one
exists"): record the licence URI as the `id`, never an invented SPDX-shaped
string.

A CC BY-NC-ND source can be cited and quoted, but not restructured into content
blocks and shipped: ingestion's restructuring is what "NoDerivatives" withholds.

### Four readings that look right and are not

**An arXiv licence is not an open licence.** The "arXiv.org perpetual,
non-exclusive licence" grants *arXiv* the right to distribute, not the reader.

**Absence is not permission.** Submissions before January 2004 predate explicit
licensing, so arXiv operates on an *assumed* licence equivalent to its own.
That is a determined fact, so the record is `stated` with the assumed-licence
URI and a `basis` naming the submission's date — **not** `unknown` (`unknown`
asserts that somebody looked and could not establish it).

**The licence belongs to the version, not to the paper**
([the version-suffix rule](#the-version-suffix-is-part-of-the-identity)):
versions of one submission may carry different licences. Record the licence of
the version archived (`2602.12670v4`), not v1's from the abstract page.

**The metadata field may understate the rights.** An author whose required
licence is not on arXiv's list may select the arXiv licence and state the real
one *on the first page of the article*; publisher permissions land there too.
If page one carries a licence or copyright statement, it is part of the answer,
and the `basis` says which of the two was read.

### What is always safe

**Article metadata is dedicated to CC0 1.0**, whatever the article's own
licence. Title, authors, date, categories and abstract can be recorded and
republished even when the full text cannot, so an entry blocked on
redistribution still carries a complete `dcterms` layer.

**A recorded arXiv licence does not go stale.** The choice is irrevocable per
version, so it needs no re-checking; only archiving a *different version*
changes it.

These facts are arXiv's, stated at
<https://info.arxiv.org/help/license/index.html> and
<https://arxiv.org/licenses/assumed-1991-2003/license.html>, and captured in
`uploads/arxiv-license-information/` and
`uploads/arxiv-licence-assumed-1991-2003/`. When a decision turns on the
wording, read them there rather than this table.

## What must be read, not recalled

**Do not write arXiv API endpoints, query parameters or response field names
from memory into code or into this page.** Look them up: an almost-right field
name parses to `undefined`, and the record silently loses its authors.

arXiv has two identifier schemes (an older one with a subject prefix, a newer
numeric one). Check any parser against the published identifier specification,
not against sample files. This is the rule
[`how-much-of-this-does-dublin-core-carry.md`](../../../docs/source/guides-document-ingestion/how-much-of-this-does-dublin-core-carry.md)
states for vocabularies, applied to an API.

## Where it lands

A materialized paper is a **queued unit**, not corpus. It arrives in
`uploads/` with its capture record, and the uploads view counts it as waiting
until [`l1-document-ingestion`](../ingestion/l1-document-ingestion.md) has made
an L1 entry from it.

Never write straight into `library/`: the completeness gate decides an entry is
finished, and a source that skipped the queue skipped the gate. On failure the
pipeline keeps the document in `uploads/` and opens a bean.

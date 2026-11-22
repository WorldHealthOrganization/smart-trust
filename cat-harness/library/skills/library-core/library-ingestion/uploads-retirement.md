---
part-of: library-ingestion
description: >
  Detail for `library-ingestion`, split out of it so the parent stays a short
  entry point. NOT a skill of its own — reached through the parent. What
  happens to an upload once it is ingested, the check that enforces it, and
  why a rename comes first.
---

# library-ingestion — retiring an ingested upload

## What happens to the upload after it is ingested — it is RETIRED, not left and not deleted

`uploads/` is a queue, not an archive. Once a source is ingested into the KG
and into a proper `library/` under a harness, its bytes move to `fsh-guts/`.
The lifecycle has **three** places, and `uploads/` is the only temporary one:

| stage | where | what it holds |
|---|---|---|
| queued | `uploads/FILE.pdf` | the source, **not yet ingested** — this is what the queue viewer counts |
| derived | `library/<slug>/` | `sections/`, `blocks/`, `images/`, `structure.json`, the manifest |
| archived | `fsh-guts/uploads/FILE.pdf` + its sidecar | the **source bytes**, kept and addressable, off the rendered site |

An ingested source's `*.pdf.extraction.json` companion moves with it, being a
derived artefact of the same ingest rather than a queue item.

### Why the library cannot be the destination

A library entry may not hold the bytes, and that is enforced.
`ENTRY_DIRECTORIES` is `sections`, `blocks`, `images`, `ocr`; `ENTRY_SIDECARS`
is `images.json`, `vector-labels.json`, `manifest.jsonld`, `summaries.json`,
plus the one kind marker. A PDF dropped into a promoted entry makes
`check:l1-complete` report it as an unexpected child.

The entry records `source_sha256` and the technical metadata, which lets a
re-derivation be checked against the original. It does not record the
original, so the source lives elsewhere.

### `fsh-guts/` is that somewhere, and it already has the contract

[`fsh-guts`](../../../../skills/kg/kg-core/fsh-guts.md) is *"the trashcan that is kept"*: addressable,
exported, greppable, and deliberately absent from the canonical render.
**Delete means relocate.** `fsh-guts/uploads/` is its own sub-directory beside
`retired/` and `scripts/`, because an ingested source is neither.

A PDF cannot carry front matter, so an archived upload keeps its bytes beside
a same-basename `.md` sidecar that declares them, as other `fsh-guts/` files
do:

```yaml
---
$schema: folio-fsh-guts/v1
title: "wang-rangaiah-2026-mcdm-aggregation.pdf"
kind: source
movedOn: 2026-09-29
movedFrom: "uploads/wang-rangaiah-2026-mcdm-aggregation.pdf"
summary: >-
  Ingested to `cat-harness/library/corpus/content/wang-rangaiah-2026-mcdm-aggregation/`;
  cited by `methodologies/mcdm-aggregation.md`. Archived here after promotion.
---
```

`movedFrom` and `movedOn` are required: without them a node there is an
orphan, and abandonment cannot be told from accident.

### What this makes true

`gen-uploads-viz.ts`'s `itemState` returns `waiting` or `ingested`, and the
headline is the UNINGESTED count, because that is what means work is owed.
`ingested` is a **transient** state: an upload sitting in it is a retirement
nobody has done yet.

**Never `rm`.** Deleting an ingested upload removes the only copy of the
source from the working tree (git history is not the same thing), and every
derived artefact in `library/` becomes unreproducible from a checkout.
`deletion-requires-confirmation` governs any exception.

### The check: `check:uploads-retired`

Do not retire uploads by a hand sweep: an answer computed over less than the
corpus looks exactly like an answer over all of it (one library instead of
every harness's, the top level of a queue instead of its per-source
directories, a copy mistaken for a move).

```sh
bun run cat check:uploads-retired
```

It matches on **sha256 against every declared library's recorded
`source_sha256`**, never on filename — `2509.06388v1.pdf` is archived as
`wang-rangaiah-2026-mcdm-aggregation.pdf`. Two families:

- **blocking** — an already-ingested **bare drop** in a queue. The remedy is a
  `git mv` plus a sidecar, or a `git rm` when identical bytes are already
  archived. The two are distinguished, because conflating them leaves files
  in two places.
- **advisory** — an already-ingested file inside a **per-source intake
  directory** (the IRIS replica's `uploads/<slug>/` holds the PDF beside an
  `intake.json` and an `iris-capture/`). Moving the PDF alone would leave that
  record naming a file that is not there, so whether such a source retires as
  a file or as a directory is that layer's layout decision. Reported on
  every run with its count; **not** exempted.

It refuses rather than passing when no library records a `source_sha256`. It
asks both roots — the repository root, which declares the checkout's
`uploads/`, and `cat-harness`, which declares a library — because neither
alone is the corpus.

It reports and never moves anything: `deletion-requires-confirmation`.

### Renaming an upload is done BEFORE the first ingest

The slug is derived from the upload: `_pdf_doc_id.py` reads an arXiv id off
page one's text layer and falls back to the basename slug. A source with no
arXiv stamp is therefore named by hand first, to the author-year convention —
`gurel-tat-2017-swot-analysis`, `wang-rangaiah-2026-mcdm-aggregation` — and the
slug follows. Renaming afterwards means re-ingesting under the new name and
removing the old entry.

---
name: asset-extraction
description: >
  Reading a container — a zip, a PDF, a saved web page — into the knowledge
  graph. What goes in by default (metadata), what does not (contents), the
  three timestamps that sit near each other and mean different things, and why
  a producer string is evidence.
---

# Asset extraction — the index goes in, the contents do not

A container arrives in `uploads/`: a zip of a saved web page, a PDF, a
tarball. Something inside it is wanted. **What enters the knowledge graph is
the INDEX** — what is in there, how big, what type, when it says it was
written — and not the files. Contents are extracted only when a person
explicitly asks.

```sh
bun run cat-harness-tools/scripts/extract-assets.ts <container>
bun run cat-harness-tools/scripts/extract-assets.ts <container> --extract <path> --because "<why>"
```

The first writes a `folio-extraction/v1` record beside the container. The
second additionally writes **one** named entry, and refuses without a reason.

## Why metadata is the default

A container's index is cheap and complete: a zip's central directory carries
every entry's size, name and timestamp without decompressing a byte. That is
enough to answer *what is in here*, *how big is it*, and *is any of it what I
want* — which is every question asked before somebody decides to take a file.

Extracting by default costs the opposite: a working tree full of files nobody
chose, each of which now looks committed-on-purpose to the next reader, and
none of which carries a reason.

**`--because` is required, and it is the point of the flag.** An entry written
to disk with no stated reason cannot be told from one nobody authorised. The
schema refuses it (`ExtractedAsset.superRefine`), so this is not a habit that
depends on remembering.

## The three timestamps, and the one that gets confused

| | says |
|---|---|
| `dc.date.issued` | when the PUBLISHER published the work |
| `materializedAt` | when WE brought the bytes local |
| `capturedAt` | when a TOOL produced this file out of something else |

**An extraction timestamp is never a publication date.** For example, a WHO
IRIS capture:

```
zip entries      2026-09-20 07:42   (all 11 of them)
page PDF         CreationDate D:20260920074221
info PDF         CreationDate D:20260920074925
```

The style guide those files contain was **published in 2020**. Every timestamp
in the capture is 2026, and every one of them is the moment somebody pressed
save. Folding the two would date a 2020 publication to 2026 and lose the only
evidence the artefact is second-hand.

`isSingleCapture()` computes the distinction rather than asserting it: when
every entry shares one minute, ONE ACT wrote the container and no entry's date
says anything about that asset's own history. When they differ, the container
preserved real dates and they can be read as such.

## A producer string is evidence, and is recorded verbatim

Both captured PDFs carry `Producer: Skia/PDF m152`. That is Chrome's
print-to-PDF — so neither file is WHO's own PDF, both are **printed web
pages**, and nothing else in a file listing, a byte count or a checksum shows
it.

Recorded as written, never normalised to "Chrome": the version is part of the
evidence, and a normaliser is a place for the fact to get smaller.

This is the mechanical half of a judgement the IRIS intake already records by
hand — the page PDF is filed with role `none`, because *"we looked and it is
not what it appears to be"* is a different fact from *"nobody looked"*.

## What is NOT dropped silently

A zip written on macOS carries a `__MACOSX/` shadow per entry. Skipping them
quietly makes the asset count disagree with the container's own, and a reader
reconciling the two finds nothing to explain the gap. They go in `omitted[]`
with a pattern, a reason and a count.

## Derived renderings — the artefact we MADE, out of bytes we hold

A cover thumbnail, an OCR text layer, a page raster, a converted figure: none
of these came from the source. They were produced here, from something the
source supplied, and **the catalogue records an artefact, not where it came
from** — so a derived file with a plausible name and a `materialized` state is
indistinguishable from one the publisher shipped.

DSpace makes this concrete. It generates a `THUMBNAIL` bundle of its own, so
"a THUMBNAIL bitstream on an IRIS item" reads, to anything downstream, as
IRIS's thumbnail. The three WHO IRIS covers in this repository are **not**
those: `iris.who.int` is egress-blocked here, nothing upstream was fetched, and
each is page 1 of a PDF already held, rasterised by
`cat-harness-tools/scripts/pdf-cover.py`.

Three rules, in the order they bite:

1. **`of` names what it was DERIVED FROM, not what it is ABOUT.** The Handle
   identifies the item; putting it on a cover we rendered asserts IRIS supplied
   the image. `local:cat-harness/uploads/<file>.pdf#page=1` says the true thing
   and resolves to the true thing.
2. **The declaration is authored, and the tool refuses without it.**
   the content core's `scripts/gen-covers.ts` will not write bytes for a `THUMBNAIL`
   whose `materialization.note` does not declare the derivation. Generating
   that sentence would make the check circular — a tool cannot attest to its
   own output.
3. **`purpose: working`, never `archival`.** A rendering is regenerable from
   bytes already held and answers no source-loss question;
   `MaterializationSchema` already refuses a `working` copy that claims to
   discharge `sourceLoss`, and this is the case that rule was written for.

**Take the determined division, not the clever one.** `pdf-cover.py` renders
page 1 and calls it the cover, for the same reason `pdf-pages.py` sections by
page: page 1 is a determined answer and "the cover" is not. Covers differ in
shape (portrait, landscape, a scanned title page), and a heuristic has no way
to say when it is unsure.

**Record the geometry.** `Bitstream.pixelWidth`/`pixelHeight` exist so a
listing reserves the box before the bytes arrive. Absent is *unmeasured*, not
square.

**Check the claim where the check can actually run.** A gate that re-renders a
derived artefact needs the backend that produced it, and the CI job that runs
this repository's gates installs `ruff` and nothing else (stated on
`ingest-stdlib`'s Tool node). Do not install a backend in the gate job, and do
**not** degrade to could-not-determine — that would report `unknown` on every
CI run, which is a check nobody can read. Split the claim instead. Of the five things a node
asserts about a derived image, four need no decoder at all:

| claim | needs the backend? |
|---|---|
| the bytes exist | no |
| their sha256 is the declared one | no |
| their length is the declared one | no |
| their pixel dimensions are the declared ones | **no** — a PNG's `IHDR` puts width and height at bytes 16..24, big-endian |
| these bytes are what that source renders to | **yes** |

So the gate keeps its teeth everywhere and gains the last row where the
backend happens to be present — and it **says in its own output which of the
two it ran**, because "3 covers verified" would read identically either way
and the two are different assurances.

## Where the record lives

Beside the container, in `uploads/`. **`uploads/` is a `state` graph** — a
queue that ingestion drains — so an extraction record is not L1 corpus and
does not read as one. What a THEME or a LIBRARY entry cites is the extracted
file's `localPath`, which exists only once somebody asked for it.

## Related

- [`library-ingestion`](library-ingestion.md) — the other way in. A container
  read this way has not been ingested; it has been *described*.
- `schemas/content/extraction.ts` in this harness — the record, and why each
  field is optional or not.
- `schemas/materialization.ts` in the content core — `materializedAt`, the
  timestamp this one is most often confused with; its state vocabulary is
  `schemas/kg/materialization-state.ts` here.
- `cat-harness-tools/scripts/pdf-cover.py` — the generic page raster, and
  the content core's `scripts/gen-covers.ts` the catalogue wiring (any layer; the catalogue decides which
  documents get one) that checks every claim it makes about them.

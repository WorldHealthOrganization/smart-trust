---
name: iris-dspace
description: >
  How WHO IRIS uses DSpace and qualified Dublin Core — the three identifier
  systems, MeSH as a controlled vocabulary, bundles, and the containment path —
  and the requirements a tool reading a record must meet.
conformsTo:
  - dcmi-terms
graph-typologies:
  - catalogue
---

# IRIS, DSpace and Dublin Core

Every claim here is read off one captured record: the DSpace full item record
for `wpr-rdo-2020-003-eng`, transcribed at
[`catalogue/records/wpr-rdo-2020-003-eng.dc.json`](../catalogue/records/wpr-rdo-2020-003-eng.dc.json).
Nothing is asserted from general knowledge of DSpace. Where this file and the
record disagree, the record wins.

The type is `folio-assistant-core/schemas/dublin-core.ts`. It is generic:
Dublin Core is ISO 15836 and DSpace is a platform. This file covers only what
IRIS does with them.

## Scale

From IRIS's storage report (By Location → Entire Site) and home page, read
2026-09-20:

| | | source |
|---|---|---|
| items | **273,559** | the home page's search placeholder |
| files | **1,057,223** | the storage report |
| storage | **361.55 GB** | the storage report |
| top-level communities | **8** | the storage report |

Items and files are different denominators, so `catalogue/catalogue.json`
carries them in separate fields, `totalItemsUpstream` and
`totalFilesUpstream`. That is **3.86 files per item**, because an item carries
several bitstreams.

`totalBytesUpstream` is **derived**: the report prints two decimals and no byte
count, so the value is `round(361.55 × 1024³)`, good to about ±5 MiB. It is GiB
rather than GB because every per-community figure the report prints (238.58,
19.72, 34.84, 26.14, 25.71) reproduces exactly at 2³⁰ and none does at 10⁹.

## Three identifier systems

The worked item carries all three:

| system | value | authoritative? |
|---|---|---|
| DSpace UUID | `18892cf3-5a4f-42a4-923c-a93f4a594dec` | **no** — IRIS's own, stable only while this DSpace instance is |
| Handle | `10665/332098` | **yes** — guaranteed by the Handle System, outside WHO |
| WHO govdoc | `WPR/RDO/2020/003` | no — WHO's publication number |

The library slug `wpr-rdo-2020-003-eng` is derived from the govdoc, the weakest
key. A tool that resolves by Handle survives the source moving.

### A legacy handle is live in the record, and must not be deduplicated

`dc.identifier.uri` appears **twice**:

```
https://iris.who.int/handle/10665/332098          ← global
http://iris.wpro.who.int/handle/10665.1/14518     ← regional, merged away
```

Regional IRIS instances were folded into the global one and both URIs were
kept. The second is a real alternate identifier, and evidence that a source
host can disappear (the `sourceLoss` gate's worked example).

## Qualified, repeated, language-tagged

Every field is `element.qualifier`. **Four fields repeat in this one record**
(`dc.date.accessioned`, `dc.date.available`, `dc.identifier.uri`,
`dc.subject.mesh`), so `Record<string, string>` silently keeps the last value
and drops the rest.

There is a per-field **language column**, present on `dc.title`,
`dc.description` and each `dc.subject.mesh`, absent on the author, the dates and
the identifiers. **An absent tag is not `en`**: it is a value whose language
nobody asserted.

## MeSH is a controlled vocabulary, not a keyword

`dc.subject.mesh` = `Publishing`, `Guidelines as Topic`. These are **NLM Medical
Subject Headings**, with their own identifiers and hierarchy at
`https://id.nlm.nih.gov/mesh/`. A MeSH term can be *resolved* and *subsumed*
(searching "Guidelines as Topic" should reach narrower terms); a free-text
keyword can do neither. `DcValue.authority` records the distinction per value.

## An item is not a file: bundles

DSpace groups bitstreams into bundles — conventionally `ORIGINAL`, plus `TEXT`
(extracted), `THUMBNAIL` and `LICENSE`. **Size and format are per-bitstream**:
the 2.68 MB in the record is the PDF's, not the item's. Bundles are why there
are more files than items.

## Containment is a path, not a parent

The breadcrumb: `Home → 7. Regional Office for the … → Regional Office for the
W… → Information products` — four levels, two of them communities and one a
collection. DSpace also lets an item be **mapped into several collections**, so
"the" parent of a node does not exist. `CatalogueNode.parents` is a list of
*paths*.

## What a later tool needs — as requirements

| # | requirement | why, in one line |
|---|---|---|
| **R1** | Resolve by **Handle** where one exists; treat UUID and govdoc as secondary | only the Handle is guaranteed outside WHO |
| **R2** | Never deduplicate `dc.identifier.uri` | the second one is evidence of a host that vanished |
| **R3** | Preserve repetition on **every** field, not a known list | four fields repeat in a single record; assume more do |
| **R4** | Treat an absent `language` as *unasserted*, never as `en` | both states occur in one record |
| **R5** | Carry `dc.subject.mesh` as a **controlled** value with its authority | it can be resolved and subsumed; a keyword cannot |
| **R6** | Model bitstreams per **bundle**, with size and format on the bitstream | an item is not a file |
| **R7** | Model containment as a list of **paths** | four levels deep, and multiple mappings are legal |
| **R8** | Never infer metadata from the PDF when a record exists | OCR off a title page catalogued the WHO Editorial Style Manual as *Abies* |
| **R9** | Record what the source says even when it contradicts the file | `dc.description` says `30 p.`; the PDF has **33** |
| **R10** | An item with no known collection carries `parents: []` — never a guessed one | held-and-unplaceable is a STATE; inventing containment is unfalsifiable |
| **R11** | Key a node by **path** when its UUID is not in the capture | an invented UUID resolves to nothing while looking authoritative |
| **R12** | Keep the **page captured** and the **identifier** apart | `/items/<uuid>/full` is what was fetched; the Handle is what the item IS |
| **R13** | A `materialized` claim must name bytes that EXIST, and something must check it | an unchecked claim can name no bytes and still pass as held |
| **R14** | Read a storage figure in the units that round-trip its own bytes | IRIS prints "GB" for what its byte counts make **GiB** — a 7% error |
| **R15** | Never fall back to a parent URL when an item has no upstream URI | "no upstream URI recorded" is the answer; the front page is a lie that resolves |
| **R16** | A partial transcription must SAY it is partial | a truncated abstract that does not declare itself cannot be told from a short one |
| **R17** | Hold what you hold: model the bitstreams whose bytes are here | the handbook lists **8** upstream; this repository has **1** |
| **R18** | Do not "correct" a record that looks wrong | the English-titled editorial manual really does carry an **Italian** ISBN |
| **R19** | A derived figure must round-trip the figure it was derived from | `round(361.55 × 1024³)` bytes must render back as **361.55** GiB |
| **R20** | An item count and a file count are different denominators | 273,559 against 1,057,223 — a fraction built from the wrong one is off by 3.86× |
| **R21** | **Mint stable URIs at the extractor (Upstream Skolemization)** | minting `https://iris.who.int/entity/item/{handle}#{prop}_{idx}` at extraction leaves no blank nodes for a later pass to resolve |
| **R22** | **Append-only streaming partition writes** | A 300,000 item corpus cannot accumulate uncompressed in working memory; write quads directly to partition file streams |

### R8: where a library entry's title comes from

`who-pub-tps-931` shows why. Its `structure.json` carries `title: "Abies"` and
`authors_raw: "Cpe N"` — OCR noise off a scanned title page of the WHO Editorial
Style Manual. `9789241548960-eng` has three renderings of one title from the PDF
(`Handbook forGuideline Development 2nd edition` from joined title lines,
`GRC Handbook - second edition` from PDF docinfo, and the real one) and no
authority among them. The IRIS record settles both.

A library entry's title is taken, in order, from:

1. **the catalogue record**: `dc.title` of the Dublin Core record that the
   catalogue node naming the entry (`libraryId`) points at through `metadataRef`;
2. **`referenced.json`** `identity.title`;
3. **the PDF Info `/Title`** (`structure.json` `metadata.docinfo.Title`), only
   when it is not junk such as `Microsoft Word - …`, a file name, `untitled`, or
   an arXiv stamp;
4. **the slug**, which `check:library-qa` then reports as `title-missing`.

**The page-1 front-matter parse is never a title.** It may still feed search and
the section files' `doc_title`.

The manifest records which source won as `meta.title_source` (for example
`dc-record`) and where it came from as `meta.title_from`, so R8 can be checked.
The resolver is `cat-harness-tools/pipeline/library-title.ts`; the
library-ingestion skill carries the full rule.

## Covers: an artefact we made, filed where IRIS files its own

The replica's home page shows a cover beside each item in its Recent
Submissions strip, and each library entry page shows it too. **None of them
came from IRIS.** Each is page 1 of the item's PDF, rasterised by
`cat-harness-tools/scripts/pdf-cover.py` and filed as a `THUMBNAIL`-bundle
bitstream — the bundle name DSpace uses for the thumbnails **it** generates.
Nothing downstream can tell the two apart from the bundle name, so the
bitstream's `materialization.note` must say the cover was derived here.

The PDF is either held in this repository or, for a referenced item, fetched by
the `iris-cover-pdfs` GitHub workflow, matched against the sha256 its
`ORIGINAL` bitstream records, rendered and discarded. Only the cover PNG is
committed.

`folio-assistant-core/scripts/gen-covers.ts` (`bun run iris:covers`) renders
only covers the **catalogue asks for**: a node declares the `THUMBNAIL`
bitstream and the script supplies the bytes. It **refuses** to write bytes for a
`THUMBNAIL` whose `materialization.note` does not declare the derivation, since
a tool cannot attest to its own output.

`bun run iris:covers:check` compares the bytes, the recorded `sha256` and the
recorded pixel dimensions, re-rendering where the PDF is held. That is R13 for
covers. A cover whose PDF is not held can be verified but not re-rendered.

### The WHO emblem is masked on covers

The site chrome carries no WHO mark until the replica is published under WHO.
Covers are shown with the WHO emblem and wordmark blanked to flat grey before
the PNG is written, so the committed bytes never contain it. Each `THUMBNAIL`
bitstream declares the blanked rectangles and the reason as `maskedRegions`. A
title that contains "WHO" is not masked: it is the work's name. A cover whose
publication gates block it is shown as *cover withheld*, not *no cover*.

## Getting a record

DSpace 7 exposes `/server/api/discover/search/objects`, paged and filterable by
`dsoType`, `scope` and facets; communities are listed at `/community-list`. The
calls this repository makes, and what live IRIS accepts, are in
[`iris-rest-feed`](iris-rest-feed.md); the code is
`scripts/iris-cdn/rest-feed.ts`.

A record derived from a PDF rather than transcribed from IRIS must be marked
**derived**, so it can be replaced wholesale when the real record arrives with
nothing downstream having believed it.

Enumeration cost, subsetting and the characterisation that decides whether IRIS
may be cited at all are in
[`who-iris/sources/who-iris.json`](../sources/who-iris.json).

---
name: archiving-web-pages
description: >
  Capturing a web page so it can be cited later — the two fidelities, what each
  one is evidence of, and why capturing only one of them loses something that
  cannot be recovered. A URL is not an archive.
---

# Archiving a web page

**A URL is not an archive.** It is a request you hope somebody else keeps
answering.

## Two fidelities, and they are evidence of different things

| | **PDF (or image) capture** | **zip / tarball (the page's own bytes)** |
|---|---|---|
| what it preserves | how the page LOOKED, at one moment, to one renderer | what the page WAS — markup, stylesheets, scripts, assets |
| what it is evidence of | appearance and layout | content and structure |
| reads without tooling | yes, anywhere, forever | no; needs unpacking, and often a browser |
| survives the site going dark | yes | yes |
| lets you re-extract text/tables later | badly — through OCR or PDF text, lossy | yes, from the source markup |
| citable as "this is what I saw" | **yes, and this is its job** | weakly — a reader cannot glance at it |

**Neither substitutes for the other**: a PDF-only capture has lost the page's
images, stylesheets and interactive content for good. The default is **both**;
dropping one is a decision to record.

## What the capture has to carry with it

A file with no capture record is an orphan the moment it is renamed. Record,
as [`filing-dublin-core`](filing-dublin-core.md) describes:

- the **URL as requested**, and the final URL if it redirected
- **when** it was captured, to the timestamp
- **how** — "printed to PDF from a logged-in browser" and "fetched
  unauthenticated" are different documents, and the second is what a reader
  can reproduce
- **what came with it** — the asset list
- the **producer** — which tool, which version

The `.extraction.json` sidecars in a layer's `uploads/` carry `container`,
`method`, `capturedAt`, `producer`, `readAt` and `assets[]`. Read one before
inventing a shape.

## Things that are easy to get wrong

**A logged-in capture is not a public document.** If the page was behind a
session, the capture is of *your* view. Say so in the record, or a later
reader will cite it as though anyone could have fetched it.

**Dynamic pages do not capture themselves.** A page assembled by script after
load may print as an empty shell. Check that the content is in the capture.

**Paywalls and licences.** Being able to fetch something is not permission to
redistribute it. Record the licence or its absence; holding and publishing an
unlicensed capture are separate decisions, made by a person.

**A redirect chain is data.** Shorteners and trackers in the requested URL are
part of how the source was found, and the final URL is what should be cited.

## What is NOT settled here

The **archive format** is not decided. WARC is the standard web archiving
container and the obvious candidate; a plain zip of a single-page save is the
cheap one. Which to adopt, and whether a capture must be replayable rather than
merely stored, is settled against the published specification and available
tooling, not from memory (the rule
[`filing-dublin-core`](filing-dublin-core.md) states for vocabularies). Until
then, capture **both fidelities** and record how.

# who-iris

**The WHO Institutional Repository for Information Sharing, catalogued by
reference.** Staged as a top-level directory ahead of becoming its own
repository, where it will carry its own tools and themes.

**Contents**

<!-- readme:toc:begin -->

- [What is here, and what is only known about](#what-is-here-and-what-is-only-known-about)
- [The worked example](#the-worked-example)
- [The library](#the-library)
- [The style guide, derived from the library](#the-style-guide-derived-from-the-library)
- [Run it locally](#run-it-locally)

<!-- readme:toc:end -->

## What is here, and what is only known about

| | |
|---|---|
| items upstream | **273,559** |
| files upstream | **1,057,223** |
| storage upstream | **361.55 GB** |
| top-level communities | **8** |
| nodes modelled here | printed by `bun run cat check:catalogue` |

Read from IRIS's home page, its storage report (By Location → Entire Site) and
its community list on 2026-09-20, and recorded with their basis in
[`catalogue/catalogue.json`](catalogue/catalogue.json). **The gap between the
nodes modelled here and the corpus is the point**, not a shortfall: a catalogue
by reference models the *shape* of a corpus without holding it.

Every node declares its state — `referenced`, `materialized` or `unknown` — and
**there is no default**: a node that has not said is invalid, because "the
author did not say" and "the author said they could not tell" are different
facts.

```sh
bun run cat check:catalogue
```

## The worked example

`wpr-rdo-2020-003-eng` — the *Publication and information products style guide*
— is the worked example: its **IRIS item page** supplies the webpage theme's
source, and the **publication itself** defines the WPRO publication theme.

Its record carries every identifier read off the captured DSpace full item
record — UUID, two Handles, govdoc number — and one discrepancy kept rather than
reconciled: `dc.description` says `30 p.` while the ingested PDF has **33**
pages.

Metadata comes from the record, never from the PDF:
[`skills/iris-dspace.md`](skills/iris-dspace.md) §R8 shows OCR off a title page
naming the WHO Editorial Style Manual `Abies`.

## The library

`who-iris.json` declares [`library/`](library/): the IRIS items this instance
holds rather than names, the `materialized` end of the catalogue. Only IRIS
items belong in it — a document with no Handle, DSpace UUID or collection path
is not one, whatever its subject.

`library/image-verdicts.json` sits beside the documents it judges, because
`apply-image-verdicts` resolves each document against the library its verdict
file is in.

## The style guide, derived from the library

The three **WHO house voices** — `who-editorial`, `who-guideline-development`,
`who-publication-design` — live in [`skills/voices/`](skills/voices/), and the
**WHO glossary** in [`glossary/`](glossary/). Each voice is read rule by rule
out of one publication in the library, and every rule cites the page it came
from; `bun run cat check:voices` resolves those citations against this
instance's library. Together they are the style guide:
[`docs/style-guide.md`](docs/style-guide.md).

## Run it locally

From a fresh clone, one command serves the site at `http://127.0.0.1:4007/who-iris/`:

```bash
bun run cat serve:local --site who-iris=.
```

The first `bun run cat …` mounts the layers `index.lock.json` pins (through
`.github/cat.ts` and `.github/mount-from-lock.sh`) and runs `bun install`
once, then runs the command. After a re-pin, run
`bash .github/mount-from-lock.sh` to refresh the mounts.

`bun run test` runs the tests. It first lays `test/attestations/` down from
the `cat/who-iris/attestations` state branch (`bun run attestations:mount`),
as the checks workflow does, because that directory is never on `main`.

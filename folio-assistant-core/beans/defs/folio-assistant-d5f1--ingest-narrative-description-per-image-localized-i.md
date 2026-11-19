---
# folio-assistant-d5f1
$schema: bean/1.0.0
title: 'INGEST: narrative description per image, localized, including images extracted from PDFs'
status: completed
type: task
priority: normal
created_at: 2026-09-16T06:43:50Z
updated_at: 2026-10-30T12:05:00Z
parent: folio-assistant-slw1
---

## What

Generate a narrative description for every image, localized to the folio's
languages.

## The half that is easy to miss

**This applies to an image EXTRACTED FROM A PDF, not only to an uploaded one.**
Most images in this corpus arrive inside a paper, and a figure nobody has
described is a figure no grep and no agent can reach.

## Provenance is not optional

Every description carries its author — human, or agent **with model version**.
See `folio-assistant-iqim`. An uncited narrative is indistinguishable from a
transcription of the source, and the two have very different standing.

## Done when

Each image in `manifest.jsonld` has a description per configured language, each
stamped with its author, and the PDF-extraction path produces them too.

Diagram: `processes/ingest-derive-content.bpmn`, `Task_Image`.

## 2026-09-19 — measured before building, and it changes the design

Not started. Two findings, and the second is a design problem I could not have
seen without measuring.

### 1. No image backend, and the chain is three deep

`pypdf`, `PyMuPDF`, `Pillow`, `pdfplumber` — **none present**. `pip` reaches an
index, but getting to a working extractor took three installs: `pypdf`, then
`cffi` (its absence made `cryptography` panic under pyo3 on import), then
`Pillow` (pypdf refuses image extraction without it).

**CI installs only `ruff`.** This repository declares no Python dependencies at
all — no `requirements.txt`, no `pyproject.toml` — which is already a latent
gap, since `pdf-structure.py` needs PyMuPDF and nothing says so.

### 2. "Every extracted image" is the WRONG unit — 121 of them are page scans

| upload | pages | images | shape |
|---|---|---|---|
| `9789241548960-eng` | 179 | **2** | born-digital; its figures are vector, not raster |
| `who-pub-tps-931` | 121 | **121 TIFF** | **one per page — these are page SCANS, not figures** |
| `wpr-rdo-2020-003-eng` | 33 | 21 | real embedded figures, on 7 pages |
| `milnorlink` | 20 | 1, then `DependencyError` | a codec Pillow lacks |

A naive "describe every extracted image" would put **121 descriptions of
whole-page scans** into the review queue for one document — and `ju0u` means a
human has to confirm each. That is not merely wasted effort: it would bury the
handful of real figures, and make `confirmed` mean "the reviewer gave up".

So this arm needs a **figure / page-scan discriminator** before it needs a
describer. The signal is already recorded: `structure.json` carries
`text_source: ocr | text-layer | embedded`, and a full-page image whose page
text came from OCR is a scan of that page. Image dimensions against page
dimensions is the second check.

Also worth noting: the document with the most *figures* is not the one with the
most *images*, and the 179-page handbook has almost none — an image count is
not a figure count, and treating them as the same is how this arm would have
reported "179 pages described" while describing nothing anyone wanted.

### Correction

My first probe printed "0 images in the first 30 pages". That was not a
measurement: `len(p.images)` returned 0 while iterating actually raised
`ImportError: pillow is required`. The real count is above.

### What this waits on

A decision on Python dependencies (see the session report). `pypdf` + `Pillow`
were installed to take these measurements and then **uninstalled**, so the
environment does not quietly carry deps CI lacks.

_2026-09-19T16:20Z_ — a block was recorded here against
`folio-assistant-68dt` (declare Python dependencies and install them in CI).
**NOT blocked on `folio-assistant-68dt` as of 2026-09-20** — see the entry below, which already recorded the unblock; this
line is corrected in place because a reader hits it first and a later
contradiction does not undo a live assertion.

- **waits on**: a working backend for images out of PDFs that CI also has. Measured absent
  2026-09-19; `pip` reaches an index but CI installs only `ruff`, so anything
  built now would ship an untested path — the `5rfy` defect.
- **since**: 2026-09-19.
- **expires**: 2026-10-19. After that, presume this stale and re-measure rather
  than trusting it.
- **handoff**: if `68dt` has landed, this is ordinary work — unblock and
  proceed. If it has not, do NOT hand-roll a parser; say what is missing.
  For `d5f1`, read this bean's measurement first: the image count is not the
  figure count, and 121 of `who-pub-tps-931`'s images are page scans.

_2026-09-20T04:20Z_ — **Unblocked on the backend half.** `68dt` is done: the
Python dependencies are declared in `schemas/python-deps.ts`, generated into
`requirements.txt`, and **CI installs the lean set** — so the PDF rungs are now
a path CI can exercise rather than the `5rfy` defect.

`pymupdf`, `pypdf`, `pillow`, `pdfplumber`, `pdfminer.six` and `cffi` are all
present. Only `camelot-py` (for `pdf-tables.py`) stays out of CI, at 323 MB
with numpy/pandas/OpenCV — declared in `requirements-extended.txt` with the
cost stated.

Note before starting: `probe()` in `ingest-document.ts` imported the deprecated
`fitz` alias, which prints a deprecation warning to STDOUT and broke the JSON
parse. Fixed in `68dt`. Routing now works — and for `d5f1` specifically, read
this bean's own 2026-09-19 measurement FIRST: the image count is not the figure
count, and 121 of `who-pub-tps-931`'s images are page scans.

## 2026-09-20 — measured with a working backend, and it changes the scope

Bean `68dt` merged, so the image path can be measured rather than reasoned
about. Two findings, and both change what this bean is.

### 1. "Each image in manifest.jsonld" is currently an EMPTY SET

No manifest in `library/` carries any image at all — all four have keys
`@context @id @type contains meta provenance title` and nothing imagey. The
"Done when" as written is vacuous: there is nothing to describe. **Extraction
and recording must exist before the narrative half means anything**, which is a
materially bigger scope than the title suggests.

### 2. Image count is not figure count, and the discriminator is clean

| document | pages | placed images | coverage | verdict |
|---|---|---|---|---|
| `WHO_PUB_TPS_93.1` | 121 | 121 | 0.998 each, one per page | page scans |
| `milnorlink` | 20 | 20 | 19 full-bleed + 1 at 0.008 | 19 scans, 1 figure |
| `9789241548960_eng` | 179 | 2 | ~0.50 | figures |
| `WPR-RDO-2020-003-eng` | 33 | 21 on 7 pages | median 0.013 | figures |

**140 page scans against 24 candidate figures.** Describing every extracted
image would produce 140 narratives of "a scanned page" — six times as many as
there are real figures.

The separation has no overlap, so no content heuristic is needed: a page scan
is one near-full-bleed image per page; a figure is smaller and occurs 0..n per
page. Measured as image-rectangle area over page area, via
`page.get_image_rects(xref)` rather than the image's own pixel dimensions,
because a placed image is what a reader sees.

### `milnorlink` was recorded wrong earlier in the same session

An earlier note here read "20 pages / 1 image then codec error". That was
measured with no working backend. It actually carries 19 full-bleed page images
**plus** an extractable text layer (47 871 chars) — a scan with OCR baked in,
consistent with the JSTOR provenance established in `8shg` the same day. The
earlier figure was an artefact of the measuring tool, not the document.

### Consequence for the design

An image entry must record the verdict AND its basis (coverage, images per
page), not just the verdict — the `nso8` discipline. A bare `kind: "scan"` is
unfalsifiable by the next reader, and this bean has already been misled once by
a stored conclusion whose reason was not checkable.

## 2026-09-20 — Stage A and Stage B shipped; the narrative half remains

### What now exists

| | |
|---|---|
| `scripts/pdf-images.py` | extracts placed images, classifies each, writes `images.json` |
| `schemas/document-image.ts` | role + the **basis** it was computed from; refuses a verdict with no working |
| `figure` block kind | registered at all seven points; `folio:Figure` + `doco:Figure` |
| `gen-library-jsonld.ts` | emits figure blocks into the section whose pages hold them |

**24 figure blocks on the real corpus** — 21 / 2 / 1 / **zero** for the
121-page scan. Matches the hand survey exactly.

Each carries `narrative: {state: "not-authored"}`, so the bean's "Done when"
is now a **non-empty** set for the first time: there are images in
`manifest.jsonld`, and each says it has no description yet.

### What is NOT done

The descriptions themselves, and their localisation. That needs a **vision
backend**, and nothing declares one — the same shape as `1r0p`'s missing
transcription backend, and the same rule applies: do not claim the capability
until something declares it. `schemas/python-deps.ts` is where it would go.

The narrative machinery is ready: `schemas/narrative.ts` has the four states
and the rule that **only a human may confirm a draft**, and
`scripts/narratives.ts` refuses to record a human decision from a
non-interactive shell.

### A measurement corrected here

An earlier note in this bean said 141 scans / 23 figures. The true split is
**140 / 24** — `milnorlink`'s one small image (coverage 0.008) was tallied as a
scan though the same table had already called it figure-shaped. Total of 164
was right; the split was not.

## 2026-09-20 (later) — the blocker I recorded does not exist, and the 24 are not 24

### The "no vision backend" claim was WRONG

The note above said the descriptions "need a vision backend, and nothing
declares one", by analogy with `1r0p`'s missing audio transcription backend.
**The analogy does not hold.** An audio backend is separate software that must
be installed. For images the reading agent is itself vision-capable: reading
`library/9789241548960-eng/images/img-p126-1.png` directly returns the GRADE
evidence-assessment table — study design, initial confidence, reasons for
lowering or raising, final confidence with the ⊕ ratings.

So the honest declaration is a **Tool node naming the agent**, not a missing
dependency. `1r0p` stays blocked; this one never was. A blocker recorded and
not retested is how a capability goes unused — which is the `apui` shape from
2026-09-19, one level out.

### What the 24 "figures" actually are

Read as one contact sheet rather than 24 files. The classification is
`role: "figure"` for all of them, and that is far too coarse:

| what it is | placements |
|---|---|
| **real data figures** (both tables, `9789241548960-eng` p126, p154) | **2** |
| organisation logos — JSTOR, MSF ×2, FAO ×2, UNDP ×2, ILO, WHO ×4 (incl. 世界卫生组织 西太平洋区域) | **12** |
| photographs — 7 of them the same children-on-a-road picture, plus one of a health worker | **8** |
| unreplaced template text: "WPRO PUBLICATION / **SAMPLE TITLE** IN THE WESTERN PACIFIC" | **2** |

Describing "every figure" would therefore produce **12 logo descriptions and
seven descriptions of one photograph** against two that are actually about the
document's content.

### Measured

* Only **2** placements are byte-identical (FAO, UNDP). The seven photographs
  are different crops — 604×366 down to 263×308 — so a hash dedupe catches the
  logos and misses the photo entirely.
* Those seven crops are **3.83 MB of the 5.54 MB** on disk: **69 %** of the
  extracted bytes are one picture a reader sees once.

### Consequences to decide

1. `figure` is not one role. A logo is publisher/organisational furniture; a
   decorative photograph is not a figure of the document either. The geometric
   rule cannot see the difference — only looking can.
2. `milnorlink`'s single "figure" is the **JSTOR logo**, which completes
   `8shg`: that document is wrapped in JSTOR furniture at every level — its
   outline was a journal wrapper, and its one image is the publisher's mark.
3. The **SAMPLE TITLE** placeholder is a defect in the published WHO document,
   not in this pipeline. Worth reporting upward rather than describing.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06: extract, then agent drafts for human confirmation

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, with three options (recommended first): extract + agent drafts; extract only, humans describe; defer. **The owner chose "Extract + agent drafts".**

After the content split, in this order:
1. Extract images from PDFs. The area-ratio test separates page scans (skipped) from figures (kept); measured 140 scans against 24 figures.
2. Record each figure in `manifest.jsonld`.
3. An agent drafts one description per configured language, stamped with its author and **model version** (`iqim`).
4. Each draft goes to the review queue for human confirmation.

The work lands in folio-assistant-core.

## Progress from `cat-tools-e1lo` (2026-10-21)

Every figure block has an agent draft narrative: 274 in total across the `cat-harness`, `folio-assistant-core`, `folio-assistant-sci` and `who-iris` libraries. What remains is a narrative per language and human confirmation through the review queue.

### Owner ruling 2026-10-21: a display shows the reader's language, else the first

Asked in the `cat-harness-tools` drain session: when a slot holds several languages, which entry does a single-text display show? The owner chose **"Locale match, else first"**. Stage 3 is split so no layer's typecheck breaks when the slot types widen:

- [x] **1–2**: PDF image extraction + 274 agent draft narratives across the 4 library instances
- [x] **3a**, `cat-harness#396`: `narrativeFor(slot, lang?)` (matches exact `lang`, then primary subtag, then falls back to first entry)
- [x] **3b**, `cat-harness-tools` + `folio-assistant-core#169` (`lsi-blocks.ts:88`) + `smart-base#117`
- [x] **3c**, `cat-harness#400`: the six slot schemas switch to `NarrativeSlotSchema`, and `block-summary` / `figure-description` read through it
- [x] **3d**: stored narratives migrated to one-entry lists tagged `lang: "en"` across `cat-harness` (#405, #407: 609), `folio-assistant-core` (#173: 50), `folio-assistant-sci` (#48: 50), `who-iris` (#78: 418), `smart-base` (#118) and `smart-immunizations` (#67), plus `cat-harness-tools` #537, #539, #540

### Stage 4 — owner ruled `"1A 2A 3A"` on 2026-10-22 (`cat-tools-e1lo`, `cat-harness-tools#548` merged `85a3446e6f`; `cat-harness#413` open)
- [ ] Stage 4: make `lang` required on every written narrative and keep the bare object only as the empty `NOT_AUTHORED` slot (owner ruled `"1A 2A 3A"` on 2026-10-22; tools readiness merged in `cat-harness-tools#548` `85a3446e6f`, schema PR open at `cat-harness#413`):
  1. **1A**: `NOT_AUTHORED` (`{ text: null, state: "not-authored" }`) kept as the one single-form value with no `lang`,
  2. **2A**: `superseded` history in block summaries requires `lang` too (0 entries exist today),
  3. **3A**: `FigureSchema.narrative` on authored paper figure blocks becomes a `NarrativeSlotSchema` slot like every other (0 authored figure blocks carry a narrative today).

## Rehomed 2026-10-10: this copy is a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a pointer here), this bean is re-filed in the store of the repository whose code it changes: **`litlfred/cat-harness-tools` bean `cat-tools-e1lo`** (cat-harness-tools PR #68). Work it there. This copy stays open as a pointer, and closes when `cat-tools-e1lo` does.


## Progress from `cat-tools-e1lo` (2026-10-21)

Every figure block has an agent draft narrative: 274 in total across the `cat-harness`, `folio-assistant-core`, `folio-assistant-sci` and `who-iris` libraries. What remains is a narrative per language and human confirmation through the review queue.

### Owner ruling 2026-10-21: a display shows the reader's language, else the first

Asked in the `cat-harness-tools` drain session: when a slot holds several languages, which entry does a single-text display show? The owner chose **"Locale match, else first"**. Stage 3 is split so no layer's typecheck breaks when the slot types widen:

- [x] **1–2**: PDF image extraction + 274 agent draft narratives across the 4 library instances
- [x] **3a**, `cat-harness#396`: `narrativeFor(slot, lang?)` (matches exact `lang`, then primary subtag, then falls back to first entry)
- [x] **3b**, `cat-harness-tools` + `folio-assistant-core#169` (`lsi-blocks.ts:88`) + `smart-base#117`
- [x] **3c**, `cat-harness#400`: the six slot schemas switch to `NarrativeSlotSchema`, and `block-summary` / `figure-description` read through it
- [x] **3d**: stored narratives migrated to one-entry lists tagged `lang: "en"` across `cat-harness` (#405, #407: 609), `folio-assistant-core` (#173: 50), `folio-assistant-sci` (#48: 50), `who-iris` (#78: 418), `smart-base` (#118) and `smart-immunizations` (#67), plus `cat-harness-tools` #537, #539, #540

### Stage 4 — merged (`cat-tools-e1lo`, `cat-harness-tools#548` `85a3446e6f` + `cat-harness#413` `ee172f2d13`)
- [x] Stage 4: make `lang` required on every written narrative and keep the bare object only as the empty `NOT_AUTHORED` slot (owner ruled `"1A 2A 3A"` on 2026-10-22; tools readiness merged in `cat-harness-tools#548` `85a3446e6f`, schema change merged in `cat-harness#413` `ee172f2d13`):
  1. **1A**: `NOT_AUTHORED` (`{ text: null, state: "not-authored" }`) kept as the one single-form value with no `lang`,
  2. **2A**: `superseded` history in block summaries requires `lang` too (0 entries exist today),
  3. **3A**: `FigureSchema.narrative` on authored paper figure blocks becomes a `NarrativeSlotSchema` slot like every other (0 authored figure blocks carry a narrative today).
- [ ] Draft localized narratives for each configured non-English language and queue each draft for human confirmation.

_2026-10-24T08:16:00Z_ — Claimed by the cloud drain thread "Drain content model and ingest beans" (session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU). Open work: French pilot in litlfred/folio-assistant-core#202, then the other locales.

_2026-10-24T09:27:19Z_ — French pilot merged, litlfred/folio-assistant-core#202 (39eb6940): `lang: "fr"` drafts for the 46 arxiv-2510.21603v1 figures. Still open: the other figures and ar, es, ru, zh.

_2026-10-24T10:55:14Z_ — Spanish merged, litlfred/folio-assistant-core#210 (fca35a3f): `lang: "es"` drafts for the same 50 arxiv-2510.21603v1 figures, all 96 slots valid. Still open: ar, ru, zh here, and every locale for the other library entries. Claim released; the next thread can pick it up.

_2026-10-24T10:56:06Z_ — Re-claimed by the cloud drain thread "Drain content model and ingest beans" (owner extended the window to ~13:48Z; session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU).

_2026-10-24T11:34:43Z_ — ar, ru and zh merged, litlfred/folio-assistant-core#212 (557117e8). arxiv-2510.21603v1 now has drafts in all six languages (en, fr, es, ar, ru, zh) for its 50 figures. Still open: the other library entries (~880 English figure drafts) and human confirmation.

_2026-10-24T13:40:00Z_ — litlfred/cat-harness#556 merged (aa48c7a1): fr/es/ar/ru/zh draft narratives for 22 figures in 11 cat-harness entries are on main and wait for a person. Claim released.

_2026-10-24T13:42:00Z_ — Re-claimed by the cloud drain thread "Drain content model and ingest beans" (owner window to ~16:48Z; session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU).

_2026-10-24T14:18:00Z_ — litlfred/cat-harness#584 merged (9487253c): fr/es/ar/ru/zh drafts for 25 figures in wang-rangaiah-2026-mcdm-aggregation, arxiv-2504.07199v3 and arxiv-2405.14766v2.

_2026-10-24T14:25Z_ — cat-harness#583 merged (c448735d). Batch C opened as cat-harness#586: 32 figures in gurel-tat-2017-swot-analysis, arxiv-2505.10399v1, nist-sp-800-207.

_2026-10-24T14:36Z_ — cat-harness#586 merged (batch C, 32 figures).

_2026-10-24T14:50Z_ — batch D opened as cat-harness#588: 13 figures in omg-2024-spdx-3-0.

_2026-10-24T14:48Z_ — cat-harness#588 merged (batch D, 13 SPDX figures).

_2026-10-24T14:52Z_ — batch E opened as cat-harness#590: 14 figures in arxiv-2607.14456v1.

_2026-10-24T15:02Z_ — cat-harness#590 merged (batch E, 14 figures of arxiv-2607.14456v1).

_2026-10-24T15:18Z_ — cat-harness#592 merged (batch F, 17 figures of arxiv-2607.20636v1).

_2026-10-24T15:35Z_ — cat-harness#595 merged (batch G, 19 figures of arxiv-2505.06046v4).

_2026-10-24T15:38Z_ — cat-harness#597 merged (batch H, 28 figures of arxiv-2312.07755v1).

_2026-10-24T15:51Z_ — cat-harness#599 merged (batch I, fr/es/ar/ru/zh narratives for 32 figures of arxiv-2404.04834v4).

_2026-10-24T16:24Z_ — Window wrap-up: last d5f1 batch was cat-harness#599 (merged). Claim released.

_2026-10-26T14:19:00Z_ — Batch J opened as [`litlfred/cat-harness#622`](https://github.com/litlfred/cat-harness/pull/622) (`5bf8d01`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 37 figures across `kg-folio-asst-2026-09-30` (33 images + 23 figure blocks) and `w3c-2018-odrl-model-2-2` (4 ODRL 2.2 UML class diagrams + 4 figure blocks). Remaining in `cat-harness/library/`: `strauch-carbno-2025-spdx-3-1-supply-chain` (37), `arxiv-2507.23348v1` (115), `arxiv-2402.02172v5` (135).

_2026-10-26T14:35:00Z_ — Batch K opened as [`litlfred/cat-harness#623`](https://github.com/litlfred/cat-harness/pull/623) (`50f5a55`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 37 images (and 24 figure blocks) in `strauch-carbno-2025-spdx-3-1-supply-chain`. Remaining in `cat-harness/library/`: `arxiv-2507.23348v1` (115), `arxiv-2402.02172v5` (135).

_2026-10-26T14:46:00Z_ — Batch L opened as [`litlfred/cat-harness#626`](https://github.com/litlfred/cat-harness/pull/626) (`0775906a`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the first 25 images (`img-p003-1` through `img-p003-46`) in `arxiv-2507.23348v1` (no `blocks/figure-*.jsonld` present). Remaining in `cat-harness/library/`: `arxiv-2507.23348v1` (90), `arxiv-2402.02172v5` (135).

_2026-10-26T14:55:00Z_ — Batch M opened as [`litlfred/cat-harness#627`](https://github.com/litlfred/cat-harness/pull/627) (`d961c06a`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the first 25 images (`img-p001-1` through `img-p004-19`) in `arxiv-2402.02172v5` (no matching `blocks/figure-*.jsonld`). Remaining in `cat-harness/library/`: `arxiv-2507.23348v1` (90), `arxiv-2402.02172v5` (110).

_2026-10-27T14:16:00Z_ — Batch N opened as [`litlfred/cat-harness#644`](https://github.com/litlfred/cat-harness/pull/644) (`720dca41`, stacked on `#626` `0775906a`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for images 26–50 (`img-p003-47` through `img-p004-35`) in `arxiv-2507.23348v1`. Remaining in `cat-harness/library/`: `arxiv-2507.23348v1` (65), `arxiv-2402.02172v5` (110).

_2026-10-27T14:35:00Z_ — Batch O opened as [`litlfred/cat-harness#645`](https://github.com/litlfred/cat-harness/pull/645) (`715b4fe3`, stacked on `#644` `720dca41`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for images 51–80 (`img-p004-36` through `img-p004-108`) in `arxiv-2507.23348v1`. Remaining in `cat-harness/library/`: `arxiv-2507.23348v1` (35), `arxiv-2402.02172v5` (110).

_2026-10-27T14:47:00Z_ — Batch P opened as [`litlfred/cat-harness#647`](https://github.com/litlfred/cat-harness/pull/647) (`6fc88dcb`, stacked on `#645` `715b4fe3`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the final 35 images (81–115 of 115: `img-p004-109` through `img-p009-16`) in `arxiv-2507.23348v1` (all 115 images now carry all 6 locales `en`/`fr`/`es`/`ar`/`ru`/`zh`). Remaining in `cat-harness/library/`: `arxiv-2402.02172v5` (110).

_2026-10-27T15:01:00Z_ — Batch Q opened as [`litlfred/cat-harness#649`](https://github.com/litlfred/cat-harness/pull/649) (`d434e930`, stacked on `#627` `d961c06a`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for images 26–55 (`img-p004-29` through `img-p025-14`) in `arxiv-2402.02172v5` (no matching `blocks/figure-*.jsonld`). Remaining in `cat-harness/library/`: `arxiv-2402.02172v5` (80).

_2026-10-27T15:12:00Z_ — Batch R opened as [`litlfred/cat-harness#650`](https://github.com/litlfred/cat-harness/pull/650) (`0f16776c`, stacked on `#649` `d434e930`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for images 56–85 (`img-p025-15` through `img-p028-15`) in `arxiv-2402.02172v5` (no matching `blocks/figure-*.jsonld`). Remaining in `cat-harness/library/`: `arxiv-2402.02172v5` (50).

_2026-10-27T15:21:00Z_ — Batch S opened as [`litlfred/cat-harness#652`](https://github.com/litlfred/cat-harness/pull/652) (`8c87901b`, stacked on `#650` `0f16776c`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for images 86–110 (`img-p028-19` through `img-p031-4`) in `arxiv-2402.02172v5` (no matching `blocks/figure-*.jsonld`). Remaining in `cat-harness/library/`: `arxiv-2402.02172v5` (25).

_2026-10-27T15:31:00Z_ — Batch T opened as [`litlfred/cat-harness#654`](https://github.com/litlfred/cat-harness/pull/654) (`fe936bf9`, stacked on `#652` `8c87901b`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the final 25 images (111–135 of 135: `img-p031-6` through `img-p035-1`) and `blocks/figure-img-p035-1.jsonld` in `arxiv-2402.02172v5` (all 135 images and 1 figure block now carry all 6 locales `en`/`fr`/`es`/`ar`/`ru`/`zh`). All 14 entries in `cat-harness/library/` now have 6-locale figure narratives across open/merged PRs (`0` remaining in `cat-harness/library/`).

_2026-10-28T04:48:00Z_ — Batch U opened as [`litlfred/folio-assistant-sci#98`](https://github.com/litlfred/folio-assistant-sci/pull/98) (`f7316f1`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 27 images (and 21 figure blocks) across `arxiv-2003.08005v1` (20 images + 20 figure blocks) and `arxiv-2406.01940v2` (7 images + 1 figure block) in `folio-assistant-sci/library/`. Remaining in `folio-assistant-sci/library/` (23 across 5 entries): `arxiv-2512.09874v3` (5), `arxiv-2601.22554v1` (7), `arxiv-2602.16554v1` (1), `arxiv-2604.00554v1` (9), `milnorlink` (1).

_2026-10-28T10:59:00Z_ — Batch V opened as [`litlfred/folio-assistant-sci#100`](https://github.com/litlfred/folio-assistant-sci/pull/100) (`9dccea7`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the remaining 23 images (and 21 figure blocks) across `arxiv-2512.09874v3` (5 images + 5 figure blocks), `arxiv-2601.22554v1` (7 images + 7 figure blocks), `arxiv-2602.16554v1` (1 image), `arxiv-2604.00554v1` (9 images + 9 figure blocks), and `milnorlink` (1 image: `img-p001-1`; 19 skipped `page-scan` entries untouched) in `folio-assistant-sci/library/`. Across `#98` and `#100`, `folio-assistant-sci/library/` now has `0` remaining English-only figures.

_2026-10-28T11:27:00Z_ — Batch W opened as [`litlfred/who-iris#86`](https://github.com/litlfred/who-iris/pull/86) (`1d3f297`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for all 21 English-only images (and 2 figure blocks) across `9789241548960-eng` (2 images + 2 figure blocks: `img-p126-1` and `img-p154-1`) and `wpr-rdo-2020-003-eng` (19 images; `who-pub-tps-931`'s 121 `page-scan` entries untouched) in `who-iris/library/`. `who-iris/library/` now has `0` remaining English-only figures.

_2026-10-28T11:43:00Z_ — Batch X opened as [`litlfred/smart-base#174`](https://github.com/litlfred/smart-base/pull/174) (`291a9d6`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 26 English-only images (and 26 figure blocks) across `9789240010567-eng` (11 images + 11 figure blocks), `9789240081949-eng` (5 images + 5 figure blocks), `9789240093362-eng` (9 images + 9 figure blocks), and `9789240116191-eng` (1 image + 1 figure block) in `smart-base/library/`. Remaining in `smart-base/library/` (195 across 7 entries): `9789240101197-eng` (14), `9789241509510-eng` (102), `9789241511766-eng` (44), `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241549912-websupplement-eng` (1), `who-dpi-h-reference-architecture-draft-v1` (31); plus `smart-immunizations/library/` (89 across 5 entries: `9789240016514-eng` (10), `9789240099456-eng` (18), `9789275119532-eng` (15), `facilityanalysisguide-immunization` (32), `who-2019-ncov-digital-certificates-vaccination-20211-eng` (14)).

_2026-10-28T11:55:00Z_ — Batch Y opened as [`litlfred/smart-immunizations#82`](https://github.com/litlfred/smart-immunizations/pull/82) (`9356781`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 28 English-only images (and 23 figure blocks) across `9789240016514-eng` (10 images + 6 figure blocks) and `9789240099456-eng` (18 images + 17 figure blocks) in `smart-immunizations/library/`. Remaining in `smart-immunizations/library/` (61 across 3 entries): `9789275119532-eng` (15), `facilityanalysisguide-immunization` (32), `who-2019-ncov-digital-certificates-vaccination-20211-eng` (14).

_2026-10-28T12:05:00Z_ — Batch Z opened as [`litlfred/smart-immunizations#83`](https://github.com/litlfred/smart-immunizations/pull/83) (`52f229e`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 29 English-only images (and 13 figure blocks) across `9789275119532-eng` (15 images, 0 figure blocks) and `who-2019-ncov-digital-certificates-vaccination-20211-eng` (14 images + 13 figure blocks) in `smart-immunizations/library/`. Remaining in `smart-immunizations/library/` (32 across 1 entry): `facilityanalysisguide-immunization` (32).

_2026-10-28T12:23:00Z_ — Batch AA opened as [`litlfred/smart-immunizations#84`](https://github.com/litlfred/smart-immunizations/pull/84) (`0afb1b8`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the final 32 English-only images (and 30 figure blocks; 2 `page-scan` entries untouched) in `facilityanalysisguide-immunization` in `smart-immunizations/library/`. Across `#82`, `#83`, and `#84`, `smart-immunizations/library/` now has `0` remaining English-only figures.

_2026-10-28T12:37:00Z_ — Batch AB opened as [`litlfred/smart-base#178`](https://github.com/litlfred/smart-base/pull/178) (`3e6ab3e`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 30 English-only images (and 14 figure blocks) across `9789240101197-eng` (all 14 images + 1 figure block), `9789241549912-websupplement-eng` (1 image, 0 figure blocks), and `who-dpi-h-reference-architecture-draft-v1` (first 15 images: `img-p001-1` through `img-p055-2` + 13 figure blocks) in `smart-base/library/`. Remaining in `smart-base/library/` (165 across 5 entries): `who-dpi-h-reference-architecture-draft-v1` (16), `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241511766-eng` (44), `9789241509510-eng` (102).

_2026-10-28T12:50:00Z_ — Batch AC opened as [`litlfred/smart-base#180`](https://github.com/litlfred/smart-base/pull/180) (`0ad6612`, stacked on `#178` `3e6ab3e`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for 30 English-only images (and 30 figure blocks) across `who-dpi-h-reference-architecture-draft-v1` (remaining 16 images: `img-p055-3` through `img-p254-2` + 16 figure blocks, completing all 31 images) and `9789241511766-eng` (first 14 images: `img-p001-1` through `img-p001-59` + 14 figure blocks) in `smart-base/library/`. Remaining in `smart-base/library/` (135 across 4 entries): `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241511766-eng` (30), `9789241509510-eng` (102).

_2026-10-28T13:02:00Z_ — Batch AD opened as [`litlfred/smart-base#182`](https://github.com/litlfred/smart-base/pull/182) (`b5d4bee`, stacked on `#180` `0ad6612`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the remaining 30 English-only images (`img-p001-60` through `img-p144-1` + 30 figure blocks, completing all 44 images and 44 figure blocks) in `9789241511766-eng` in `smart-base/library/`. Remaining in `smart-base/library/` (105 across 3 entries): `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241509510-eng` (102).

_2026-10-30T11:05:00Z_ — Batch AE opened as [`litlfred/smart-base#188`](https://github.com/litlfred/smart-base/pull/188) (`25b2f13`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the first 34 English-only images (`img-p001-1` through `img-p041-1` + 34 figure blocks; 1 `page-scan` entry `img-p004-1` untouched) in `9789241509510-eng` in `smart-base/library/`. Remaining in `smart-base/library/` (71 across 3 entries): `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241509510-eng` (68).

_2026-10-30T11:10:00Z_ — Merge sweep: batches J–T in `litlfred/cat-harness` (`#622`, `#623`, `#626`, `#627`, `#644`, `#645`, `#647`, `#649`, `#650`, `#652`, `#654`), batches U–V in `litlfred/folio-assistant-sci` (`#98`, `#100`), batch W in `litlfred/who-iris` (`#86`), batches Y–AA in `litlfred/smart-immunizations` (`#82`, `#83`, `#84`), and batches X, AB–AD in `litlfred/smart-base` (`#174`, `#178`, `#180`, `#182`) are all merged on `main` (2026-10-29). Batch AE (`litlfred/smart-base#188`) is open.

_2026-10-30T11:13:00Z_ — Batch AF opened as [`litlfred/smart-base#189`](https://github.com/litlfred/smart-base/pull/189) (`c29a593`, stacked on `#188` `25b2f13`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the next 34 English-only images (images 35–68 of 102: `img-p041-2` through `img-p081-1` + 34 figure blocks) in `9789241509510-eng` in `smart-base/library/`. Remaining in `smart-base/library/` (37 across 3 entries): `9789241549912-eng` (2), `9789241549912-webannexes-eng` (1), `9789241509510-eng` (34).

_2026-10-30T11:22:00Z_ — Batch AG opened as [`litlfred/smart-base#190`](https://github.com/litlfred/smart-base/pull/190) (`cdda430`, stacked on `#189` `c29a593`): `fr`/`es`/`ar`/`ru`/`zh` draft figure narratives for the final 37 English-only images (and 34 figure blocks) in `smart-base/library/`: the remaining 34 images (images 69–102 of 102: `img-p082-1` through `img-p106-33` + 34 figure blocks; 1 `page-scan` entry `img-p004-1` untouched) in `9789241509510-eng`, all 2 images (`img-p001-1`, `img-p172-1`) in `9789241549912-eng`, and the 1 image (`img-p024-1`) in `9789241549912-webannexes-eng`. Across merged PRs (`cat-harness#622`–`#654`, `folio-assistant-sci#98`–`#100`, `who-iris#86`, `smart-immunizations#82`–`#84`, `smart-base#174`, `#178`, `#180`, `#182`) and open PRs (`smart-base#188`, `#189`, `#190`), `smart-base/library/` and all declared libraries across the workspace now have `0` remaining English-only figures.

## 2026-10-30T12:05Z — completed: every describable image has all six languages, and the gate now checks it

Measured after merging smart-base#188, #189 and #190 (batches AE–AG): across every library I could read at main (cat-harness, smart-base, folio-assistant-core, fhir-harness, smart-immunizations, smart-ra, who-iris, folio-assistant-sci), there are 1011 describable images and 0 without a narrative. 31 were still English-only. Batch AG's note said "0 remaining English-only figures across the workspace", but **smart-ra's own copy of `who-dpi-h-reference-architecture-draft-v1`** has its own English narratives, which differ from smart-base's copy, so batches AB/AC never reached it.

- [`litlfred/smart-ra#100`](https://github.com/litlfred/smart-ra/pull/100) (merged, `cdb1e9e`): adds fr/es/ar/ru/zh drafts for those 31 images and their 29 figure blocks. The drafts are by claude-opus-5-5, session https://claude.ai/code/session_013ZJ1uYnvBifNcPaVPVJbUS. The narratives first moved to the list form with `narratives-migrate-lang --apply`. Re-measured afterwards: 1011 describable, 0 missing a locale.
- [`litlfred/cat-harness-tools#864`](https://github.com/litlfred/cat-harness-tools/pull/864) (merged, `8262eba`): `check:l1-complete` image-descriptions now checks for a narrative in **every configured language** (the instance's `translation.supportedLocales`, else the six UN languages). Before, it accepted any narrative, which is why the 31 were invisible. It stays `QA_ONLY`.
- [`litlfred/folio-assistant#2726`](https://github.com/litlfred/folio-assistant/pull/2726) (merged): re-pins smart-base to 040f197 and cat-harness-tools to 8262eba together. The real-corpus L1 test needs both.

The Done-when is met: each image has a description per configured language, each stamped with its author, and the PDF-extraction path produces them. Every non-English entry is still `draft`. Confirming them is a person's job in `bun run cat narratives`; that is not part of this bean's Done-when.


## Progress from `cat-tools-e1lo` (2026-10-21)

Every figure block has an agent draft narrative: 274 in total across the `cat-harness`, `folio-assistant-core`, `folio-assistant-sci` and `who-iris` libraries. What remains is a narrative per language and human confirmation through the review queue.

### Owner ruling 2026-10-21: a display shows the reader's language, else the first

Asked in the `cat-harness-tools` drain session: when a slot holds several languages, which entry does a single-text display show? The owner chose **"Locale match, else first"**. Stage 3 is split so no layer's typecheck breaks when the slot types widen:

- [x] **1–2**: PDF image extraction + 274 agent draft narratives across the 4 library instances
- [x] **3a**, `cat-harness#396`: `narrativeFor(slot, lang?)` (matches exact `lang`, then primary subtag, then falls back to first entry)
- [x] **3b**, `cat-harness-tools` + `folio-assistant-core#169` (`lsi-blocks.ts:88`) + `smart-base#117`
- [x] **3c**, `cat-harness#400`: the six slot schemas switch to `NarrativeSlotSchema`, and `block-summary` / `figure-description` read through it
- [x] **3d**: stored narratives migrated to one-entry lists tagged `lang: "en"` across `cat-harness` (#405, #407: 609), `folio-assistant-core` (#173: 50), `folio-assistant-sci` (#48: 50), `who-iris` (#78: 418), `smart-base` (#118) and `smart-immunizations` (#67), plus `cat-harness-tools` #537, #539, #540

### Stage 4 — merged (`cat-tools-e1lo`, `cat-harness-tools#548` `85a3446e6f` + `cat-harness#413` `ee172f2d13`)
- [x] Stage 4: make `lang` required on every written narrative and keep the bare object only as the empty `NOT_AUTHORED` slot (owner ruled `"1A 2A 3A"` on 2026-10-22; tools readiness merged in `cat-harness-tools#548` `85a3446e6f`, schema change merged in `cat-harness#413` `ee172f2d13`):
  1. **1A**: `NOT_AUTHORED` (`{ text: null, state: "not-authored" }`) kept as the one single-form value with no `lang`,
  2. **2A**: `superseded` history in block summaries requires `lang` too (0 entries exist today),
  3. **3A**: `FigureSchema.narrative` on authored paper figure blocks becomes a `NarrativeSlotSchema` slot like every other (0 authored figure blocks carry a narrative today).
- [ ] Draft localized narratives for each configured non-English language and queue each draft for human confirmation.

_2026-10-24T08:16:00Z_ — Claimed by the cloud drain thread "Drain content model and ingest beans" (session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU). Open work: French pilot in litlfred/folio-assistant-core#202, then the other locales.

_2026-10-24T09:27:19Z_ — French pilot merged, litlfred/folio-assistant-core#202 (39eb6940): `lang: "fr"` drafts for the 46 arxiv-2510.21603v1 figures. Still open: the other figures and ar, es, ru, zh.

_2026-10-24T10:55:14Z_ — Spanish merged, litlfred/folio-assistant-core#210 (fca35a3f): `lang: "es"` drafts for the same 50 arxiv-2510.21603v1 figures, all 96 slots valid. Still open: ar, ru, zh here, and every locale for the other library entries. Claim released; the next thread can pick it up.

_2026-10-24T10:56:06Z_ — Re-claimed by the cloud drain thread "Drain content model and ingest beans" (owner extended the window to ~13:48Z; session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU).

_2026-10-24T11:34:43Z_ — ar, ru and zh merged, litlfred/folio-assistant-core#212 (557117e8). arxiv-2510.21603v1 now has drafts in all six languages (en, fr, es, ar, ru, zh) for its 50 figures. Still open: the other library entries (~880 English figure drafts) and human confirmation.

_2026-10-24T13:40:00Z_ — litlfred/cat-harness#556 merged (aa48c7a1): fr/es/ar/ru/zh draft narratives for 22 figures in 11 cat-harness entries are on main and wait for a person. Claim released.

_2026-10-24T13:42:00Z_ — Re-claimed by the cloud drain thread "Drain content model and ingest beans" (owner window to ~16:48Z; session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU).

_2026-10-24T14:18:00Z_ — litlfred/cat-harness#584 merged (9487253c): fr/es/ar/ru/zh drafts for 25 figures in wang-rangaiah-2026-mcdm-aggregation, arxiv-2504.07199v3 and arxiv-2405.14766v2.

_2026-10-24T14:25Z_ — cat-harness#583 merged (c448735d). Batch C opened as cat-harness#586: 32 figures in gurel-tat-2017-swot-analysis, arxiv-2505.10399v1, nist-sp-800-207.

_2026-10-24T14:36Z_ — cat-harness#586 merged (batch C, 32 figures).

_2026-10-24T14:50Z_ — batch D opened as cat-harness#588: 13 figures in omg-2024-spdx-3-0.

_2026-10-24T14:48Z_ — cat-harness#588 merged (batch D, 13 SPDX figures).

_2026-10-24T14:52Z_ — batch E opened as cat-harness#590: 14 figures in arxiv-2607.14456v1.

_2026-10-24T15:02Z_ — cat-harness#590 merged (batch E, 14 figures of arxiv-2607.14456v1).

_2026-10-24T15:18Z_ — cat-harness#592 merged (batch F, 17 figures of arxiv-2607.20636v1).

_2026-10-24T15:35Z_ — cat-harness#595 merged (batch G, 19 figures of arxiv-2505.06046v4).

_2026-10-24T15:38Z_ — cat-harness#597 merged (batch H, 28 figures of arxiv-2312.07755v1).

_2026-10-24T15:51Z_ — cat-harness#599 merged (batch I, fr/es/ar/ru/zh narratives for 32 figures of arxiv-2404.04834v4).

_2026-10-24T16:24Z_ — Window wrap-up: last d5f1 batch was cat-harness#599 (merged). Claim released.

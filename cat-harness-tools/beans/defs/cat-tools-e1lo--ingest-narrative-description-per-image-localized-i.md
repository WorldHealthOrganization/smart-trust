---
# cat-tools-e1lo
$schema: bean/1.0.0
title: 'INGEST: narrative description per image, localized, including images extracted from PDFs'
status: completed
type: task
priority: normal
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:33:42Z
updated_at: 2026-10-22T17:10:00Z
---

Parent epic (in index store): folio-assistant-zzmr.

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-d5f1`** by the owner's ruling (the code this bean changes lives in cat-harness-tools; the core copy stays as a pointer). Body copied verbatim below; history and rulings recorded there remain authoritative up to this date.


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


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). Every figure block has an agent draft narrative: 274 in total across the cat-harness, core, sci and who-iris libraries. What's left is a narrative per language and human confirmation through the review queue. The mechanism is `pdf-images.py` and `narratives.ts` in cat-harness-tools. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Owner decision above — resolved

The rehome question (option 1) was settled by the owner's ruling of 2026-10-10: this bean IS the rehomed copy, so the question above is closed and must not be re-asked. Kept for history.

## Re-measured 2026-10-20 — the next step is a schema change in cat-harness

`scripts/narratives.ts` (here) queues narratives, but the schema it validates
against, `@litlfred/cat-harness/schemas/narrative.ts`, has **no language
field at all**. "A narrative per language" cannot be stored, let alone queued,
until that schema says how. The remaining human-confirmation half is the
owner's, through `bun run cat narratives`.

## Owner decision

How does a narrative carry its language? (Asked 2026-10-20 by the
cat-harness-tools drain lane; the change lands in cat-harness's
`schemas/narrative.ts`, then `narrativesIn` here follows it.)

1. **(Recommended) A `lang` (BCP 47) field on each `Narrative`, and the
   `narrative` slot becomes a list, one per language.** Each language has its own
   author, model version and review state, which is what the review queue
   decides on; a missing language is visibly absent.
2. A map keyed by language (`narrative: { en: …, fr: … }`). Compact, but a
   reviewer confirms each entry separately anyway, so the queue path needs the
   key as well.
3. Keep one narrative and translate it at render time. No per-language review,
   so it gives up the human confirmation the 2026-10-06 ruling asked for.

**Default if no answer:** option 1.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Owner ruling 2026-10-20: option 1, a `lang` per narrative

Answered directly in the cat-harness-tools drain session ("2y"). Each
`Narrative` carries a BCP 47 `lang`, and the `narrative` slot becomes a list
with one entry per language, each with its own author, model version and review
state. Order of work: the schema change in cat-harness (`schemas/narrative.ts`)
first, then `narrativesIn` and the queue here follow it.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.

_2026-10-20T18:14:45Z_ — Claimed by feat/e1lo-narrative-lang — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Stages 1 and 2 of the language ruling — 2026-10-20

The ruling lands in four stages, so no stored narrative is invalid at any point:

- [x] **1, cat-harness** (litlfred/cat-harness#384): `Narrative.lang` (BCP 47,
      optional for now); `NarrativeSlotSchema` accepts one narrative or a list
      in which every entry names its `lang` and none repeats; `narrativesOfSlot`
      reads either.
- [x] **2, this repository**: `narrativesIn` reads every slot (flat, images,
      summaries) through `narrativesOfSlot`. A list yields one queue item per
      language at `[..., "narrative", j]`, the queue shows `[lang]`, and
      `decide` writes the one entry the reviewer saw. Tests in
      `scripts/tests/narratives.test.ts`, mutation-checked.
- [x] **3**: the six slot schemas in cat-harness (`document-image`,
      `block-summary`, `tabular-records`, `vector-figure`,
      `figure-description`, `tabular-csvw`) switch to `NarrativeSlotSchema`,
      and the stored narratives (274 per the count above, across the
      cat-harness, core, sci and who-iris libraries) migrate to lists with
      their source `lang`.
- [x] **4**: the single form goes, and `lang` becomes required.
- [ ] then the bean's own work: an agent drafts each configured language, and
      each draft goes to the queue for a person.

Released to `todo`: stage 3 touches four content repositories' stored data.
Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.

## Owner ruling 2026-10-21: a display shows the reader's language, else the first

Asked in the cat-harness-tools drain session (structured question): when a
slot holds several languages, which entry does a single-text display show?
The owner chose **"Locale match, else first"**. Stage 3 is therefore split, so
that no layer's typecheck breaks when the slot types widen:

- [x] **3a**, cat-harness#396: `narrativeFor(slot, lang?)`. It matches the
      exact `lang`, then the primary subtag, then falls back to the first
      entry.
- [x] **3b**, this repository (`feat/e1lo-readers-slot-aware`):
  - Counters read every entry: `check-l1-complete` (figures with text,
    images still not-authored, and table detail lines as `lang:state`).
  - The sidecar parse check uses `NarrativeSlotSchema`, so a valid list is
    not reported as a defect.
  - Displays use `narrativeFor`: `library-graph`, and `library-document`
    through `scripts/lib/narrative-display.ts` for untyped JSON.
  - Still to do: folio-assistant-core `scripts/lsi-blocks.ts:88`
    (`block.narrative?.text`). It is another repository, handed to the
    coordinator.
- [x] **3c**, cat-harness: the six slot schemas switch to
      `NarrativeSlotSchema`, and `block-summary` / `figure-description`
      read through it.
- [x] **3d**: the 274 stored narratives migrate to lists with their source
      `lang`, in four content repositories.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.

## Stage 3d done; stage 4 needs three owner decisions (2026-10-21)

**Data (3d) merged** for cat-harness (#405, #407: 609), core (#173: 50), sci (#48: 50) and who-iris (#78: 418). Every one is a one-entry list naming `en`. smart-base and smart-immunizations are lane S's, run with the tool set on tools main.

**Tools merged:**
- #537: writers emit `[{…, lang}]`.
- #539: the queue and the migration see vector figures and figure descriptions.
- #540: the migrator keeps Python number spellings.

Stage 4 makes `lang` required and removes the single form. Three places need a call first. Counts are measured across the composed index's libraries, plus qou's folio.

### 1. What does an empty slot ("not-authored") look like?
`NOT_AUTHORED = { text: null, state: "not-authored" }` marks "no description yet". Where it comes from:
- written today by `tabular-csvw.ts` for every new CSVW record;
- implied by `document-image.ts` for a describable image with no narrative;
- stored once on disk: folio-assistant-sci `codata-2022/tabular.jsonld`.

- **A. (recommended) Keep it as the one single-form value, with no `lang`.**
  - Every authored narrative is a list entry with a required `lang`; "nothing written" stays `{ text: null, state: "not-authored" }`.
  - Cost: one schema branch. No data changes.
  - Risk: readers see two shapes, but they already go through `narrativesOfSlot`.
  - Commits to: an empty slot claims no language, so adding a French draft later is plainly "the first narrative", not "French added while English is still missing".
- **B. A one-entry list with `lang: "en"`.**
  - One shape everywhere.
  - Cost: change `NOT_AUTHORED` and migrate the 1 stored record.
  - Risk: it asserts a language for text that does not exist, and a later `fr` draft beside it reads as "English is missing".
- **C. An absent field means not-authored.**
  - Remove `NOT_AUTHORED` altogether.
  - Cost: `document-image` and `tabular-csvw` change, and the "absence is distinguishable from rejection" behaviour (document-image test) has to be re-argued.
  - Risk: absent then means both "not looked at" and "looked at, nothing written".
- **If you say nothing:** stage 4 waits, nothing breaks, and new narratives are already written with `lang` (#537).

### 2. `superseded` history in block summaries
`superseded` is a plain `Narrative[]` with `lang` optional. **0 entries exist** in any library today.

- **A. (recommended) Require `lang` there too.**
  - Free now: nothing to migrate, and new entries are copies of slot entries, which already carry `lang`.
- **B. Leave it optional** as historical record.
  - Costs nothing now, but keeps a second rule for "a narrative" in the schema.
- **If you say nothing:** it stays optional, which is harmless while it is empty.

### 3. `FigureSchema.narrative` (authored paper figure blocks, cat-harness `constraints.ts`)
It is still the single `NarrativeSchema`, not a slot. **0 authored figure blocks carry a narrative**, in qou's folio or anywhere else in the index.

- **A. (recommended) Make it a slot like every other**, and require `lang` with the rest.
  - One line, nothing to migrate.
- **B. Remove the field.**
  - Nobody uses it, but library figure blocks (`blocks/figure-*.jsonld`) do carry narratives, so authored figures losing the field would be an odd asymmetry.
- **If you say nothing:** it remains the last single-form schema, and stage 4 cannot remove the single form.

Recommendation, as my judgement: 1A, 2A, 3A. That gives stage 4 one rule — every written narrative names its language — with one explicit exception: "nothing written yet".


## Summary of Changes

*2026-10-22T17:10:00Z* — Done (lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). Stage 4, the owner's ruling "1A 2A 3A", merged as litlfred/cat-harness#413 (`ee172f2`):
- **1A:** a written narrative must name its `lang`, and the bare object is only the empty `not-authored` slot.
- **2A:** `superseded` requires `lang`.
- **3A:** `FigureSchema.narrative` is a `NarrativeSlotSchema`.

The data had already been migrated in every layer:
- cat-harness #405 and #407
- core #173
- sci #48
- who-iris #78
- smart-base #118
- smart-immunizations #67

The writers, the review queue and the migrator follow the list form (cat-harness-tools #537, #539, #540 and #548).

The coordinator found 0 invalid records across every library under the stage-4 schema. Lane C carries ee172f2 into the next index re-pin. That is a pin bump, not work on this bean.

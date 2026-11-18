---
# folio-assistant-6xaz
$schema: bean/1.0.0
title: pdf-structure infers a TOC from a worked EXAMPLE and ships it as the document's own structure
status: completed
type: bug
priority: normal
created_at: 2026-09-19T00:12:09Z
updated_at: 2026-10-10T16:40:52Z
parent: folio-assistant-0lmb
---

Measured 2026-09-19 ingesting `uploads/WPR-RDO-2020-003-eng.pdf` (WHO WPRO 'Publication and Information Products Style Guide', 33pp, no embedded outline).

`scripts/pdf-structure.py` inferred 13 sections and wrote 11 of them named after **a different publication**: 'FACILITY LEVEL: Improving hospital planning and management', '1.1 Accountability', '2.1 Goal – Hospitals as a path to UHC'. Those come from page 22, which is a SAMPLE TABLE the style guide reproduces as a design example ('OVERVIEW OF ACTION AREAS AND DOMAINS'). Every level-2 entry was stamped `page: 22` — the page the table was found on — so the collision is visible in the output and nothing acts on it.

The document's real structure is a style guide: INTRODUCTION (p3), PAGINATION (p23), and so on.

**Why this is worse than no sections.** `content/docs/document-ingestion/uploads-and-library-are-two-stages-of-one-pipeline.md` argues that an un-ingested source is worse than an absent one 'because it produces false confidence rather than a gap'. Misnamed sections are that failure one level in: they are greppable, they are in `library/`, and they answer a question wrongly with authority. Ingested with `--no-sections` for now, so it carries `structure.json` and no false tree.

`toc_source: "inferred"` IS recorded, and `diagnostics` reports `toc_entries: 13, sections: 13` — but a consumer reading `sections/` cannot tell an inferred tree from an outline-derived one, and the two are not comparable in trustworthiness. Contrast `uploads/9789241548960_eng.pdf` (WHO handbook for guideline development, 2nd ed), which HAS an embedded outline: `toc=258(out)`, 250 sections, all sound.

## Done when
- An inferred TOC whose entries collapse onto one or two source pages is reported as NOT DETERMINED rather than emitted — the third-state rule this repo applies everywhere else ('could not determine' is never rendered as an answer).
- `sections/` records its own `toc_source`, so a consumer can weight an inferred tree differently from an outline-derived one without re-reading `structure.json`.
- A test over a PDF containing a sample table asserts the sample is not read as structure.

_2026-09-19T00:18:29Z_ — ## Widened — it hit BOTH outline-less documents, in different shapes

Measured 2026-09-19 on the second one too, `uploads/WHO_PUB_TPS_93.1.pdf` (WHO Editorial Style Manual, 121 scanned pages, OCR'd):

`pdf-structure.py --ocr` read the TOC titles correctly — Spelling, Punctuation, Quotations, Non-discriminatory language are the manual's real chapters — but took every entry's PAGE NUMBER from the contents page it was found on (`pages: 2-2`, `pages: 4-4`). So the section boundaries were meaningless: **26 of 42 sections came out under 500 characters** while 37 923 characters landed in one section misnamed `sec-039-18-usetul-reference-books` (OCR typo included) and 20 922 in `sec-040-1-seat-of-government-la-paz`.

So the failure is not only 'a sample table read as structure'. Both shapes are the same root cause: an inferred TOC is emitted with the same authority as an outline-derived one, and `sections/` does not record which it was.

**Interim, not a fix:** `scripts/pdf-pages.py` ingests at PAGE granularity — `section_title: "Page N"`, `pages: N-N`, `granularity: page`, `toc_source: none`. A page is a determined division; an inferred chapter was not. Both documents re-ingested that way, so every rule derived from them can cite a node that really contains it. Delete the page trees and re-ingest with `pdf-structure.py` once this bean is fixed.

Contrast held: `uploads/9789241548960_eng.pdf` HAS an embedded outline and its 250 chapter sections are sound — real titles, real page ranges ('Identifying and managing conflicts of interest', pp 46-47, 1120 chars).


_2026-09-20_ — Claimed by `claude/ecstatic-goldberg-eroyaz`.


## 2026-09-20 — shape one fixed and pinned; shape two measured and NOT fixed

### What landed

`inferred_toc_verdict` in `scripts/pdf-structure.py`. An inferred table of
contents whose entries concentrate on the commonest one or two source pages is
recorded as `toc_source: "undetermined"` with a reason in numbers, and no tree
is emitted. `split_sections` on an empty TOC yields one `sec-000-document`
holding the whole text, so **refusing a tree is not discarding the document** —
it stays greppable under an honestly named node.

Measured on the document this bean was opened over, before and after:

```
BEFORE  toc_source=inferred     toc=13  sections=13
  shipped: ['Front matter', 'Introduction',
            'FACILITY LEVEL: Improving hospital planning and management',
            'Accountability', 'Efficiency', 'Quality']
AFTER   toc_source=undetermined toc=0   sections=1
  ships  : ['Document']
  reason : 13 inferred entries, 92% of them starting on page(s) 22, 24 of 33
           — a list found ON a page, not the document's structure
```

`sections/*.md` now carries `toc_source:` in its front matter. That is the half
serving BOTH shapes: it is `sections/` that gets read, quoted and cited, and a
consumer there could not previously tell an inferred tree from an
outline-derived one.

**The falsifier held, and it was the sharp one.** `9789241548960_eng.pdf` — the
one document with a real embedded outline — came out **byte-identical** field
for field: `toc_source: outline`, 258 TOC entries, 250 sections, only the two
new keys added. If the detector had touched it, the detector was wrong.

### Shape two: measured, and deliberately left open

The widening note above predicted `WHO_PUB_TPS_93.1.pdf` would fail the same
way. **It does not.** Re-measured today with `--ocr`:

| | |
|---|---|
| entry page concentration | page 2 ×6, page 39 ×5, page 3 ×4 — **top two = 27% of 41** |
| verdict | `None` — correctly trusted by this detector |
| the actual damage | 26 of 42 sections under 500 chars; 37,923 in `sec-039-18-usetul-reference-books` |

So its signature is **degenerate section sizes**, not TOC concentration — a
different defect in `split_sections`, which matches an entry's title within
`page ± 2` and so lands a boundary on the contents page itself.

**Why no second detector.** A size-distribution check needs calibrating, and
the corpus offers nothing to calibrate against: one bad inferred document, and
**zero known-good inferred ones** — the only well-behaved document here
(`9789241548960-eng`, median 779 chars, 30% under 500) is outline-derived and
would never be subject to the check. A threshold set from one failure and no
contrast is a number nobody can re-derive, which is the defect class this
session has spent the day removing. It would also have been a *wrong pass*
dressed as diligence.

### Verification

15 checks in `scripts/tests/pdf-toc-verdict.test.py`, ten mutations each caught
by a named one. Two fixture PDFs are built by hand — the repository declares no
PDF *writer*, and a fixture needing an undeclared dependency is one CI cannot
build. The second exists because of a **surviving mutation**: "an outline is
second-guessed too" passed against the handbook, whose outline is spread over
179 pages, so the arm proved nothing until a PDF with a *concentrated* outline
was built to pin the property rather than the document.

### Still open

- Shape two, above — `split_sections` boundaries on an inferred TOC.
- Re-ingesting the two documents with `pdf-structure.py` (they carry
  interim page-granularity trees from `pdf-pages.py`). The bean says to do that
  once this is fixed; shape two is not, so they stay as they are.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.


## 2026-10-06 — shape two fixed at the dedupe layer (branch claude/goal5-ingest-spine)

Root cause, measured on the stored OCR pages of who-iris/library/who-pub-tps-931 (no tesseract here; the 121 page texts were rebuilt from sections/page-*.md and fed to infer_headings + split_sections): 16 chapter headings sit on contents pages 2-4 AND once each, in order, in the body (Spelling p8, Punctuation p16 … Technical reports p78). infer_headings kept each heading's FIRST occurrence, so the contents listing shadowed every chapter. The existing contents-page skip never fired because the OCR moved the page numbers into a column of their own.

Fix: `listing_pages` marks a page whose >=2 NUMBERED headings recur later on DIFFERENT pages, in the same order, and its entries are dropped before dedupe. That is a property of the page, not a calibrated threshold. Running headers (which recur on ONE page), a single recurring heading, and out-of-order recurrences are all pinned as negatives.

Measured: chapters now start on their body pages; sections under 500 chars went 26 -> 14 (of 40). No collateral: 13 other outline-less PDFs plus the handbook and an arXiv outline doc are byte-identical before and after. Mutation (listing disabled) caught by arm 8. Arm 7 (the handbook falsifier) had been silently skipping because the PDF moved to who-iris/uploads/9789241548960-eng/; it runs again.

STILL OPEN (shape three, not fixed): numbered LIST ITEMS in the body ('1 To mark the antithesis…', '1 List all authors when three or fewer…') read as headings. That is the remaining 14 short sections. Separating them needs either a calibrated length threshold (nothing to calibrate against: one bad document, zero known-good inferred ones) or a numbering-monotonicity rule that would break documents whose numbering restarts per part. Not guessed. Re-ingesting who-pub-tps-931 with pdf-structure --ocr also waits on shape three, and needs an OCR engine this container lacks.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C). All three **Done when**
criteria are met in the code's current home — `scripts/pdf-structure.py` moved
to `litlfred/cat-harness-tools` in the repo separation (re-located as the
handover asked; it is not in this repository):

- **Concentrated inferred TOC → NOT DETERMINED.** `inferred_toc_verdict`
  (`scripts/pdf-structure.py:489`) records `toc_source: "undetermined"` with a
  numeric reason and emits no tree; the document stays whole under
  `sec-000-document`.
- **`sections/` records its own `toc_source`.** Written into each section's
  front matter (`scripts/pdf-structure.py:1681`).
- **Sample-table test.** `scripts/tests/pdf-toc-verdict.test.py` arm 4 builds a
  PDF whose second page is a sample table and asserts it is not read as
  structure; a concentrated-outline fixture pins that outlines are not
  second-guessed.

Shape two (contents-page entries shadowing body headings) is also fixed there
(`listing_pages`, `scripts/pdf-structure.py:624`).

**Not done here, and why:** shape three — numbered list items in the body read
as headings (the remaining 14 short sections of `who-pub-tps-931`) — and the
re-ingest of the two style-guide documents with `pdf-structure.py --ocr`. Both
are changes to a harness tool, which this layer does not own (AGENTS.md: "the
harness owns the harness"), and both still need either an owner ruling on
threshold vs numbering-monotonicity or an OCR engine. They are handed to the
cat-harness-tools store as a follow-up rather than kept open against criteria
that are met.


## Summary of Changes

Mirror copy. Owned by litlfred/folio-assistant-core's store, where drain lane C closed it (folio-assistant-core#25; residual \"shape three\" is harness-tool work for the cat-harness-tools store). Closed here so no lane repeats it.



## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C). All three **Done when**
criteria are met in the code's current home — `scripts/pdf-structure.py` moved
to `litlfred/cat-harness-tools` in the repo separation (re-located as the
handover asked; it is not in this repository):

- **Concentrated inferred TOC → NOT DETERMINED.** `inferred_toc_verdict`
  (`scripts/pdf-structure.py:489`) records `toc_source: "undetermined"` with a
  numeric reason and emits no tree; the document stays whole under
  `sec-000-document`.
- **`sections/` records its own `toc_source`.** Written into each section's
  front matter (`scripts/pdf-structure.py:1681`).
- **Sample-table test.** `scripts/tests/pdf-toc-verdict.test.py` arm 4 builds a
  PDF whose second page is a sample table and asserts it is not read as
  structure; a concentrated-outline fixture pins that outlines are not
  second-guessed.

Shape two (contents-page entries shadowing body headings) is also fixed there
(`listing_pages`, `scripts/pdf-structure.py:624`).

**Not done here, and why:** shape three — numbered list items in the body read
as headings (the remaining 14 short sections of `who-pub-tps-931`) — and the
re-ingest of the two style-guide documents with `pdf-structure.py --ocr`. Both
are changes to a harness tool, which this layer does not own (AGENTS.md: "the
harness owns the harness"), and both still need either an owner ruling on
threshold vs numbering-monotonicity or an OCR engine. They are handed to the
cat-harness-tools store as a follow-up rather than kept open against criteria
that are met.

---
# folio-assistant-j820
$schema: bean/1.0.0
title: 'PDF EXTRACTOR FRAGMENTS A COMPOSITE FIGURE: 383 placed images against 7 captioned figures, 335 from one page'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T21:14:17Z
updated_at: 2026-09-24T13:46:41Z
parent: folio-assistant-slw1
---

Found 2026-09-23 while ingesting arXiv:2510.21603v1 (bean `ctp3`). Split out
rather than worked around, because routing around it would have meant writing 383
image descriptions from nothing.

## CORRECTED 2026-09-24 — the original diagnosis in this bean was WRONG

Everything below the next heading was written on 2026-09-23 from counts and
file sizes. **Two file reads falsified it**, and the corrected finding is
better: it names a mechanical fix where the original named an open judgement.

| the bean said | what looking showed |
|---|---|
| "fragments of one composite architecture figure" | **clip-art icons** — a newspaper, a picture placeholder — the icons Figure 1 uses to depict document types in its pipeline |
| "many byte-identical in size", implying blank pieces | distinct and meaningful; the identical sizes are the SAME icon placed repeatedly |
| "383 descriptions would be fabrication" | **383 placements are 50 DISTINCT images**. Page 3's 335 are **22**, each placed ~15 times. Describing 50 is ordinary work |

**The defect is duplicate placement, not fragmentation.** The extractor emits
one entry per PLACEMENT rather than per distinct image, and it is general:

| document | placed | distinct by content hash |
|---|---:|---:|
| `arxiv-2510.21603v1` | 383 | **50** |
| `9789241509510-eng` MAPS | 161 | **102** |
| `9789241511766-eng` M&E guide | 99 | **44** |
| `arxiv-2312.07755v1` | 84 | **28** |
| `arxiv-2607.14456v1` | 14 | 14 (clean) |

**So the bean's own question is answered: EXTRACTION-side, by deduplicating on
content hash.** No threshold, no judgement, no corpus-specific number — the
thing four separate geometric rules could not give (see the next section). It
cuts this document from 383 to 50 and makes it promotable.

**A residue remains and is NOT this.** MAPS's 63 blank cover pieces survive
dedup, because blank rectangles of differing dimensions hash differently. That
is `m4xy`'s vector/furniture finding and stays with `m4xy`.

**`arxiv-2312.07755v1` is not the fourth instance this bean claimed.** Its 76
images on page 10 are 28 distinct icons in Table 2, *"the 10 most common icon
semantics"* — each already carrying an accurate individual narrative. A crowded
page can be legitimately crowded, which is one more reason no count-based rule
works.

## Measured

| | |
|---|---|
| document | `arxiv-2510.21603v1` (Dong et al., Doc-Researcher), staged, **not promoted** |
| captioned figures in the text | **7** |
| images `pdf-images.py` placed | **383** |
| from page 3 alone | **335** |
| shape of those 335 | many byte-identical in size |

Page 3 carries the paper's composite architecture diagram. The extractor placed
each of its constituent drawing objects as a separate image, so the count is not
"335 figures" but one figure in 335 pieces.

## Why this blocks promotion, and why that is correct

`image-descriptions` is an L1 completeness requirement, and `document-image.ts`'s
inspection basis exists so that a description is grounded in something an inspector
actually looked at. A description of a fragment of a composite is a description of
nothing a reader will ever see — writing 383 of them is fabrication at scale, which
is the failure the requirement is there to prevent. The gate is doing its job; the
extractor is producing a subject the gate cannot honestly clear.

## What this is NOT

- **Not `xeg6`.** That was `2602.12670v4`: 7 images, all genuinely figures, all
  below `CAPTURE_CHROME_THRESHOLD`, and the finding was that a coverage bound
  would misclassify three of them. Here the count itself is wrong before any
  threshold is applied.
- **Not `r8br`.** That is browser-print nav icons — chrome mistaken for content.
  These are content, fragmented.

The three are siblings under `slw1` and each needs its own answer.

## MEASURED 2026-09-24 across 29 documents in 5 libraries — and every geometric rule FAILED

The bean asked for the ratio across the staged corpus. That question was the
wrong one twice over, and reading before building is what caught both.

**First: the survey already existed.** `m4xy` did it 2026-09-22 over all seven
WHO entries (issue #877), and its table already holds a SECOND instance of this
pathology — `9789241509510-eng` MAPS Toolkit, 4 declared figures, 161 placed
images, **63 of them blank fragments of one title page**. So this was never a
one-document finding; it was a one-document *rediscovery*.

**Second: `m4xy` explicitly forbids the metric this bean proposed.**
`check-l1-complete.ts` says it in its own docstring — *"It does not compare
counts. Declared figures and placed images are not commensurable and a ratio
between them asserts a coverage this cannot establish."* A placed-vs-captioned
ratio was the one thing not to build.

So the measurement was re-aimed at PER-PAGE GEOMETRY, which is a different
question and needs no caption counts. Four candidate discriminators were tested
over every `images.json` in the tree, excluding `method: "capture"` and the
`chrome`/`page-scan` roles that `r8br` already handles.

| candidate rule | result |
|---|---|
| busiest page's **share** of the document's images | **fails** — a one-image document is trivially 100 %, so five healthy entries tie with the worst offenders |
| **absolute max images on one page** | a real gap at 7 → 26, but both 26-image cases are the Antigravity browser captures, already `role: chrome`. It separates a class that is already separated |
| **total coverage of a page's images together** | continuous, 0.0059 → 0.6099, no gap. And inverted: the WORST page (MAPS cover, 63 pieces) has the HIGHEST total, 0.61, because the fragments tile the cover |
| **per-image coverage** | **the two classes overlap completely** — see below |

### The decisive one

Splitting every figure-role image by whether its page is crowded (≥20 images):

```
crowded pages   n=621   coverage 2.70e-05 .. 6.03e-01
uncrowded       n=144   coverage 2.80e-05 .. 5.04e-01
```

The ranges are the same to within 4 %. **All 144 uncrowded-page images sit below
the highest crowded-page one.** No threshold on coverage can separate a fragment
from a figure, in either direction.

### `m4xy`'s gap is REAL, and it is corpus-specific

Checked against the same 296 images `m4xy` pooled: its stated empty stretch
≈ 0.00012 .. 0.00033 **is genuinely empty** — values sit at 1.21e-04, then
nothing, then 3.36e-04. An earlier reading of mine that put 7 images inside it
was an artefact of rounding `≈0.00012` down; corrected here rather than left
standing.

But the 469 figure-role images OUTSIDE `smart-base/` have a MINIMUM coverage of
**1.81e-04** — above the gap entirely, with nothing below it. So a threshold
placed in `m4xy`'s gap would be **inert on every non-WHO document**, including
the two with the worst fragmentation:

| page | pieces | median coverage each |
|---|---:|---|
| `9789241509510-eng` p1 (WHO) | 63 | 1.12e-04 |
| `9789241511766-eng` p1 (WHO) | 71 | 1.15e-04 |
| `arxiv-2312.07755v1` p10 | 76 | 1.81e-04 |
| `arxiv-2510.21603v1` p3 | 335 | 4.79e-04 |

WHO fragments and arXiv fragments live a half-order of magnitude apart. One
number cannot catch both, and `m4xy`'s own objection — *"a threshold chosen
after seeing this corpus is a number chosen to fit the answer"* — is now
measured rather than suspected.

## Crowded pages, and what each one actually is

Written before the correction at the top of this bean, which reclassifies two
of these. Kept because the list is the evidence the geometric rules were tested
against, and because “crowded” turns out NOT to be one condition:

| page | placed | distinct | what it is |
|---|---:|---:|---|
| `9789241509510-eng` p1 | 63 | — | blank cover fragments (`m4xy`'s finding, survives dedup) |
| `9789241511766-eng` p1 | 71 | — | blank cover fragments |
| `arxiv-2312.07755v1` p10 | 76 | **28** | **legitimately crowded** — a table of icon semantics, each icon real and already accurately described |
| `arxiv-2510.21603v1` p3 | 335 | **22** | one icon set, each placed ~15 times |

Three different things behind one symptom, which is the whole reason a
count-based rule fails.

## What this means for the bean's own question

The bean asked “extraction-side or classification-side?” **On this evidence it
is neither, as an automatic rule.** Every geometric signal available is
continuous across the two classes, which is precisely the situation
`document-image.ts` was built for: it refuses `logo` and `decorative` on a
geometry basis *because no measurement of a placed rectangle can make those
calls*, and `apply-image-verdicts.ts` records an `inspection` basis naming who
looked. That mechanism is correct and this measurement is evidence FOR it.

What is missing is not a threshold. It is:

1. **No `fragment` role.** `IMAGE_ROLES` is `page-scan | figure | chrome | logo
   | decorative | undetermined`. An inspector who can see that 335 images are
   one diagram in pieces has nowhere to record it, so the only way to clear
   `image-descriptions` is to write 335 descriptions — which is the fabrication
   the inspection basis exists to refuse.
2. **No way to inspect a page as a group.** Verdicts are per image id. The
   judgement “these 335 are one figure” is a statement about a PAGE.

## Open, and NOT decided here

Whether the fix is at extraction (merge drawing objects that share a page region
into one placed image) or at classification (a `fragment` verdict that
`image-descriptions` does not require a description for) is a real design choice
with a real trade-off, and picking one from a single document is picking from one
data point. Measure across the staged corpus first: how many other documents have
a page whose image count is an order of magnitude above its caption count?

## Done when

- [x] measured across every ingested document — 29 in 5 libraries, not just
      this one, and not as a ratio (`m4xy` forbids that comparison)
- [x] four geometric discriminators tested; all four fail, and the failure is
      the finding
- [ ] the owner rules on a `fragment` role + page-level verdicts, which is what
      the measurement points at instead of a threshold
- [ ] `arxiv-2510.21603v1` either promotes, or carries a recorded reason it cannot
- [ ] `arxiv-2312.07755v1` is re-examined — it is ALREADY PROMOTED with 76
      drafted narratives over one fragmented page, and nobody knew

## Summary of Changes — 2026-09-24

Owner: *"dedup everything, migrating the narratives."*

**`schemas/document-image.ts`** gains `PlacementSchema` and an optional
`placements[]`, with a refinement holding `placements[0]` to the placement
`basis` describes. Absent on a singly-placed image, so ~90 % of entries are
unchanged and all 16 existing readers of `basis.page` keep working.

**`scripts/pdf-images.py`** emits one entry per distinct image. **Keyed on the
PDF's own `xref`, not a content hash** — two placements of one image object ARE
one image by the document's own account. Checked before choosing: on
arXiv:2510.21603v1 the PDF holds 51 objects whose decoded bytes are 37
distinct, so hashing would merge images the PDF keeps apart. Its summary line
now prints distinct AND placements, because the gap between them is the finding.

**`scripts/migrate-image-placements.py`** carries the committed corpus onto the
new shape. It re-derives nothing: it groups by the bytes on disk and moves what
is already there.

| | |
|---|---|
| sidecars collapsed | **10** of 29 |
| entries | **809 → 279** |
| placements preserved | all of them |
| placement notes written | 13 |
| duplicate PNGs removed | **530** |
| `ingest-staging/` | 17 MB → **6.7 MB** |

All 29 sidecars validate against the new schema.

### Three things worth keeping

**No narrative was lost and none was invented.** All 463 were `draft` and none
`confirmed`, so no human judgement was overwritten. A later placement's text
becomes `placements[].note`; where the split would have produced a fragment the
whole sentence is kept instead. Three notes the heuristic mangled were rewritten
by hand and are named in the commit.

**The collapse EXPOSED a defect nothing else could find.**
`9789240081949-eng` holds five byte-identical QR codes described as if each
encoded a different category — and a sixth note calls one *"a second square QR
code… describing how the CDISAH classification was developed"*. One image, five
incompatible claims. Preserved verbatim in the notes rather than tidied away;
somebody has to decide what that code actually points at.

**The tests exist because the change passed without them.** Schema, generator,
29 rewritten sidecars and 530 deleted files went green across all 138 gates on
the first run — the `1xhc` shape. `scripts/tests/image-placements.test.ts`
holds the assertions that would have gone red, and one of them immediately
found a real bug: the refinement dereferenced `placements[0]` before `.min(1)`
could reject an empty array, so the schema CRASHED instead of refusing.

### Still open

- `arxiv-2510.21603v1` is now 50 images rather than 383, all
  `not-authored`. Describing 50 is ordinary work and would promote it; nobody
  has done it.
- The QR-code contradiction above.
- MAPS's blank cover fragments survive dedup and remain `m4xy`'s.

## The QR-code finding, corrected 2026-09-24 — I overstated it

This bean, issue #1234 and the #1235 merge commit all said `9789240081949-eng`
held *"five byte-identical QR codes described as if each encoded a different
category — one image, five incompatible claims."* **That was too harsh, and
reading the five properly is what showed it.**

Four of the five are CONSISTENT. Each says: the same code, on a different
category page, with the page text offering `bit.ly/CDISAH` — and the one claim
about the target is hedged, *"which the code likely encodes"*. That is a correct
description of one image placed five times, written before anything could tell
the describer it was one image.

**Exactly one claim was wrong**: the page-64 note opened *"A second square QR
code…"*. It is not a second code; it is PDF xref 540 again. And that note had
already said its own target *"could not be determined from the extracted
image"* — so the describer was careful, and the only error was arithmetic
about identity, which is precisely what per-placement entries made invisible.

So the collapse did expose a real defect, and the defect is smaller and more
specific than this bean claimed. The overstatement is left here rather than
edited away, for the same reason the `doc-researcher.md` one is.

### What was measured

- **One image object.** PDF xref 540, placed on pages 20, 27, 37, 45 and 64.
- **The payload is NOT recoverable from this document.** The embedded raster is
  36×36. `cv2.QRCodeDetector` decodes nothing from it, from its page regions
  re-rendered at 600 dpi, or from whole pages at 300, 600 and 1200 dpi —
  upsampling cannot restore data the embedding never carried. Recorded so
  nobody spends the attempt again.
- **The probable target is an inference, and is now labelled as one.** The text
  offers `bit.ly/CDISAH` at each occurrence and `bit.ly/cdisah_feedback` also on
  page 64.

The narrative and the page-64 note now say all of that. Both remain `draft`.

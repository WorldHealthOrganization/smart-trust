---
title: "Table-of-contents extraction — methods compared against held-out PDF outlines"
kind: research
bean: folio-assistant-cp3v
summary: >-
  Which way of inferring a PDF's table of contents works, when the PDF has no outline? Seven methods scored on 2026-10-06 against the 13 corpus PDFs that do carry one, with the outline hidden and used as the answer key. Layout (a printed contents page, else heading styles from font metrics) reaches title F1 0.89, and the consensus of the methods 0.92 (0.83 on 20 held-out PDFs), against 0.30 for the text-pattern heuristic it replaces. Grobid measured (title F1 0.59, CRF models); Nougat-small measured on CPU over 10 of the 13 (title F1 0.81 against layout's 0.87 on the same 10; bean e8vg).
---

# Table-of-contents extraction
{: .no_toc }

1. TOC
{:toc}

---

> **What this page is.** It records what was measured on **2026-10-06**, on
> this repository's PDFs. The rule an agent follows lives in the
> `document-intake` skill; this page keeps the evidence. Read the
> [limits](#what-this-could-not-establish) before the conclusions.

## The question

`pdf-structure.py` reads a PDF's table of contents from its embedded outline
(bookmarks) when there is one. When there is not — 18 of the 31 PDFs in this
repository on 2026-10-06 have no outline or a single entry — it used to infer one with regular expressions over
plain page text (`infer_headings`). Plain text has discarded what makes a
heading visible: larger type, bold, capitals, italics. So that fallback found
only headings that were numbered or carried one of thirteen stock names.

## How it was measured

**The answer key is the outline itself.** 13 PDFs carry an outline of five or
more entries. For each, the outline is set aside, every method runs on the page
content alone, and its output is scored against the outline. No hand labelling,
and the same harness re-runs after every change:
`python3 cat-harness-tools/scripts/toc-benchmark.py`.

The metrics are the ones the uploaded papers use, so results compare:

| metric | meaning | from |
|---|---|---|
| title P / R / F1 | an extracted entry matches an outline entry when normalised titles agree (similarity ≥ 0.85), one to one, in page order | ICDAR Book Structure Extraction; Wu, Mitra & Giles 2013; "Xerox F1" in Bentabet et al. 2019 |
| link F1 | matched **and** on the same physical page | ICDAR "matching links" |
| level F1 | matched **and** at the same depth, up to one constant shift | ICDAR "matching levels", relative form (below) |
| full F1 | matched with page and level both right | ICDAR "complete entries" |
| capped F1 | title F1 after dropping predictions deeper than the outline's deepest level | this page (below) |
| TEDS | 1 − tree-edit-distance / max(tree sizes) over the nested titles | Wang, Gui & He 2023 |

Two adaptations, both forced by what the outlines are like:

- **Levels up to a constant shift.** The DPI-H reference architecture's
  bookmarks start at "1.1" as level 1, leaving out the chapter level; other
  outlines put the document title above everything. Either way it is the same
  hierarchy, and an absolute comparison scores it zero.
- **Capped F1.** `arxiv-2404.04834v4`'s outline stops at level 2, but the paper
  has numbered `5.1.1` subsections. A method that finds them is marked down for
  being right. Capped F1 drops predictions deeper than the outline goes.

Macro averages (each document counts once), PyMuPDF reading the font metrics.
TEDS is not computed for the 534-page iHRIS handbook (pure-Python tree edit
distance is too slow at 2,500 nodes) and is averaged over the other 12.

## The methods

| method | what it does | where |
|---|---|---|
| `regex` | the previous fallback: text patterns over plain page text, with the concentration verdict | `pdf-structure.py` `infer_headings` |
| `size` | the construction step of Wang et al. (2023) alone: any line set larger than the body is a heading, larger means shallower | `toc-benchmark.py` `m_size` |
| `font` | lines in a heading **style** — size, bold, capitals, italic — with running heads, captions, contents pages, cover pages and sentence-shaped lines removed; levels from section numbering where present, else style rank, repaired into a tree (Bentabet et al. 2019) | `_pdf_headings.py` `font_headings` |
| `contents` | parse a printed contents page (dotted leaders or a trailing page number), levels from numbering or indentation, then move printed page labels to physical pages by finding the titles in the body (Wu et al. 2013) | `_pdf_headings.py` `contents_headings` |
| `layout` | `contents` when it yields five or more entries, else `font` | `_pdf_headings.py` `layout_headings` |
| `consensus` | every method as evidence, each entry scored: a contents entry is confirmed when the body carries it near the page it names, and by a heading style; without a contents page, a style-found heading is confirmed by a section number, a numbered style, a stock section name or another extractor, and in a numbered document an unconfirmed one is dropped | `_pdf_headings.py` `consensus_headings` — **the fallback `pdf-structure.py` uses** |

## Results

| method | title P | title R | title F1 | capped F1 | link F1 | level F1 | full F1 | TEDS |
|---|---|---|---|---|---|---|---|---|
| `regex` | 0.46 | 0.29 | 0.30 | 0.30 | 0.29 | 0.28 | 0.28 | 0.15 |
| `size` | 0.43 | 0.63 | 0.44 | 0.51 | 0.42 | 0.36 | 0.35 | 0.27 |
| `font` | 0.72 | 0.94 | 0.79 | 0.84 | 0.78 | 0.76 | 0.76 | 0.65 |
| `contents` | 0.21 | 0.21 | 0.21 | 0.21 | 0.21 | 0.16 | 0.15 | 0.20 |
| `layout` | 0.85 | 0.97 | 0.90 | 0.92 | 0.89 | 0.83 | 0.83 | 0.79 |
| **`consensus`** | **0.89** | **0.97** | **0.92** | **0.94** | **0.92** | **0.86** | **0.85** | **0.84** |
| `consensus` + Grobid voter | 0.85 | 0.95 | 0.89 | 0.91 | 0.89 | 0.82 | 0.82 | 0.79 |
| `grobid` | 0.52 | 0.75 | 0.59 | 0.61 | 0.58 | 0.51 | 0.51 | 0.33 |

`grobid` is Grobid 0.9.2-SNAPSHOT built from source (commit `e7c522b` of
`grobidOrg/grobid`), CRF models only (`wapiti`, the default configuration, no
deep-learning models), batch `processFullText` with `-teiCoordinates`, on CPU:
237 s for all 13 documents. Section depth is read from each `<head>`'s `n`
attribute, because Grobid writes the body as a flat run of `<div>`s; an
unnumbered head is level 1. See [Grobid, measured](#grobid-measured).

Title F1 per document, smallest outline first:

| document | outline entries | regex | size | font | contents | layout | grobid |
|---|---|---|---|---|---|---|---|
| `2403.07553v1.pdf` | 16 | 0.20 | 0.40 | 0.94 | 0.00 | 0.94 | 0.91 |
| `2506.20759v1.pdf` | 17 | 0.53 | 0.00 | 0.71 | 0.00 | 0.71 | 0.70 |
| `2609.07340v1.pdf` | 17 | 0.80 | 0.00 | 0.97 | 0.00 | 0.97 | 0.73 |
| `arxiv-2601.04544v1.pdf` | 19 | 0.17 | 0.93 | 0.90 | 0.00 | 0.90 | 0.61 |
| `arxiv-2404.04834v4.pdf` | 23 | 0.23 | 0.15 | 0.77 | 0.00 | 0.77 | 0.60 |
| `2603.10808v1.pdf` | 27 | 0.18 | 0.86 | 0.95 | 0.00 | 0.95 | 0.65 |
| `2505.07664v1.pdf` | 29 | 0.00 | 0.42 | 0.92 | 0.00 | 0.92 | 0.50 |
| `arxiv-2507.23348v1.pdf` | 33 | 0.13 | 0.63 | 0.79 | 0.00 | 0.79 | 0.57 |
| `arxiv-2402.02172v5.pdf` | 39 | 0.09 | 0.40 | 0.67 | 0.00 | 0.67 | **0.69** |
| `9789240093362-eng.pdf` | 54 | 0.34 | 0.10 | 0.26 | 0.81 | 0.81 | 0.13 |
| `who-dpi-h-reference-architecture-draft-v1.pdf` | 138 | 0.45 | 0.07 | 0.37 | 1.00 | 1.00 | 0.31 |
| `9789241548960_eng.pdf` | 258 | 0.70 | 0.81 | 0.77 | 0.98 | 0.98 | 0.75 |
| `ihris_admin_handbook_sep_17_2010.pdf` | 1357 | 0.01 | 0.97 | 0.97 | 0.00 | 0.97 | 0.51 |

A heading set over two lines is now continued onto its second line when that
line carries on the title (lower case, or after a hyphen or comma). That
fixed the one IEEE outlier, `2506.20759v1`: its italic research-question
headings were cut at the line break — each a miss and an extra — 0.71 → 0.94.
The first version, which joined any same-style line below, merged adjacent
headings and cost 0.07 overall; the lower-case test is what separates a
wrapped title from the next heading.

### What the table says

- **The two layout methods are complementary, and the split is by genre.**
  Every WHO publication with a printed contents page is solved by `contents`
  (0.81–1.00), where `font` is poor (0.26–0.77), because their body headings
  share styles with call-outs and boxes. Every paper has no contents page, and
  `font` carries them. `layout` takes the better of the two on every document.
- **Style beats size.** `size` (Wang et al.'s construction step alone) misses
  the IEEE convention completely (0.00 on two papers): section headings there
  are `I. INTRODUCTION` in small capitals and `A. Search strategy` in italics,
  both at body size and weight. Reading capitals and italics, gated on a section
  number, is what recovers them.
- **`size` used to win on two documents; it was three over-reaching rules.**
  On the iHRIS handbook `font` missed 264 headings `size` found, all 14pt bold:
  "Step 1: Create the module" fell to the theorem/proof word list (which names
  `Step`), `<configuration>` to the code-fragment filter, and a repeated
  "Configuration Settings" to de-duplication. Each rule is right for **body-size
  bold** type and wrong for type set clearly larger; restricting them to body
  size, keeping captions excluded at every size, and de-duplicating only a
  heading that repeats on the same or next page took iHRIS from 0.88 to 0.97 and
  `layout` from 0.86 to 0.88. On `arxiv-2601.04544v1` `size` still leads by 0.03
  (0.93 vs 0.90): three bold box titles and list labels that `font` keeps and
  the outline does not list.
- **Levels lag titles by about 0.07.** Most of the loss is in outlines that are
  themselves inconsistent: DPI-H puts `1.1` sections and `Appendix A` at the
  same level, and `9789240093362-eng` lists `1.2` and `1.3` at level 1 beside
  their own chapter.
- **Where `regex` was right, it was right for the same reason** — numbered
  headings (`2609.07340v1`, 0.80) — and it had no way to see anything else.

### Grobid, measured

Title F1 per document, against `layout`:

| document | outline entries | Grobid heads | P | R | Grobid F1 | `layout` F1 |
|---|---|---|---|---|---|---|
| `2403.07553v1.pdf` | 16 | 19 | 0.84 | 1.00 | 0.91 | 0.94 |
| `2506.20759v1.pdf` | 17 | 20 | 0.65 | 0.76 | 0.70 | 0.71 |
| `2609.07340v1.pdf` | 17 | 24 | 0.62 | 0.88 | 0.73 | 0.97 |
| `arxiv-2601.04544v1.pdf` | 19 | 37 | 0.46 | 0.89 | 0.61 | 0.90 |
| `arxiv-2404.04834v4.pdf` | 23 | 37 | 0.49 | 0.78 | 0.60 | 0.77 |
| `2603.10808v1.pdf` | 27 | 53 | 0.49 | 0.96 | 0.65 | 0.95 |
| `2505.07664v1.pdf` | 29 | 43 | 0.42 | 0.62 | 0.50 | 0.92 |
| `arxiv-2507.23348v1.pdf` | 33 | 47 | 0.49 | 0.70 | 0.57 | 0.79 |
| `arxiv-2402.02172v5.pdf` | 39 | 57 | 0.58 | 0.85 | **0.69** | 0.67 |
| `9789240093362-eng.pdf` | 54 | 250 | 0.08 | 0.37 | 0.13 | 0.81 |
| `who-dpi-h-reference-architecture-draft-v1.pdf` | 138 | 518 | 0.20 | 0.74 | 0.31 | 1.00 |
| `9789241548960_eng.pdf` | 258 | 285 | 0.72 | 0.79 | 0.75 | 0.98 |
| `ihris_admin_handbook_sep_17_2010.pdf` | 1357 | 719 | 0.73 | 0.39 | 0.51 | 0.97 |

- **Recall is good on papers (0.62–1.00); precision is the problem.** Grobid
  emits more heads than there are sections — on `2403.07553v1`, a whole
  sentence ("Li, et al. [12] proposed an upgraded version …") is tagged as a
  `<head>`. Its fulltext model is trained to find every heading-like segment;
  a TOC wants only the sections.
- **It wins on one document**, `arxiv-2402.02172v5` (0.69 vs 0.67) — the paper
  whose appendix carries its own contents page, where `font` is weakest.
- **Off its training domain it collapses**: 0.13 and 0.31 on the two WHO
  publications with printed contents pages, which `layout` solves at 0.81 and
  1.00 by reading the contents page Grobid ignores.
- **Levels are flat** unless numbered: Grobid gives no depth to an unnumbered
  head, so level F1 (0.51) trails title F1 by more than `layout`'s does.

Verdict for this repository: Grobid is not a better fallback than `layout`,
on papers or on WHO publications. It remains the right tool for what it was
built for — references, header metadata, citation parsing — which this
benchmark does not measure. Its deep-learning (DeLFT) models were not tried;
they need a GPU-scale Python stack and might narrow the precision gap.

### Nougat, measured

Run 2026-10-12: `nougat-ocr` 0.1.17, model **`0.1.0-small`**,
**CPU only** (4 cores, no GPU), `--no-skipping`, torch 2.14, transformers
4.38.2, pypdfium2 4.20.0 (5.x removed the `render` API nougat calls). The
weights came from nougat's own GitHub release assets, which its
`checkpoint.py` downloads from; **huggingface.co was never needed**, which
corrects what this page said before. Wall time about 20 s a page: 3.3 h for
the 10 documents below. The three longest (`9789241548960_eng`, 179 pages;
`who-dpi-h-reference-architecture-draft-v1`, 254; the iHRIS handbook, 534)
were **not run**: about 5 more hours on CPU. Scored with
`toc-benchmark.py --methods layout,nougat --nougat-mmd`.

| document | outline entries | Nougat P | R | Nougat F1 | `layout` F1 | wall time |
|---|---|---|---|---|---|---|
| `2403.07553v1.pdf` | 16 | 0.84 | 1.00 | 0.91 | 0.94 | 4.1 min |
| `2506.20759v1.pdf` | 17 | 0.83 | 0.88 | 0.86 | 1.00 | 6.3 min |
| `2609.07340v1.pdf` | 17 | 0.94 | 1.00 | 0.97 | 0.97 | 14.5 min |
| `arxiv-2601.04544v1.pdf` | 19 | 0.63 | 1.00 | 0.78 | 0.90 | 17.3 min |
| `arxiv-2404.04834v4.pdf` | 23 | 0.61 | 0.83 | 0.70 | 0.77 | 27.1 min |
| `2603.10808v1.pdf` | 27 | 0.96 | 0.89 | 0.92 | 0.95 | 7.9 min |
| `2505.07664v1.pdf` | 29 | 0.70 | 0.79 | 0.74 | 0.92 | 19.1 min |
| `arxiv-2507.23348v1.pdf` | 33 | 0.94 | 0.88 | **0.91** | 0.79 | 19.8 min |
| `arxiv-2402.02172v5.pdf` | 39 | 0.81 | 0.90 | **0.85** | 0.67 | 17.3 min |
| `9789240093362-eng.pdf` | 54 | 0.33 | 0.63 | 0.43 | 0.81 | 67.4 min |
| **macro, these 10** | | **0.76** | **0.88** | **0.81** | **0.87** | |

Capped F1 0.84 against `layout`'s 0.90; level F1 0.79 against 0.83; TEDS 0.66
against 0.75. **Link F1 and full F1 are not measurable** (scored 0.00): Nougat
writes one Markdown stream with no page boundaries, so no heading carries a
page. Wall times overlap with other work on the same 4 cores and are upper
bounds.

- **Nougat beats `layout` on the two papers `layout` finds hardest**
  (`2507.23348v1` 0.91 vs 0.79, `2402.02172v5` 0.85 vs 0.67). Both are where
  `layout` over-predicts (51 and 77 headings for 33 and 39 entries), and an
  image model that never sees font metrics does not share that failure. That
  makes it a useful **voter**, not a replacement.
- **It fails on the long WHO guideline** (0.43): 104 headings for 54 entries,
  with repeated headings, which is the hallucinate-and-repeat behaviour the
  literature reports for long documents. `contents` (0.81) reads that
  document's printed contents page and needs no model.
- So the assessment below stands, now measured: on born-digital PDFs it trails
  `layout` by 0.06 and costs ~20 s a page on CPU; it is the candidate for
  **scanned** PDFs with no text layer, which this corpus does not contain.

### The consensus TOC — cross-checking the methods

The methods are not independent guesses at one list; they are different
**evidence** for each entry, and the strongest rule is: *a contents entry should be findable later as a heading.*
`consensus_headings` turns that and its converse into confidence:

| evidence | where it comes from |
|---|---|
| `contents` | listed on a printed contents page |
| `body` | the title is a body line on or within a page of where the contents says |
| `style` | a heading style marks it (`font_headings`) |
| `number` | a section number is set with it |
| `numbered-style` / `stock-name` | its style is one numbered headings use / it is "References", "Appendix A" … |
| `grobid` (optional) | another extractor agrees |

Every inferred entry in `structure.json` now carries `confidence` and
`evidence`, so a consumer can trust the near-certain entries and look at the
flagged ones. Per document, title F1:

| document | outline entries | `layout` | `consensus` | + Grobid | TEDS `layout` | TEDS `consensus` |
|---|---|---|---|---|---|---|
| `2403.07553v1.pdf` | 16 | 0.94 | 0.94 | 0.94 | 0.89 | 0.89 |
| `2609.07340v1.pdf` | 17 | 0.97 | 0.97 | 0.97 | 0.94 | 0.94 |
| `2506.20759v1.pdf` | 17 | 0.71 | 0.71 | 0.71 | 0.71 | 0.71 |
| `arxiv-2601.04544v1.pdf` | 19 | 0.90 | **0.97** | 0.93 | 0.83 | **0.95** |
| `arxiv-2404.04834v4.pdf` | 23 | 0.77 | **0.83** | 0.81 | 0.56 | **0.70** |
| `2603.10808v1.pdf` | 27 | 0.95 | 0.95 | 0.95 | 0.90 | 0.90 |
| `2505.07664v1.pdf` | 29 | 0.92 | 0.93 | 0.93 | 0.84 | 0.87 |
| `arxiv-2507.23348v1.pdf` | 33 | 0.79 | **0.99** | 0.90 | 0.65 | **0.97** |
| `arxiv-2402.02172v5.pdf` | 39 | 0.67 | 0.68 | 0.68 | 0.51 | 0.51 |
| `9789240093362-eng.pdf` | 54 | 0.81 | 0.81 | 0.81 | 0.36 | 0.36 |
| `who-dpi-h-reference-architecture-draft-v1.pdf` | 138 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| `9789241548960_eng.pdf` | 258 | 0.98 | 0.98 | 0.98 | 0.98 | 0.98 |
| `ihris_admin_handbook_sep_17_2010.pdf` | 1357 | 0.97 | 0.97 | 0.97 | n/a | n/a |

No document is worse; the gains are the papers whose bold box titles and
run-in labels `font` kept and the numbering now rejects. Three choices were
measured rather than assumed, and each reversed a first attempt:

- **The body check sets confidence; it does not filter.** Dropping the 4
  entries of `9789240093362-eng` that the body never confirmed removed real
  sections whose body wording differs from the contents line (0.81 → 0.76).
  They are kept at confidence 0.5–0.55.
- **Nothing is added beneath a contents page.** Adding the 35 style-found
  subsections whose numbers extend a contents entry cost
  `9789241548960_eng` 0.06: a printed contents is a deliberate choice of depth.
- **"Numbers its sections" means most headings are numbered.** With a
  threshold of three, the iHRIS manual's few numbered steps made every other
  heading "unconfirmed" and 96% of it was dropped.

**Grobid as a voter lowers the score** (0.89): agreeing with Grobid confirms
some of the extra heads it emits. It stays available (`others=`) but off.

## The list of figures, and a contents page against its body

### Figures and tables

`_pdf_figures.figure_list` writes `figures` into `structure.json`. A caption is
a line that **opens** with a label, a number and punctuation — "Figure 3:",
"Fig 5.", "Table 2 —", or a label alone ("Table 4.1.") with its title beside
or below it. "Fig. 5 outlines the phases" opens a line the same way without
the punctuation: that is a **reference**, and it counts as evidence for
Figure 5. Each caption is then scored by evidence independent of how it was
found:

| evidence | meaning |
|---|---|
| `referenced` | the body cites it elsewhere — the figure form of "a TOC entry should be findable later" |
| `in-sequence` | every smaller number of its run is present (1, 2, 3 … or 2.1, 2.2 … within a chapter) |
| `graphic` | figures only: the page carries an image or vector drawing |
| `listed` | a printed "List of figures / tables" names it |

None of the 31 PDFs has a printed list of figures, so there is no answer key
and no F1 here; the evidence is the measure. Over the 20 PDFs with captions,
219 captions were found and every one kept; the three that failed every check
— DPI-H Tables 2.2, 2.4 and 3.5 — are real captions in a draft whose own
numbering skips 2.1, 2.3 and 3.4. **A check that fails on a real caption is
reporting the document, not the extraction**, so a well-formed caption keeps
confidence 0.5 and the gap goes to `diagnostics.figure_sequence_gaps`
(`["figure 2.1", "table 2.1", "table 2.3", "table 3.4"]` for that draft,
each confirmed absent from its text).

### Contents page against body — drafts drift

A printed contents page is set once and the body keeps changing, so in a
draft the two disagree. `_pdf_headings.contents_alignment` writes
`diagnostics.toc_alignment` whenever a document has a contents page — with or
without an embedded outline, because the printed page is what a reader sees:

| list | meaning |
|---|---|
| `listed_not_found` | a contents entry no body line carries — renamed, moved or deleted since |
| `found_not_listed` | a numbered body heading, no deeper than the contents goes, that the contents omits — added since |
| `page_mismatch` | found, but more than a page from where the contents says |

Measured on the five WHO documents with contents pages (counts: listed-not-
found / found-not-listed / page-mismatch): DPI-H draft 1/1/0,
9789240093362 0/1/1, 9789241548960 0/1/0, 9789240101197 5/0/4,
9789240116191 2/2/0. The first pass flagged far more — 95 for the DPI-H draft
alone — and four rules brought it down, each a convention rather than a
document: a title that **wraps** on a chapter divider matches by prefix; a
**lettered** line is a list item; a number followed by a **lower-case** word is
a sentence ("3.1 describes the modelling approach"); and a number that
**recurs** three or more times is a local enumeration ("1 What it is" under
every appendix component). It reports and never corrects: which side is right
is the author's call.

## Page labels — the number a reader sees

Every page reference above is a **physical** index. A reader, a citation and
a contents page use the **printed** label — "iv", "23", "p. 177" — and the two
differ whenever there is a cover, roman front matter, an unnumbered plate, or
an article that starts mid-volume. `_pdf_page_labels.page_labels` writes a
`pages` array (`physical`, `label`, `source`, `confidence`, `evidence`), adds
`page_label` beside every TOC entry and figure and `label_start` /
`label_end` to every section, and reports disagreements in
`diagnostics.page_label_conflicts`. Four sources:

| source | how |
|---|---|
| `printed` | the number in the page's header or footer, fitted into runs of constant offset (physical − printed), so roman and arabic runs each hold; a number fits only a run of ≥3 pages, so a stray "2024" never becomes a page (Wu et al. 2013's "legal page number") |
| `pdf-labels` | the PDF's own /PageLabels (19 of 77 corpus PDFs), decoded — one producer writes `<FEFF0065>213` for "e213" |
| `interpolated` | an unnumbered page inside a run (chapter opener, full-page figure) takes the run's value |
| `contents` | a contents entry confirmed in the body pairs a printed label with a physical page |

**Measured** (`cat-harness-tools/scripts/page-label-benchmark.py`): hide each PDF's
/PageLabels and predict from the content alone. Over the 15 PDFs whose labels
are informative: **arabic-labelled pages 0.98 correct**, all labelled pages
0.88 (the remainder is mostly cover labels such as "A", "B", "Cover Page",
which are not printed on the page), coverage 0.88. Three PDFs are set aside
because their /PageLabels merely repeat the physical index — a producer's
default; one of them prints "3" on its physical page 4.

**When the sources disagree, the printed number wins** and the conflict is
reported. `9789241548960_eng` prints "iii", "iv" … on its front matter while
its /PageLabels say "3", "4" — nine pages running; a reader cites the print.
The first run found the search band too narrow: LaTeX folios sit 9.1% from
the page edge, outside a 9% margin (2508.21620v2 0.00 → 0.97; 2607.20636v1
0.53 → 0.99).

## The PDF-library question

PyMuPDF is AGPL-3.0; pdfminer.six is MIT. `_pdf_headings.py` reads font
metrics from either. Run with `--layout-backend pdfminer`:

| backend | method | title P | title R | title F1 | link F1 | level F1 | full F1 | TEDS |
|---|---|---|---|---|---|---|---|---|
| PyMuPDF (AGPL) | `layout` | 0.82 | 0.92 | 0.86 | 0.85 | 0.79 | 0.78 | 0.74 |
| pdfminer.six (MIT) | `layout` | 0.88 | 0.85 | 0.84 | 0.83 | 0.77 | 0.77 | 0.75 |
| PyMuPDF (AGPL) | `font` | 0.69 | 0.90 | 0.76 | 0.75 | 0.73 | 0.73 | 0.62 |
| pdfminer.six (MIT) | `font` | 0.76 | 0.86 | 0.76 | 0.74 | 0.72 | 0.72 | 0.65 |

Within 0.02 on every headline number, so the gain does not depend on taking
the AGPL dependency. (Measured before the body-size-only rule fix that took
PyMuPDF `layout` from 0.86 to 0.88; not re-run since.) pdfminer.six is markedly slower (the 13 documents take
about 1 minute with PyMuPDF; the pdfminer.six run was not timed but took many
times longer). `pdf-structure.py` uses
PyMuPDF when it is installed and pdfminer.six otherwise.

## Methods assessed but not run

Grobid was first in this list; it is now measured above, built from source with
the Maven Central mirror in `cat-harness-tools/scripts/gradle-maven-mirror.init.gradle`
(skill `blocked-build-dependencies`).

| tool | what it is | why not run here | assessment |
|---|---|---|---|
| **LayoutLMv3** | multimodal transformer for document layout; needs fine-tuning for heading detection | no labelled data, and a GPU-scale dependency | not justified while a rule-based method reaches 0.86 |
| **Donut / GPT** (Feyisa et al. 2024) | contents-page parsing with an OCR-free image model or a prompted LLM | paper reports ~85–89 % field accuracy on 20 test documents in one domain, and its own figures disagree with its text | the rule-based `contents` method already reaches 0.81–1.00 on this corpus's contents pages, and runs offline |
| **Bentabet et al. 2019 / Wang et al. 2023 models** | char-CNN + BiLSTM-CRF; RoBERTa + GNN over a block tree | need training data and a GPU | their **rule-based parts** are implemented: Bentabet's tree repair (`tree_levels`), and Wang's size-ordered construction (the `size` baseline) |

### Grobid and Nougat side by side, for a TOC

| dimension | Grobid | Nougat |
|---|---|---|
| input | the digital PDF: text, font metrics and boxes, read through `pdfalto` | raster page images: a scan, or a rendered PDF page |
| heading hierarchy | TEI-XML `<head n="1.1">` with token-level coordinates | Markdown `#`, `##`, `###` in the text stream; a Markdown parser (mistletoe, mistune) gives the tree |
| linking a heading to a page | direct: physical page index and coordinates | indirect: output is per page, so page boundaries must be tracked |
| cost | fast on CPU; poor on degraded scans without OCR first | heavy GPU inference; robust to scanning defects and maths |

The split matches this corpus. Grobid works from the same text layer
`_pdf_headings.py` reads, so on born-digital PDFs it competes with `font`, and
its training is on scientific articles. Nougat is the only candidate for the
case nothing here handles: a scanned PDF with no text layer.

Sources: Grobid — <https://github.com/grobidOrg/grobid>, documentation
<https://grobid.readthedocs.io>, the batch client
<https://github.com/grobidOrg/grobid-client-python>; P. Lopez, *GROBID:
Combining Automatic Bibliographic Data Recognition and Term Extraction for
Scholarship Publications*, ECDL 2009. Nougat — arXiv:2308.13418,
<https://github.com/facebookresearch/nougat>, weights `0.1.0-small` and
`0.1.0-base` as that repository's release assets (also `facebook/nougat-*` on
Hugging Face).

Nougat is measured above ([Nougat, measured](#nougat-measured)); its weights
come from nougat's GitHub release assets, not Hugging Face. Any other tool can
run elsewhere and write its output as `(level, title, page)` rows, which
`toc-benchmark.py`'s `score()` accepts unchanged.

## Held-out test — 20 PDFs the rules never saw

Every number above is a **development** score: the rules were written while
looking at those 13 documents. On 2026-10-06 a `state:mount` put 22 further
PDFs with outlines under `fsh-guts/uploads/` — arXiv papers, W3C and OMG
specifications, a slide deck, a JSTOR download — none of which had been looked
at. They were scored with the method frozen (no rule changed in response):

| method | title F1, development (13) | title F1, **held-out (20)** | TEDS, held-out |
|---|---|---|---|
| `regex` (previous fallback) | 0.30 | 0.26 | 0.17 |
| `size` | 0.44 | 0.55 | 0.36 |
| `font` | 0.79 | 0.80 | 0.65 |
| `layout` | 0.90 | 0.82 | 0.70 |
| **`consensus`** | **0.92** | **0.83** | **0.72** |

**The development set overstated the method by about 0.09**, as expected; on
documents it has never seen it still scores three times the fallback it
replaces. Two outlines were not answer keys and the benchmark now says so,
by rules about the outline rather than about the method: a JSTOR download
whose "outline" is page bookmarks plus the whole journal issue's contents (13
articles not in the file) is set aside, and a slide deck's "Slide N:" prefix
is dropped before titles are compared. The one unexplained low score is the
W3C PROV-O specification (0.23), left as found.

| document | outline entries | `regex` | `layout` | `consensus` |
|---|---|---|---|---|
| `2504.21474v1.pdf` | 10 | 0.14 | 0.71 | 0.71 |
| `neubauer-2025-ai-assisted-schema-creation.pdf` | 12 | 0.74 | 0.92 | 0.92 |
| `2607.25032v1.pdf` | 12 | 0.00 | 0.92 | 0.92 |
| `2504.07199v3.pdf` | 18 | 0.32 | 0.76 | 0.76 |
| `2605.03537v1.pdf` | 18 | 0.00 | 0.90 | 0.90 |
| `2508.21620v2.pdf` | 20 | 0.74 | 0.88 | 0.70 |
| `2608.08453v1.pdf` | 21 | 0.25 | 0.86 | 1.00 |
| `qi-hessen-vanderheijden-2023-ca-vs-lsa.pdf` | 23 | 0.79 | 0.93 | 0.93 |
| `feng-2023-designing-with-language.pdf` | 23 | 0.30 | 0.94 | 0.94 |
| `dong-2025-doc-researcher.pdf` | 24 | 0.29 | 0.85 | 0.92 |
| `2504.19675v2.pdf` | 25 | 0.00 | 0.91 | 0.91 |
| `arxiv-2202.02427v1.pdf` | 27 | 0.00 | 0.88 | 0.98 |
| `2606.04382v1.pdf` | 29 | 0.00 | 0.93 | 0.93 |
| `strauch-carbno-2025-spdx-3-1-supply-chain.pdf` | 43 | 0.00 | 0.40 | 0.40 |
| `w3c-2018-odrl-model-2-2.pdf` | 66 | 0.76 | 0.87 | 0.87 |
| `2602.12670v4.pdf` | 81 | 0.08 | 0.91 | 0.91 |
| `w3c-2013-prov-o.pdf` | 111 | 0.22 | 0.23 | 0.23 |
| `2607.20636v1.pdf` | 149 | 0.02 | 1.00 | 1.00 |
| `w3c-2020-json-ld-1-1.pdf` | 193 | 0.63 | 0.69 | 0.74 |
| `omg-2024-spdx-3-0.pdf` | 434 | 0.00 | 0.98 | 0.98 |

## What this could not establish

- **The held-out set is small** — 20 PDFs, and they are mounted from a state
  branch rather than tracked, so its scores are reported but not part of
  the default benchmark run. The development set overstated the method by
  about 0.09. Each rule is written to the general convention it handles (IEEE
  small capitals, a cover page, a printed contents page), never to a document,
  and the 18 PDFs with no outline were read by eye after each change. The honest
  test is the `qou` library (715 `structure.json`, many with outlines), which
  lives in another repository.
- **An outline is not ground truth.** Some omit levels, some are
  inconsistent, and one lists sections out of order. The benchmark sorts by page
  and allows a level shift, but a method that is *more* right than the outline
  is still scored down.
- **Scanned PDFs are not covered.** OCR'd text has no font metrics, so it still
  falls to `regex`. `WHO_PUB_TPS_93.1.pdf` is the corpus example.
- **Thirteen documents in two genres** — arXiv papers and WHO publications —
  plus one software manual. Books, theses and slide decks are untested.

## References

- Z. Wu, P. Mitra, C. L. Giles. *Table of Contents Recognition and Extraction
  for Heterogeneous Book Documents.* ICDAR 2013, 1205–1209.
  `uploads/ICDAR2013-ToC.pdf`.
- N.-I. Bentabet, R. Juge, S. Ferradans. *Table-Of-Contents generation on
  contemporary documents.* arXiv:1911.08836, 2019. `uploads/1911.08836v1.pdf`.
- X. Wang, L. Gui, Y. He. *A Scalable Framework for Table of Contents Extraction
  from Complex ESG Annual Reports.* arXiv:2310.18073, 2023.
  `uploads/2310.18073v1.pdf`.
- D. W. Feyisa et al. *The Future of Document Indexing: GPT and Donut
  Revolutionize Table of Content Processing.* arXiv:2403.07553, 2024.
  `uploads/2403.07553v1.pdf`.
- L. Blecher, G. Cucurull, T. Scialom, R. Stojnic. *Nougat: Neural Optical
  Understanding for Academic Documents.* arXiv:2308.13418, 2023.

---
name: document-intake
description: >
  Process uploaded documents (PDFs, scans, LaTeX, structured/normative
  guidelines, etc.) from uploads/ into structured content objects. Handles OCR
  extraction, environment detection, structural analysis, and content-object
  generation. Supports multi-stage pipelines: raw upload → extracted text →
  structured blocks → .ts/.md content objects.
allowed-tools: Read Write Edit Bash Grep Glob Agent WebFetch
---

# Document Intake

> **Bib human-review integration.** Track per-upload ingestion
> status beside the upload's records in `uploads/<document-id>/` (identified passage, formalised?, matched?) and
> link each upload to the `references.ts` entry it sources. An upload that
> supplies a cited source moves that ref to `source-in-repo` (agent-identified
> passage; no human photo) and then through the
> [`bib-human-review`](../cataloguing/bib-human-review.md) ladder to `validated`. Existing
> `uploads/` follow the same agent-sourced path.

## Overview

This skill manages the `uploads/` directory as an intake pipeline for
converting raw documents into structured content objects. It handles:

1. **Scanned PDFs / images** — OCR extraction → text → blocks
2. **LaTeX source** — environment extraction → blocks
3. **Structured / normative guidelines** — normative structure → blocks
4. **arXiv papers** — fetched source → blocks (delegates to paper-importer)
5. **Arbitrary documents** — best-effort structural analysis

The key distinction from `paper-importer`: this skill owns the full
lifecycle of `uploads/`, including tracking processing state, partial
extractions, and multi-pass refinement. Paper-importer focuses on the
final content-object generation step.

## When to Use This Skill

- User says "upload", "scan", "process document", "intake"
- User drops a file into `uploads/`
- User mentions a guideline, standard, or normative document
- User wants to convert a raw document into content objects
- Files appear in `uploads/` that haven't been processed yet

## uploads/ Directory Convention

```
uploads/
  <document-id>/
    intake.json                  ← what arrived and where from (folio-intake/v1)
    <document-id>.dc.json        ← what it is: title, type, subject (folio-dublin-core/v1)
    original.pdf                 ← raw upload (PDF, scan, etc.)
    original.tex                 ← or LaTeX source
    extracted-text.md            ← OCR or parser output (intermediate)
    extracted-blocks.json        ← structured extraction (intermediate)
    mapping.json                 ← label/section mapping decisions
    README.md                    ← human notes about the document
```

### The two records an upload writes

The description is a Dublin Core record; the intake records the capture and
points at it. Both are validated by the registry (`check:kind-validators`).

`intake.json` — `folio-intake/v1`, cat-harness-tools `schemas/library/intake.ts`:

```json
{
  "$schema": "folio-intake/v1",
  "doc_id": "example-doc-2016",
  "record": "example-doc-2016.dc.json",
  "source": {
    "upstream": "https://...",
    "capturedAt": "2026-03-25T10:00:00Z",
    "capturedBy": "folio-assistant document adapter: the upload form"
  },
  "files": [
    { "path": "original.pdf", "bytes": 123456, "sha256": "…", "type": "upload", "role": "original-bitstream" }
  ]
}
```

An intake names what it is a capture OF: a catalogue `item` (a
`folio-catalogue-node/v1` id), a Dublin Core `record`, or — only when
neither exists — its own `title`. `source` is `ProvenanceSchema` (`upstream`
for a URL, absent for a direct upload) plus the capture moment.

`<document-id>.dc.json` — `folio-dublin-core/v1`:

| upload field | Dublin Core |
|---|---|
| title | `dc.title` |
| type (`guideline`, `paper`, `report`, `standard`) | `dc.type` |
| domain | `dc.subject` |
| normative level | `dc.type` qualified `normativeLevel` |
| detected format (`pdf`, `latex`, `scan`, `docx`) | `dc.format` |

## Pipeline Stages

### Stage 1: Upload (→ `uploaded`)

Place raw files in `uploads/<document-id>/`. Create `intake.json`
with source metadata. Files are committed to git for reproducibility.

**Record the licence in `intake.json` when you know it.** The ingestion
pipeline's licence step runs before any extraction, because `library/` is
committed content and refusing a source after deriving from it is a deletion
nobody may take unasked. That step sees only the upload: the `licence` record
in `intake.json` (the same `stated` / `unknown` record a library manifest
carries in `meta.licence`, cat-harness-tools `schemas/library/source-licence.ts`)
and whether a `LICENSE` file sits beside it.
`bun run cat ingest` prints its verdict before the first arm runs, and after the
arms it writes a recorded licence into the staged entry's `licence.json` — the
authored sidecar `gen-library-jsonld` carries into `meta.licence` (the manifest
itself is generated, so a licence written there would not survive a
regeneration). It never overwrites a `licence.json` already there; a mismatch
is printed as a conflict.

| verdict | when | what to do |
|---|---|---|
| `stated` | `licence: { status: "stated", id, basis }` | nothing — `basis` says where it is stated |
| `unknown` | `licence: { status: "unknown", searched: [...] }` | nothing now; the places tried are the record |
| `undetermined` | no licence recorded (a `LICENSE` sibling is named, not read) | ingestion proceeds, and says so — undetermined is never reported as cleared |

It never reads a licence out of extracted text; that is a later check's job.

Supported formats:
- **PDF** — academic papers, scanned guidelines, reports
- **LaTeX** — `.tex` source bundles
- **HTML** — web-published guidelines, standards
- **DOCX** — Word documents
- **Images** — scanned pages (PNG, JPG, TIFF)

**For academic papers, prefer the MCP fetch path:**
when the session network allows the upstream host, use
`paper-search-mcp` (arxiv / PubMed / bioRxiv / medRxiv) or
`openalex-paper-search` (alex-mcp; OpenAlex catalog) rather than
`curl`/`WebFetch`. The MCP tools return canonical metadata and the
PDF in one call, eliminating the OCR-then-extract-then-name dance.
See `paper-importer.md §Phase 1` (in the science layer)
for the per-tool routing table. Sandboxed Claude-Code-on-the-web
sessions (github-only allowlist) cannot reach those hosts; in
those sessions, queue the fetch onto a normal-network machine
per [`bib-qa/qa-tags.md` §Batch intake pipeline](../cataloguing/bib-qa/qa-tags.md#batch-intake-pipeline).

### Stage 2: Extraction (→ `extracted`)

Convert raw format to `extracted-text.md`:

**For PDFs, always start with
[`cat-harness-tools/scripts/pdf-extract.py`](../../../../cat-harness-tools/scripts/pdf-extract.py)** — do not reach for a
Python PDF library directly. It walks a fallback ladder (`pdftotext` → `pypdf` →
`pdfminer.six` → a zero-dependency content-stream extractor → OCR) and, when it
cannot read a file, **tells you which rung failed and why** instead of returning
an empty string:

```bash
python3 cat-harness-tools/scripts/pdf-extract.py FILE.pdf -o extracted-text.md
python3 cat-harness-tools/scripts/pdf-extract.py FILE.pdf --diagnose   # structure only
```

Exit `0` = text; **exit `2` = no text layer (a scan)**; exit `3` = a parser
problem on a file that does have text.

Two failure modes it prevents:

* **A silent empty extraction reads exactly like a scan, a broken library, and
  a malformed PDF.** The script separates them by inspecting the PDF structure
  (`CCITTFaxDecode` / `JBIG2Decode` / `DCTDecode` counts against `/Font`), so
  "swap libraries" vs "you need OCR" is decided by evidence rather than guessed.
* **A broken native extension kills the whole pipeline.** `pypdf` and
  `pdfminer.six` both fail via pyo3 `PanicException` when `cryptography`'s Rust
  bindings are broken — and that is a `BaseException`, so an ordinary
  `except Exception` does **not** catch it. Every rung is guarded accordingly,
  and the zero-dependency rung exists for this case.

| Format | Extraction method |
|--------|-------------------|
| PDF (text) | `cat-harness-tools/scripts/pdf-extract.py` (ladder; `pdftotext` when available) |
| PDF (scan) | `cat-harness-tools/scripts/pdf-extract.py` → exit 2, then `cat-harness-tools/scripts/pdf-ocr.py` (Tesseract) or Claude vision |
| LaTeX | Direct parse (strip preamble) |
| HTML | Readability + turndown |
| DOCX | Pandoc → markdown |
| Images | Claude vision API |
| PDF (tables/figures) | `cat-harness-tools/scripts/pdf-tables.py` → `tables.json` (see Stage 3) |
| PDF (sections) | `cat-harness-tools/scripts/pdf-structure.py` → `structure.json` + `sections/*.md` (see Stage 3) |

For scanned documents the script's OCR rung fires automatically **if**
`tesseract` and `pdftoppm` are installed (`apt-get install -y tesseract-ocr
poppler-utils`); it names whichever is missing. Where OCR is unavailable, or
where layout carries meaning (headings, lists, tables, boxes), fall back to
Claude's vision capability, which reads structure that OCR flattens.

**Output**: `extracted-text.md` — raw markdown with preserved structure.

### Stage 3: Structural Analysis (→ `structured`)

Analyze extracted text for formal environments and document structure.

#### The three producers this stage actually runs

These scripts build the corpus's `structure.json`, `sections/` and `ocr/`
trees. Stage 2's `pdf-extract.py` writes loose text, not the greppable
`sections/` tree the corpus-grep checklist reads.

| script | writes | notes |
|---|---|---|
| [`cat-harness-tools/scripts/pdf-structure.py`](../../../../cat-harness-tools/scripts/pdf-structure.py) | `library/<doc-id>/structure.json` + `sections/NN-slug.md` | metadata (a page-1 title GUESS, authors, arXiv/DOI from the page-1 stamp, and the PDF Info dictionary as `docinfo`), TOC from the PDF outline, or else inferred from the layout (see the note below), per-section text split. The page-1 guess is **never** the entry's title: [`l1-document-ingestion`](l1-document-ingestion.md) §"A manifest's title" gives the order (catalogue record → `referenced.json` → PDF `/Title` → slug) |
| [`cat-harness-tools/scripts/pdf-ocr.py`](../../../../cat-harness-tools/scripts/pdf-ocr.py) | `library/<doc-id>/ocr/page-NNN.txt` | `pdftoppm -r 300 -png` then `tesseract`; per-page cache; script auto-detected via Tesseract's own OSD |
| [`cat-harness-tools/scripts/extract-candidates.py`](../../../../cat-harness-tools/scripts/extract-candidates.py) | `library/<doc-id>/candidates.json` | pure regex, imports no PDF library; **proposals, never content** — nothing here writes to `content/` and nothing here creates Lean |

```bash
python3 cat-harness-tools/scripts/pdf-ocr.py FILE.pdf --outdir library/<doc-id>/   # only if scanned
python3 cat-harness-tools/scripts/pdf-structure.py FILE.pdf --outdir library --ocr
python3 cat-harness-tools/scripts/extract-candidates.py library/<doc-id>/
```

How they fit together:

* **`pdf-structure.py` READS OCR, it never runs it.** Its `--ocr` flag consults
  the cache `pdf-ocr.py` wrote, gated on `text_is_unusable()` (under 120
  chars/page, or under 55 % letters — mojibake). So on a scanned document the
  order is `pdf-ocr.py` first, `pdf-structure.py --ocr` second. Run them the
  other way round and the sections come out empty.
* **An OCR'd document whose structure was never re-run is invisible to the
  section grep.** Its text is in `ocr/` but `sections/` holds a stub, and its
  `structure.json` does not record `"text_source": "ocr"`. Re-run
  `pdf-structure.py --ocr` on it.
* **The backends are optional and their absence is reported, not guessed.**
  `pdf-structure.py` prefers PyMuPDF (better text on maths, real outlines) and
  falls back to `pypdf`; the Dockerfile ships `pypdf` only, deliberately, so the
  image stays BSD-licensed against PyMuPDF's AGPL. Check with
  `python3 cat-harness-tools/scripts/pdf-ocr.py --check`.
* **With no outline, the TOC is inferred from the LAYOUT, and the artefact
  says how.** `diagnostics.toc_inferred_method` is `contents` (a printed
  contents page, its page labels moved to physical pages by finding the titles
  in the body), `font` (lines set in a heading style: larger, bold, capitals or
  italic, numbered or not) or `regex` (text patterns — the last resort, used
  for OCR'd text, which has no fonts). Weight a `regex` TOC lowest. Each
  inferred entry also carries `confidence` (0..1) and `evidence` — which
  independent checks agreed: listed on the contents page, found in the body
  near the page it names, set in a heading style, numbered. Trust the high
  ones; look at the flagged ones before citing them. An inferred TOC is used
  only when it passes the concentration check, its mean confidence is at
  least 0.6, and no more than a quarter of the sections it would cut are
  empty; otherwise the entry is split one section per page
  (`granularity: "page"`, with the reason in `structure_note`) —
  `l1-document-ingestion` §"The route `pdf-structure.py` takes itself". The
  same artefact carries `figures` — the list of figures and
  tables, each caption with `confidence` and `evidence` (cited in the text,
  in its numbering run, a graphic on its page) — with numbering gaps in
  `diagnostics.figure_sequence_gaps`; and, when the document has a printed
  contents page, `diagnostics.toc_alignment`: entries the body no longer
  carries, numbered sections the contents omits, and page mismatches. On a
  draft, read these as findings about the document. Every page also has a
  printed label: `pages[]` (physical index, the label a reader sees, which
  sources agreed), `page_label` on TOC entries and figures, and
  `label_start`/`label_end` on sections. **Cite the label, not the physical
  index**; `diagnostics.page_label_conflicts` lists pages where the PDF's
  own labels disagree with what is printed. Before changing `cat-harness-tools/scripts/_pdf_headings.py`,
  run `python3 cat-harness-tools/scripts/toc-benchmark.py` before and after: a rule
  that fixes one document and costs two is visible only there. The numbers,
  the methods compared and what could not be run are in
  `cat-harness/docs/research-and-analysis/toc-extraction.md`.

#### For academic papers:
Same as paper-importer Phase 2 — detect theorem/definition/lemma
environments, sections, cross-references.

#### For structured / normative guidelines:

> **This table is for a `paper` folio only.** In a `document` folio
> `definition` is a **math** kind whose `lean` field is *required*, so a
> guideline recommendation mapped onto it will not validate; and
> `proposition` and `conjecture` are math kinds that `content_profile_check`
> rejects. There a normative statement is a **`recommendation` block**, with
> its strength as a code in a declared code list: load `normative-statements`
> from the `folio-document-adapter` package.

Many guideline and standards documents have a recurring normative
structure that maps onto content-block kinds:

| Guideline element | Content block kind | Notes |
|------------------|-------------------|-------|
| **Recommendation** (numbered, boxed) | `definition` | Normative statement |
| **Evidence / rationale summary** | `prose` | Supporting narrative |
| **Remarks** | `remark` | Implementation notes |
| **Good-practice statement** | `proposition` | Consensus-based |
| **Research priority** | `conjecture` | Open questions |
| **Background** | `prose` | Context sections |
| **Evidence-quality table** | `diagram` | Quality assessment |

When a document distinguishes *normative levels* (e.g. L1 = what to do,
L2 = how to do it), map the normative statement to a `definition` block
and the implementation guidance to a `prose` block tagged with the level
(e.g. `["implementation", "L2"]`). The exact level taxonomy is
domain-specific; record it in the upload's Dublin Core record as `dc.type`
qualified `normativeLevel`.

> Domain-specific guideline handling (e.g. a particular standards body's
> recommendation grammar) belongs in a domain adapter bundle, not the
> generic paper adapter. This skill detects the *shape* and hands off the
> domain-specific mapping rules to the relevant adapter: for prose folios,
> `folio-document-adapter`, whose `normative-statements` holds the
> recommendation grammar.

#### Tables and figures — run `cat-harness-tools/scripts/pdf-tables.py`

Text extraction destroys tables. A GRADE evidence table or a boxed
recommendation comes out of Stage 2 as a run of prose, and nothing downstream
can recover that it was a grid.

```bash
python3 cat-harness-tools/scripts/pdf-tables.py FILE.pdf -o uploads/<document-id>/
python3 cat-harness-tools/scripts/pdf-tables.py --check     # which backends are installed
```

Writes `tables.json` (`pdf-tables/v1`) beside `structure.json`, with each
table's cell matrix, column edges, caption, containing `section_id`, and a
**GFM rendering that can be pasted straight into a content block** — the
LaTeX pipeline already converts a GFM table to `\begin{tabular}`.

Tables split across a page break are rejoined when their column geometry
matches; `stitched_from` records what was merged, so check it on any table
whose rows look like two tables.

**Read `status` before you read `tables`.** The three ways to get no tables are
distinguished on purpose, and `tables` is `null` — not `[]` — whenever nothing
actually looked:

| `status` | Exit | Means |
|---|---|---|
| `ok` | 0 | a backend looked; `tables: []` means the document has none |
| `n/a-no-backend` | 5 | `pip install pdfplumber` (or `camelot-py`) |
| `n/a-no-text-layer` | 2 | a scan — its tables are pixels; see Stage 2's OCR route |

Needs `pdfplumber` or `camelot-py`, both pure PyPI installs with no model
weights. **Docling is the better parser and is not this**: its weights come
from HuggingFace, which is 403-blocked in sandboxed sessions, so it is a
workstation/CI stage whose artefacts get committed — the
`docling` capability probe reports it absent here rather than letting a session
believe it ran.

**Output**: `extracted-blocks.json` — array of detected blocks with
provisional kinds, titles, and content; `tables.json` for the layout-bearing
parts that do not survive as text.

#### Figures and captioned tables: describe, keep, transcribe

Owner, 2026-11-11: "actually extract the figures", "and any tables too",
"need summaries in all 6 UN", and "make sure all kg extractions happen as part
of skills and processes". This is the method the image and table tasks of
`processes/library/ingest-derive-content.bpmn` point at. It applies
to every PDF entry, including one catalogued by reference whose PDF is not held.

**1. Judge and describe every extracted image.** `pdf-images.py`
and `pdf-vector-figures.py` give each image a geometry role only; geometry
cannot tell a chart from a logo or a 2-pixel fragment of a cover. An agent
opens every image (and every `vfig-` render) and records, in the library's
`image-verdicts.json`:

- `role`: `figure` (carries content), `logo`, or `decorative` (ornament,
  background, blank, or a fragment too small to mean anything);
- `saw`: the reason for the role;
- `draft`: the English description, from the image and its caption only. No
  number that cannot be read, no interpretation beyond the image;
- `translations`: the same in `ar`, `zh`, `es`, `fr`, `ru`, so every figure has
  all six UN languages (cat-harness-tools#1841). Each becomes its own `draft`
  narrative; only a person confirms one (`bun run cat narratives`);
- `shows` on a `vfig-` that renders a declared figure or table.

Put the inspector in `attribution.<doc-id>`. Images with identical bytes reuse
one verdict. Apply with `apply-image-verdicts.ts`.

**2. Keep the figures, small.** Only images judged `figure` are
kept, as WebP at quality 80 with the long side at most 1600 px (card Q-FIG-1 =
A): about a seventh of the PNG bytes. Logos (the WHO emblem ruling of
2026-09-21 still holds), decorative fragments and page scans are not kept. The
sidecar's `file` names the `.webp`. An image `pdf-images.py` cannot decode is
re-rendered from its placed rectangle on the page, never silently dropped.
Check the size before committing and flag it on the merge card.

**3. Transcribe each captioned table.** `pdf-tables.py`
finds grids by geometry and, on WHO layouts, reports many false tables. For
every table the structure declares (`structure.json` `figures`, kind `table`),
an agent reads the rendered page (and the next, for a continued table), checks
cell text against the text layer, and writes it as CSVW (card Q-FIG-2 = A):

- `library/<entry>/tables/<label>.csv`, header row first;
- `library/<entry>/tables.csvw.json`, `folio-tabular-csvw/v1`, one table per
  CSV: `fac:group` for a two-row header, `fac:merged` for spanning cells (A1,
  in CSV rows), plus `fac:label`, `fac:caption`, `fac:pages`, `fac:lang` (the
  cells keep the document's language), `fac:notes` (footnotes), and
  `fac:narrative`: a description of the table in all six UN languages, as
  `draft`.

A caption that points at something that is not a table (a box of prose, a
list) is recorded as not a table, with the reason.

### Stage 4: Mapping (→ `mapped`)

Interactive step — present extracted blocks to user for review:

1. Show block count by kind
2. Let user rename, reclassify, skip, or merge blocks
3. Let user define chapter/section structure
4. Let user set the target paper ID
5. Generate `mapping.json` with confirmed decisions

### Stage 5: Content Generation (→ `generated`)

Generate content objects under `content/<paper-id>/`:

1. **`.ts` manifests** via `content/schema/builders.ts`
2. **`.md` content** in project markdown conventions
3. **Chapter `.ts` manifests** with section structure
4. **Paper `.ts` manifest** (new or updated)

Tag all generated blocks with:
```typescript
tags: ["imported", "source:<document-id>"]
```

Add `meta.source` referencing the upload:
```typescript
meta: {
  source: "uploads/<document-id>",
  originalSection: "3.2",
  importedAt: "2026-03-25T..."
}
```

Then **publish the extracted statements**: every statement taken from the
source is published in the artifact's own pages and in the shared extraction
viewer, each linked to its library entry and section, and CI fails when those
pages are stale. This is a standard step for every content type:
[`publish-extracted-statements`](publish-extracted-statements.md).

## Structured-Document Processing

### Detecting normative structure

Normative guidelines often follow predictable patterns:

```
RECOMMENDATION N:
<recommendation text in bold/box>

Remarks:
- Implementation note 1
- Implementation note 2

Summary of evidence:
<narrative text>

Evidence-quality table:
<quality assessment>
```

### Label conventions for guidelines

| Element | Label pattern | Example |
|---------|--------------|---------|
| Recommendation | `def:<doc>-rec-<N>` | `def:example-rec-1` |
| Evidence summary | `prose:<doc>-evidence-<N>` | — |
| Remark | `rem:<doc>-remark-<N>` | `rem:example-remark-1` |
| Good practice | `prop:<doc>-gps-<N>` | `prop:example-gps-1` |
| Research priority | `conj:<doc>-research-<N>` | `conj:example-research-1` |

### Cross-referencing recommendations

Recommendations often reference each other and external evidence.
Map these to `uses[]` in content objects:

```typescript
export default definition({
  label: "def:example-rec-3",
  title: "Recommendation 3: ...",
  uses: ["def:example-rec-1"],  // references Rec 1
  tags: ["imported", "source:example-doc-2016", "L1", "normative"],
  meta: {
    source: "uploads/example-doc-2016",
    strength: "strong",
    quality: "moderate",
  }
});
```

## Integration with Other Skills

| Skill | Integration point |
|-------|-------------------|
| `paper-importer` | Delegates Phase 5 generation for academic papers |
| `content-validation` | Validates generated content objects |
| `editor` | Reviews generated narrative content |
| `scientific-accuracy` | Checks extracted statements |
| `ontologist` | Maps terminology to glossary |
| `publish-extracted-statements` | Publishes the extracted statements, each linked to its library entry and section |

## Resuming Partial Processing

Where processing stopped is read from what EXISTS, not from a status field
(`intake.json` has none). To resume:

1. `uploaded` — `intake.json` is there
2. `extracted` — `extracted-text.md` (or an extraction record) is there
3. `structured` — `extracted-blocks.json` is there
4. `mapped` — `mapping.json` is there
5. `generated` — blocks tagged `source:<document-id>` exist in the content

Start from the first stage whose artefact is missing.

This allows multi-session processing of large documents.

## Checklist

Before marking intake complete:

- [ ] Raw files committed to `uploads/<document-id>/`
- [ ] `intake.json` and `<document-id>.dc.json` validate (`check:kind-validators`)
- [ ] `extracted-text.md` reviewed for OCR errors
- [ ] `extracted-blocks.json` reviewed and confirmed by user
- [ ] `tables.json` written, `status` checked (not silently `n/a`), and any
      `stitched_from` table spot-checked against the PDF
- [ ] All content objects generated with correct builders
- [ ] Blocks tagged with `["imported", "source:<document-id>"]`
- [ ] Chapter/section structure matches document
- [ ] Cross-references mapped to `uses[]`
- [ ] Content validation passes (`content_validate`)
- [ ] Extracted statements published with source links, and their pages current
      ([`publish-extracted-statements`](publish-extracted-statements.md))
```

---
name: l1-document-ingestion
description: >
  The detailed method for turning a DOCUMENT in `uploads/` into a complete L1
  entry in `library/<bib-slug>/` — which rung reads it and why, what a complete
  L1 entry holds, why an inferred structure is refused rather than guessed,
  and the archive, dataset, narrative, image and vector-label arms. Refines the
  harness's basic `library-ingestion` flow; one entry point: `bun run cat ingest`.
graph-typologies:
  - library
  - uploads
uses-methodology:
  - lsi
  - correspondence-analysis
---

# L1 document ingestion

**This is a refinement, not the entry point.** The harness's
[`library-ingestion`](../../../../cat-harness/library/skills/library-core/library-ingestion.md)
skill carries the basic flow every asset takes — an upload is accepted, its
metadata goes into the knowledge graph, and the asset lands in `library/` if it
is materialized — together with the two entry points, the upload's retirement
to `fsh-guts/`, and the remote half. This skill is what happens next **when
the asset is a document whose text and structure are wanted as L1 source
content**: reading it into sections, blocks and sidecars that `check:l1-complete`
can judge.

The rung code — `scripts/ingest-document.ts`, the `pdf-*.py` rungs,
`notebook-structure.ts` and OCR — lives in the harness. This skill is the
METHOD that chooses among them; invoking harness code from here is a downward
edge. The executable form is `collab/processes/library/l1-document-ingestion.bpmn`,
which calls the harness's basic `Process_Ingestion` first and then the four
`ingest-*` phases beside it.

## The whole path is two commands

```sh
bun run cat ingest uploads/FILE.pdf --library <lib>            # rung + every derived arm, into ingest-staging/
bun run cat ingest uploads/FILE.pdf --library <lib> --promote  # the L1 gate, then into <lib>/<slug>/
```

Staging prints the second line for you, built from **your own arguments**.

**`--promote` writes the entry's JSON-LD nodes**, for that entry only, with the
same `buildEntryNodes` the corpus generator uses. They are minted for the
**destination**, not for staging: an entry's layer is read off where it sits,
and `ingest-staging/` belongs to whichever layer holds it. You do **not**
need `gen-library-jsonld` or `check:l1-complete --write` after promoting — the
first is done, and the second's verdicts live on the `qa-reports` branch rather
than on `main`.

## Which rung, and why there is more than one

| rung | when | what it produces |
|---|---|---|
| `pdf-structure.py` | any PDF with a text layer | the **outline**'s chapters; with no outline, the **inferred** contents when it is trusted, else one section per **page** |
| `pdf-pages.py` | a page tree by hand: `--first-page-label`, or `--from-ocr` text | one section per **page** |
| `pdf-ocr.py` | text extraction yields almost nothing | a text layer to then page-split |
| `pdf-tables.py` | tables or figures matter | what `pdf-structure/v1`'s Section does not carry |
| `slides-structure.py` | the package declares a **PPTX or ODP** deck | one section per **slide**, `images.json`, `accessibility.json` |
| `referenced-source.py` | `--reference` given: the **licence forbids a copy** | `referenced.json` only — identity, sha256, outline; no text |
| `text-structure.ts` | the source is **text files** — Markdown, MDX, XML — usually fetched from a repository at a commit | `text-structure/v1`: a Markdown file divided by its own ATX headings outside fenced code, any other file one verbatim section, located by **file and line range**; images recorded by digest, never sectioned |
| `notebook-structure.ts` | the file is JSON with a numeric `nbformat` and a `cells` array — a **Jupyter notebook**, decided by content, never by the `.ipynb` name | `notebook-structure/v1`: one section per markdown heading, located by **cell** range; code kept as fenced code and never run; outputs not kept, and `structure_note` says so |

**A notebook is a variant, not a PDF with odd pages.** `structure.json` has a
shared base (cat-harness-tools `schemas/content/document-structure.ts`): the PDF
format is one variant, unchanged, and the notebook format is the other. A reader
that needs only sections reads either through `structureOf()`, which says where
a section is as `{pages}` or `{cells}`. A page-aware reader gets nothing from a
notebook, rather than a cell index mistaken for a page number.

**The decision is mechanical:**

- `toc_source: outline` → `pdf-structure` (`9789241548960-eng`, 250 sections)
- `toc_source: none`, `source.text_source: embedded` → `pdf-structure`, which
  keeps its inferred contents only when they pass the trust tests and otherwise
  writes pages (`wpr-rdo-2020-003-eng` lands on pages that way)
- a junk outline (`milnorlink`) → `pdf-pages`: `pdf-structure`
  would read the outline it found rather than infer one
- `toc_source: none`, `source.text_source: ocr` → `pdf-ocr` then `pdf-pages --from-ocr`
  (`who-pub-tps-931`)

## Slide decks — PPTX and ODP

A deck is a zip that **declares** its type (`[Content_Types].xml`, or ODF's
`mimetype` member), so it routes on the sniff, before the archive rung, exactly
as a workbook does. `slides-structure.py` writes the same `pdf-structure/v1`
shape a paged PDF gets — one section per slide,
`page_start == page_end == <slide>`, `granularity: "slide"` — so
`l1-blocks.ts`, the manifest and
`check:l1-complete` read it unchanged. Two differences from the PDF rungs:

- **A slide's title is its title placeholder, or it is `Slide N`.** Never the
  largest text box: that is the inferred-TOC failure below in a new format. It is
  also an accessibility finding, because a slide with no title placeholder cannot
  be navigated to by name, so the two questions share one answer
  (`title_source: placeholder | none` in each section's front matter).
- **No image is a `page-scan`.** A full-bleed picture alone on a slide is the
  slide's content, not a scan of text already extracted.

`accessibility.json` reports, per check, what the package can answer — slide
titles, alt text (with editor auto-captions such as *"Description automatically
generated"* counted as **failing**, since nobody wrote them), decorative marks,
language tags, document title, speaker notes — and says `undetermined` for the
three it cannot: reading order, images of text, contrast. **It gives no overall
score.** A single number would weigh a missing title against a missing alt text,
and nothing supports that weighting.

**Two copies of one deck? Compare before you choose which to ingest:**

```sh
python3 cat-harness-tools/scripts/slides-structure.py --a11y-only DECK.pptx DECK.odp
```

Prefer the copy that wins the per-check comparison. An export can lose what the
author wrote (an ODP export of Google Slides can drop **all** alt text and keep
the language only on the default style), and the format's reputation does not
tell you which way a particular export went.

Image descriptions go in the library's `image-verdicts.json` as for a PDF. Put
the inspector in `attribution.<doc-id>` when they are not the file's
`inspected_by`; without it the deck inherits the first inspector's name and
date.

## A source whose licence forbids a copy — record it, do not ingest it

Some sources may be read but not reposted. The OMG BPMN and DMN specifications
permit use on condition that a copy "will not be copied or posted on any
network computer or broadcast in any media". A normal ingest commits every
section's text to a public repository, which breaks that condition. It does so
silently, because nothing in the text layer says so.

```sh
bun run cat ingest FILE.pdf --reference IDENTITY.json --library <name>
```

`IDENTITY.json` holds the title, version, document number, date, publisher,
URL and the licence clause, **read off the document**. A missing field is
refused, never guessed. The entry holds `referenced.json` — the exact bytes'
sha256, the embedded outline (clause titles and pages, so a citation can still
name a clause), a `folio-materialization/v1` record in state `referenced`, and
why the text is withheld — plus a manifest with an empty `contains`, and a
`licence.json` quoting the clause.

**The choice is the caller's, never inferred.** Whether a licence permits
posting is a reading of the licence, not of the bytes. `check:l1-complete`
knows the kind, and **refuses** a `referenced` entry that holds `sections/`,
`blocks/` or `images/`. That would be the copy this kind exists not to make.

**A publication, not a file — an external reference.** A
FHIR implementation guide is a website and a package, not one PDF, so there are
no bytes to hash. Its `referenced.json` takes the `published` variant of
`source` (`schemas/referenced-source.ts`): `kind: "published"`, `url`,
`canonical`, `package_id`, `version`, and `read_from` / `read_at` naming the
local record the identity was read off — no `sha256`, rather than a made-up
one. `links` names where a reader goes instead (the publisher's page, and a
`site_path` on this site such as the layer's artefact index), and the
library viewer shows them on the entry's row. Write it by hand — there is no
file to run `referenced-source.py` on — then `gen-library-jsonld.ts --entry`
for the manifest. The licence follows the usual rule: `stated` only with a
basis, else `unknown` with where you looked. Example: the WHO SMART Trust IG's
entry in the DAK layer's `library/`.

## A source published as text in a repository — read it at a commit

The Gherkin reference, the MCP specification, the `hmans/beans` README and
FHIR R5's TestPlan resource are published as Markdown or
XML in git repositories. Printing one to PDF so a PDF rung can read it makes
the recorded sha256 identify a rendering nobody published, so they take their
own rung instead:

```sh
bun run cat ingest uploads/FILE.md --text --library <lib>            # rung + l1-blocks, into ingest-staging/
bun run cat ingest uploads/FILE.md --text --library <lib> --promote  # the L1 gate, then the entry and its KG nodes
```

`--text` is the CALLER's statement that the file is text: text has no magic
bytes, so the extension is never read, and a binary handed in as text is refused
as `undetermined`. Through `cat ingest` it takes the notebook's derived arm
(`l1-blocks`), and `--promote` writes the entry's JSON-LD nodes, as for every
rung. **Do not stop at the rung.** Run alone, `text-structure.ts` leaves an
entry with no `manifest.jsonld` and no section or block nodes. A source read at
a commit, with its `upstream.json` and several files, still runs the rung
directly:

```sh
bun run cat-harness-tools/scripts/text-structure.ts -o <library> --doc-id <slug> \
  --base <checkout> --upstream upstream.json [--title T] [--image F]... FILE...
```

and then, without fail, `l1-blocks.ts -o <entry>` and
`gen-library-jsonld.ts --entry <entry>`, as for a notebook. What it decides:

- **Divided by the author's headings, or not at all.** A Markdown file splits
  at its own ATX headings, outside fenced code. A `# comment` inside a
  `gherkin` block is not a heading. Any other text, and anything that opens
  with `<`, is one section, fenced verbatim. Nothing is rendered: shortcodes
  and JSX stay as written, and `structure_note` says so.
- **`upstream` records the exact revision**: repository, 40-hex commit, ref,
  path, and in words whether that revision is the **published** text or a
  working copy. A default branch is often neither, and a reader cannot tell
  which from a URL. Keep the clone out of the repository tree. The bytes can
  be fetched again from the commit, so none go to `uploads/` or `fsh-guts/`.
- **Several files are one source** when the publisher ships them as one, as
  with a specification version that is a directory of pages. Each file keeps
  its own sha256. The source's sha256 is the sha256 of their `sha256sum`
  listing, so `sha256sum -c` against a checkout verifies the entry without
  this code.

## From a library entry to a folio document — seed it, and its graph comes with it

A folio whose working document starts from a source (an outline, a draft, a
report) is SEEDED from the library entry, not from the raw file:

```sh
bun run cat-harness-tools/scripts/seed-folio-from-library.ts \
  --entry library/<doc-id> --slug <folio-doc> [--title T] [--author A]... [--force]
```

Any `structure.json` variant works. The top heading level becomes the
chapters, deeper levels nest as sections, and a section's own text becomes
one `prose` block. No kind is guessed: a persona or a requirement is the
folio's own enrichment step. Every block carries `meta.source` (library,
section, locator, `method: "library-seed"`), and the seed ENDS by writing each
block's `.jsonld` with `gen-block-jsonld`'s own code. A folio-specific seed
script that writes blocks must end the same way, or its site publishes no
graph. A seed is one-time: an existing
document is refused unless `--force`, which discards hand edits.

The original is never touched: the library entry and the folio's nodes are
DERIVED, and both are checked (`gen-library-jsonld --check`,
`gen-block-jsonld --check`) so neither can drift unseen.

## A source's glossary and abbreviations — candidates, read by one tool

Every L1, DTH and DAK source reads its glossary the same way, with the Tool
`glossary-from-source`, never with a script of its own:

```sh
bun run cat glossary:from-source --out glossary/<scheme>.glossary.json \
  --id <scheme> --title "<title>" --from library/<doc-id>/sections
```

`--from` reads every section whose title names a glossary, definitions,
terms, abbreviations or acronyms, and each numbered section under a glossary
section (a specification that prints one term per heading). A folio block can
be named with `--terms` or `--abbreviations`. Each row becomes a `candidate`
term, verbatim, with `source: <file>#L<line>`; an acronym becomes the
`notation` of the term it expands. The scheme is merged: a term a person has
adopted or edited is never changed. Only a person moves a term to `authored`
(`glossary-terms`). `--check` keeps the candidates in step with the L1 entry.

## A source's reference list — its own bibliography, read by one tool

Every source that prints a reference list gets its own bibliography, read the
same way with the Tool `references-extract` (step `Task_References` of
`ingest-build-l1-kg.bpmn`), never with a script of its own:

```sh
bun run cat references:extract --instance . [--entry <doc-id>] [--check]
```

It reads the L1 sections of each library entry. A list is a whole section
whose title is a reference-list heading, or the lines after such a heading
inside a section (chapter-end lists), in the six UN languages and Portuguese
(References, Bibliography, Further reading, Références bibliographiques,
Referencias, Литература, المراجع, 参考文献, …). Numbered lists are split on
their own numbers; unnumbered ones where an entry closes and the next opens.
Page numbers, running heads and section tabs between entries are skipped; a
list ends at an annex, chapter or glossary heading, a table or figure, or a
contents leader.

Each entry becomes a `folio-reference/v1` node in the instance's declared
`references` directory, keyed `<doc-id>.<section>.<n>`: `provenance:
extracted`, `derivedFrom` the section file, and `printed` the entry exactly as
the source prints it. Only fields read without guessing are set: `URL`, `DOI`,
`ISBN`, `issued` (the work's year, not the access date), `accessed`, and
`type: article-journal` for a journal's year;volume:pages. No title or author
is parsed, because WHO, Vancouver and author-year styles disagree on where a
title ends; the bibliography shows `printed` instead. A cited IRIS handle the
library holds gets `heldAt`. An entry longer than any citation (the list ran
into the text after it) is left out rather than kept wrong.

The bibliography page lists the nodes under the document they came from
(`bibliography/library/<doc-id>/`). They get no page of their own: a reader
opens one in the side panel from its document's page. Re-run the tool after a section is
re-derived; `--check` fails when a node is stale or has no list left to come
from. Nodes with any other `provenance` are never touched.

## Requirements and normative statements — every DAK and DTH source

Requirement extraction is a general part of L1 ingestion for DAK and DTH
sources, as a Stage B **aspect**: `cat ingest` runs `extract-candidates.py
--aspects-only` on every staged entry, and each requirement the source states
becomes a typed node in the entry's graph, `derivedFrom` its L1 section. A
folio's requirement block then CITES that node. It does not restate it with an
id of its own.

**The mount is the gate.** The `requirements` aspect lives in the DAK layer
(its `scripts/extractors/dak-requirements.py`), so it runs in DAK and
DTH repositories and nowhere else. With no aspect mounted the arm writes
nothing.

**No new schema: the existing kind that fits the source.** Requirement schemas
come in more than one style, some core and some the DAK layer's:

| the source prints | kind | layer |
|---|---|---|
| a DAK requirement row, `<CODE>.FXREQ.<n>` / `.NFXREQ.<n>` | `functional-requirement` / `non-functional-requirement` | DAK layer |
| a system's `shall`/`must`/`should` in prose ("The registry shall …") | `functional-requirement`, no id | DAK layer |
| a row of a table of system functions | `functional-requirement`, `source_kind: function-table-row` (by hand today) | DAK layer |
| a row of a table of information needs, an item of a list of reports or functions, a figure caption naming a function | `functional-requirement`, `source_kind`: `information-need-table-row`, `function-list-item`, `figure-caption` (by hand today) | DAK layer |
| an indicator | `indicator` | DAK layer |
| any other normative sentence | [`recommendation`](../../content/folio-document-adapter/normative-statements.md), strength in `rfc2119-requirement-level` or `grade-recommendation-strength` | core |

**Ids come from the source or there are none.** `number` is the id exactly as
printed, and it lands in the node's `meta.source_number`. A requirement that
prints no id has none. The node's `@id` is derived from the section and the
order the items appear in (`<kind>-<section>-NN`), never from a made-up label
such as an agent-assigned `FR-xx`.

**A requirement from a source is a reference, not a definition:** it
contributes to a definition but does not make one. The nodes carry
`provenance: ingested` and `route_to: l2-dak-authoring`. The folio that cites
one decides what it means for its own system, and a person promotes it.

**Then account for everything.** Run [`l1-coverage`](l1-coverage.md) with the
entry's requirement candidates as `--captured`. Every normative sentence the
aspect did not propose is either a missing capture or an exclusion a person
signs off.

A requirement written by hand, from a table no extractor reads yet, uses the
same `candidates.json` shape: `kind`, `source_kind`, `number` (or null),
`name`, `statement` verbatim, `section_file`, `section_title`, `pages`,
`formalization_candidate: false`, `route_to`. Leave out `document_class`,
`validated` and `disposition`. Those describe the WHOLE document, and the
manifest reads them as such. Then run `gen-library-jsonld --entry`.

## An inferred chapter tree is refused, not guessed

The failure this rule prevents is **silent**.

Without an outline, a heading-detector *can* infer a table of contents — and an
inferred TOC is confidently wrong in a way the output does not show. Two
cases:

- `WPR-RDO-2020-003-eng.pdf` — 11 of 13 inferred sections were named after a
  **different publication**, because page 22 reproduces a sample table from one
  as a design example.
- `WHO_PUB_TPS_93.1.pdf` — inferred entries took page numbers from the
  *contents* pages, so 26 of 42 sections came out under 500 characters while
  37,923 characters landed in one section misnamed `18-usetul-reference-books`.

So `pdf-pages` claims **no** chapter tree and says so in `structure_note`. **A
page is a determined division; an inferred chapter was not.** Same third-state
rule the rest of this repository keeps: a structure that could not be determined
is never rendered as one that was.

### The route `pdf-structure.py` takes itself

With no outline, the inferred contents is used only when it passes **all three**
tests, in order (`inferred_toc_trust`):

1. **concentration**: at most 60% of its entries may start on the two
   commonest pages — a list read off a page is not the document's structure;
2. **mean confidence ≥ 0.6** (`TOC_MIN_MEAN_CONFIDENCE`), each entry's
   confidence being how much independent evidence agreed — a contents page,
   the body, a heading style, a numbering run;
3. **headings with bodies**: from 5 sections up, no more
   than 25% of the sections the tree would cut may hold under 50 characters
   (`TOC_MAX_EMPTY_SHARE`, `TOC_EMPTY_SECTION_CHARS`), front matter not
   counted — a tree of empty sections is logo lettering, a sample table's
   column heads or a cover's address block, not chapters.

Otherwise — refused, or nothing inferred — the entry is split **one section per
page** (`page-001`, "Page 1", the shape `pdf-pages.py` writes), with
`granularity: "page"`, `toc_source: undetermined` or `none`,
`toc_undetermined_reason`, and a `structure_note` saying why. Both inputs are
recorded whether or not they passed: `diagnostics.toc_inferred_entries` and
`diagnostics.toc_inferred_mean_confidence` and
`diagnostics.toc_inferred_empty_share`.

**What the floor does and does not catch.** The mean is a weak predictor of
quality. A mean of **exactly 0.60** means no entry was corroborated by anything
but its style, and "at least 0.6" lets it through, so read a `font` TOC at 0.60
before citing it. The floor's real work is on the `regex` fallback, whose
entries carry no confidence and count as 0. The third test is the one that
catches a poor `font` tree; a poor tree with an empty share just under 25% is
too close to good ones to separate by this measure.

## A text layer that is not text

Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "force OCR when a page's text
layer fails a quality check". A text layer can carry plenty of letters and
still not be the page's words, and the character count the router used to
look at cannot see it. `cat-harness-tools/scripts/_text_quality.py` checks
EVERY page against the document's languages (`--lang-hint`, else the
catalogue's `dc.language.iso`). Each check was measured on an IRIS PDF:

| The text layer | Seen on | What the check counts |
|---|---|---|
| accents through the wrong code page ("dΘclaration") | 10665/231031, French | words mixing Greek and Latin letters, in a Latin-script document |
| Persian in the wrong Arabic code points | 10665/94830-per | Arabic-script letters outside the language's alphabet |
| words split by kerning ("au g m ente") | 10665/83270, French | a lone lower-case letter between two lower-case words |
| fake bold, each word printed twice | 10665/66977-chi | words equal to the word before |
| a font with no Unicode mapping | 10665/232378, Arabic | letters among characters that are not digits or table punctuation |

The router runs the check in its probe. When any page fails, the document goes
to `pdf-ocr+pdf-structure`: `pdf-ocr.py` reads every page and
`pdf-structure.py --ocr` takes the OCR text **for the failing pages only**,
keeping the outline and the text layer of the rest. They are listed in
`structure.json` `source.ocr_pages`, each with its reason; `text_source` stays
`embedded`. When most pages fail and there is no outline, the whole document
is read from OCR (`pdf-ocr+pdf-pages`), as for a scan.

**A page that holds two scripts.** OCR reads a page in the script its detector
names, so a French article's Arabic abstract (10665/117378) came out as
"er ie obus AU ball", and the Latin URLs in an Arabic toolkit's references
(10665/75211-ara) as Arabic letters. A page whose mean word confidence is under
70 is read again with each other installed script added (`ara+eng`,
`fra+ara`), and the most confident read is kept when it gains 10 points. On
the Arabic references page the confidence went from 54 to 86 and the URLs
read correctly; a page of plain Arabic keeps its first read.

## An outline that is not contents, and a section too long to be a block

Owner, 2026-11-11: "split single blocks that hold a whole book". Eight IRIS
PDFs came out as one section of 10,000 to 101,000 words, every one because an
outline was present, was taken as the document's answer, and located no
heading on any page:

- Word bookmark names: `_tyjcwt`, `_Hlk62546849`, `_GoBack`, `_TOC_250000`
  (10665/353150, 353151, 259268, 341997);
- "Blank Page" (10665/385385), or the names of the files merged into the PDF
  (10665/44118: `9789241547727_eng_Chapter1-4`);
- a Russian edition carrying its English outline (10665/331525-rus).

`pdf-structure.py` drops machine bookmark names from the outline, and sets the
outline aside when nothing is left or when under half of what is left names a
line the pages print (`diagnostics.outline_rejected` says which). The contents
are then inferred, and must pass the three tests above, else the document is
split by page.

A section that still holds more than half of a document of 20 pages or more
(and over 8,000 words), or over 20,000 words anywhere, is cut at the headings
inferred inside it, else one section per page
(`diagnostics.oversized_split`). A re-ingest renumbers the section ids of an
entry cut this way, so its block summaries go stale and are redrafted.

### Titles that do not match their text

Four IRIS entries had section titles that did not match the words under them.
`pdf-structure.py` now tidies an INFERRED table of contents before it splits
(`diagnostics.headings_tidied`; an outline entry is never touched):

- **A title cut to its last line** ("sanitaria universal", 10665/354399): a
  title that opens in lower case is rejoined with the lines above it, up to the
  bare number that opens it ("1.2 Función de la salud digital ... cobertura
  sanitaria universal"). With no number above it, it is dropped.
- **A body word set apart by a font** ("un", "comme", "On", 10665/264857), and
  a reference's first author in capitals ("YOUNG,"): dropped.
- **A diagram's labels** (an annex flowchart, 10665/329296): two or more
  sections on one page, each with fewer than 30 words, are dropped as headings
  and their words stay with the section before them.

A page whose PDF draws its side panel and body before its headings
(10665/342236) put every section one heading late. When the outline's first
heading on a page sits in the later half of the page's text, and the page read
in print order (top to bottom, a band of columns left column first) puts it
near the top, that page is read in print order
(`diagnostics.pages_read_in_print_order`).

### The document's language is recorded, not read from the slug

`structure.json` `source.languages` holds the languages the ingest was given
(`--lang-hint`). A reader asks it, not the slug: an item's first edition keeps
the bare slug whatever its language, so 10665/202203, which is Russian, has
no `-rus`.

## Footnotes and their marks

Owner, 2026-11-11: "also foot notes/marks". The `pdf-footnotes.py` arm reads
the page layout after `l1-blocks.ts` and writes `footnotes.json`
(`folio-document-footnotes/v1`, `schemas/content/document-footnotes.ts`):

- a **mark** is a superscript span (or one small and raised) whose text is 1-3
  digits, a letter, or `* † ‡ §`;
- a **note** is a line in the lower 40% of the page, smaller than the body
  text, that opens with a mark; the small lines after it continue it;
- a mark calls the note with the same mark on its page, else on the next.

Only a note that a mark calls is a footnote, with every `marks[]` place that
calls it (page and the words before the mark) and the `block` that holds its
page. A small line opening with a number is as often a table row or a running
footer (10665/311941: 159 such lines, none called), so those are kept as
`uncalled_notes`, and marks with no note as `unlinked_marks`; nothing is
dropped. The section text is not changed. OCR'd pages have no fonts and are
listed in `pages_unread`. `check:l1-complete` reports the counts (`footnotes`)
and fails only on a file that will not parse or names another entry.

Numbered citations (`[12]`, or a superscript 12 whose reference is in a list
at the end) are not footnotes; a superscript one shows up in `unlinked_marks`,
where a reference-list extractor can pick it up.

## Errata: errors in the source's own text

Owner, 2026-11-11 (card Q-ODD-1 = A, and "add to L1 doc schema errata").
Reading the blocks to summarise them finds errors that are in the publication,
not the extraction: a workshop report titled June 2006 whose introduction says
June 2005 (10665/205022), a Spanish edition announcing "nueve
recomendaciones" where the English lists ten (10665/354399).

**The block is never changed.** The agent records each one in
`library/<bib-slug>/errata.json` (`folio-document-errata/v1`,
`schemas/content/document-errata.ts`):

| Field | What it holds |
|---|---|
| `id` | `e1`, `e2`, ... never reused |
| `kind` | `error`, `inconsistency` (two places or two official editions disagree), `residue` (a placeholder, an editor's comment, contents page numbers "xx"), `translation` (an official translation says what its original does not) |
| `block` / `page` | where it is printed; at least one |
| `quote` | the words as printed, verbatim |
| `reading` | the reading the evidence supports, when there is one |
| `evidence` | what shows it, in a form a person can check |
| `narrative` | the note a reader sees, a draft naming its model until a person confirms it in `bun run cat narratives` |

The file is authored, so a re-ingest keeps it. An extraction defect (garbled
OCR, a block cut in the wrong place) is not an erratum: re-derive the entry.
Decisions about a document (personal data in a participant list, a "do not
distribute" notice) are not errata either; ask the owner. `check:l1-complete`
reports errata (`errata`) and fails only on a file that does not parse, names
another entry, or points at a block the entry does not have.

## What a complete L1 entry holds

```
library/<bib-slug>/
  structure.json     "$schema": "pdf-structure/v1" — doc_id, toc_source,
                     granularity, sections[], structure_note,
                     source{} (see below; source.text_source says embedded|ocr)
  sections/          one Markdown file per section, front matter + body
  blocks/            the block projection consumers read
  manifest.jsonld    @id, @type folio:SourceDocument, contains[], provenance
  summaries.json     agent summaries of prose blocks, a QA sidecar (see below)
  footnotes.json     footnotes and the marks that call them (pdf-footnotes.py arm)
  errata.json        errors in the source's own text, authored (never a rung's)
  images.json        raster images and their role (figure | decorative | ...)
  vector-figures.json  drawn figures rendered to figures/vfig-pNNN.png
  tabular.csvw.json  transcribed tables (CSVW) and tables/*.csv
  extraction.json    "$schema": "folio-library-extraction/v1" — what each kind's
                     step found (see "Every kind says what was extracted")
  ocr/               page-NNN.txt, only where the source was scanned
```

### Every kind says what was extracted

Owner, 2026-11-14, on a one-page notice whose page showed no references and
no glossary: *"why no biblio, glossary, etc here"*. A blank says nothing:
"none in the source", "not extracted yet" and "never looked" all look the
same. So every entry records, per kind — `contents`, `sections`, `figures`,
`tables`, `references`, `glossary`, `footnotes`, `summaries` — one of:

| state | means |
|---|---|
| `found` (+ `count`) | the step ran and kept N |
| `partial` | fewer kept than the text declares (e.g. 15 figures captioned, 3 kept), or sections split per page rather than by heading |
| `none` | the step **ran** and the source has none — never written for a step that did not run |
| `not-extracted` | the step has not run for this entry |

The ingest writes `extraction.json`:
`{"$schema":"folio-library-extraction/v1","kinds":{"<kind>":{"state","count"?,"note"?,"tool"?,"version"?,"at"?}}}`.
The library viewer's **What was extracted** line reads it and, for any kind
it does not name, derives the state from the files present
(`entryCoverage` in `cat-harness-tools/scripts/lib/library-document.ts`).

**A `check:l1-complete` pass is not this.** The gate checks the files an
entry must hold; it does not check headings, captions, tables, references,
glossary or figure blocks. An entry can pass the gate and still be
`page`-granular with fifteen figures nobody can see — 205 of who-iris's 211
entries passed while 89 were split per page (audit, 2026-11-14).

### When an entry needs re-ingesting — and how it is done

Re-ingest an entry when any of these holds; each is visible on its page:

- `granularity: page` on a born-digital PDF (sections are "Page 1…N", the
  Contents tree is flat) — the current `pdf-structure.py` may now trust an
  inferred contents the older run refused;
- figures captioned in the text but none kept, or vector figures kept but no
  figure **blocks** (they are invisible to the knowledge graph);
- a references or glossary heading in the text but its entries not extracted;
- tables captioned but none transcribed.

The order is fixed (owner's card, 2026-11-14): **fix the tools first, re-ingest
a pilot of about three entries, check them on their pages, then batch.**
Re-ingesting writes new derived files; the source PDF is frozen evidence and
is never edited. Re-splitting a page-granular entry makes its block summaries
stale: they are kept and marked stale, English is redrafted in the batch, and
the other five languages are left to the summary drain.

`bun run cat check:l1-complete` is the gate. It reports three states, never two: a
requirement **met**, **unmet**, or **not yet derivable** — the last because the
per-format arms (images, audio, tables, archives) are tracked separately and a
check that cannot run must not read as a pass.

**Then publish its statements.** Once the entry is complete and promoted, every
statement extracted from it is published in the folio's working artifact and in
the shared extraction viewer, each linked to the entry and its section, and CI
keeps those pages current. That is a standard step, the same for every content
type: [`publish-extracted-statements`](publish-extracted-statements.md).

## A manifest's title — the authority order, and never the page-1 parse

A library entry's `manifest.jsonld` `title` is the first of these the entry has:

| rank | `meta.title_source` | read from |
|---|---|---|
| 1 | `dc-record` | `dc.title` of the Dublin Core record that the catalogue node naming this entry (`libraryId`) points at through `metadataRef` |
| 2 | `referenced` | `referenced.json` `identity.title` |
| 3 | `pdf-info` | `structure.json` `metadata.docinfo.Title`, the PDF Info `/Title`, when it is not junk |
| 3 | `text-heading` | `structure.json` `metadata.title` of a **text or notebook** structure: front-matter `title:`, `--title`, or the level-1 heading |
| 4 | `slug` | the entry id. Nothing better exists, and `check:library-qa` reports it as `title-missing` |

**The page-1 front-matter parse is NEVER a title.** On a `pdf-structure/v1`,
`metadata.title` is `parse_front_matter`'s guess at which lines of page 1 are
the title, and it guesses wrong (a running head, a repeated word, a status
block). A plausible wrong title passes every check that has no second source. A
slug is honest about being a placeholder and gets flagged. The parse may still
feed search and the section files' `doc_title`.

`text-heading` shares rank 3 because it is the same kind of fact as `/Title`
(the source naming itself, in its format's own metadata). The two are exclusive
by variant, so no entry ever has both. A tabular record's `title` is its source
file name, which is never a title.

**Junk `/Title`** (`pdfInfoTitleJunk`): shorter than 3 characters or no letters;
`untitled` and its kin; `Microsoft Word - …`; an arXiv stamp
(`arXiv:0909.4061v2 [math.NA] …`); anything ending in a file extension; the
source's file name or stem; the slug. A junk value falls through to the next
source. It never becomes the title. Records (ranks 1–2) are taken as written,
because a cataloguer's choice is not a program's default.

**Record the Info dictionary at ingest.** `pdf-structure.py` and `pdf-pages.py`
write `metadata.docinfo`. Backfill an older entry with
`python3 cat-harness-tools/scripts/pdf-pages.py --docinfo-into <entry> <pdf>`. It
refuses unless the PDF's sha256 is the one the entry recorded.

One resolver, `cat-harness-tools/pipeline/library-title.ts`
(`resolveLibraryTitle`, `TITLE_AUTHORITY`), is used by both
`gen-library-jsonld.ts` and `check-library-qa.ts`. The manifest records
`meta.title_source` and `meta.title_from`, and the QA check re-derives the
order from the entry's files. So a manifest that claims `pdf-info` while a
catalogue record exists is reported as `title-implausible`, not believed.

## `source{}` — the technical facts, written by whichever rung ran

Every rung writes `source` on `structure.json`, from the single definition in
`scripts/_tech_meta.py`: `file`, full 64-hex `sha256`, `bytes`, `mtime` (the
SOURCE's, UTC to the second — not the ingest time, because what tells you a
re-fetch got something new is the file changing), `mimetype_sniffed` and
`mimetype_source`. Both rungs add `text_source`, `embedded` or `ocr`: ONE field
and ONE vocabulary for where the section text came from. `pdf-structure` also
adds `pages` and `extractor`.

**The mimetype is sniffed from the leading bytes and never falls back to the
extension.** An extension is a claim by whoever named the file; the magic bytes
are what the content is, and a `.pdf` that is really an HTML error page
extracts to nothing while every downstream verdict is about the wrong document.
Unrecognised bytes give `mimetype_sniffed: null` with `mimetype_source:
"unrecognised"`: a guess that agrees with the filename is indistinguishable
from a real sniff.

`bun run scripts/ingest-document.ts <pdf> --refresh-meta` backfills an existing
entry. It **reads the indent off the file** rather than choosing one: the two
rungs write at different widths, and hardcoding either reformats every entry
the other authored.

## `provenance` — who wrote it, and the closed union that makes omission impossible

Every block declares how its text came to be. The vocabulary is
`schemas/attribution.ts`, and it is **closed**:

- the literal `"ingested"` — verbatim source text. There is no author to name;
  the document it came out of is recorded by `source{}` above.
- an `Attribution` — `kind` (`script | agent | human`), `id`, and optionally
  `version`, `model`, `session`, `date`, `skill`.

**An `agent` must name its `model`, structurally.** "A model described it,
version X" is what a reader needs to weigh a narrative, and what makes the set
re-generatable when that model is superseded, so `AttributionSchema` refuses an
agent attribution with no model.

**The vocabulary is the QA reviewer's, not a second one.** `block-qa.ts`
re-exports `ATTRIBUTION_KINDS` as `QA_REVIEWER_KINDS`; the same three
participants review and author. What is *not* shared is `QaReviewer` itself,
most of which is about whether a criterion's cached verdict is stale.

### What the gate can and cannot enforce

`check:l1-complete` checks two things per block, and the second is the point:

1. `provenance` parses as a `Provenance`. An open string, a malformed
   attribution, an `agent` with no `model` — all `unmet`.
2. A block of an **authored** kind must not claim `"ingested"`.

`LIBRARY_BLOCK_ORIGIN` classifies each library block kind as `extracted` or
`authored`, and a test asserts it is **total over what actually occurs in
`library/`** — so a narrative arm cannot land a new kind without classifying
it, and classifying one `authored` arms requirement 2 immediately.

Closing the union does not stop an arm asserting something false. It makes the
**omission** impossible: a new arm has to choose, and choosing `"ingested"` for
a generated description is a false statement rather than a missing field.

A zero narrative count is reported, never silent. The authored branch is
proved to fire by fixtures in `scripts/tests/attribution.test.ts`, not by the
corpus, and each of the three branches is mutation-checked — removing it fails
a named test.

## Archives — the entry list is data, and the rung is chosen by CONTENT

A tar or zip in `uploads/` is opaque to every grep in the corpus: a search for
a filename inside one finds nothing, and that absence is indistinguishable from
the file not being there. `scripts/archive-contents.py` writes
`library/<slug>/contents.jsonld` — **one schema whatever the container**
(`schemas/archive-contents.ts`), so a consumer reads archives without knowing
whether it was tar or zip.

Per entry: `path`, `bytes`, `sha256`, `mtime`, `mimetype_sniffed`,
`mimetype_source` — the `source{}` vocabulary above, reused verbatim, because
**an archive entry is not a different kind of thing from a loose file**. The
mimetype is sniffed from the entry's own leading bytes, never from its name,
for the same reason it is outside an archive.

Four entry states, not two: a `directory` carries no size and no digest (a zero
would be a measurement nobody made); an unreadable member is
`mimetype_source: "unreadable"`, which is not an empty file; a `symlink` or
`special` is listed with its kind rather than dropped. Dropping directories
would make an archive of empty ones indistinguishable from an empty archive.
A file the sniffer does not recognise as an archive is **refused** — an empty
`entries[]` would read as an empty archive, a different fact.

### The rung is chosen before anything opens the file as a PDF

`planFor` sniffs first, so a zip is never reported as a PDF with a missing
backend. A file *named* `.pdf` that is really a zip takes the archive rung,
which is the case only a sniff can decide.

### What the gate checks, and the determined zero

Which entries the requirement applies to is **derived, not guessed**: `source.
mimetype_sniffed` is already on every entry, so "this came from a zip" is a
recorded fact. An archive entry must carry a `contents.jsonld` that validates
against the declared schema.

An entry that is not an archive reports `not an archive (<mimetype>)` — said
out loud rather than passed in silence, because "nothing to check here" and
"the check never ran" are different facts. The requirement is proved to fire by
fixture archives built in `scripts/tests/archive-contents.test.ts`, and each of
its four branches is mutation-checked.

## Datasets — findable by their headers, and the narrative nobody wrote

`scripts/tabular-records.py` writes `library/<slug>/tabular.jsonld`: sheet
names, the header row, and the shape of each sheet. `header_vocabulary` is the
union across sheets, and it is the field a `grep` for a column name lands in —
without it a dataset is stored but not findable, and a failed search is
indistinguishable from the dataset not having that column.

**The record is real JSON-LD, and so is `contents.jsonld`.** Both arms emit the
published
content context (the URL lives once, in `scripts/_content_context.py`, pinned
to `CONTENT_CONTEXT_URL` by a test), and every key is a declared term. The
facts a consumer queries across documents — `format`, the counts,
`header_vocabulary` — are real terms; the nested structures that are ours —
`sheets`, `entries`, the technical metadata, the `narrative` — are `@json`
literals, **because that is how their nulls survive**: `rows: null` means
"could not be counted" and `narrative.text: null` means "nobody has written
one", and JSON-LD drops a null anywhere else. The schemas still accept an
older record with no `@context`, since folio repositories hold them.

**Stdlib only** (`zipfile` + `xml.etree`, `csv`). This repository declares no
Python dependencies — no `requirements.txt`, and CI installs only `ruff` — so a
tool needing openpyxl would pass locally and fail there. Everything this arm
needs is in `xl/workbook.xml` and each sheet's `<dimension>`.

### The narrative is a state machine — drafted by an agent, confirmed by a person

cat-harness-tools `schemas/content/narrative.ts`: `not-authored` → `draft` →
`confirmed`, with `rejected` as a real fourth state.

**Two attributions, because they are two acts.** `drafted_by` is who wrote the
words; `confirmed_by` is who accepted them. The question a reader most wants
answered is not "did a machine touch this" but "has a person agreed to it".

**An agent cannot confirm its own draft** — `confirmed_by.kind` must be
`"human"`, structurally. Without that, `confirmed` degrades into "an agent said
so twice".

**But a rule about who may act cannot be enforced by a rule about what is
written.** In an agent container `git config user.name` is the agent's, so the
CLI could record the agent as a `human` reviewer and the schema could not see
it. `reviewer()` therefore refuses outside a terminal: a person confirming at a
prompt has one, an agent's subprocess and CI do not. **This stops accident, not
fraud** — it makes it impossible to confirm a narrative *while going about
other work*.

**`rejected` keeps its reasons.** A rejected draft silently re-offered wastes
the reviewer's time; one that vanishes lets the next agent redraft the identical
thing.

### Reviewing: `bun run cat narratives`

Numbered list, numbered reasons: a review step that demands a typed sentence
is one that will not happen, and then `confirmed` means "nobody got round to
objecting".

```sh
bun run cat narratives                     # what is waiting on you
bun run cat narratives:confirm 1
bun run cat narratives:reject 1 --why 2    # or --why-text "..."
```

`check:l1-complete`'s `narrative-review` validates every narrative-bearing file.
A `draft` is **reported, not failed**: it is work waiting on a person, and
failing it would make an unreviewed queue indistinguishable from a broken arm.

A null `rows`/`columns` is likewise not an empty sheet: `shape_source` says
whether the shape was read, counted, or `undetermined`.

### Summarising prose blocks — a QA sidecar, drained slowly

**The block stays verbatim.** A prose block is the source's text,
`provenance: "ingested"`, and re-ingestion regenerates it. A summary is an
agent's account of that text, so it lives beside the blocks in
`library/<slug>/summaries.json` (`folio-block-summaries/v1`,
`schemas/block-summary.ts`): one record per block, holding `block`, `source`
(the section file), `source_hash` and a `narrative`. That narrative is the
state machine above, not a second one: `draft`, `confirmed` by a person only,
`rejected` with a reason, and an agent author must name its model.

**`source_hash` makes a changed source read as STALE.** It is the sha256 of
the section text the summariser was shown (`proseBody`). Re-ingest a document
and any section whose text moved puts its summary back in the queue, marked
stale. `bun run cat narratives` shows it and refuses to confirm it.

**The queue is derived, so nothing enqueues.** Every prose block in every
declared library is in it until it has a current draft or confirmation. A
rejected draft is back in it, and its rejection reason travels with it.

```sh
bun run cat summaries                                   # the backlog, per entry
bun run cat summaries:next -- --n 5 [--entry <slug>]    # next K blocks WITH their text, as JSON
bun run cat summaries:record -- drafts.json             # write drafts; validated, all or nothing
```

`drafts.json` is `{drafted_by: {kind: "agent", id, model, session}, drafted_at,
lang?, drafts: [{block, source_hash, text, lang?}]}`, with `source_hash` echoed
from `summaries:next`. `lang` is a BCP 47 tag and defaults to `en`. `record`
refuses a state other than `draft`, a hash that no longer matches, and a block
that already has a current summary IN THAT LANGUAGE. A draft in a language the
block does not have yet is added beside the others, which are kept unchanged.

**Drain K at a time during ingestion work**, not all at once: a thousand
unreviewed drafts at once is a buried reviewer. Write in your own words, from
the block's text only, adding nothing from outside it.

**Length scales with the source:**

| source text | summary |
|---|---|
| under ~150 words | 1 short sentence |
| ~150–600 words | 2 sentences, short to medium |
| ~600–2,000 words | 3 medium sentences |
| over ~2,000 words | 4 sentences, medium to long |

If the extraction put the wrong text under a heading, summarise what is there
and say so. The backlog is reported by `check:l1-complete` (`block-summaries`)
and on the library page. It is advisory, never a gate. What the gate does fail
is a sidecar that does not parse, names another entry, or holds a record for a
block or source that is not there.

**Special pages get one sentence saying what the page is**: a cover, title
page, copyright or cataloguing page, a blank or near-blank page, a table of
contents, an index, a reference list. Garbled OCR, text in the wrong script, or
text that does not match the block's title is summarised as far as it can be,
and the summary says so ("the extracted text of this page is garbled OCR; it
appears to be a table of …"), so a reviewer sees an extraction defect instead
of a confident account of noise.

**A block too long to read whole** (a whole book extracted as one block) is
summarised from its start, its headings and its end, at the 4-sentence length,
and the scope is taken from the headings. Report the block as an extraction
defect: it should have been split.

### Summaries in every language

**A block's summary is owed in every configured language**: the layer's
`translation.supportedLocales`, which defaults to the six UN languages (ar,
zh, en, fr, ru, es) (owner, 2026-11-11). The slot holds one narrative per
language, each reviewed separately in `bun run cat narratives`. The order is:

1. **English** first, from the block's text, as above.
2. **The document's own language**, when it is not English, also written FROM
   THE SOURCE TEXT, not from the English. It uses the document's own
   terminology and checks the English against the source; when the two
   disagree, the source wins and the English draft is reported for redrafting.
   An edition in a language outside the configured set (Portuguese, Persian…)
   still gets one in its own language.
3. **Every other configured language**, translated from the current summary,
   as below.

```sh
bun run cat summaries                                    # also prints the translations owed, per language
bun run cat summaries:next -- --lang fr --n 50 [--entry <slug>]   # summarised blocks with no fr summary, WITH their current summaries
bun run cat summaries:record -- drafts-fr.json           # drafts carry lang: "fr"
```

`check:l1-complete` reports the missing languages in its `block-summaries`
detail. Like the summary backlog, it is advisory.

### Translating a summary

**Say the same thing, in the same length.** Translate the current summary
faithfully and naturally: nothing added, nothing dropped, and its notes kept
(garbled text, blank pages, a figure that does not match). It is a translation
of the summary, never a new summary of the block.

**Use WHO's established terms in the target language** (ВОЗ, منظمة الصحة
العالمية, 世界卫生组织, OMS; World Health Assembly as each language's official
name). Proper names, test and drug names (Xpert MTB/RIF, PrEP) and document
codes (A42/10, EB95/8) stay as written. A title with no official translation
stays in its original language. Use the target's own conventions: decimal
commas in fr, es and ru, logical-order Unicode for Arabic and Persian (Persian
letters ی and ک), Simplified Chinese with full-width punctuation.

**Check before recording**: every block and `source_hash` copied exactly, the
text is in the target script, and it is not the source summary unchanged.
Record one language per file: `record` refuses the same block twice in one
file.

### The Document panel — what a reader browses

Every entry carrying a `structure.json` gets a **Document** panel in the
library viewer, built from the ingestion schema by
`cat-harness-tools/scripts/lib/library-document.ts` and published as
`assets/library/entries/<id>.doc.json` (`folio-library-document/v1`) by
`bun run cat library:viz`. Tabs: **Contents** (the TOC as a tree, collapsed below
the first level that branches, each inferred entry's confidence, linking to its
section), **Pages** (physical page, printed label, sections starting, figures),
**Figures & tables**, **Sections** (the summary, else an *extract* — the
section's own opening text, labelled as such and cut at a word), **Checks**
(contents vs body, numbering gaps, page-label conflicts). Because it reads the
schema, a new field in `structure.json` reaches every library at once; a field
an older ingestion lacks shows "not recorded — re-ingest", never an empty table.

Above the tabs: the entry's own **listing row** (the same columns the whole
library shows) and the **What was extracted** line. Figures are a list, one
per row: a lazy thumbnail, a short name taken from the description's own
"Fig. n, 'Title'", and the page; selecting the thumbnail opens it large with
its description (owner, 2026-11-14). Block summaries sit behind a disclosure
labelled with their state, so an unconfirmed agent draft is readable and
still says it is one.

**Printing loads everything first** (owner, 2026-11-14: *"make sure printing
loads all of the content before it renders the PDF"*): the panel's Print /
PDF button and the browser's own print both switch lazy images to eager and
wait for them, write each figure's description under it, and open the
contents tree and every disclosure.

For a withheld entry the panel keeps structure, page labels, figure and table
**captions** (labels, like TOC titles) and our summaries,
and omits only section body extracts.

### Keywords — from the LSI weights, per section and per document

Keywords are **extracted content**, so they never live in the ingest record
(cat-harness#1144). `bun run cat library:keywords` builds them at publish into
the derived keywords graph: one `folio-keywords/v2` JSON-LD node per entry
under the site's `assets/keywords/<instance>/<slug>.jsonld`, with an
`index.json` beside them. Nothing is written inside `library/<slug>/`; the
route is declared `builtAtPublish`, and `derive:publish` runs the writer. Up
to 12 for the document and up to 8 per section, fewer for a short section (one
per ~20 content tokens, at least 3).

Each node holds six **variants** side by side, so they can be compared:

| Variant | Method | Weighting | Terms scored |
|---|---|---|---|
| `lsi-log-entropy-surface` (default) | `lsi` | log-entropy | the words the text uses |
| `lsi-tfidf-surface` | `lsi` | tf-idf | the words the text uses |
| `lsi-log-entropy-latent` | `lsi` | log-entropy | latent scores, any term of the library |
| `lsi-tfidf-latent` | `lsi` | tf-idf | latent scores, any term of the library |
| `lsi-log-entropy-latent-rerank` | `lsi` | log-entropy | latent scores, only the words the text or its headings use |
| `ca-latent` | `correspondence-analysis` | raw counts | latent scores, any term of the library |

The default is read from the **same** log-entropy matrix the LSI index is
built from (`keywordsOf` in `pipeline/lsi.ts`), so a keyword means "frequent
here, rare across this library" exactly as the index does. A latent variant
scores terms by the rank-k reconstruction (k = 100), so it can propose a term
the text never uses (synonymy, Deerwester et al. 1990); it scores the top 300
candidates. Correspondence analysis tends to favour rare proper names
(authors, publishers), which the comparison shows.

The Document panel computes the default variant in memory and shows it as
chips, green where a heading also names the term (`evidence: ["heading"]`):
the document saying it of itself. Withheld entries show them: they are
derived terms, like captions, not the text. The `library-keywords` check in
`bun run cat health` reports entries without keywords and any legacy
`keywords.json` still committed.

What the scoring does:

- **Two-word phrases** from truly adjacent tokens said at least twice; a stop
  word, punctuation, or a line break before a capital (a table cell, a heading)
  breaks the run — "Development" over "Systematic review team" is two cells,
  not "development systematic".
- **A word said once** in a text of 100+ tokens is not a keyword, unless the
  section's heading names it; heading-named terms score double.
- **Generic words** the index keeps but that say nothing about a topic
  ("anyone", "aims", "take", "-ly" adverbs) are excluded from keywords only.
- **Plurals fold**: "evidence reviews" does not follow "evidence review".

Limits: no part-of-speech tagging, so a rare verb can still surface in a short
section; a library of fewer than 3 sections gets none.

### A WITHHELD entry in the viewer — its summary, else the gate, never "no content"

An entry whose library root's `withheld.json` names it is listed but publishes
no verbatim text: `gen-library-viz` reads its blocks with `verbatim: false`.
"Not ours to show" must not look like "nothing was extracted":

1. **A row shows the section's summary when one exists**, labelled as a summary
   and never as the source text. Summaries are our writing and stay published.
2. **Otherwise, a withheld row says the gate**: *"Withheld — copyright not
   granted"*, naming every gate that refused (*"copyright and restrictions not
   granted"*), with a link to the catalogue record — its published page first,
   its upstream URI second, no link rather than a guessed one.
3. **Anything else with no content keeps the neutral "(no content carried)"**,
   because for those it is true.
4. **A banner tops a withheld entry**: why the text is not shown, which gate
   refused, the record link, and how many sections have summaries (*"0 of 121
   sections summarised"*). No banner on any other entry.

**Withheld is READ, never inferred from emptiness.** The flag, the gates and the
record come from `withheld.json` — `folio-withheld/v1` carries an optional
structured `gates[]` and `record{id, page, uri}` beside the `reason` sentence,
which the layer's generator writes from its own data (the IRIS catalogue:
`gen-iris-pages.ts`, from the catalogue's publication gates). A list that
carries only the sentence still works: the row then says the sentence.

The row and banner code is `scripts/lib/library-withheld-view.ts`, embedded in
the page verbatim so `library-withheld-view.test.ts` runs the same text the
browser does; `library-withheld-viewer.e2e.ts` opens the rendered page.
Drafting the summaries is a separate backlog:
`bun run cat summaries:next -- --entry <slug>` serves a withheld entry's text to the
summariser like any other.

### Describing a document's images — and why it is an ARM, not a step you run

`pdf-images.py` classifies by geometry, which answers exactly one question: is
this image the whole page, or something on it. It cannot tell a logo from a
chart. The finer roles come from LOOKING, and that judgement is **data** —
`<library>/image-verdicts.json`, one entry per image, reviewable line by line.

```sh
bun run cat ingest uploads/FILE.pdf --library <lib>   # stage; reports what is unmet
# look at ingest-staging/<doc-id>/images/, write the verdicts into
# <lib>/image-verdicts.json, then:
bun run cat ingest uploads/FILE.pdf --library <lib>   # re-stage: the arm applies them
bun run cat ingest uploads/FILE.pdf --library <lib> --promote
```

**Re-running `ingest` is the second step, not a separate apply command.**
`--promote` refuses an entry whose `image-descriptions` requirement is unmet,
and the stand-alone narrative writers (`apply-image-verdicts.ts`,
`narratives.ts`) resolve their targets through
`directoriesForGraph(root, "library")`, i.e. only in promoted libraries.
Applying the verdicts as an arm in staging is what lets a document be both
described and promoted.

**Applying by hand works exactly once.** `pdf-images.py` opens the sidecar with
`"w"` — no existence check, no merge — so the next `ingest` overwrites the
descriptions, and overwrites them *quietly*: the file still parses and still
validates, it simply has no narratives in it any more. Running the application
as the fourth arm, **after** `pdf-images.py`, makes a re-run RE-APPLY instead —
the sidecar is rebuilt from the PDF and the committed judgement is laid back
over it.

`--staging <entry-dir> --library <lib-dir>` is available directly if you need
it, and `--library` is **required**: a staging directory does not say which
library a document is being promoted into (a queue does not determine a
library). An absent verdicts file exits **0**, because the first ingest
necessarily runs before anybody has looked at the images; `image-descriptions`
is the gate that refuses, not that script. An *orphaned* verdict — one naming
an image the sidecar does not have — still fails, in either mode.

Every narrative it writes lands as `draft`. Only a person confirms one.

#### A role threshold is OPTIONAL, and its default is NONE

A coverage cutoff may sort images into roles (figure vs furniture) only when
a caller supplies one.

- **By default nothing is thresholded.** With no value supplied, every role
  call comes from an inspection verdict as above, naming who looked.
- **A caller may supply one.** An image whose role it decides must record
  that basis: the value, and that the value was caller-supplied rather than
  inspected. A thresholded role must never be readable as an inspected one.
- **Ship no number.** No config default, and no value in docs, tests or
  examples presented as recommended. Per-image coverage does not separate the
  classes, and a cutoff placed in one corpus's empty stretch is fitted to that
  corpus and says nothing about others.

#### Reading a figure: the text layer is not the figure

Two traps, both of which produce a wrong description:

**A diverging axis's SIGN cannot be read from the text layer.** `get_text`
returned `0.2 0.4 0.6` below the zero of a `Delta Pass Rate` bar with **no
sign at any codepoint** — matplotlib draws U+2212 as a vector path, so the
minus exists in the rendering and not in the text. Rendering the region showed
`-0.2 -0.4 -0.6` plainly. A verdict trusting the extraction would have called
a `-0.6` endpoint `+0.6`.

**And the direction is a fact about the axis, not about the colours.** The
recorded inspection said a bar ran *"blue low to red high"*. Its ticks said
`Pass Rate`, `1.0` at the top in dark blue: blue was HIGH. A reader given the
original sentence reads every heatmap in the paper inverted — **worse than no
description**, because a missing one is visibly missing.

So: render the region and read the ticks. Two images that look alike need the
same check each: a third "repeated legend" can be a different, signed scale.

### The figure that is DRAWN — `pdf-vector-labels.py`, the other arm

`pdf-images.py` answers "what does this page PLACE". A WHO conceptual figure —
a framework, a maturity model, a taxonomy, a process flow — is drawn in path
operators and text, so it places nothing, and the raster arm is silent about
it truthfully. `9789240120747-eng` declares six captioned figures, places zero
images, and `image-descriptions` reported *"0 image(s), 0 describable and all
described"* over it: **a determined empty that is true about raster and
misleading about figures.**

The vector arm runs beside the raster one in `withDerivedArms`
and writes `vector-labels.json` — every positioned text line on a page that
declares a figure, with its rectangle in the visible frame, its fonts and
sizes, and whether it intersects a drawing.

**Read the sidecar, not a count.** Three things it deliberately does not do:

- **It does not say which labels belong to the figure.** `intersectsDrawing`
  is recorded and never filtered on. On `9789240120747-eng` page 34 it
  separates perfectly; on `9789240010567-eng` page 25 it is false for thirty
  labels that are plainly figure content, because they sit in the white space
  *between* the drawn boxes.
- **It does not group above the MuPDF LINE.** A block on that same page holds
  six circled numerals 200 pt apart across three different diagrams.
- **It does not compare its counts to anything.** Declared figures and
  recovered labels are not commensurable.

So when you describe such a figure, the labels are your evidence and the
grouping is your judgement — which is the same split as
`image-verdicts.json`, one level over. The rule from the section above holds
here with more force, not less: **render the page and look at it.** The arm
recovers what the text layer says; it cannot tell you that the arrows run
clockwise.

The determined empty is still meaningful: `who-rhr-1806-eng` records zero
pages because it contains no `Fig.` or `Figure` mention at all. A document with
**no text layer** returns `pages: null` with a reason instead — the one place
this arm could otherwise report a clean run over an unread scan.

### An `.xlsx` IS a zip — ask the container

The magic bytes of an OOXML or ODF document say `application/zip`, which is
true and useless: it would send every spreadsheet to the archive rung to be
listed as a bag of XML parts. The magic cannot tell them apart, so
`_tech_meta.sniff_zip_package` asks the **container**, which declares itself —
OOXML by `[Content_Types].xml` plus the part names, ODF by its `mimetype`
member. Same principle as the byte sniff, one level in.

`sniff_effective_mimetype` is the single answer the router (`planFor`) and the
recorder both ask, so they cannot disagree.

**A CSV has no magic bytes at all**, so routing one cannot be a sniff and must
not become an extension guess. `is_tabular_text` asks the only content question
available: do the first rows split into the *same* number of fields, more than
one? Prose, a single column and anything ragged all answer no — a one-column
"table" is indistinguishable from a list of lines.

Proved on fixtures built at test time, all five branches mutation-checked.

## Related

- [`publish-extracted-statements`](publish-extracted-statements.md): the step after promotion — every extracted statement published, with its source links.
- [`library-ingestion`](../../../../cat-harness/library/skills/library-core/library-ingestion.md) — the basic flow this refines: the two entry points, the upload's retirement, the remote half
- [`directory-conventions`](../../../../cat-harness/skills/kg/kg-core/directory-conventions.md) — the graph typologies and who declares them
- [`bib-qa`](../cataloguing/bib-qa.md) — auditing what is already in `library/`
- [`tabular-metadata`](tabular-metadata.md) — the CSVW model behind the dataset arm
- `collab/processes/library/l1-document-ingestion.bpmn` — this method, executable; it calls the harness's `Process_Ingestion` first

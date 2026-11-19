---
input: schemas/skills/document-publishing/input.schema.json
output: schemas/skills/document-publishing/output.schema.json
---

# document-publishing

Take a document folio from corpus to published artifact — without a TeX
installation.

## The pipeline

```
folio/**    →  document_render_md   →  build/<slug>.md
                                    →  document_render_html  →  build/<slug>.html
                                    →  document_render_pdf   →  build/<slug>.pdf
```

One assembly step, then pandoc. Run `document_render_md` first and read it:
it is the only place the whole document appears in reading order in one
file.

## Before rendering

Run, in this order, and fix what each reports before moving on:

1. **`content_validate`** — schema, constraints, and profile conformance. A
   document folio that has acquired a math block or a `.lean` sibling fails
   here.
2. **`qa_sweep`** — the QA axes over each block's sidecar.
3. **`document_render_md`** — read the assembly. Look for: sections that came
   out empty (a block written but never listed in `blocks[]`), blocks in an
   order that does not read, and the `> **Missing block:**` marker, which
   means a section names a root that failed to load.

## PDF without LaTeX

`document_render_pdf` drives pandoc with an HTML engine — `weasyprint`
(recommended), `prince`, or `wkhtmltopdf`. If none is installed it reports
which are missing and stops.

It does **not** fall back to `latexmk`, even on a machine that has it: a
document folio is defined by not requiring TeX to publish.

`document_render_html` needs only pandoc, so it works when the PDF path
cannot. When you are drafting rather than publishing, prefer it.

## Styling

Both HTML and PDF accept `css`, a stylesheet path relative to the repo root.
Keep it in the **folio** repo, not here — a house style is content, and the
platform ships no default beyond pandoc's.

The same stylesheet drives both outputs, so a print rule (`@page`, page
breaks, running heads) belongs in it alongside the screen rules rather than in
a second file that drifts.

## Release files: the public-comment PDF and the offline .docx

`scripts/document-export.ts` is the publication pipeline's FILE step. It
runs the same assembly as `document_render_md`, and it gives the same result
locally as on any CI runner, because the commit is the only input that
changes:

```sh
bun run folio-assistant-core/scripts/document-export.ts release --document <slug> [--out <dir>] [--release <id>] [--date YYYY-MM-DD]
```

| file | what it is |
|---|---|
| `<slug>-public-comment-<sha7>-<date>.pdf` | the frozen, line-numbered review draft |
| `<slug>-public-comment-<sha7>-<date>.docx` | the same draft as Word, whose sha256 goes in the release references (`public-comment-channels`) |
| `<slug>-offline-<sha7>.docx` | the editing copy: Track Changes on, one Word bookmark per chapter, section and block |
| `<slug>-export-<sha7>.json` | `document-export/v1`: commit, date, tool versions, and each file's format, filters, parameters, sha256, pages, lines and bookmarks |
| `<slug>-…-latest.{pdf,docx,json}` | the same files under stable names, overwritten by every export, so a link to one always serves the newest |
| `index.html` | the Export page: every file above with its format, the filters and parameters it was made with, size, date, and links to this export and to its latest copy |

`pdf` or `docx` builds only that half. The **PDF is the .docx laid out by
LibreOffice** (`soffice --headless`), not a print of the site. That way the
two files have the same pages and line numbers (Word line numbering,
continuous), and `pdf-line-map.py` reads the PDF as it reads a Word-made
review PDF. It needs pandoc, LibreOffice and poppler (`pdfinfo`,
`pdftotext`), and never TeX.

It refuses a working tree with uncommitted changes under `folio/`, because
the stamp would name a commit the file does not come from (`--allow-dirty`
marks the stamp `-dirty`). The date defaults to the commit's date, so two
runs at one commit write the same .docx bytes. The PDF differs only in
LibreOffice's creation timestamp.

### Bringing an offline edit back

An author edits the offline copy in Word with Track Changes on and returns
it **with every change still pending**. A change accepted before upload looks
like the original text and carries no author.

```sh
python3 -I folio-assistant-core/scripts/docx-offline.py changes <edited.docx> --repo . \
    --out <changes.json> --summary <pr-body.md> [--apply [--commit]]
```

- The file's `folio-source-commit` must exist in the repository, or nothing
  is merged (exit 2).
- Each paragraph belongs to the last `folio_<sha1(label)[:16]>` bookmark
  before it. The name is recomputed from the source commit's
  `review-anchors.json`, so run `bun run review:anchors` before exporting.
- `--apply` edits the block's `.md` in the working tree, carrying each
  insertion and deletion onto the matching line or table cell so emphasis,
  links and list markers around it survive. A block whose `.md` changed
  since the source commit is a `conflict` and is left alone. A paragraph
  that matches no line (a heading, a split or merged paragraph) is `manual`.
  Neither is guessed at; both are listed in the summary with the original
  and the proposed text.
- `--commit` makes one commit per block (`offline edit: <label> (<author>,
  <date>)`), so a review can take or drop each. Run it on a branch
  `offline-edit/<sha7>/<author>`, and open the pull request with
  `--summary`'s file as its body.
- Word comments come back on their block, in the report and the summary.
  Formatting-only changes are ignored.

## A large document loads its text as data

`build-document-site.ts` publishes a document of 200 or more blocks
(`LAZY_THRESHOLD`) as a **shell plus data**, because one page of every block
is too heavy to use.

| file | holds | who reads it |
|---|---|---|
| `en/<slug>/index.html` | headings, every block anchor, a placeholder per block, [edit]/[feedback] as data, comment-note counts | readers |
| `<slug>/blocks/NNN.json` | each block's rendered HTML, 40 blocks per chunk, in document order | the shell, as the reader nears a block, then the rest in idle time |
| `en/<slug>/index.hydrated.html` | the whole document on one page | `file://` opens (fetch fails, so the shell goes there), readers without JavaScript, tools (`block-screenshots.ts`) |
| `<slug>/pc-notes.json` | each block's comment list (a public-comment folio) | a comment note, when opened |
| `outline.json` `lazy` | the hydrated page, the chunk count, and each block's chunk | the rendered-impact predictor, which names the chunk a change alters |

Pages are under the page locale, `en/`, and data is not.
`scripts/document-site-route.ts` says where each one goes.

The name follows the knowledge graph's own pair: a subgraph publishes
`index.jsonld`, which references its members, and `index.hydrated.jsonld`, which
holds them inline. The document page is the same pair: `index.html` references
its blocks, `index.hydrated.html` holds them.

A link to a block (`#prose:…`) or to a term inside one (`#term-…`) loads that
chunk first and lands on it. `--lazy always|never` overrides the threshold.

Two rules for anything that reads the document page:

- **Want the text? Read `index.hydrated.html` when it exists.** The shell has
  placeholders where the text goes.
- **Find blocks by their anchor** (`<a id="<label>">`). It is on both pages.

Searching the document's comments is the dashboard's job, not the page's.

## What is not implemented

The pandoc tools (`document_render_*`) have no citations, no bibliography, no
glossary and no automatic cross-reference numbering: `\cite{…}` passes through
**verbatim**, so write references as Markdown links or footnotes for that
path. The site build (`build-document-site.ts`) does render `\cite{a,b}` as a
muted `[a, b]` (each key linked to its entry with `--bibliography-url`) and
`:defterm` / `:refterm` as a term and its link; it has no cross-reference
numbering either.

Cross-references do work: every labelled block emits an HTML anchor, so
`[see the scope statement](#rec:scope)` resolves in both HTML and PDF. Use the
block's `label`, not a heading-derived anchor, which changes whenever the
title is edited.

## Release

Publication authorisation is the base process's, not this skill's:
`Task_AuthorizeRelease` and `Task_PublishRelease` are non-relaxable in
`draft-to-publication.bpmn` and no content type can opt out of them. Render,
review, then take the release decision through the workflow —
`workflow_next` will tell you what is enabled.

### A public comment release is a full build

A site build is a `preview` (a pull request's `branches/<slug>/`: only what the
change reaches, every whole-corpus index borrowed from main) or `full` (the
main deploy, a public comment release, a release: every index rebuilt). See
cat-harness skill `feature-staging`, section "Build types".

Before `pc:release freeze`, dispatch the preview workflow for the branch with
`build_type: full`, so the frozen copy's search index and slices describe the
draft rather than main. Freeze refuses a copy whose `staging.json` says
`buildType: "preview"`, and records the build type in `release.json`.

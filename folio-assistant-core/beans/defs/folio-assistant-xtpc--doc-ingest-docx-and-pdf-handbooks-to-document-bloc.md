---
# folio-assistant-xtpc
$schema: bean/1.0.0
title: 'DOC INGEST: .docx and PDF handbooks to document blocks with content-derived ids — and document-intake out of the paper adapter'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:54Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-q4jm
---

Owner: *"doc ingest"*. A DAK narrative or an L1 handbook arrives as a .docx or
PDF. Until it is blocks in the folio/ graph, there is nothing to diff, anchor
comments to, or heat-map.

**Measured 2026-09-22.**
- `document-intake` lives in **folio-paper-adapter/**, not
  folio-document-adapter/. An L1 handbook is a `document` folio, so the skill
  is in the wrong adapter for its main customer.
- The slw1 epic has nine per-format arms: audio, images, CSV, archives and so
  on. **None is .docx.**
- `pdf-structure.py` splits a PDF into `sections/NN-slug.md`. `NN` is a
  POSITION, so inserting a section renumbers every section after it. That is
  exactly the id drift child 01 exists to catch.

**What.**
- A .docx arm: heading hierarchy, tables and figures become blocks.
- Move or generalise `document-intake` into the document adapter.
- Ids are minted from a **content-derived anchor** (heading path plus a
  normalised text hash, with a collision suffix), never from position. On
  re-ingest, an existing id is **looked up** in the folio/ graph before a new
  one is minted.

Parented here rather than under slw1 because the constraint that makes it
hard is REVIEW identity. slw1 is the sibling to read alongside it, and apui is
the entry point it plugs into.

## Done when
- [ ] a .docx upload becomes document blocks through the apui entry point
- [ ] document-intake is reachable from the document adapter
- [ ] re-ingesting an unchanged document passes `id-reingest-stable` (child 01)
- [ ] re-ingesting with one inserted section changes the ids of exactly that section's blocks


## Also issue #197 (roast R9)

The owner's #197 asks for exactly this, plus provenance **to page and line of the rendered source** on every extracted node, applied to PDF ingestion too, *"to make review and adjuducation processes easier to follow"*. Also *"basic formatting (bold, italic) preserved … not 1:1"*, and *"open format versions only for now"* (.docx, not .doc). Its comment tags @ritikarawlani for any schema change to the paper .ts content type.

- [ ] every ingested node carries source page and line provenance

## Moved here from 5xzc (2026-09-22)

- [ ] register `id-reingest-stable`: re-ingesting an unchanged upload yields the same labels. Implement it beside `id-unique` / `id-stable` in `qa-checkers-ids.ts`, once this bean's ingest emits blocks. It was not registered earlier because a criterion with nothing to check sweeps `n/a` everywhere, and that reads as coverage.

_2026-10-04T19:17:28Z_ — Claimed by claude/confident-bardeen-inaarx — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Round 1: 2026-10-04 (branch claude/confident-bardeen-inaarx)

- `folio-assistant-core/scripts/docx-structure.py`, standard library only: headings, lists (ordered/bulleted from numbering.xml), tables (gridSpan), images, captions, text-box call-outs (mc:Fallback copies skipped), footnotes, and bold/italic/hyperlinks kept as Markdown. On the DPI-H draft: 1108 items, 101 footnotes.
- `folio-assistant-core/scripts/docx-to-folio.ts`: an editable document folio with nested sections and one block per paragraph, list, table, figure or call-out. Labels are `<prefix><section>-<text hash>`. A re-run looks old labels up by hash: 946 of 946 kept on the DPI-H draft, and the test inserts a paragraph and sees exactly one new label. Every block carries `meta.source` page / printedPage / lineStart / lineEnd / method, and `review-anchors.json` is the same index in one file.
- Platform fixes it needed: `render-markdown.ts` now renders subsection headings at any depth (they were dropped, and only one level of blocks was walked); `Section.lead` for a chapter's text before its first heading; `build-document-site.ts` copies `folio/<slug>/media/`.

- [x] every ingested node carries source page and line provenance
- [ ] a .docx upload becomes document blocks through the apui entry point (the CLI works; apui not wired)
- [ ] document-intake reachable from the document adapter
- [x] re-ingesting an unchanged document keeps every label (test; `id-reingest-stable` not yet registered)

## Completed on landed evidence
Landed on main in PR #1912 / commit f28c22babd06 (public comment: .docx + line-numbered PDF to editable document blocks).

---
input: schemas/skills/document-structure/input.schema.json
output: schemas/skills/document-structure/output.schema.json
---

# document-structure

Decide and maintain the chapter/section skeleton of a document folio.

## Structure is authored, not inferred

Nothing derives the outline from the prose. Three manifests hold it, and each
is an ordered list:

| File | Holds | Order means |
|---|---|---|
| `folio/<slug>/<slug>.ts` | `chapters: ChapterRef[]` | reading order of chapters |
| `<chapter>/<chapter>.ts` | `sections: Section[]` | reading order within the chapter |
| a section's `blocks: string[]` | block root names | reading order within the section |

A block reaches the output **iff** some section names it: a block whose
`.ts` and `.md` exist but that no `blocks[]` lists renders nowhere. Adding the
name to `blocks[]` is part of adding a block.

## Sections may nest exactly one level

`subsections[]` on a section carries another section, whose `blocks[]` render
under a deeper heading. One level only — the renderers flatten at that depth,
so a third level silently loses its blocks rather than nesting further. If you
need a third level, you need another chapter.

## Chapter granularity

A chapter is the unit a reviewer is asked to read in one sitting, and the unit
the work plan tracks. Prefer more, smaller chapters over few large ones: a
chapter is also the unit that gets *rewritten*.

## Adding a chapter

1. `mkdir folio/<slug>/<chapter-dir>`
2. Write `<chapter-dir>/<chapter-dir>.ts` — title, optional `label`, and
   `sections[]` (which may start empty).
3. Add `{ dir: "<chapter-dir>" }` to the document manifest's `chapters[]`, in
   the position it should be read.
4. `content_validate`.
5. `bun run review:anchors`, so the review sheet's Selected Sections list
   and every comment's placement see the new chapter.

**Every document folio declares `review:anchors` and `check:review-anchors`
from its first commit** (`review-anchors-from-folio.ts --document <doc>`;
the `--library`/`--source` flags only when it was seeded from a library
file). The section list is what a review sheet's dropdown reads; a folio
without it leaves a linked sheet empty. See
`review-sheet-script`, "Linking a sheet to a repository".

The directory name is the chapter's slug; it appears in build output and in
every path a reviewer sees, so name it for what the chapter is about rather
than for its position. A `ch3-` prefix is a rename waiting to happen the first
time something moves.

## Back matter: glossary and acronyms go at the end

Owner, 2026-11-02: every document opens on its title and summary, never on a
reference list, and the same skeleton holds across documents:

| Part | Chapters, in order |
|---|---|
| Front | title page and front matter (acknowledgements, publication data), executive summary or abstract, how to use |
| Main | the numbered chapters |
| Back | Annexes or Appendices, then **Glossary**, then References |

**Acronyms are a section of the Glossary chapter, never a chapter of their
own.** An acronym is a glossary term's SKOS `notation` (`folio-glossary/v1`), so
the acronyms list is one view of the glossary graph: the Glossary chapter holds
the terms first and the acronyms after them.

When a source publication prints its glossary or abbreviations up front (WHO
handbooks often do), the folio still puts them at the back. Move the section
into the `glossary/` chapter by moving its block files (blocks resolve from
their chapter's directory) and **keep every label**: review comments, review
sheets and contributor logs cite them. Then regenerate or update
`review-anchors.json`, and fix any `<chapter>/<block>` paths in L1-coverage
or glossary-table registries.

`bun run folio-assistant-core/scripts/back-matter-order.ts --document <doc>`
warns when a document breaks this. It is warn-only: moving a chapter in an
existing document is its editor's call.

## Reordering

Move the entry in `chapters[]` — nothing else. Do **not** rename directories
to encode order: labels, `uses[]` targets, feedback records and QA sidecars
all key on names, and a rename breaks every one of them for a change that the
manifest already expresses. Then `bun run review:anchors`, as after adding one.

After any reorder, re-read `uses[]` across the moved chapter: an editorial
edge that pointed backwards may now point forwards, which is a real finding
about reading order rather than a mechanical detail.

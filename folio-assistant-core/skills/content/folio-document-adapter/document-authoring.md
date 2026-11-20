---
input: schemas/skills/document-authoring/input.schema.json
output: schemas/skills/document-authoring/output.schema.json
---

# document-authoring

Author a **document** folio: policy guidance, a standard, a report, a
handbook — anything whose content is structured prose rather than machine-
checked mathematics.

## What a document folio is

The same content model as a paper, minus the formal layer:

```
folio/<slug>/
  <slug>.ts                   the document manifest (chapters, in order)
  <chapter-dir>/
    <chapter-dir>.ts        the chapter manifest (sections, in order)
    <block-root>.ts         one block manifest
    <block-root>.md         that block's narrative body
    <block-root>.qa.json    QA sidecar (machine-written; never hand-edit)
```

A block is the unit of authorship, review, feedback and QA. Its `.ts` carries
the metadata — label, title, `uses[]` — and its `.md` carries the prose. They
are separate files so a reviewer's diff is over prose, not over a manifest.

## The kinds you may use

`prose`, `recommendation`, `example`, `remark`, `algorithm`, `simulator`,
`equation`, `diagram`, `figure`, `table` (the `document`-profile nodes in
`block-kinds/`).

**Not** `definition`, `theorem`, `lemma`, `proposition`, `corollary`,
`conjecture`, `proof`. Those seven are the paper profile: their assertion is a
formal mathematical claim backed by a `.lean` sibling, and a document folio
has no Lean toolchain to check one. `content_profile_check` enforces this, and
`content_validate` runs it on every pass.

If you find yourself wanting a `theorem`, you want one of two things:

- a **normative statement** — a recommendation, a requirement, a rule. See
  `normative-statements` for how to carry one in this profile, and read it
  before reaching for a math kind.
- an actual theorem — in which case this folio is a paper. Change the
  layer's `index.config.json` entry to `"contentType": "paper"`
  deliberately (the index is the one config), and know that
  you are taking on Lean and TeX as dependencies.

## Adding a block

1. **Find the section it belongs to.** `content_list` shows the tree. A block
   only reaches the output if a section's `blocks[]` names it — writing the
   files is not enough, and a block nobody lists renders nowhere and is swept
   by nothing.
2. **Write `<root>.ts`** — the builder call for the kind, with `label`,
   optional `title`, and `uses[]`.
3. **Write `<root>.md`** — the prose. GitHub-flavoured Markdown; tables,
   footnotes and raw HTML all survive to the output unchanged, because the
   document render path assembles Markdown rather than translating it.
4. **Add the root name to the section's `blocks[]`**, in reading order.
5. **`content_validate`** before you consider it done.

## `uses[]` is editorial, and it is yours to maintain

`uses[]` lists the blocks a **reader** must already have read to follow this
one. It is a judgement about narrative order, not a mechanical fact — nothing
derives it and nothing should. In a paper folio there is a machine-derived
formal graph alongside it; in a document folio there is not, so `uses[]` is
the *only* dependency signal the corpus carries. Every ordering metric, every
impact question ("what has to change if this recommendation changes?"), and
the reading-order review read it.

List **direct** neighbours only. If A needs B and B needs C, A lists B.

## Rendering

`document_render_md` assembles the whole folio into one Markdown file — run it
to inspect ordering before you render anything else. `document_render_html`
and `document_render_pdf` go through pandoc; the PDF path uses an HTML engine
(weasyprint, prince, wkhtmltopdf) and **never** falls back to LaTeX. If no
engine is installed it says so.

## What belongs in the folio, and what belongs here

Subject matter — the actual recommendations, the vocabulary, the chapters —
lives in the **folio repo**, as content. This platform holds the formalism.
If you are about to add a domain constant or a subject-specific rule to
folio-assistant, you are in the wrong repository.

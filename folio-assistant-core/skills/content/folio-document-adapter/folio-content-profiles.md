---
name: folio-content-profiles
description: >-
  The content-folio half of the harness's content-profiles skill: how a
  document folio is structured prose and how a paper folio extends it, block-kind
  discovery across block-kinds/ graphs, profile-check enforcement, and the
  TeX-free document render path.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
graph-typologies:
  - folio
---

# Folio content profiles — `document` base and `paper` extension

The harness skill [`content-profiles`](../../../../cat-harness/skills/authoring/authoring-core/content-profiles.md)
defines why **adapters** (disjoint code/runtime namespaces) and **profiles**
(nested vocabulary subsets) are separate axes. For content folios built on
`folio-assistant-core`, this skill states how the `document` and `paper`
profiles instantiate those rules.

## 1. `document` is the base; `paper` extends it

- A **`document`** folio is structured prose: policy guidance, a standard, or a
  technical report ([`document-structure`](document-structure.md)).
- A **`paper`** folio extends `document` with block kinds whose assertion is a
  formal mathematical claim (`definition`, `theorem`, `lemma`, `proposition`,
  `corollary`, `proof`, `conjecture`), backed by machine-checkable `.lean`
  siblings and a TeX pipeline.
- Every block kind is a `folio-block-kind/v1` node in its owning layer's
  `block-kinds/` graph with a required two-valued `profile` field (`document`
  or `paper`), from which `BLOCK_KINDS`, `DOCUMENT_BLOCK_KINDS`, and
  `MATH_BLOCK_KINDS` in `schemas/content/block-kinds.ts` are derived.

## 2. Profile enforcement and TeX-free document rendering

- **Profile enforcement (`profile-check.ts`):** checks on every validation that
  (1) every block's kind belongs to the folio's active profile, and (2) in a
  `document` folio, no block carries a `lean` field or a `.lean` sibling (even
  on shared kinds like `remark`, `example`, `algorithm`, or `simulator` where
  the schema marks `lean` optional).
- **TeX-free document render path:** `document_render_{md,html,pdf}` assemble
  the folio to Markdown and drive Pandoc (with `weasyprint`, `prince`, or
  `wkhtmltopdf` for PDF), never falling back to `latexmk`.
- **Normative statements:** carried by `recommendation` blocks per
  [`normative-statements`](normative-statements.md), never by `definition`.
- **Extracted-statement pages:** when source documents are added to the
  folio's working artifact, the standard step
  [`publish-extracted-statements`](../../library/ingestion/publish-extracted-statements.md)
  publishes every statement extracted from them, each linked to its library
  entry and section. The step is the same for every profile; the profile's
  adapter decides only how those pages look in its artifact (pages of a
  document, an appendix of a paper, pages of an implementation guide).

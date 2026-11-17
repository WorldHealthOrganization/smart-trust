---
$schema: folio-memory/v1
id: there-is-no-recommendation-block-kind
label: stable
summary: "there is no `recommendation` block kind"
createdAt: 2026-09-19
archived: true
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
> **Archived 2026-10-10: no longer true.** Bean `55ao` added the
> `recommendation` block kind: a node in `folio-assistant-core/block-kinds/`,
> typed by cat-harness as `RecommendationBlock`, with `strength` as a code in a
> declared code list. Kept rather than deleted, as the record of the interim
> convention: content authored as a labelled `prose` block converts by changing
> one builder call.

A normative statement is a labelled, titled `prose` block; the convention and
its limits are in `folio-assistant-core/skills/content/folio-document-adapter/normative-statements.md`. A
real kind means a builder, a Zod schema, a label prefix, viewer registration,
constraint rows and QA criteria — about **thirty files** — and is tracked
separately rather than half-done.

Known-wrong and predating the document profile: `document-intake.md` maps
guideline recommendations onto `definition`, which is wrong for a document
folio, where `definition`'s `lean` field is required.

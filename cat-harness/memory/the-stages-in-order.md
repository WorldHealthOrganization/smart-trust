---
$schema: folio-memory/v1
id: the-stages-in-order
label: stable
summary: "the stages, in order"
createdAt: 2026-09-19
archived: true
---
> **Archived 2026-09-19.** Its only reader, the `content-pipeline-navigator`
> subagent, was retired. Kept rather than deleted: the record of what was
> learned outlives the mechanism that carried it, which is why a work item is
> `scrapped` and not removed. Not injected into any agent's prompt —
> `platform-boundary-guard` was already at 189 of its 200 lines, so there
> was nowhere to put it without pushing an entry past the line the harness
> silently truncates at.

```
.ts manifests + .md content
  → Zod schema validation (shape + types)          schemas/constraints.ts
  → constraint rules (file existence, cross-refs, lean requirements)
  → profile check (kind-within-profile)            pipeline/profile-check.ts
  → render (LaTeX or Markdown)                     render-latex.ts / render-markdown.ts
  → AST validation of the rendered output
  → chapters/*.tex  or  one assembled .md
```

---
$schema: folio-memory/v1
id: adding-a-block-kind-is-30-files-not-one
label: trap
summary: "adding a block kind is ~30 files, not one"
createdAt: 2026-09-19
archived: true
---
> **Archived 2026-09-19.** Its only reader, the `content-pipeline-navigator`
> subagent, was retired. Kept rather than deleted: the record of what was
> learned outlives the mechanism that carried it, which is why a bean is
> `scrapped` and not removed. Not injected into any agent's prompt —
> `platform-boundary-guard` was already at 189 of its 200 lines, so there
> was nowhere to put it without pushing an entry past the line the harness
> silently truncates at.

Builder, Zod schema, label prefix, viewer registration, constraint rows, QA
criteria. **There is no `recommendation` kind**: a normative statement is a
labelled, titled `prose` block
(`folio-assistant-core/skills/content/folio-document-adapter/normative-statements.md`). Enumerate the cost
before starting rather than half-doing it.

Known-wrong and predating the document profile: `document-intake.md` maps
guideline recommendations onto `definition`, which is wrong for a document
folio, where `definition`'s `lean` field is **required**.

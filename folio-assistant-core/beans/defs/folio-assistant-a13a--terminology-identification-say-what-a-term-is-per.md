---
# folio-assistant-a13a
$schema: bean/1.0.0
title: 'TERMINOLOGY / identification: say what a term IS, per asset kind — and what is not'
status: scrapped
type: task
priority: normal
created_at: 2026-09-25T04:51:47Z
updated_at: 2026-09-29T22:01:05Z
parent: folio-assistant-5yhm
---

**SCRAPPED 2026-09-29 — superseded on `main` before this bean was ever
committed.** Not deleted: a scrapped bean stops the next agent re-entering a
dead end, and this one would read as an obvious gap to anybody who had not
checked.

Written 2026-09-25 to ask "what IS a term, per asset kind, and what is not",
on the reading that `glossary-page.ts`'s rule was implicit. It is not implicit
any more. [`glossary-terms`](../../skills/library/cataloguing/glossary-terms.md)
§"Extracted terms" now states it:

- `folio-assistant-core/scripts/glossary-extract.ts` extracts a `candidate`
  from every KG asset carrying a title and a description — skills, Tool nodes,
  BPMN tasks and call activities, DMN decisions, and schema fields with a doc
  comment.
- One scheme per asset type per instance (`kg-skills`, `kg-tools`,
  `kg-bpmn-activities`, `kg-dmn-decisions`, `kg-schema-fields`), and the `kg-`
  prefix is reserved — an authored scheme taking it fails `check:glossary`.
- **What is NOT a term is stated**: BPMN lanes and roles are excluded because
  the swimlane ledger carries them.
- Three states, not two: `authored`, `candidate`, `could-not-extract` with its
  reason.

The one residue — how `skos:prefLabel` and `dcterms:title` relate — was bean
`sl9u`, now completed, and `vocabulary-authority` §"DC ↔ SKOS: the overlap,
and what stops the drift" carries the answer.

Nothing here is lost. The live remainder of the terminology ask is `7wou`
(the check against an external authority), `2i5f` (adjudication) and `ejug`
(a terminology service as a Tool), all under `5yhm`.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
any more. `glossary-terms` (now `folio-assistant-core/skills/library/cataloguing/glossary-terms.md`)
```

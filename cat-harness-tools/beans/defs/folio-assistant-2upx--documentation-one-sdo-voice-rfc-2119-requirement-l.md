---
# folio-assistant-2upx
$schema: bean/1.0.0
title: 'DOCUMENTATION: one SDO voice, RFC 2119 requirement levels, and the pages the knowledge graph is missing'
status: completed
type: epic
priority: high
created_at: 2026-09-21T16:21:34Z
updated_at: 2026-10-26T13:10:00Z
parent: folio-assistant-rwmf
---

Owner, 2026-09-21. A large body of direction on documentation, captured here as the frame; the children carry the work.

**The writing standard.** We are writing as an SDO writes — W3C, IHE. Glossary Terms are Capitalized throughout. Requirement levels follow RFC 2119 (MUST / MUST NOT / REQUIRED / SHALL / SHALL NOT / SHOULD / SHOULD NOT / RECOMMENDED / MAY / OPTIONAL). The RFC is queued at `uploads/rfc2119-key-words-requirement-levels.pdf` and MUST be ingested before the voice cites it.

**The review discipline, applied after every first draft:**
1. *Have I repeated anything?* If so, consolidate.
2. *Does the content flow in logical order?* If not, apply the detangler (bean `j79e`).
3. *Is this Term defined?* If not — is it defined later, is it in the Glossary, does it need a Glossary entry (used in several places, or only here)?

**Scope.** All the documentation eventually; **bootstrap and cat-harness first**. Skills and `docs/` SHOULD share content rather than restate it, so both consolidate and the docs point at `skills/` for rendering where the skill was written correctly. Some documentation will need splitting between folio-assistant and cat-harness — that is expected. Clean up what you touch; bean what you do not.

**Extract skills as the documentation is refined** — the skills are an output of this work, not a precondition.

## Not duplicating
`lqo9` already owns the Glossary content kind; this epic ALIGNS to it rather than restating it. `j79e` owns the detangler. `rkqp` owns model-specific voices. `zzmr` owns the KG's structure. `x3bd` owns top-level topical KG directories. `b5f0` owns what instantiation means. `3q47` owns setting agent context from the KG per task.

## Completed (2026-10-24)
All 10 child beans of `folio-assistant-2upx` are `completed` (`1gf7`, `5qq3`, `88mg`, `bnuy`, `ibxa`, `kjbb`, `q7ey`, `qh1s` via `litlfred/cat-harness#464`, `rn3o`, `vq8o`), and the referenced sibling beans (`lqo9`, `j79e`, `rkqp`, `x3bd`, `3q47`) are also `completed`.


**Closed 2026-10-26.** All 15 children are completed and the RFC 2119 source is ingested (`cat-harness/library/rfc2119-key-words-requirement-levels`), so nothing in this subtree is open (check:bean-rollup).

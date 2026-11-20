---
# folio-assistant-h3rw
$schema: bean/1.0.0
title: Ingest three Lean-autoformalization papers into folio-assistant-sci (library + methodologies + skill pointers)
status: completed
type: task
priority: normal
created_at: 2026-09-29T21:44:37Z
updated_at: 2026-09-29T22:19:12Z
parent: folio-assistant-slw1
---

Owner: 'review and ingest into skills and methodologies for lean formalziation as f-a-sci. as appropriate'. Papers: arXiv:2601.22554v1 (LeanArchitect), arXiv:2406.01940v2 (Process-Driven Autoformalization / FormL4), arXiv:2602.16554v1 (MerLean).

## Todo
- [x] Ingest the three PDFs into folio-assistant-sci/library (L1, images described, promoted)
- [x] Declare folio-assistant-sci/methodologies/ and write one methodology node per paper
- [x] Point the existing Lean skills at them where each applies (no duplication)
- [x] Gates, commit, push

## Summary of Changes

- Ingested arXiv:2601.22554v1 (LeanArchitect), arXiv:2406.01940v2 (Process-Driven Autoformalization) and arXiv:2602.16554v1 (MerLean) into `folio-assistant-sci/library/`, L1 complete and promoted; all 15 extracted images opened and given verdicts (8 figure, 6 decorative, 1 logo), every narrative a draft.
- Declared `folio-assistant-sci/methodologies/` (in `folio-assistant-sci.json` as `sci-methodologies`, and repository-scoped in `cat-harness/cat-harness.json` as `folio-assistant-sci-methodologies`) and wrote one methodology node per paper: `blueprint-driven-formalization`, `process-driven-autoformalization`, `bidirectional-agentic-autoformalization`.
- Pointed six existing Lean skills at them (lean-formalization, lean-generation, lean-formal-graph, proof-narrative-lean-equivalence, lean-proof-vacuity-audit, lean-build-fix) without restating the nodes.
- Regenerated the derived artefacts; `bun run cat gates` 171/171 green.

## Open for the owner

- Whether to adopt LeanArchitect itself, or derive blueprint `\uses`/`\leanok` from the formal graph this platform already builds.
- The licence of the three papers is not recorded (`source-licence` reports them `not-recorded`, as it does 34 others).

---
# folio-assistant-0js9
$schema: bean/1.0.0
title: 'INGEST + METHODOLOGY: five subject-indexing papers (SemEval-2025 Task 5 x3, LCSH agentic pipeline, LCSHBench)'
status: completed
type: task
priority: normal
created_at: 2026-09-24T19:46:16Z
updated_at: 2026-09-26T12:13:49Z
parent: folio-assistant-slw1
---

Ingest five open-access subject-indexing papers into `cat-harness/library/`, and adopt the methodology they support. The platform library holds only sources a methodology cites (`library-ref.test.ts`), so the ingest and the methodology nodes have to land together.

## The five sources

| bib-slug | paper | role |
|---|---|---|
| `arxiv-2605.03537v1` | Chow, skill-based agentic pipeline for LCSH indexing | primary for `skill-pipeline-subject-indexing` |
| `arxiv-2504.19675v2` | Annif at SemEval-2025 Task 5 (XMTC + LLMs) | parallel track, recorded there |
| `arxiv-2504.21474v1` | Homa at SemEval-2025 Task 5 (OntoAligner, RAG) | parallel track, recorded there |
| `arxiv-2606.04382v1` | LCSHBench | primary for `consensus-grounded-subject-evaluation` |
| `arxiv-2504.07199v3` | SemEval-2025 Task 5 overview | parallel evaluation design, recorded there |

## Why two nodes and not one

Producing an assignment and judging one are different questions. Five papers blended into one "subject indexing" node would be the composite that `methodology-adoption` forbids.

## Done when

- [x] five sources ingested (c43ae1b, PR #1290)
- [x] eight images judged into `cat-harness/library/image-verdicts.json`
- [x] `methodologies/skill-pipeline-subject-indexing.md` written from the primary, read whole
- [x] `methodologies/consensus-grounded-subject-evaluation.md` written from the primary, read whole
- [x] every entry in `cat-harness/library/` cited by a methodology (`library-ref.test.ts`)

## Summary of Changes

Ingest by the original session in PR #1290. The two methodology nodes, this body and the parent were added 2026-09-26 in the same PR, on the owner's decision to finish #1290 rather than split it. Neither node claims a consumer: no skill here assigns subject terms yet. Both say so.

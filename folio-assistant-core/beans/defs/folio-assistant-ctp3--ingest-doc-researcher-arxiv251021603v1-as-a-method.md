---
# folio-assistant-ctp3
$schema: bean/1.0.0
title: INGEST Doc-Researcher (arXiv:2510.21603v1) as a methodology subgraph in folio-assistant-core
status: completed
type: task
priority: normal
created_at: 2026-09-23T21:14:08Z
updated_at: 2026-09-24T00:15:16Z
parent: folio-assistant-slw1
---

Owner's request, 2026-09-23: *"ingest methdolofy subgraph. develop processes skills etc.
apply to folio-asst-core"*, then *"it is part of f-a-c subgraph"*.

Dong et al., **"Doc-Researcher: A Unified System for Multimodal Document Parsing and
Deep Research"** (arXiv:2510.21603v1, Huawei, 24 October 2025). Open access.

## What went in

Four new declared directories on `folio-assistant-core`, each declared twice —
locally in `folio-assistant-core.json` (`core-library`, `core-methodologies`,
`core-skills`, `core-processes`) and repository-scoped in `cat-harness.json`.

| node | what it carries |
|---|---|
| `methodologies/doc-researcher.md` | the method, what the paper MEASURED against what it claimed, and a comparison table against this checkout's existing ingestion |
| `skills/deep-document-research.md` | the part an agent acts on — the loop, the two stopping conditions, the three things not to adopt |
| `processes/deep-document-research.bpmn` | one lane, `deep-researcher`, the loop drawn with both exits |
| `scenarios/roles.json` → `deep-researcher` | the accountability: somebody stands behind a synthesis and its citations |
| `.claude/skills/actors/deep-researcher.json` | an agent actor who may take that role |

## The two real gaps the comparison found

Read from the pipeline, not assumed — `methodology-adoption` §"Extract the PROCESS,
not the paper's tools" requires the comparison before any tool is proposed.

1. **Four granularities, not one.** The method parses once and assembles at
   `{chunk, page, full, summary}` so that a LATER step can choose per query.
   `l1-blocks.ts` produces blocks; sections exist; there is no `summary` level and
   no per-query choice. A pipeline that picks once has answered every future
   question the same way, which is the condition this method exists to escape.
2. **The loop is not modelled anywhere else.** Planner / Searcher / Refiner /
   Reporter against a sufficiency threshold — the BPMN is the first statement of it
   here, and nothing implements it.

Neither is built in this change, deliberately: the node records where the gap is,
and building either is a separate decision with the owner.

## What was deliberately NOT adopted

- **MinerU, Qwen2.5-VL, UniMERNet** — the paper's tools, not obligations.
- **M4DocBench** — 158 questions over the authors' own 304 documents measures their
  corpus, not this one.
- **50.6% and "3.4× baselines"** — measured on a benchmark the same authors built.
  Quoting them here would be evidence for a claim nobody tested.
- **σ**. The paper gives sufficiency a symbol and a threshold and never says how it
  is computed. That is the load-bearing quantity in the whole loop, and inventing
  one would bury a judgement in a number. `GW_Sufficient` carries
  `<folio:judgement>` for exactly that reason.
- **Machine descriptions as fact.** The paper converts figures to text with a VLM
  and uses the output. Here an agent's description is a `draft` and only a person
  confirms it. This checkout is STRICTER and stays so.

## The primary is HELD but NOT PROMOTED

`bun run cat ingest` staged it as `arxiv-2510.21603v1` — 22 blocks and a manifest. Its
`image-descriptions` requirement is unmet and cannot be honestly met: the extractor
placed **383** images against 7 captioned figures, 335 of them from page 3 alone.
Writing 383 descriptions would be the fabrication `document-image.ts`'s inspection
basis exists to refuse.

So `origin:` names the paper and `evidence:` is **omitted** rather than pointed at a
staged entry. `check:methodology-evidence` will list it, correctly, alongside the
others in that state. Split to bean `j820` rather than worked around.

## Done when

- [x] methodology node, skill, BPMN, role, actor
- [x] both declarations, layout-norms clean (the BPMN is at a TOP-LEVEL
      `folio-assistant-core/processes/`, not `methodologies/processes/`, which
      `check:layout-norms` refuses as a double declaration)
- [x] `bun run cat gates` — 136/136
- [ ] issue + PR
- [ ] owner merges

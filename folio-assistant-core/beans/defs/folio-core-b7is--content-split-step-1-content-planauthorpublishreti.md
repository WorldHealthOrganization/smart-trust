---
# folio-core-b7is
title: 'Content split steps 1-3: lifecycle operation, diff and the glossary LaTeX half move up from cat-harness'
status: completed
type: task
created_at: 2026-11-08T07:10:54Z
updated_at: 2026-11-08T07:10:54Z
---

Content split step 1 (folio-assistant bean `0r7u`, step 1; owner ruling 2026-10-06 "split method from operation", cut chosen 2026-11-08: option 1, split by caller).

The four lifecycle skills no cat-harness process calls move up from `cat-harness/skills/authoring/content-lifecycle/` into this layer's `content-lifecycle-ext` package: `content-plan`, `content-author`, `content-publish`, `content-retire`, with the input/output contracts of the first three. The harness keeps `content-review`, `-validate`, `-test` and `-feedback`, which its own SDLC processes (adjudication, narrative-code-review, qa-report-signing, upstream-version-adoption, review-task, review-narrative) call.

- [x] core: the four skill bodies and three contracts added; package manifest lists them
- [x] core: harness roles.json bindings re-expressed as role extensions (author, qc-reviewer, programme-manager, publication-manager, authoring-agent, build-pipeline)
- [x] cat-harness: the four bodies, contracts and role bindings removed; staying prose reworded so it names none of them
- [x] core PR green and merged — lands with litlfred/folio-assistant-core#676
- [x] cat-harness PR green and merged (after core) — litlfred/cat-harness#1136
- [x] folio-assistant index re-pin — follows the merges in folio-assistant, not in this layer

## Steps 2 and 3 (owner, 2026-11-08: option 1, keep the refinement pattern)

The generic skill stays in cat-harness as the METHOD; the operation is a refinement above it. Per item, measured on cat-harness main `42d4f15` (no cat-harness process calls any of these):

| item | outcome |
|---|---|
| getting-started | split; refinement exists: core `folio-getting-started` |
| repo-conversion | split; refinement exists: core `folio-repo-conversion` |
| board-windows | split; refinement exists: core `folio-board-windows` |
| board-diagram-interchange | split; refinement exists: core `folio-board-diagram-interchange` |
| evidence-appraisal | stays: already a content-type-neutral procedure ("names no system"); refined by core `folio-content-lifecycle` and smart-base `grade`. Its mentions of core's `evidence-retrieval.bpmn` tasks reworded (cat-harness#1136) |
| editor, content-graph, md-authoring, canonical-watcher, uses-editorial-review | split; refinement exists: core `folio-editorial-workflow` |
| content-profiles | split; refinement exists: core `folio-content-profiles` |
| one-voice-audit, chapter-complexity-review, readability-editing | split; refinements exist: sci `paper-voice-audit`, `paper-chapter-complexity`, `math-readability-editing` |
| milnor-exposition-standard, compute-/detangler-integration-watcher | already moved to sci |
| review-comments | already moved to core |
| block-density, devils-advocate-watcher, evidence-review, exposition-swarm-drain, integration-audit, one-voice-integration-watcher, one-voice-style-guide, production-vs-exploratory-discipline, review-heatmap, scientific-accuracy, todo-review, voice-* (3), technical-documentation | stay as method; no refinement needed now (none names a higher layer) |
| diff (step 3) | moves to core `content-lifecycle-ext` with its `/diff` command and the session-coordinator binding, in a follow-up after cat-harness#1136 merges: adding it here first declared it twice in the composed checkout (`skill:commands`, `uml:overview`, `skills:docs` failed on #676). Bean folio-core-knsj tracks it |
| html-rendering-qc (step 3) | already split: its math rows are sci `math-render-check`. Finding, not fixed here: it describes a `ui/app.js` viewer that no layer holds any more |
| glossary-build (step 3) | split: the LaTeX chapter, `.tex` markers and Lean synonyms module go to sci `paper-glossary-build` (litlfred/folio-assistant-sci PR); core keeps the index, SKOS scheme, Markdown markers and rules |
| staging-review (step 3) | kept whole: five cat-harness diagrams call it |
| docs-generation | unchanged: names sci's skills only conditionally ("where that layer is mounted"), no repository |

## Summary of Changes
- core: `content-plan`, `content-author`, `content-publish`, `content-retire` (with the three contracts) in `content-lifecycle-ext`; role extensions for author, qc-reviewer, programme-manager, publication-manager, authoring-agent and build-pipeline; `folio-content-lifecycle` links them locally; `glossary-build` loses its LaTeX half
- cat-harness: the same skills, contracts, bindings and command removed; staying prose reworded; three orphan schema pages removed
- sci: new `paper-glossary-build`
- cat-harness-tools: `gen-schema-docs` reports orphan schema pages (13 older ones listed for a person to delete)

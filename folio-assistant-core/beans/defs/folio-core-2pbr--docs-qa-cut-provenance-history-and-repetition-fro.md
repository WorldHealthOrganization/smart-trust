---
# folio-core-2pbr
$schema: bean/1.0.0
title: 'Docs QA: cut provenance, history and repetition from reader docs'
status: completed
type: task
priority: normal
tags:
    - docs
    - docs-qa
created_at: 2026-11-03T00:00:00Z
updated_at: 2026-11-04T08:00:00Z
---

Review every reader-facing text in folio-assistant-core (the Markdown sources
under `docs/` and `skills/`, the BPMN documentation text under `processes/`,
the Tool node text under `tools/`, and `README.md` / `AGENTS.md`) for a
reader who wants to understand, use, change or render the knowledge graph.

Each finding is classed `bean-ref`, `owner-decision`, `proposal-ref`,
`history`, `wordy` or `stale-or-wrong`. Every fact a reader or agent needs
stays, said once; only its provenance goes.

Generated pages (`docs/concepts`, `docs/guides`, `docs/process`, the
translations, every `README.md` written by `subgraph-readmes.ts`) are fixed at
their sources.

## Done when

- [x] findings recorded as JSON and published as the QA report
- [x] findings applied, wrong facts first
- [x] the repository's fast checks run on what changed
- [x] one pull request opened, linking the report, with the word totals

## Summary of Changes

800 findings applied across 154 reader texts (skills, doc sources, BPMN
documentation, Tool node text, README, AGENTS.md and the directory
descriptions in `folio-assistant-core.json`): 123,327 words to 111,116.
QA report: https://claude.ai/artifact/EtC9iypiLtZw5QpAm5biC7. The English
doc pages, 13 BPMN checklists and the directory READMEs were regenerated;
translations are left to the translation pipeline.

---
# folio-assistant-mcsm
$schema: bean/1.0.0
title: 'Voice docs pages + WHO library ingestion: per-voice documentation, PDF extraction, JSON-LD graph (issue #208 follow-up)'
status: completed
type: task
priority: normal
created_at: 2026-09-25T15:35:23Z
updated_at: 2026-10-21T19:42:00Z
parent: folio-assistant-slw1
---

_2026-10-06_ — recovered from the stray root `.beans/` directory (leftover of the 2026-09-18 `.beans` -> `beans` rename), where the bean tooling could not see it; parented under the INGEST epic. Its work (voice docs pages, WHO library ingestion, issue #208 follow-up) needs re-checking against what has since landed before it is worked or closed.

## Closed 2026-10-21 — re-checked against main

All deliverables for issue `#208` (closed 2026-09-26) and its follow-up (`r1lz`, `w095`, `bfmf`) are live on `main`:
- **Per-voice documentation & viewer:** `cat-harness/docs/guides/voices.md`, `cat-harness/docs/processes/voice-review.md`, and the interactive HTML viewer at `cat-harness/docs/en/cat-harness/voices/`.
- **WHO library ingestion & JSON-LD graph:** `who-iris/library/who-pub-tps-931` (121 sections), `who-iris/library/9789241548960-eng` (250 sections), and `who-iris/library/wpr-rdo-2020-003-eng` (33 sections), each with `structure.json`, `sections/*.md`, `manifest.jsonld`, and `blocks/*.jsonld`.
- **Verification:** `bun run cat check:voices` passes (`Voice graph (49 voices, 180 rules) — every rule cites a source that resolves, with a quote long enough to check`).

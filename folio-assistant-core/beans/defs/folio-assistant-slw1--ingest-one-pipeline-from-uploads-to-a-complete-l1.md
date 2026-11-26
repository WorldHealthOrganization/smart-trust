---
# folio-assistant-slw1
$schema: bean/1.0.0
title: 'INGEST: one pipeline from uploads/ to a complete L1 library'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:43Z
updated_at: 2026-11-01T23:05:00Z
parent: folio-assistant-npuo
---

The `uploads/` → `library/` path, and what "complete" means at L1.

Nine of these are the per-format arms (audio, images, CSV, archives, technical
metadata, provenance, round-trip translation QA) and two are the spine: `apui`
gives them ONE documented entry point, and `pn6j` is the gate that says the
derived content is actually present before L1 counts as complete. Without the
spine the arms are nine scripts nobody can run in order; without the arms the
gate has nothing to check.

`r1lz` sits here rather than under voices: ingesting the three WHO style guides
INTO `library/` is this pipeline's job, and deriving voices from them is what
happens afterwards.

## Closed 2026-11-01

Its last open child, `x80s`, is completed. Every other child was already completed or scrapped in this store. The person review of the summary drafts is bean `pvq4`, outside this epic (owner, Q-CM-2 A).

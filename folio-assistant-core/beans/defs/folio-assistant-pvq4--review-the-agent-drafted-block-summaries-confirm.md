---
# folio-assistant-pvq4
$schema: bean/1.0.0
title: 'REVIEW: a person confirms or rejects the agent-drafted block summaries'
status: todo
type: task
priority: normal
tags:
    - human-review
created_at: 2026-11-01T23:05:00Z
updated_at: 2026-11-01T23:05:00Z
---

Split out of `x80s` on the owner's choice (Q-CM-2 option A, 2026-11-01, project thread "Build the content-model machinery"). The drafting machinery and the drain are done. What is left is a person's act, and it no longer holds GOAL 5 (`npuo`) open.

Every summary in a `library/<slug>/summaries.json` sidecar is an **agent draft** (`state: draft`). **None is human-adjudicated** until a person confirms or rejects it with `bun run cat narratives`. The tool refuses to run outside a terminal, and `summaries:record` cannot write anything but drafts.

## Todo

- [ ] Confirm or reject the drafts with `bun run cat narratives`. `bun run cat summaries` gives the current figure. On 2026-11-01 it was about 4,900 drafts and 0 confirmed, after the C2PA 2.5 and DSpace 7 drains.
- [ ] While reviewing, check the source oddities noted during the drain (/mnt/project-files/x80s-drain-2026-11-01/source-oddities.md). Two of them may be extraction defects in C2PA: a garbled bullet in 16.6.1.1, and a stray "== Information security" in B.2.

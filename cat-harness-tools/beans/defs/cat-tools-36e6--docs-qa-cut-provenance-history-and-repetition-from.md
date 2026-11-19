---
# cat-tools-36e6
title: 'Docs QA: cut provenance, history and repetition from reader docs'
status: completed
type: task
priority: normal
created_at: 2026-11-03T16:14:56Z
updated_at: 2026-11-04T13:10:16Z
---

Owner-requested docs QA of cat-harness-tools reader docs (README/AGENTS, subdirectory READMEs, skills, tools, scripts/schemas module headers). Classify findings (bean-ref, owner-decision, proposal-ref, history, wordy, stale-or-wrong), publish a QA report artifact, apply fixes, open one PR.

## Done

Merged as #1463 (root docs and directory descriptions), #1464 (`schemas/`
headers) and #1465 (`scripts/` headers): 311,939 words to 192,708 over 768
documents. QA report: https://claude.ai/artifact/6xMoPLRk412iT2hXKkqYfK

Follow-up: `generate-schemas.ts` and `generate-registry.ts` now give `bun run`
as their runner (the registry test runs it that way), and the
`instantiate-harness.ts` header, skipped because main changed it mid-review, is
cleaned. Commands written as `bun run <name>` without `cat` are the checkout
root's convention (every generator's `command:` field uses it), so they stay.

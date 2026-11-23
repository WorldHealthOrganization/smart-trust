---
# folio-assistant-afu3
$schema: bean/1.0.0
title: 'SEARCH PINNED: the magnifier stays on screen at every scroll position (#1732)'
status: completed
type: feature
priority: high
created_at: 2026-10-01T00:56:04Z
updated_at: 2026-10-07T20:30:00Z
parent: folio-assistant-o3xy
---

Owner, 2026-10-01: the search magnifier should ALWAYS be on screen, mid-page included. Issue #1732, follow-up to #1715/#1720. Branch claude/search-pinned.

## Completed on landed evidence

- Implementation landed on `main` in PR #1732 (commit `49828a5686a3`): search magnifier pinned to stay visible on screen across all scroll positions.
- Verified on `origin/main`.

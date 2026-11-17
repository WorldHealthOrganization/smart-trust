---
# folio-assistant-r2ld
$schema: bean/1.0.0
title: '''On this page'': sections with sub-sections are collapsible'
status: completed
type: task
priority: normal
created_at: 2026-10-05T14:39:33Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: 'on this page should have sub-sections collapsible'. Both surfaces: mountDocumentIndex (docs-ui.js) and documentIndexOf (navbar.ts, rail) — independent implementations of one rule; nest h3 under h2 as a closed disclosure.

## Done when
- [ ] theme sidebar and rail both nest h3 under their h2, closed by default
- [ ] e2e on both

_2026-10-05T15:28:15Z_ — Claimed by claude/vibrant-darwin-r6im60 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

Done in this branch: h3s fold under their h2 behind a closed 'N sub-sections' disclosure below the link, on both surfaces (docs-ui mountDocumentIndex; navbar.ts NavItem.fold via documentIndexOf). Unit + e2e added.

## Completed on landed evidence
Landed on main in PR #2214 / commit 9013f51b0bf1 (feat(navbar): 'On this page' sub-sections fold in navigation).

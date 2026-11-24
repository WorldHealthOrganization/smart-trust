---
# folio-assistant-eojz
$schema: bean/1.0.0
title: 'LANDING: the site''s landing instance is resolved from a site.landing flag, not the generator''s directory (#1904)'
status: completed
type: task
priority: normal
created_at: 2026-10-02T22:49:23Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-yj32
---

Issue #1904. Owner ruling 2026-10-02, verbatim: "Flag it, with a default (recommended). The chosen instance's own `<name>.config.json` carries `"site": { "landing": true }`. If exactly one harness is instantiated, it is the landing page and no flag is needed. That covers smart-trust. If there are several and none is flagged, a gate fails. If more than one is flagged, then neutral hub with listing of harnesses, todos,"

## Done when
- resolveLandingInstance(repoRoot) is the one resolver; check:landing-instance gate fails on ambiguous; sync-docs-harness, library-graph, schema-graph use it; cat-harness flagged; / unchanged for this repo.

Holder: claude/site-landing-instance, session https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB

## Evidence of completion (2026-10-07)
- Landed in PR #1904 / commit `555734e21eb2`: Landing instance resolution from `site.landing` flag in `<instance>.config.json` via `resolveLandingInstance`.
- Re-derived independently on 2026-10-07: `check:landing-instance` passing.

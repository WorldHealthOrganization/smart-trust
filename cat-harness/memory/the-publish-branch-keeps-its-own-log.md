---
$schema: folio-memory/v1
id: the-publish-branch-keeps-its-own-log
label: stable
summary: "`gh-pages` keeps an append-only render log at `_render-log/`"
createdAt: 2026-09-20
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
  - kind: agent
    id: ci-health-watcher
---
*What happened to `branches/<slug>`?* — `_render-log/<YYYY-MM-DD>.jsonl` at the
branch ROOT, outside `branches/` so `rm -rf "branches/$SLUG"` cannot reach it.

A full replace does NOT preserve it: `CARRIED_PREFIXES` in
`restore-staging.ts` carries it across, and `--verify` checks the carry as well
as the previews. Add a prefix there, never a third code path. Skill:
[`ui-core/render-logging.md`](../skills/ui/ui-core/render-logging.md).

---
# cat-tools-p4tr
$schema: bean/1.0.0
title: 'MCP TOOL PATHS NOT CONTAINED: translation, workflow, folio_init and nquads tools joined argument values into paths without safe-path'
status: completed
type: bug
priority: high
created_at: 2026-10-31T04:21:00Z
updated_at: 2026-10-31T04:21:00Z
parent: cat-tools-sr31
---

RED FLAG: security. Severity: major. Held privately until fixed.

Every path argument now goes through `src/core/safe-path.ts` (refused, never repaired). Locale must be BCP 47. `test/server-path-sinks.test.ts` now ratchets `src/tools` as well.

## Done when

- [x] Fixed in #1087 (issue #1085), merged d10e9c5.
- [x] Tests: `test/mcp-tool-path-containment.test.ts`.

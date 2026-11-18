---
# cat-tools-m1cp
$schema: bean/1.0.0
title: 'MCP ENDPOINT REACHABLE WITHOUT THE GATEWAY: the deploy Caddy config sent bearer-carrying /mcp requests past the auth gateway, and the server had no check of its own'
status: completed
type: bug
priority: critical
created_at: 2026-10-31T04:21:00Z
updated_at: 2026-10-31T04:21:00Z
parent: cat-tools-sr31
---

RED FLAG: security. Severity: critical. Held privately until fixed (owner, 2026-10-31, option A).

All /mcp traffic now goes through the gateway, which adds a shared `X-Folio-Gateway` secret. Both servers refuse /mcp without it, except on a loopback bind with no secret set.

## Done when

- [x] Fixed in #1088 (issue #1086), merged 3e17e94.
- [x] Tests: `src/core/tests/gateway-trust.test.ts`, `test/auth-gateway.test.ts`.

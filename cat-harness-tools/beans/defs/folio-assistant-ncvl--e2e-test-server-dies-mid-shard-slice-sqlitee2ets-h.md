---
# folio-assistant-ncvl
$schema: bean/1.0.0
title: 'E2E TEST SERVER DIES MID-SHARD: slice-sqlite.e2e.ts hits ERR_CONNECTION_REFUSED, passes on re-run (#2192, #2273)'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T11:19:19Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-1xhc
---

Reported 2026-10-06 by session A (session_01FrpbCpM7BWxGCPsu618MLr). On #2273, and on #2192 earlier, `slice-sqlite.e2e.ts` failed with ERR_CONNECTION_REFUSED: the Playwright webServer (`node test-server.mjs`) died partway through the shard. One re-run passed each time.

'Flake' is not a root cause. A server that dies under one spec is a defect either in that spec (a payload or slice size that crashes the server, a resource limit) or in the server.

## Done when
- [ ] The server's exit is captured: its stderr and exit code are attached to the Playwright report when a shard sees connection refused.
- [ ] The cause is named: which request kills it, and why.
- [ ] It is fixed at that layer, and a test reproduces the crash before the fix.

## Completed on landed evidence
Landed on main in commit 7f0cc26c6a2e (E2E test server connection error resolved).

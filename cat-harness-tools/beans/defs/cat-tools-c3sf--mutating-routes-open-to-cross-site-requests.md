---
# cat-tools-c3sf
$schema: bean/1.0.0
title: 'MUTATING ROUTES OPEN TO CROSS-SITE REQUESTS: /api/git/checkout and /api/chat had no permission check, wildcard CORS, and accepted text/plain'
status: completed
type: bug
priority: high
created_at: 2026-10-31T04:21:00Z
updated_at: 2026-10-31T04:21:00Z
parent: cat-tools-sr31
---

RED FLAG: data-loss, security. Severity: major. Held privately until fixed. Reproduced: a text/plain POST discarded the working tree.

Checkout now needs `content-authoring`, chat needs `review-comments` (edit mode needs `content-authoring`), both need application/json, and neither sends wildcard CORS. A branch starting with `-` is refused. Servers bind 127.0.0.1 unless `FOLIO_BIND_HOST` is set. Fixed in both `src/server.ts` and `adapters/mcp-server/server.ts`.

Follow-up open: viewers lost chat, and local use without the gateway gets 403 (owner's card, 2026-10-31).

## Done when

- [x] Fixed in #1088, merged 3e17e94.
- [x] Tests: `src/core/tests/mutating-routes.test.ts`.

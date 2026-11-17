---
# cat-tools-x2ua
$schema: bean/1.0.0
title: 'GATEWAY FORWARDED CLIENT IDENTITY HEADERS: a client-sent X-User-Actor reached the server, where it overrides the session role'
status: completed
type: bug
priority: high
created_at: 2026-10-31T04:21:00Z
updated_at: 2026-10-31T04:21:00Z
parent: cat-tools-sr31
---

RED FLAG: security. Severity: major. Held privately until fixed.

The gateway now strips every client `X-User-*` and `X-Folio-Gateway` header on both the session and bearer paths before it sets its own.

## Done when

- [x] Fixed in #1088, merged 3e17e94.

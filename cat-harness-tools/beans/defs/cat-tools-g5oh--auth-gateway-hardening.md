---
# cat-tools-g5oh
$schema: bean/1.0.0
title: 'AUTH GATEWAY HARDENING: OAuth state not bound to the browser, Google email not checked as verified, upstream env name mismatch'
status: completed
type: bug
priority: normal
created_at: 2026-10-31T04:21:00Z
updated_at: 2026-10-31T04:21:00Z
parent: cat-tools-sr31
---

RED FLAG: security. Severity: minor. Held privately until fixed.

Fixed in #1088: state is bound with a 10-minute HttpOnly cookie, `verified_email` is required, and compose sets `FOLIO_UPSTREAM`.

Not done: revoking a session when a user leaves the allowlist needs a server-side session store. `deploy/GOOGLE_OAUTH_SETUP.md` says so.

## Done when

- [x] State binding, verified email, env name (#1088).
- [ ] Server-side session revocation.

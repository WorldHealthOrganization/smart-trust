---
# folio-core-4kq2
$schema: bean/1.0.0
title: 'Public-comment dashboard inserted some values as HTML and allowed any link scheme'
status: completed
type: bug
priority: normal
tags:
    - security
    - security-review-2026-10-31
    - red-flag-security
created_at: 2026-10-31T04:21:22Z
updated_at: 2026-10-31T04:21:22Z
---

Found by the 2026-10-31 security review of the folio-assistant layers. Held privately until the fix merged, then filed (owner, option A).

**Where:** `scripts/public-comment-site.ts`.

**Fixed in** litlfred/folio-assistant-core#339 (merge `789f854`). Status and type cells are escaped in `fromRow`, and record links go through `safeHref`, which allows only http(s), relative and fragment URLs.

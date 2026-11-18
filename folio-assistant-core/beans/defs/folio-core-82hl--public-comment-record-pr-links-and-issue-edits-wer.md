---
# folio-core-82hl
$schema: bean/1.0.0
title: 'Public-comment record: PR links and issue edits were not role-checked'
status: completed
type: bug
priority: high
tags:
    - security
    - security-review-2026-10-31
    - red-flag-security
created_at: 2026-10-31T04:21:22Z
updated_at: 2026-10-31T04:21:22Z
---

Found by the 2026-10-31 security review of the folio-assistant layers. Held privately until the fix merged, then filed (owner, option A).

**Where:** `scripts/public-comment-changesets.ts` (pull-request path and issue `edited` path).

**Fixed in** litlfred/folio-assistant-core#339 (merge `789f854`). A PR links change-sets only when its author is an editor or committee member; an issue edit by someone other than the author no longer applies tags; login and association now come from the same person.

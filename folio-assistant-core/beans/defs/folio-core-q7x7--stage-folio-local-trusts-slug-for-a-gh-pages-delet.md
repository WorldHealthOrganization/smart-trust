---
# folio-core-q7x7
$schema: bean/1.0.0
title: 'stage-folio-local trusts --slug for a gh-pages deletion and serves files by unchecked path'
status: completed
type: bug
priority: high
tags:
    - security
    - security-review-2026-10-31
    - red-flag-data-loss
created_at: 2026-10-31T04:01:25Z
updated_at: 2026-10-31T04:22:00Z
---

Found by the 2026-10-31 security and QA review of the folio-assistant layers (SOP: cat-harness `skills/conduct/security/`, the 16 rules of `skills/voices/secure-code-authoring/voice.json`, RED FLAG categories of cat-harness-tools `schemas/sdlc/red-flag.ts`). No fix PR yet: fixes wait for the owner's go-ahead.

**Category:** data-loss · **Severity:** major

`scripts/stage-folio-local.ts`.

1. **`--slug` is never checked** (line 63) and then names a deletion and a publish: `git rm -r -q STAGING/${slug}` (line 145), `cpSync(site, join(work, "STAGING", slug))` (line 146), then `git push origin gh-pages`. A slug of `..` or `.` or one containing `/` makes the removal name all of `STAGING/` or the site root. This is the `fuzm` shape the security SOP cites (refuse, never repair). The CI path (`feature-staging.yml`) guards its slug by value; this local path does not.
2. **The check server does not contain its paths** (lines 98-108): `join(site, decodeURIComponent(url))` with no `resolveWithin` / `realPathWithin` (`src/core/safe-path.ts` in cat-harness-tools). `join` does not clamp `..`, so an encoded `..` reads outside `site`. `server.listen(0)` binds every interface, so the server is reachable from the local network while the check runs.

Rules: `scz-refuse-never-repair`, path-containment SOP.

## Done when

- [x] `--slug` is refused unless it matches the staging slug shape (same check as feature-staging.yml)
- [x] The server uses resolveWithin + realPathWithin and listens on 127.0.0.1
- [x] A test proves `..` is refused for both

## Summary of Changes

Fixed in litlfred/folio-assistant-core#338 (merge `cb28730`): `--slug` refused unless it matches the staging slug shape; the check server uses resolveWithin + realPathWithin and binds 127.0.0.1; tests added.

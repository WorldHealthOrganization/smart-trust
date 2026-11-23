---
# folio-core-0dy3
$schema: bean/1.0.0
title: 'folio-assistant-core cannot run the security gate'
status: completed
type: bug
priority: normal
tags:
    - security
    - security-review-2026-10-31
    - red-flag-false-green
created_at: 2026-10-31T04:01:25Z
updated_at: 2026-10-31T08:30:00Z
---

Found by the 2026-10-31 security and QA review of the folio-assistant layers (SOP: cat-harness `skills/conduct/security/`, the 16 rules of `skills/voices/secure-code-authoring/voice.json`, RED FLAG categories of cat-harness-tools `schemas/sdlc/red-flag.ts`). No fix PR yet: fixes wait for the owner's go-ahead.

**Category:** false-green · **Severity:** minor

`bun run cat security:gate` is not runnable in this repo, measured 2026-10-31:

- `package.json` declares no `check:*` scripts, so the gate's checks would be `unknown`.
- Run by hand with cat-harness-tools beside it, `check-secret-leaks.ts` dies on `Cannot find module '@litlfred/bootstrap-tools/schemas/release-iri.ts'` (the package is not on npm, it arrives by remote mount).
- `pin-actions.ts` crashes at line 299 because it reads `feature-staging.yml`, which only folio-assistant has.
- `check-workflow-injection.ts` runs, but against folio-assistant's baseline, so it reports 5 stale entries that belong to another repo.

So core's workflows (which hold write tokens, see the unpinned-actions bean in this store) are not checked by any gate here. They are checked only if a folio-assistant run happens to read them.

## Done when

- [x] core's CI runs the security gate over core's own workflows and reports pass/fail/unknown
- [x] The gate's scripts take the target root instead of assuming the folio-assistant layout

## Summary of Changes

Added `scripts/check-security-gate.ts` (`coreSecurityGate(root)` and `--root <dir>`) taking the target root explicitly across `check:workflow-injection`, `check:secret-leaks`, `check:lockfile-pinning`, `check:bun-pin`, `check:materialized-fixity`, `check:dependency-advisories`, and `action-sha-pinning` (reporting `pass`/`fail`/`unknown`), wired `check:core-security-gate` and `security:gate` in `package.json` and `folio-assistant-core.json`, and added `scripts/check-security-gate.test.ts`.

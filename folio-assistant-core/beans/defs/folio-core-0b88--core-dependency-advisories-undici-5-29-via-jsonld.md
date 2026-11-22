---
# folio-core-0b88
$schema: bean/1.0.0
title: 'Core dependency advisories: undici 5.29 via jsonld 8'
status: completed
type: bug
priority: normal
tags:
    - security
    - security-review-2026-10-31
    - red-flag-security
created_at: 2026-10-31T04:01:25Z
updated_at: 2026-10-31T08:30:00Z
---

Found by the 2026-10-31 security and QA review of the folio-assistant layers (SOP: cat-harness `skills/conduct/security/`, the 16 rules of `skills/voices/secure-code-authoring/voice.json`, RED FLAG categories of cat-harness-tools `schemas/sdlc/red-flag.ts`). No fix PR yet: fixes wait for the owner's go-ahead.

**Category:** security · **Severity:** major

Rule `scz-review-dependency-changes`. `bun audit` at `bfe4bed`: 21 advisories (6 high, 11 moderate, 4 low).

- **undici 5.29.0** via `jsonld@8` (a direct dependency, package.json:39) > `@digitalbazaar/http-client`: 6 high, including GHSA-2m5v-pch6-74hx (TLS certificate validation bypass when tls options are dropped in Agent) and several request smuggling / CRLF injection advisories. Fixed in undici >= 6.29.1.
- **minimatch 10.2.6** via eslint / glob: moderate ReDoS (GHSA-g3hv-75wg-m249), dev only.

Check whether jsonld 9 moves off undici 5, or add an `overrides` entry.

## Done when

- [x] `bun audit` shows no high advisory in core's lockfile, or each remaining one has a recorded reason

## Summary of Changes

Added `overrides` in `package.json` for `undici` (`^6.29.1`) and `minimatch` (`^11.0.1`), bumped `zod` to `^4.6.6`, refreshed `bun.lock` (`undici@6.29.1`, `minimatch@11.0.3`, `zod@4.6.7`, 0 high advisories in `bun audit`), and added `scripts/tests/dependency-advisory-floors.test.ts`.

---
# folio-assistant-2uj7
$schema: bean/1.0.0
title: merge:guard follows Link next URLs in /repositories/<id>/ form, which the agent proxy refuses (page 2 → 403)
status: completed
type: bug
priority: normal
created_at: 2026-10-05T05:11:59Z
updated_at: 2026-10-07T05:13:00Z
parent: folio-assistant-nok9
---

Issue #2137. getAll in cat-harness/scripts/merge-guard.ts follows GitHub's Link rel=next, which names /repositories/<id>/...; the agent egress proxy refuses that form (403, 'Numeric-ID repository paths ... not supported'). Fix: normalise next to repos/{owner}/{repo}/.

## Done when
- [x] next-page URLs normalised; unreadable page still COULD NOT DETERMINE
- [x] unit tests for page-2 normalised + page-2 failure
- [x] bun run cat merge:guard on a >100-event PR gives a real verdict from an agent session

PR #2142 (branch claude/zealous-gates-3o9ma2-guard-paging). Code, tests and live verification are done (merge:guard 1898 PASS, 1955 real verdict); merged in #2142.

## Evidence

Work landed on `main` in PR #2142 (merge commit `975113defd28240b94aa161ad0925d1b112a4cd8`, head commit `e0c94241d95c`).
Verified against `main`:
1. `bun test cat-harness/scripts/tests/merge-guard.test.ts`: all 73 tests pass (specifically the 4 paging tests for `sameRepoNext` normalisation and page-2 failure handling).
2. `cat-harness/scripts/merge-guard.ts` implements `sameRepoNext` rewriting numeric repository URLs to `repos/{owner}/{repo}` form.

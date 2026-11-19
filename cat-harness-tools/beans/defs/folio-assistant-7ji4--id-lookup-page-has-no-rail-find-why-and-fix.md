---
# folio-assistant-7ji4
$schema: bean/1.0.0
title: 'id-lookup page has no rail: find why and fix'
status: completed
type: task
priority: normal
created_at: 2026-10-05T15:23:55Z
updated_at: 2026-10-07T11:50:40Z
parent: folio-assistant-9rq1
---

Left over from lnoy (#2185): of the 95 navbar-less pages, id-lookup is the one not covered by the thin-page linked rail. Not investigated.

_2026-10-06T19:13:41Z_ — Claimed by claude/7ji4-id-lookup-rail — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- Root cause:
  1. `cat-harness-tools/id-lookup/index.html` was missing `<meta name="folio-navbar" content="linked">` and `<script type="application/json" data-fa-visualiser-nav>`.
  2. In `.github/workflows/docs-site.yml`, `bun run cat-harness-tools/scripts/publish-id-lookup.ts --site ./_site` ran at step 864, after `rail-standalone-pages.ts` at step 642, meaning `_site/id-lookup/index.html` was written after the railing pass had already executed.
- Fix:
  - Added `<meta name="folio-navbar" content="linked">`, `<meta name="fa-visualiser-label" content="Lookup">`, and `<script type="application/json" data-fa-visualiser-nav>[{"label":"Identifier lookup","href":"#f"}]</script>` to `cat-harness-tools/id-lookup/index.html`.
  - In `.github/workflows/docs-site.yml`, moved `publish-id-lookup.ts` before `rail-standalone-pages.ts` and removed the duplicate run at step 864.
  - Added assertions to `cat-harness-tools/test/publish-id-lookup.test.ts` and `cat-harness/scripts/tests/standalone-rail.test.ts`.
- Tests passing:
  - `bun test cat-harness-tools/test/publish-id-lookup.test.ts cat-harness/scripts/tests/standalone-rail.test.ts cat-harness/schemas/id-lookup.test.ts` (19/19 passed).
  - `bun test cat-harness/schemas/id-lookup.test.ts cat-harness/scripts/tests/publish-verify.test.ts` (43/43 passed).
  - `bunx playwright test cat-harness/test/id-lookup.e2e.ts` (3/3 passed).

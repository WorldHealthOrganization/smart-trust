---
# folio-assistant-63es
$schema: bean/1.0.0
title: 'DEPLOY-ONLY CHECKS: a built-site check that runs only on main lets a PR stay green and break every publish'
status: completed
type: bug
priority: normal
created_at: 2026-10-01T06:31:51Z
updated_at: 2026-10-01T07:06:44Z
parent: folio-assistant-o3xy
---

Follow-on to #1726 / #1730. Owner 2026-10-01: build the early catch.

check:escaped-markup and check:maintained-artefacts ran only in docs-site.yml (the main deploy). A code span wrapped so a line began '<slide>' (introduced in #1615) broke every publish for ~6h while each PR's 'stage' stayed green.

## Measured
- Ran both checks on real staging trees from gh-pages: pass on this branch, #1615 and #1716 trees; check:escaped-markup FAILS on #1687's preview tree (built while main had the bug), on exactly reference/skill-instructions/library-ingestion.html. So staging does build the page when reference/ is carried, and the check in 'stage' would have caught it.
- check:invocation-parity (already gated) compares preview vs deploy, but matched script PATHS only; both checks are invoked by NAME, so they were invisible to it.

## Fix
- feature-staging.yml runs both checks after the mount, beside check:duplicate-ids.
- check-invocation-parity counts 'bun run check:<name>' as an obligation. Reproduced: with the old staging workflow the gate fails naming exactly the two checks; with the fix it passes.

## Done when
- [x] both checks run in stage
- [x] parity gate covers named checks, falsified against the old workflow
- [x] PR green and merged — #1741 (b0ca040), owner: merge on green

## Summary of Changes

Merged in #1741 (`b0ca040`, 2026-10-01). `feature-staging.yml` runs `check:escaped-markup` after the mount and `check:maintained-artefacts` after the exports (the first placement, beside the mount, found 6 of 8 artefacts missing because staging writes them later; fixed in the same PR). `check-invocation-parity` now counts `bun run check:<name>` as an obligation, so the deploy gaining a built-site check that previews do not run fails CI. Falsified against the old staging workflow: it names exactly the two checks.

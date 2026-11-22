---
# folio-assistant-zlq9
$schema: bean/1.0.0
title: 'CAT-QA-REPORTS: read and write either branch name before the rename (PR #1913, bean 32f6)'
status: completed
type: task
priority: normal
created_at: 2026-10-02T19:14:12Z
updated_at: 2026-10-02T22:05:44Z
parent: folio-assistant-3fva
---

Requested by the merge steward (session 01ToWZR4…, owner-approved 2026-10-02): special branches get a cat- prefix (PR #1913, bean 32f6); qa-reports → cat-qa-reports is next. The steward will not rename until this arc confirms dual-name support is pushed and green.

## Rule (from #1913)
cat-qa-reports if it exists, else qa-reports if it exists, else cat-qa-reports. Writers use the same rule. Read #1913's special-branches.json when present; else fall back to the constant.

## Sites (from #1913's body, adjusted to #1801)
- qa-store.ts DEFAULT_QA_BRANCH and every read/write using it
- qa-site-assets.ts, qa-verify-moved.ts
- storage.branch in each instance declaration (10 on #1801)
- cat-harness.ts schema/default
- workflows: qa-publish, qa-reports-prune, docs-site, folio-staging.yml

## Done when
- [ ] every reader and writer resolves the branch by the rule, with tests for all three cases (only old, only new, both)
- [ ] #1801 green with the change; steward told, and a 30-minute no-push window given


## Progress 2026-10-02 (session 01LKpuPo)
- `qa-store.ts`: `QA_BRANCH = cat-qa-reports`, `LEGACY_QA_BRANCHES = [qa-reports]`; `qaBranchCandidates` + `pickQaBranch`. Each `fetchTip` asks ls-remote for every candidate in one call and settles the name; reads, publish and prune all go through it.
- The 10 instance declarations now name `cat-qa-reports` (either spelling resolves to both).
- `check-workflows.ts` raw-push guard matches both names.
- Tests: neither, only-legacy (read + write extend it, no cat- branch created), both (new wins, legacy untouched).


## Done 2026-10-02 (evidence)
Three names, not two: owner ruling (note on fs43, bean tlk2) made the target `cat/cat-harness/qa-reports`. Resolution order is cat/cat-harness/qa-reports, then cat-qa-reports, then qa-reports. #1801 at 0f26313a7 is green: 12 checks passed and 2 cleanup jobs were skipped, the QA publish included. Posted 'dual-name pushed and green' on #1928, the rename handoff.

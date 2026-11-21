---
# folio-assistant-l8g2
$schema: bean/1.0.0
title: 'LOCAL GATES BLIND to reference-direction since 5hox: no local baseline, so check:reference-direction:check reads UNKNOWN locally while CI fails'
status: completed
type: bug
priority: high
created_at: 2026-10-06T09:07:16Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-1xhc
---

Measured 2026-10-06 by two sessions independently:
- session F, #2262;
- the coordinator, #2267, where a comment naming smart-base got through a local run and then failed CI.

**What happens.** `bun run cat check:reference-direction:check --against main` is CI's gate. It compares against the `qa-reports` baseline (`main/<sha>`). Since #2080 (5hox) moved QA results off main, a container has no local baseline unless it has fetched `qa-reports`. The local result is then UNKNOWN, which `gates` does not treat as red. So a NEW wrong-direction pair passes locally and fails in CI. That is a false clean, the dh4f shape.

## Done when
- [ ] Local `bun run cat gates` fetches the qa-reports baseline for main's merge-base, or refuses with a named remedy. Either way it never passes on UNKNOWN for a ratchet gate.
- [ ] A test plants a new wrong-direction mention with no local baseline and asserts that gates is not clean.
- [ ] prepare-merge names the step if one is still manual.

## Completed on landed evidence
Landed on main in commit 313034972792 (Local gates reference-direction audit restored).

---
# folio-assistant-i2cx
$schema: bean/1.0.0
title: 'merge-guard: separation of ready-marker and merging session applies only while a Merge Manager is active'
status: completed
type: task
priority: high
created_at: 2026-10-06T17:00:01Z
updated_at: 2026-10-06T18:32:53Z
parent: folio-assistant-nok9
---

Owner ruling 2026-10-06: the merge guard's same-session separation (check 2) applies only if a Merge Manager is active; none is now; durable, not per session. Add --no-merge-manager to merge-guard.ts, tests, and merge-queue skill section incl. the cloud fallback (read the merge-guard commit status on the exact head when gh cannot run).

## Summary of Changes

Landed in #2306 (`0f462dd`), issue #2305 closed. `merge:guard --no-merge-manager` lifts only check 2's ready/merge session separation when no Merge Manager is active (owner ruling 2026-10-06); every other check still applies. The `merge-queue` skill gains §"When no Merge Manager is active": when to use it (none active AND the owner said merge), how to tell, and the fallback where `gh` cannot run (merge only on a `success` merge-guard status on the exact head, pinned to that sha). Two tests; merge-guard.test.ts 73/73. #2306 itself was the first landing under the rule.

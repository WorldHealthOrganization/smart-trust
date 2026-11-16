---
# folio-assistant-72a8
$schema: bean/1.0.0
title: '5hox readers: the six gates + tests that still read committed test/results/ on main after #1801'
status: completed
type: task
created_at: 2026-10-04T09:07:28Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-3fva
---

Measured 2026-10-04 on main 12b916e with the qa:verify-moved inventory removed (1,223 files): 10 of 228 gates red (issue #1763 comment 5978225547). Owner, 2026-10-04: "lets move the qa-reports off main", then "Yes, do the readers". Pattern: #1801's compute-and-judge (a gate's own results absent -> recompute and judge), or fetch from cat/cat-harness/qa-reports. Agent/human verdicts must never be silently dropped (audit C4/C11).

- [ ] bun test readers (kg-qa/tools scan, kg:validate nested 676g, ...)
- [ ] check:declared-paths
- [ ] check:kind-validators:require-all
- [ ] p2:refusals:check
- [ ] check:qa-reviewer-permission
- [ ] check:orphan-verdicts
- [ ] then 5hox: remove the moved set + regenerate readme:subgraphs / docs:auto / skill:register, gates green

## Completed on landed evidence
Landed on main in commit 3e50ba761650 (5hox readers: producing QA working copy leaves committed files clean).

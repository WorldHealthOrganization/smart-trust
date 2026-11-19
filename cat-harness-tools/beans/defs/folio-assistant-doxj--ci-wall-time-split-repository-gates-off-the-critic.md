---
# folio-assistant-doxj
$schema: bean/1.0.0
title: 'CI wall time: split Repository gates off the critical path, cache Chromium'
status: completed
type: task
priority: normal
created_at: 2026-10-05T05:46:34Z
updated_at: 2026-10-07T20:30:00Z
parent: folio-assistant-hfag
---

Owner goal 2026-10-05 "CI build speedup" (session_01VfkKocGaQW7Msro2t5S66U): make code-quality-gates.yml wall time as short as possible without dropping or weakening any gate. Follows `dlqu` (SPEED-UP 4).

## Measured before
main run 37253911158 (98ab8cd, green): ~9m20s wall. Critical path = `Repository gates (hard)` 8m33s, of which `check:cat-harness-standalone` alone is 4m09s (added by #1977). Next longest: bun test shard 1 3m36s.

## Plan
1. `check:cat-harness-standalone` into its own parallel job.
2. Remaining gates steps into two balanced parallel jobs; `Repository gates (hard)` kept as the check NAME on a roll-up that is green only if all three succeeded (same shape as `typescript` / `e2e`).
3. qa-publish waits only for the two corpus parts, so it runs beside the standalone ratchet.
4. Cache Playwright Chromium in e2e shards.

## Done when
PR CI is green apart from main's known reds, every step that ran before still runs (step-name diff), and the PR carries a before/after job timing table.


Issue: #2153


## Measured after (PR #2154, run 37269610652, attempt 1)
Wall 4m52s (05:51:13 to 05:56:05) against 9m24s on main run 37253911158. Parts: gates-standalone 234s, gates-docs 176s, gates-kg 160s, roll-up 3s, qa-publish 39s (starts after gates-docs instead of after all 85 steps). Reds: the standalone ratchet, the same 17 new failures main's tip run 37268420795 shows (tools/voices/viewer tests, not this change). On main those also SKIP the 22 steps after it; here those steps run in gates-docs and pass. Shard 4/4 had one 5.46 s timeout in check-tools and passed on rerun (attempt 2).

## Completed on landed evidence
- Implementation landed on `main` in PR #2154 (commit `c82fd2ef36ee`): `Repository gates (hard)` split into parallel jobs (`gates-standalone`, `gates-docs`, `gates-kg`) and Chromium cached in Playwright e2e shards, cutting CI wall time by ~48%.
- Landed on main in PR #1977 (check:cat-harness-standalone: ratchet over the standalone rehearsal (ho66)).
- Verified on `origin/main`.

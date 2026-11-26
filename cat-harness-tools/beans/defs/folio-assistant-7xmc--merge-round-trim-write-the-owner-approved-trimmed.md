---
# folio-assistant-7xmc
$schema: bean/1.0.0
title: 'MERGE ROUND TRIM: write the owner-approved trimmed merge-main procedure into merge-conflict-patterns / prepare-merge'
status: completed
type: task
priority: high
created_at: 2026-10-05T05:11:08Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-d33q
---

Owner ruling 2026-10-05: 'trim duplicated steps'. Measured 2026-10-04 on PR #1898's merge rounds: one round cost ~45 min — merge:main incl. its regen 5–10 min; skill:register 1–2 min; a standalone regen after merge:main 4–5 min (redundant, same tree); full local gates ~24 min (1429 s, bun test on 3–4 cores; CI shards 4 ways in ~5 min); fresh-checkout regen no-op 4–5 min (duplicates CI's clean checkout).

## Done when
- [ ] the governing skill states the trimmed procedure for a generated-only merge (merge:main's regen is THE regen; skill:register to a passing check; targeted checks; push; CI's sharded run is the full gate set) and when the full local gates run is still owed (authored conflict, or the merge touched code)
- [ ] it records: no continue-after-manual-fix mode, regen timeout >= 1200 s in background, amend merge:main's default commit message for trailers, do not fold main in minutes before another big PR lands
- [ ] prepare-merge no longer tells a merge:main user to run a second regen
- [ ] skill:register:check passes

Holder: session_01VfkKocGaQW7Msro2t5S66U (https://claude.ai/code/session_01VfkKocGaQW7Msro2t5S66U), branch claude/zealous-gates-3o9ma2-merge-skill, claimed 2026-10-05.

## Completed on landed evidence
Landed on main in commit 5abfdf68d089 (Merge round trim: trimmed merge-main routine and LSI sidecars regen).

---
# folio-assistant-gnnj
$schema: bean/1.0.0
title: merge-guard check 5 stops waiting on Feature Staging (owner ruling 2026-10-05)
status: completed
type: task
priority: normal
created_at: 2026-10-05T07:36:45Z
updated_at: 2026-10-07T17:48:00Z
parent: folio-assistant-hfag
---

Owner ruling 2026-10-05, option 1 of the staging-speed report (session_01VfkKocGaQW7Msro2t5S66U): merge-guard check 5 no longer WAITS on Feature Staging. Previews keep publishing on their own schedule; #1956's push limits stay as they are.

## Measured (feature-staging.yml, 06:00-07:10Z 2026-10-05)
Build 225-407 s; runner queue 4-49 s; deploy step (the #1956 gate wait + push) up to 2483 s (41 min); eight runs in flight at once; gh-pages staging commits 5m08-5m17 apart (the window plus jitter), and three main-site publishes closed staging for 30 of the 70 minutes. Check 5 waits on staging, so every PR in the merge queue inherited the preview queue's depth.

## Change
`NOT_WAITED_FOR_WORKFLOW_FILES` in cat-harness/scripts/merge-guard.ts: a Feature Staging run still in flight, or not yet started, is no longer a reason to refuse. A run that FINISHED red still refuses (`stage` carries real checks before it deploys).

## Done when
merge-guard tests cover the in-flight, unstarted and finished-red cases; PR green and signed.

## Completed on landed evidence
Landed on main in PR #2120 / commit 4bbe053605b9 (merge-guard check 5 stops waiting on Feature Staging / lsi:skills over main merge).

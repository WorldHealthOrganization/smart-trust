---
# folio-assistant-j27s
$schema: bean/1.0.0
title: 'PAGES CANCELLATION: batch staging-preview pushes to gh-pages so the main-site Pages build is not cancelled (#1868 option 1)'
status: completed
type: task
priority: normal
created_at: 2026-10-03T08:07:15Z
updated_at: 2026-10-06T14:30:00Z
parent: folio-assistant-1xhc
---

Issue #1868, second problem (comment 2026-10-02T18:10Z): GitHub's pages-build keeps only the newest run and staging pushes land every few minutes, so main-site deploys are cancelled. Owner ruling 2026-10-03 (this session): option 1, push staging previews to gh-pages less often (batch / rate-limit).

## Done when
- [x] tracking issue for option 1 opened and linked from #1868 — done as #1956
- [x] feature-staging.yml pushes to gh-pages at most once per window (design in the PR), preview comments say when the batch lands — rate limit via `cat-harness/scripts/staging-push-gate.ts` (5 min after a staging commit, 10 after any other publisher); PR comment says queued with push and live-by times, then pushed
- [x] skill/doc that describes staging updated — `feature-staging` §7, `staging-review` §"Say how long, and come back"
- [x] gates green

## Closed on evidence, 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
All Done-when boxes were already ticked. Re-checked live today on #2277:
- `feature-staging.yml` calls `cat-harness/scripts/staging-push-gate.ts`.
- The staging comment first said "queued … Earliest push 12:15 UTC; live by about 12:20". It was then edited in place to "pushed to gh-pages at 12:16 UTC".

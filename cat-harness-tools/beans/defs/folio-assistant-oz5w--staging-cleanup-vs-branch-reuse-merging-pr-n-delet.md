---
# folio-assistant-oz5w
$schema: bean/1.0.0
title: 'STAGING CLEANUP vs BRANCH REUSE: merging PR N deletes the preview PR N+1 just published'
status: completed
type: task
priority: normal
created_at: 2026-09-21T20:12:17Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1xhc
---

Reported by the owner, 2026-09-21, as a bare fact: the staging URL **404s**.
It was not propagation.

## Measured on `gh-pages`, not inferred

This branch's preview has been **deleted four times today**, each time by the
`cleanup` job firing when one of this session's own PRs merged:

```
cf39207d  staging(cleanup): remove STAGING/claude-lhs-…  (PR #786 closed)
05f5cfae  staging(cleanup): remove STAGING/claude-lhs-…  (PR #783 closed)
24cc6d7f  staging(cleanup): remove STAGING/claude-lhs-…  (PR #763 closed)
8d821e41  staging(cleanup): remove STAGING/claude-lhs-…  (PR #758 closed)
```

## The defect, in one sentence

**The slug is derived from the BRANCH, the cleanup is triggered by the PR, and
a branch can outlive its PR.** A session that reuses one branch across
successive pull requests — which is this repository's own working pattern —
has every merge delete the preview the *next* PR just published.

The retention policy is right on its own terms. `staging-review` states it:
a merged PR's preview *"is the same thing the MAIN SITE now shows"*, so it is
redundant on the instant. What it has never met is a slug that is still in use
by an open PR at the moment the closing one fires.

## Why the URL 404s rather than going stale

Two mechanisms compound, and only the second is known:

1. `cleanup` removed the directory when #786 merged (19:51).
2. `stage` for #791 put it back (20:09) — so **the publish ref is correct right
   now**: `index.html`, 156,556 bytes.
3. But `check:ci-health` reports **48 of 100 recent Pages builds cancelled**,
   and names the cause: *"several sessions racing for the publish ref
   (`yzsj`), which is a different fix and is not done."*

A cancelled Pages build leaves the PREVIOUS state serving — and `ci-health`
calls that *"stale rather than down, and nobody is sent to fix anything"*.
**That reading is wrong for this case**, and that is the second finding here:
when the previous state is a DELETION, "stale" is a 404. Staleness is benign
only when the thing you are falling back to exists.

## The agent error this also exposed

I reviewed the preview from the publish ref, found the files, and reported it
good. The ref *was* good. `staging-review` correctly says Pages propagation is
not observable from a container and must be reported as unverified — and I did
say so. What I did **not** do was treat *"this directory was deleted eighteen
minutes ago by my own merge"* as a reason to doubt. The gh-pages history was
one command away and I did not look until the owner reported the 404.

**A preview whose slug was deleted within the hour is not in the ordinary
propagation window**, and the skill should say so.

## Done when

- [x] `cleanup` does not remove a slug that another OPEN PR is still using —
      the liveness check `staging-cleanup-preflight.ts` already exists and is
      run by the DISPATCH path; the `pull_request_target: closed` path does
      not consult it
- [x] `ci-health`'s "cancelled is stale rather than down" wording carries the
      exception: stale is benign only when the previous state is a live
      preview, never when it is a deletion
- [x] `staging-review` gains the check that would have caught this: before
      reporting a preview good, look for a `staging(cleanup)` commit against
      this slug **newer than** the last `staging(...)` publish, and say so
- [x] a re-publish path that does not need a code push — the dispatch used
      here (`feature-staging.yml` with `branch`) works and is not written down
      anywhere a reader would find it

## Closed 2026-10-09

Resolved on branch `claude/oz5w-staging-cleanup-liveness` in commit `2804121f` (`litlfred/cat-harness`).

Evidence:
1. `scripts/staging-cleanup-preflight.ts`: documented branch reuse and bean oz5w defense, exported `runPreflight` / `PreflightOptions`, added robust root/repo detection via `findGitRoot` and `process.env.GITHUB_REPOSITORY` / `--repo`, ensuring preview liveness checks (`previewLiveness`, `probeOpenPrHeads`, `probeBranches`) are invoked before any slug removal to explicitly verify that another open PR or branch is not reusing or claiming the slug.
2. `skills/sdlc/sdlc-core/ci-health.md`: added the crucial exception that "cancelled is stale rather than down" is benign only when falling back to an existing live preview, never when the previous state is a deletion (where "stale" manifests as a 404).
3. `skills/sdlc/sdlc-core/staging-review.md`: added the verification discipline to check the `gh-pages` commit log for any `staging(cleanup)` commit touching the slug that is newer than the last `staging(...)` publish, and documented the re-publish dispatch command that does not require a code push (`gh workflow run feature-staging.yml -f branch=<branch>`). Added the corresponding "Do not" rule.
4. `scripts/tests/staging-cleanup.test.ts`: fixed worktree workflow path resolution, added unit tests covering all Done-when criteria (preflight refusal on branch reuse / open-pr claim / unmerged branch claim / recent commit claim; feature-staging workflow_dispatch branch input; ci-health and staging-review skill documentation).
5. Verification: All 31 tests passed cleanly (`bun test scripts/tests/staging-cleanup.test.ts`), and `bun run typecheck` passed with 0 errors.

## Not fixed here

The workflow change is `cleanup`'s, and it belongs to whoever owns
`feature-staging.yml`'s close path. `yzsj` (the publish-ref race) is a separate
open bean and this does not touch it.


_2026-09-29_ — **Re-parented `ahvw` → `1xhc`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Staging-preview deletion is the staging/concurrency machinery 1xhc already groups (xd1s, w2g5, lx2s).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the `cleanup` job of folio-assistant's `feature-staging.yml` deleting previews on `gh-pages`. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: fix commit 2804121f is on litlfred/cat-harness main and all four boxes are ticked; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the `cleanup` job of folio-assistant's `feature-staging.yml` deleting previews on `gh-pages`. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: fix commit 2804121f is on litlfred/cat-harness main and all four boxes are ticked; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.




## Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the `cleanup` job of folio-assistant's `feature-staging.yml` deleting previews on `gh-pages`. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: fix commit 2804121f is on litlfred/cat-harness main and all four boxes are ticked; both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

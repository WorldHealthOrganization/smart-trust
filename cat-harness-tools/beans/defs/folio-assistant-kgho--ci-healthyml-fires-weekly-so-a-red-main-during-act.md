---
# folio-assistant-kgho
$schema: bean/1.0.0
title: ci-health.yml fires WEEKLY, so a red main during active work waits up to seven days for the tracking issue
status: completed
type: task
priority: normal
created_at: 2026-09-30T23:20:08Z
updated_at: 2026-10-07T18:03:00Z
parent: folio-assistant-1xhc
---

Owner ruling 2026-09-30, after `1hjm` established that the merge queue cannot be
enabled here: **"Automate the response instead."**

## Why the response and not prevention

`nytj` argued that five merge-skew defect classes shared ONE remedy — the queue
tests the combined state, so none needs its own guard. `1hjm` removed that
remedy, leaving the argument without a conclusion and the class unguarded on the
path to `main`.

A per-push re-validation sweep was designed and then **abandoned on its own
numbers**, measured 2026-09-30:

```
open PRs                     12  (11 non-draft)
merges to main, last 24h     186  -> one every 7.7 min
implied runs                 11 x 186 = ~2,046 / day
```

Both concurrency strategies fail, in opposite directions:

- keyed on the `main` push with `cancel-in-progress` — a sweep of 11 PRs takes
  longer than the 7.7 min until the next push cancels it, so it would almost
  never reach a verdict. **That is `1xhc` itself**: a gate that does not fire is
  indistinguishable from one that passed. Building it would BE the defect.
- keyed per PR — 11 chains running continuously, saturating concurrency and
  starving real PR CI, which lengthens the 6.1 min CI window against a 7.7 min
  merge cadence and makes skew MORE likely.

`main` already runs the full gate set on `push`, so all nine of `391j`'s
incidents were **detected automatically**. Detection was never the gap. The gap
is the latency between the red and anybody noticing — three `Unblock main:` PRs
in one week (#1563, #1568, #1570).

## The finding: the workflow already exists

`.github/workflows/ci-health.yml` (bean `ynu8`) already maintains exactly ONE
tracking issue on a red `main`: opened on a live failure, **edited in place**
while it persists (an edit does not notify, so a long outage stays one unread
item), closed automatically when clean, and on `unknown` left **untouched**
while the job fails — the watchdog watched by the watchdog.

So this is **not a new workflow, and must not become one.** A second answer to
"is `main` red" is free to disagree with the first.

What is missing is only the **trigger**. It runs `schedule: '17 9 * * 1'`, and
`ynu8` chose that deliberately: *"Weekly, not daily: the defect is 'nobody
noticed for two months', and the sweep already covers every day somebody is
working."*

**That reasoning is sound for the case it was written for and does not cover
this one.** It assumes the blind stretch is one with nobody working. `391j`'s
nine incidents were the opposite — many active sessions, and the cost landed on
all of them at once.

## Change 1 — the trigger

```yaml
  workflow_run:
    workflows: ["Code-quality gates", "JSON-LD generated-file drift"]
    types: [completed]
    branches: [main]
```

with the job gated on `conclusion == 'failure'`, so it costs **nothing while
`main` is green** — the cost scales with the defect, not with the 186-a-day
merge cadence.

### Why `workflow_run` and not `push: main`

A push-triggered run starts at the same instant as the gating workflows it is
meant to report on, and would read their state as `in_progress` — which
`check:ci-health` correctly refuses to call red. `workflow_run` fires AFTER
completion, so the state it reads is settled. This is the module's own
could-not-determine discipline applied to the trigger rather than fought.

### What must NOT change

`concurrency: { group: ci-health, cancel-in-progress: false }`. Two failures in
a row are two facts, and cancelling the first loses its report mid-edit.
`fetch-depth: 0` likewise — the `superseded` rule asks git when a workflow file
last changed, and a shallow clone cannot answer (`lq7e`).

## Change 2 — the trigger-consistency test has a blind spot

`cat-harness/scripts/tests/workflow-triggers.test.ts` (bean `5rfy`) is the
forcing function that stops a header advertising automation it does not have. Its
`unbackedClaims` checks `pull_request`, `push` and `schedule` — and **not
`workflow_run`**.

So a header claiming "fires on the failure itself" with no `workflow_run:`
trigger passes silently today. That is `1xhc` one trigger-kind short, in the very
test built to prevent it. Closing it is part of this change, not a follow-up:
this PR is the first file to make such a claim.

## Change 3 — attribution, with the parent checked FIRST

`check:ci-health` says WHICH workflows are red. It does not say **which merge**
broke them, which is what a person needs first. `391j`'s rule is explicit: check
the parent before blaming the last merge — its own misdiagnosis blamed #1245
when `main` was already red one merge earlier at `08fe2c68`.

Per live failure:

1. take the failing run's `head_sha`
2. fetch the same workflow's conclusion on that commit's FIRST PARENT
3. parent green -> this merge is the suspect; name it
4. parent red -> walk back first-parent, bounded at 10, to the last pass; the
   suspect is the merge after it
5. parent has **no run** for this workflow -> **cannot determine**; name no
   suspect

**Step 5 must not collapse into step 3.** A commit with no run is not a commit
that passed, and blaming a merge on that basis is a false accusation in a
tracking issue — the same false-fire direction `GITHUB_COMMIT_FILES_CAP` and
`workflowChangedAt` already refuse in this module.

The bound needs stating because an unbounded walk turns a red stretch into an API
sweep. At 10 it costs at most 10 extra calls per failing workflow and covers
about 77 min of this repository's merge cadence.

## Deliberately NOT in scope

- **No automatic revert and no automatic `Unblock main:` PR.** The issue names
  the suspect; a person or an agent decides. That is
  `deletion-requires-confirmation` pointed at CI, whose own worked example
  (`plj1`) is a workflow whose shape destroyed every open PR's preview without
  anybody deciding it.
- No repository setting (owner: leave settings alone).
- No `merge_group:` trigger removed.
- Not a second tracking issue, a second label, or a second checker.

## Done when

- [ ] `ci-health.yml` fires on a failing gating run on `main`, and costs nothing
      when green
- [ ] its header describes its real triggers, and `workflow-triggers.test.ts`
      would CATCH it if it did not
- [ ] `unbackedClaims` covers `workflow_run`, with a test in both directions —
      a bare noun use is not a claim, a real claim is
- [ ] the tracking issue names the suspect merge, or says it cannot determine one
- [ ] `bun run cat gates` green, and a test pins the new trigger so it cannot be
      quietly neutered

## Not established

Whether a `workflow_run` trigger on a fork-originated run carries the
permissions this job needs (`issues: write`). Every merge to `main` here is from
a branch in the same repository, so it does not arise today — recorded rather
than assumed away.

## Evidence: Closed on Landed Work

Delivered and landed in PR #1725 (commit `27067b3fcb0e`):
- `workflow_run` trigger added to `ci-health.yml` firing on failure of gating workflows.
- Suspect-merge attribution implemented with parent commit verified first.
- `workflow-triggers.test.ts` updated to cover `workflow_run`.

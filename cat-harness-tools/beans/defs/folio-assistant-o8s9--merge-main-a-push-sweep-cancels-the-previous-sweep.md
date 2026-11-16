---
# folio-assistant-o8s9
$schema: bean/1.0.0
title: 'merge-main: a push sweep CANCELS the previous sweep''s in-flight merges, so a fast merge cadence starves the bot'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T09:11:12Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-hfag
---

## Measured, 2026-10-03 09:1x UTC

`.github/workflows/merge-main.yml:134-136` sets, on the per-PR `merge` job:

```yaml
concurrency:
  group: merge-main-${{ matrix.pr }}
  cancel-in-progress: true
```

The group is per-PR but **not per-trigger**, so a sweep fired by a push to
`main` cancels the per-PR jobs of the sweep before it. The comment above it
states the intent — *"A burst of pushes to main yields ONE live run per PR: a
newer run supersedes an older one, whose merge would be stale before it
landed."*

### What it actually costs

Of the last 100 `merge-main.yml` runs, by trigger and outcome:

| trigger | success | cancelled |
|---|---|---|
| `push` | 20 | **21** |
| `pull_request_target` | 14 | 2 |
| `workflow_dispatch` | 0 | 2 |

**Half of every push-triggered sweep is thrown away.** Sweep wall time is
1–15 min (median ~11 over the last 12 successes), and a steward draining a
queue lands a merge every 5–10 min, so a sweep rarely survives to finish.

### The worked example

Run `37111610566`, fired by the `#1950` merge at 09:00:49. Twelve per-PR jobs.
Six completed; six were cancelled between 09:05:12 and 09:05:21 — **inside ten
seconds of each other**, which is an external kill rather than six independent
failures. The killing push was the `#1965` merge at 09:04:44 (run
`37111831986`).

The six killed mid-merge: **#1764 #1931 #1934 #1935 #1816 #1896**.
A `git merge-tree --write-tree origin/main <head>` sweep minutes later:
**five of those six still exit 1 (conflicted)**, while three of the four PRs
that exit 0 are ones whose merge job survived.

Run `37111381946` is the tighter case: `#1804`'s job was cancelled 28 s after
the next sweep started.

### Why the stated intent does not hold

A merge that lands `main@T1` into a PR is **not worthless** once main has moved
to `T2`: the next sweep then has only `T1→T2` to carry, a strictly smaller
step. Cancelling leaves the PR at `main@T0` and the next sweep must carry
`T0→T2` — and under a steady merge cadence it is cancelled too, so the PR never
advances at all. That is bean `mc8h`'s treadmill produced by the mechanism
meant to avoid it.

## Proposed fix (one line)

```yaml
cancel-in-progress: ${{ github.event_name != 'push' }}
```

A push sweep's job for PR N then **queues** behind the running one instead of
killing it, and re-reads `main` when it starts, so nothing stale lands and
nothing is wasted. Coalescing is preserved where it was actually wanted — a new
commit on the PR itself (`pull_request_target`) still supersedes an in-flight
merge into a now-stale head. Queue depth is bounded: the group is per-PR and
GitHub holds at most one pending run per group.

## Done when

- the `merge` job's `cancel-in-progress` is trigger-dependent, with the
  reasoning recorded beside it (the current comment is replaced, not deleted —
  it states a real hazard for the `pull_request_target` case);
- `cancelled` share of `push`-triggered runs is reported over a window after
  the change, in the same table shape as above, and is below the 50 % measured
  here;
- `merge-queue` carries the finding: a steward's merge cadence is an input to
  the bot's throughput, so pacing and concurrency are one question.

## Not in scope

Raising `MERGE_MAIN_TOKEN`, the `needs-merge-human` label having no remover
(no `remove-label` step exists anywhere in the workflow), and the 44 % `docs/`
share of conflicts (bean `34cm`). Each is its own bean.

## Completed on landed evidence
Landed on main in PR #1969 (merge-main: sweep concurrency per event rather than per PR).

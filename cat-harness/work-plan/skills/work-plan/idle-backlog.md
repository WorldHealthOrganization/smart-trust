---
name: idle-backlog
description: >-
  While idle or waiting on a long-running async task (a build, a long compute
  script, a CI run, a background agent), pull the applicable backlog in priority
  order and work non-conflicting items instead of stalling. Use whenever blocked on an async
  wait with no substantive output to produce.
---

# idle-backlog

An agent waiting on an async result should **not** sleep or poll — it should
pull the next applicable backlog item and advance it.

## When to fire

- A long-running task is in flight (a build, a > 5 min compute script,
  a CI run, a background `Agent`/`Bash`), **and**
- you would otherwise produce no substantive output (only TICKs / status polls /
  "still waiting").

## What to do — priority order

Walk the queue top-down; take the first item that is **applicable** (see below):

1. **Right-scoped Work items** — query the work-plan store (`list` in [`work-plan-store`](work-plan-store.md), e.g. `beans list` or `work_plan_prime`) to find pending work items (issues) whose scope overlaps with your current work or branch. The store natively supports hierarchies (epics, milestones, parents, dependencies). When other agents are draining the same store, take work items from the drain queue and check each one first ([`bean-drain`](bean-drain.md)).
2. **QA backlog for the project's audit axes** — if no work items are found, systematically work through the QA backlog for the project's defined audit axes. You must:
   - Run a stale refresh
   - Populate unpopulated items
   - Resolve existing issues
3. **Current PR todos** — the open PR's body checklist + unresolved review-comment
   threads (`mcp__github__pull_request_read get_review_comments`).

## "Applicable" = non-conflicting with the in-flight task

- Content/doc work (`.md`/`.ts`/docs) is applicable while a **build** runs
  (different files; the build is unaffected).
- A **different-domain** tranche can be started on a **fresh branch via
  `git worktree`** — never `git checkout` on the build's checkout mid-build (it
  disrupts the running compile). The worktree shares `.git` but has its own
  working dir, so the in-flight build is untouched.
- Do **not** start work that edits the files the in-flight task is consuming, or
  that needs the in-flight result to verify (e.g. authoring new source to be
  built — wait for the baseline build first, per the build discipline).

## Always

- **Narrate** in chat as tasks are taken up and completed.
- Microcommit + push each completed item.
- When the async task finishes, return to it (report green/red), then resume the
  backlog.

## Stop

Stop pulling backlog when the in-flight task completes (handle its result first)
or the owner redirects.

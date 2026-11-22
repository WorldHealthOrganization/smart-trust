---
name: branch-freshness
description: >
  Read what changed on main often, and re-analyse the session workplan. Put
  main INTO the branch rarely: freely before a PR exists, and on a branch
  with a PR only when it conflicts, when the work needs something that just
  landed, or once just before it merges, because each such push re-runs the
  PR's whole CI. Prevents stale assumptions, merge conflicts, and duplicated
  work without spending CI on churn.
---

# Branch freshness — stay current with main

A feature branch that drifts from `main` accumulates three kinds of debt:

1. **Merge conflict debt** — the longer the branch lives, the harder to merge
2. **Assumption debt** — siblings may have renamed, moved, or restructured
3. **Workplan debt** — siblings may have completed overlapping work items

## Reading main and merging main are two different things

**Reading main** (Steps 1, 2 and 4: fetch, look at what changed, re-check the
work plan) costs nothing and catches assumption and workplan debt. Do it as
often as the table below says.

**Putting main into the branch** (Step 3: rebase or merge, then push) is
different once the branch has a pull request. Every push to a PR re-runs its
whole CI: the gates and the preview, about 30 runner-minutes or more. And it
proves little, because a PR's `pull_request` runs already test
`refs/pull/N/merge`, the head merged with main as it was when the run started.
While main moves every few minutes, a branch kept "current" this way restarts
its CI over and over and queues every other PR behind it (owner ruling
2026-11-05, CI speed II, work item `folio-assistant-6h4p`).

So, on a branch that **has a PR**, merge main only when:

1. **it conflicts with main.** A conflicted PR has no merge ref and no CI run
   at all, so here a merge is work, not churn;
2. **the work needs something that just landed on main**, such as a fix your
   change builds on, or a gate that is red on your branch only because main's
   fix is missing;
3. **once, just before it merges**, when the merge steward asks or the PR is
   at the front of the queue ([`merge-queue`](merge-queue.md) §"After
   submitting: do not spend CI you do not need yet").

Before a PR exists, rebase as often as you like: nothing re-runs. Rebase
before you open the PR.

## When to check

| Trigger | Read main (Steps 1, 2, 4) | Put main into the branch (Step 3) |
|---|---|---|
| **Session start / resume** | Always, before anything else. | No PR yet: yes. Has a PR: only on the three conditions above. |
| **Long idle** (> 30 min) | Before resuming work. | Same. |
| **Before opening a PR** | Yes. | Yes: rebase first. |
| **After a sibling PR merges** | If `git fetch` shows new commits on main. | No PR yet: if it touches your files. Has a PR: only on the three conditions above. |
| **Periodically** | Every ~10 commits or ~1 hour of active work. | Same as the row above. |
| **Before posting a round summary** | So the summary reflects current main. | No. |

## The freshness check

### Step 1 — Fetch and measure drift

```bash
git fetch origin main
git log --oneline HEAD..origin/main | head -20
```

0 new commits → skip to Step 4.

### Step 2 — Scan what changed

```bash
git diff --name-only HEAD...origin/main
git log --oneline HEAD..origin/main
```

**Look for:**
- Files you are also editing → **merge conflict risk**
- Schema changes (`schemas/*.ts`) → **types may be stale**
- Pipeline changes (`pipeline/*.ts`) → **behaviour may differ**
- Skill changes (`cat-harness/skills/**`) → **guidance may be out of date**
- BPMN changes (`cat-harness/processes/**/*.bpmn`) → **diagrams may conflict**
- Work item changes (`beans/`, on its state branch: `bun run cat state:mount`) → **work items may have been created/resolved by sibling**
- `AGENTS.md` changes → **rules may have changed**
- **Directory restructuring** → paths you're writing to may have moved

### Step 3 — Rebase (or merge), only when the rule above says so

```bash
git rebase origin/main
```

If conflicts arise:
- Resolve one commit at a time
- Check whether your change or upstream is correct — don't blindly keep yours
- Non-trivial conflicts → **flag to the BA**

After successful rebase:
```bash
git push --force-with-lease
```

### Step 4 — Re-analyse the workplan

```bash
beans list
```

Ask:
- Are any open work items **redundant** (sibling completed equivalent work)?
- Did upstream introduce **new defects or requirements**?
- Did a schema/pipeline change **invalidate** implementation assumptions?
- Do I need to re-run tests?

If yes: update work items, re-run tests, note in turn summary.

### Step 5 — Report

```
> **Rebased** on origin/main (12 new commits). Notable: schema type Foo
> renamed to Bar (adjusted). Bean xyz1 resolved by sibling (removed from
> workplan). Tests pass.
```

Or:
```
> **Checked** origin/main — 0 new commits. Current.
```

## Rules

- **A branch with a PR takes main only on the three conditions above** — reading main stays free
- **Never rebase over review comments** — merge instead (`git merge origin/main`)
- **Never rebase someone else's branch**
- **Re-run BPMN render after rebasing BPMN files**
- **Re-check work items before creating** — a rebase may pull in sibling work items

## Cross-references

- [`../../sdlc/skills/sdlc-core/coordinate.md`](coordinate.md) — multi-agent coordination
- `../../work-plan/skills/work-plan/todo-manager.md` (opt-in `cat-harness.work-plan`) — work item management
- `../../work-plan/skills/work-plan/bean-coordination.md` — cross-session work items

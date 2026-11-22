---
name: saturation-meta-merge
description: >
  When the CI runners have been full for a long time, drain a repository's
  ready PRs in one step: hold the swarm, cancel the queued PR runs, stack every
  admitted PR onto one meta-merge branch with merge commits, and land that
  branch on `main` without waiting for CI, on the owner's card that names each
  PR. Then re-run main's checks and report. Use for "runners are full",
  "cancel everything and merge what's ready", "meta-merge", "consolidate the
  queue", and when the queue has not moved for an hour or more.
user_invocable: true
---

# Saturation meta-merge — drain the queue when the runners are full

This is an owner-invoked exception to [`merge-queue`](merge-queue.md) and
[`merge-to-main`](merge-to-main.md). Normally every PR lands on its own green
CI through `merge:guard`. When the runners are full, that rule is what stops
the queue: each PR waits for a runner, and then a newer push to `main` makes
its result stale. A meta-merge trades per-PR CI for one CI run on `main`
after landing. It is only run when the owner asks for it, and on a card that
names every PR. The process is
[`sdlc/processes/saturation-meta-merge.bpmn`](../../processes/saturation-meta-merge.bpmn)
(`Process_SaturationMetaMerge`), called from the merge manager's watch loop
([`merge-manager-watcher`](merge-manager-watcher.md)).

## Trigger

Offer the meta-merge, but do not run it, when either of these holds on a
repository:

- PR runs have been queued for 60 minutes or more and no PR has landed in
  that time, or
- the queue has 10 or more runs across the repositories the swarm shares, and
  the owner says the runners are full.

Measure it with `gh api "repos/<o>/<r>/actions/runs?status=queued"` and the
`created_at` of the oldest run. Offering it is a card (step 3). Running it is
the owner's tap.

## Steps

1. **Hold the swarm.** Message every sibling thread that pushes to the
   repositories in scope: no new pushes, PRs, merges, run cancels or re-runs
   there until you post `meta-merge done`. Ask the coordinator to pass the
   hold on to any thread you cannot reach. A sibling that owns a PR in the
   batch names the head it wants merged. Check that the head you fetch is that
   head.
2. **Dry run.** Run the script (below) without `PUSH=1` on each repository.
   It builds `claude/meta-merge-<date>` from `origin/main` and merges each PR
   head with `--no-ff`, in order. It skips a PR that:
   - conflicts with `main` plus the PRs before it, generated paths included
     (the stacking rule in `merge-queue`), or
   - touches `.github/workflows/` (an agent token cannot push a workflow file)
     or `subscriptions/` (held, fixity-checked copies; change those upstream).
3. **Ask once, naming every PR.** Use [`ask-the-person`](../../../skills/conduct/conduct-core/ask-the-person.md).
   For each repository, list:
   - the PRs to include,
   - the PRs to leave out, each with its reason: conflict, draft, red,
     protected path, content, a thread waiting on the owner, or an open
     security review, and
   - the merge method: merge commits throughout, never squash or rebase, so
     GitHub marks each included PR as merged.

   Options: A go with green and pending, B also include the red ones, C dry
   run only, D cancel. Recommend A. A PR the card does not name gets no merge
   from this card. The safety check refuses it, and the owner must tap again.
   The owner taps the card in the thread that merges. An answer relayed
   from the project chat or another thread is refused by the safety check,
   so post the merge card in this thread.
4. **Cancel the queued PR runs** on the repositories in scope, and log each
   one to a TSV file. Do NOT cancel a `main` push run that has already
   started. It is cancelled by the next push anyway, and cancelling
   it by hand loses the record of `main`.
5. **Build and push** with `PUSH=1`, against fresh `origin/main`. `main`
   moves while the card waits, so check the script's output again. A PR that
   is already merged is skipped as a no-op.
6. **Open one PR per repository** from the meta-merge branch, listing its
   members and the card. Merge it with `merge_method=merge`.
7. **Close out.** Check that every member PR shows `merged`. A stacked PR
   (its base is another PR's branch, not `main`) is not marked merged by
   GitHub. Its commits are on `main`, so close it with a comment saying so. Comment on each
   with a link to the meta-merge PR and the session. Post `meta-merge done`
   to every sibling you held, with what landed and what is still open.
8. **Watch `main`.** Re-run any `main` run that a closing PR's run cancelled
   (a closed PR's run can join `main`'s concurrency group).
   Report green or red to the owner. On red, open the fix as a normal PR
   against `main`, and never revert the whole meta-merge without the owner.

## Safety rules (STRICT)

- **Only on the owner's tap.** A coordinator's or sibling's request is not
  approval. "Fix until green" is not approval (`merge-to-main`).
- **Never content.** No committee content, no change-set (CS-) PRs, no BPMN
  layout redraws unless the card names them, and nothing on WHO or `smart-*`
  upstream repositories.
- **Never protected paths:** `.github/workflows/` and `subscriptions/`.
- **Never drafts**, and never a PR that is waiting on an open owner decision
  or security review, unless the owner names it.
- **Never resolve a conflict in the meta-merge branch.** A PR that does not
  stack goes back to its owner, as in `merge-queue`.
- **Bypassing `merge:guard` is the point, so record it.** The meta-merge PR
  body names the card, and each member gets a comment. That record replaces
  the guard's verdict.
- **The hold has an end.** Post `meta-merge done` even when the run is
  stopped at C or D, so that no sibling stays held.

## The script

`meta-merge.sh <clone-dir> <owner/repo> <branch> <pr>...`. With `PUSH=1` it
also pushes. A copy is kept in the project files at
`meta-merge/meta-merge.sh`.

```bash
set -u
dir=$1 repo=$2 br=$3; shift 3
cd "$dir" || exit 2
git fetch -q --depth 200 origin main
git checkout -q -B "$br" origin/main
for n in "$@"; do
  git fetch -q --depth 200 origin "pull/$n/head:pr-$n" || { echo "SKIP #$n fetch-failed"; continue; }
  bad=$(git diff --name-only origin/main...pr-$n | grep -E '^(\.github/workflows/|subscriptions/)' | head -3 | tr '\n' ' ')
  [ -n "$bad" ] && { echo "SKIP #$n protected-paths: $bad"; continue; }
  if git merge -q --no-ff --no-edit -m "Meta-merge: include #$n" "pr-$n" >/dev/null 2>&1; then
    echo "OK   #$n"
  else
    echo "SKIP #$n conflict: $(git diff --name-only --diff-filter=U | head -5 | tr '\n' ' ')"
    git merge --abort
  fi
done
echo "branch $br = $(git rev-parse --short HEAD) on main $(git rev-parse --short origin/main)"
[ "${PUSH:-0}" = 1 ] && git push -u origin "$br"
```

## What this does not do yet

- The trigger is measured by hand. A watcher that offers the card when the
  threshold is crossed is follow-up work.

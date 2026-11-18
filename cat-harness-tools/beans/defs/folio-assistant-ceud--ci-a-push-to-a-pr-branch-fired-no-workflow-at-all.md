---
# folio-assistant-ceud
$schema: bean/1.0.0
title: 'CI: a push to a PR branch fired NO workflow at all — a PR that looks untested rather than red'
status: completed
type: bug
priority: normal
created_at: 2026-09-24T17:30:00Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-24, working PR #1241.

`6603c3fbc4d` was pushed to `claude/cool-fermi-htir5p`, an open PR branch.
**No workflow fired for it at all** — not `code-quality-gates`, not
`jsonld-gen-check`, not `feature-staging`. The latest run of every workflow
stayed on the previous SHA, `f1fb1556576`, for 35 minutes.

## What was ruled out

- **The push landed.** `git ls-remote origin claude/cool-fermi-htir5p` returned
  `6603c3fbc4d…`, so the ref was on the remote.
- **No path filter.** `code-quality-gates.yml`'s `on:` block is
  `pull_request: / merge_group: / push: branches: [main] / workflow_dispatch:` —
  bare `pull_request`, no `paths`, no `types`, so the default
  `opened|synchronize|reopened` covers a push to the head branch.
- **No queue backlog.** Runs on this branch were completing in ~4 minutes
  throughout, before and after.

A hand `workflow_dispatch` ran and went green, so nothing about the tree was
wrong.

## Why this matters more than a flake

`1xhc` at the workflow level: **a gate that does not fire is indistinguishable
from one that passed.** But this is the worse half of that — a red PR announces
itself, whereas a PR with no runs at all looks *untested*, and the GitHub UI
shows the previous commit's green checks beside the new head. An agent or a
person reading "checks passed" is reading a verdict about a different commit.

I noticed only because I was tracking the SHA by hand.

## Done when

Either a second occurrence is caught with enough evidence to name the cause, or
somebody establishes this was a one-off GitHub delivery failure and says so
here. **One occurrence is not a pattern** — this bean exists so the second one
is not diagnosed from scratch.

Not actionable in code today. The delivery logs that would settle it
(Settings → Webhooks → Recent Deliveries) are not readable from a session.

## SECOND OCCURRENCE — 2026-09-25, PR #1348 (appended by another session)

This is the second occurrence the "Done when" asks for. Same shape as #1241, on
a different branch, 26 hours later — so **it is not a one-off**, and the first
entry's alternative ("somebody establishes this was a one-off GitHub delivery
failure") is now closed off.

`9132c5ee7a4` was pushed to `claude/fix-detangle-sidecar-065p`, the open head of
PR #1348, at **19:02:55Z**. **No workflow fired for it.** The latest run of every
workflow stayed on the previous SHA, `e82eb541c47`, for **14 minutes**, until a
later commit was pushed.

**Two workflows were DUE and neither fired** — stated precisely, because "no
workflow fired" and "no workflow was due" are the two readings this bean exists
to keep apart, and a count of workflows is worthless without their path filters:

| workflow | due for this push? | fired |
|---|---|---|
| `code-quality-gates` | **yes** — its `on:` block carries no `paths:` filter, by design | no |
| `feature-staging` | **yes** — the push touched `cat-harness/docs/**` (4 files) and `cat-harness/skills/**` (1) | no |
| `jsonld-gen-check` | **no** — matched none of its 15 paths | n/a |

I first wrote this entry naming all three as "did not fire". That was an
overclaim: the third was never due. Corrected before the entry was merged. Two
due and zero fired is the stronger statement anyway, because it is checkable.

Ruled out the same way as #1241, and the checks all came back the same:

- **The push landed.** `git fetch` then `git log -1 origin/<branch>` returned
  `9132c5ee7a4`; the reflog records `update by push` at 19:02:55.
- **No path filter**, and the `on:` block is unchanged from what the first entry
  quotes.
- **No queue backlog** — see the control below, which is stronger than the
  first entry's "runs were completing in ~4 minutes".

### The new evidence: a near-simultaneous control push that DID fire

This is what #1241 could not supply, and it narrows the cause considerably.
At **19:13:37Z**, ten minutes into the silence, a push to a *different* open PR
branch (`claude/0uu2-declare-deploy-tools`, PR #1327) fired **three** workflows
within seconds — `code-quality-gates`, `jsonld-gen-check` and `feature-staging`,
all created at `19:13:37`.

All three were genuinely due there, checked the same way rather than assumed:
that push carried 633 files, of which 62 match `cat-harness/scripts/**`, 201
match `cat-harness/docs/**` and 8 match `cat-harness/content/**/*.ts`. So the
control is **3 due / 3 fired** against the failure's **2 due / 0 fired**.

| | push at 19:02:55 | control push at 19:13:37 |
|---|---|---|
| branch | `claude/fix-detangle-sidecar-065p` (PR #1348) | `claude/0uu2-declare-deploy-tools` (PR #1327) |
| workflows DUE (by path filter) | 2 | 3 |
| workflows fired | **0** | **3**, within seconds |
| ref on remote afterwards | yes | yes |

So it is **not** an account-wide or repository-wide outage, not a runner
shortage, not a quota exhaustion and not a queue backlog: the same repository
delivered a push event normally while this branch's push was still unserved.
That localises it to the **delivery of an individual push event**, which is
consistent with the first entry's guess but was not established by it.

### How it was cleared, and what was deliberately not done

A later real commit — a base merge that was owed anyway, `main` having moved 10
commits — fired `code-quality-gates` at **19:25:46**, four seconds after its
push. So the branch was never in a bad state.

**No empty commit and no close-and-reopen**, both of which are forbidden. A
`workflow_dispatch` was available (the `on:` block has it) and was deliberately
NOT used: a dispatch run tests the branch alone, whereas a `pull_request` run
tests the branch merged with `main`, and that distinction had already cost this
same PR a real failure earlier the same day — `check:prov-qaqc` passed on the
branch and failed on the merge. A dispatch would have produced a green that was
evidence about the wrong tree.

### What this adds to "Done when"

The original clause is satisfied on its first limb — a second occurrence, with
enough evidence to localise the cause to individual push-event delivery rather
than to the repository, the runners or the workflow definitions. What is still
missing is a **detection**, and that is the part worth stating as work:

- [x] something notices that a pushed SHA has no runs after N minutes. This is
      the actionable half and does not need the webhook delivery logs: the runs
      API answers "are there any runs for this SHA" directly, which is how both
      occurrences were confirmed
- [x] the guidance says what to do when it happens — specifically that a base
      merge or a real commit is the legitimate way to get a verdict, and that a
      `workflow_dispatch` green is a verdict about the branch rather than the
      merge, so it does not substitute for one
- [x] MEASURED AFTER: the second occurrence is detected by a tool rather than
      by an agent tracking the SHA by hand, which is how both of these were found


_2026-09-29_ — **Re-parented `1swy` → `1xhc`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). A push that fires no workflow is exactly 1xhc's thesis: a gate that does not fire looks like one that passed.

## Evidence of completion (2026-10-07)
- Landed in PR #1359 (merge commit `fcb14e3ca443`): Push-to-PR workflow trigger occurrence diagnosed and delivery control established.
- Re-derived independently on 2026-10-07: PR branch workflow triggers active and verified.

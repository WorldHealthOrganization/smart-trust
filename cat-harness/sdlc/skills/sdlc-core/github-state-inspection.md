---
name: github-state-inspection
description: >-
  Answer questions about GitHub-hosted state — is a page published, where does
  it live, did CI pass, does a branch exist — by reading the ref or the API,
  never by composing a URL or fetching one. The first check for any deployment
  or 404 question is `git ls-tree` of the publish ref.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Reading GitHub state — resolve the ref, do not compose the URL

> Skill id: `github-state-inspection` · Package: `sdlc-core`

Every question of the form *"is it published?"*, *"why is this 404?"*, *"did
that deploy?"* has an authoritative answer in a **ref**, and a misleading one
in an HTTP request. This skill says which to reach for and in what order.

## The rule

> **A published URL is LOOKED UP in the publish ref's tree. It is never built
> from the source path.**

`cat-harness/docs/guides/agent-onboarding.md` publishes to
`/docs/cat-harness/guides/agent-onboarding.html`: the layer segment moves from
in front of `docs/` to behind it. Anyone composing the URL from the source
path gets a 404 and concludes the page is missing.

Source paths also move, and some pages (proposals, for one) are kept in the
repository but **deliberately unpublished**. A URL composed from a remembered
source path can assert a page exists where the repository has decided none
should.

## First check for ANY deployment question

**Look at the branch.** Not the site.

```sh
git ls-remote origin refs/heads/gh-pages        # does the publish ref exist at all
git fetch origin gh-pages
git ls-tree --name-only FETCH_HEAD              # what is at the root
git ls-tree -r --name-only FETCH_HEAD | grep -i <thing>   # where does it actually live
```

For a staging preview, the subtree is `branches/<branch-slug>/`, and
`git ls-tree --name-only FETCH_HEAD branches/` lists every branch with a live
preview. The slug replaces `/` with `-`: `claude/festive-galileo-s7ibx0`
becomes `branches/claude-festive-galileo-s7ibx0/`.

The MCP GitHub tools answer the same question without a fetch —
`get_file_contents` with `ref: "refs/heads/gh-pages"` and a directory path
returns the listing. Use whichever is to hand; both read the ref, which is the
point.

## Present on the ref is not the same as SERVED — read the Pages deployment

The step above is authoritative for *what exists*. It is not authoritative for
*what a reader gets*, and the gap between them has a mechanism worth knowing.

Pages-from-a-branch publishes through a `pages build and deployment` run, and a
new push to the publish ref **cancels the run already in flight**. So a commit
can sit on `gh-pages` with the file plainly there while the last *successful*
deployment is an older tree.

```sh
git log --format='%h %ad %s' --date=iso -10 origin/gh-pages   # how fast is the ref moving
```

and the deployments themselves, which only the API has:

```
actions_list  method: list_workflow_runs
              workflow_runs_filter: { branch: "gh-pages", event: "dynamic" }
```

Read `conclusion` per run, not just the newest — `cancelled` is the one that
misleads, because nothing is red and yet nothing shipped from that commit.
Each staging deploy pushes *two* commits about ten seconds apart, the payload
(`staging(<slug>): from <sha>`) and then `render-log: rendered …`, and the
second reliably cancels the first's build, so on a busy publish ref many recent
deployments read `cancelled`.

So when a preview 404s and the file **is** on the ref:

1. Check whether a deployment has succeeded *since* the commit that added it.
   A `cancelled` newest run with an older success means the tree being served
   predates your push.
2. Check whether your subtree survives in that older tree too — on a ref this
   busy, `git cat-file -e <commit>:<path>` over the recent commits answers
   "was it ever missing" directly, and a path present at every one of them rules
   the ref out as the cause entirely.
3. Only then is the question about Pages rather than about the repository, and
   it is a wait-or-escalate, not a fix.

**What this does not license.** A `cancelled` run is an explanation to verify,
never one to assert: it is equally consistent with a page that is serving fine.
From a container that cannot reach the host, the honest report is the mechanism
plus what you could and could not establish — not "it is probably propagation".

## Why `curl` is not the first check, and often not evidence at all

Three distinct failures produce an identical-looking result, and only one of
them means the page is missing:

| what you see | what it can mean |
|---|---|
| `404` | the page is not published — **or** your URL was composed wrong |
| `000`, `CONNECT tunnel failed, response 403` | the agent's proxy blocks the host. Says **nothing** about the site |
| `200` on a stale page | the deploy has not run yet; the old build is still served |

In a Claude Code container, outbound HTTPS goes through a proxy that **blocks
`github.io`**. A `curl` against a Pages URL from here returns `000` and a 403
tunnel error regardless of whether the page exists, so "could not determine"
from a fetch is no answer when the ref holds one.

**"Could not determine" is a third state and must never be rendered as a
pass** — but it is also not a place to stop when another source can determine
it. Reach for the ref first, and a fetch only to confirm something the ref
cannot tell you (that a redirect works, that a asset loads).

## CI state — read check RUNS on the head sha

Commit *statuses* and check *runs* are different APIs and this repository uses
the second. `pull_request_read` with `method: "get_status"` returns
`{"state":"pending","total_count":0,"statuses":[]}` on a PR whose eight checks
are green, because there are no legacy statuses to report. Use
`method: "get_check_runs"`.

Further traps:

- **Check the sha.** A `check_suite.completed` event names a `head_sha` that
  may already be superseded by your own later push, and the staging workflow's
  own commits appear as shas that are not PR heads at all. Compare against the
  PR's current head before concluding anything.
- **`mergeable_state: "unknown"`** means GitHub has not finished computing it,
  not that the PR is fine. `"dirty"` is a real merge conflict and is work now.
- **"No suite failed" over ZERO suites is not a pass**, and neither is a clean
  run list that is only PART of the check set. See below.

### A clean check set and a COMPLETE check set are different questions

A `check_suite.completed` event says no third-party suite is still running or
failed. Its own harness note admits the gap: *suites with no runs, cancelled
suites and legacy statuses are not covered; verify the PR's overall state
before acting.* So the event is evidence about the suites that EXIST, and
silence about the ones that do not yet.

The same hole exists one layer down: a classifier that guards only the EMPTY
run list passes a PARTIAL one — one clean run where thirteen are owed reads as
`PASS — 1 check(s) completed clean`.

**So before reading a clean check set as green, ask whether it is the whole
set.** `check:head-has-run` answers it — `coverageFor` reconciles the runs
against the workflows the tree itself declares, and `mergeStateForHead`
returns `conflicted` for the case below. `bun run cat ci:watch` composes both.
**Do not build a second reconciliation**; two answers to one question are free
to disagree.

Four causes of an absent-or-inert run, which must not collapse into one
silence. The fourth is not an absence: the run exists, it completed, and it
executed nothing.

| cause | how it reads | what to do |
|---|---|---|
| **a conflicted head** | no `pull_request` run is published AT ALL — the forge mints no `refs/pull/N/merge`, and a `pull_request` run checks that ref out | merge the base in. The checks are not slow; they are never coming |
| **a filtered trigger that owed no run** | genuinely nothing was due | stay silent — loosening this produces false fires |
| **a run never created, unexplained** | a workflow the tree declares `on: pull_request` has no run and the head is mergeable | a **finding**, not a wait |
| **a bot-actor push** | the runs EXIST and are `completed`, with `conclusion: action_required` — approval was owed and never given, so no job ran | read the dispatched run instead; see below |

A `draft` PR is a fifth reading of the same silence: `Code-quality gates` does
not fire from `pull_request` while a PR is a draft, so a draft head owes those
runs no more than a filtered trigger does. Mark it ready, do not dispatch.

#### `conclusion: action_required` is not a failure, and not a pass

Counting conclusions makes this invisible. `action_required` is a terminal
conclusion that is neither `success` nor `failure`, so a predicate written as
`conclusion != "failure"` reads it as fine and one written as
`conclusion == "success"` reads the head as merely incomplete. Neither says
what is true: **the workflow was reached, approval was owed, and no job body
executed.**

A head pushed by a bot actor gets `pull_request` runs that are all
`action_required`; a head pushed by a session gets runs that execute.

**The merge-forward bot does not void the gates.** With no `MERGE_MAIN_TOKEN`
set, `merge-main.yml` **dispatches** both gating workflows —
`code-quality-gates.yml` and `jsonld-gen-check.yml` — so the merge commit is
proved by CI rather than trusted; Feature Staging is left alone because it is
preview-only. Such a head shows the pair `pull_request: action_required` beside
`workflow_dispatch: success`, on the identical head sha.

So the rule for reading a head is **by workflow and sha, never by event**: a
`workflow_dispatch` run of an owed workflow on the exact head is proof, and
after a merge-forward it is arguably better proof, because the branch tip
already contains the base and the dispatch tests the merged content rather
than a synthesised merge ref. `check:head-has-run` already reads it this way,
so do not add an event filter to it.

`MERGE_MAIN_TOKEN` is a **convenience**, not a correctness fix: it makes the
PR's own runs fire on the bot's push instead of needing a dispatch. Do not
hand-push commits to "restore" gates that already ran.

**Ask whether the BASE moved before calling any verdict non-deterministic.** A
`pull_request` run tests the head merged with `main` as it was at push time, so
main moving flips verdicts in both directions with no change to your branch —
a green head can become a red merge commit, and a red check can turn green when
a sibling's fix lands. That is not a flapping gate.

## Order of resort

1. **The ref** — `git ls-tree` / `get_file_contents`. Authoritative for what
   exists and where.
2. **The API** — check runs, PR state, branch list. Authoritative for what
   happened.
3. **The workflow run** — `actions_list` / `get_job_logs`. Authoritative for
   *why* it happened.
4. **An HTTP fetch** — last, and only for what the first three cannot answer.
   From an agent container, treat a failure as a proxy result until proven
   otherwise.

**From a cloud agent container, use REST.** The proxy blocks GraphQL, so
`gh pr view` and other GraphQL-backed `gh` commands fail; `gh api repos/...`
works. Actions log blob URLs return 403 through the same proxy, so read logs
with the GitHub MCP `get_job_logs` (`return_content`, `tail_lines`), not by
fetching the URL it would hand you.

---
# folio-assistant-52cz
$schema: bean/1.0.0
title: A CONFLICTED PR CREATES NO pull_request RUN, and g62s's headUnjudged cannot see it — the one absent-run case that needs no glob evaluation
status: completed
type: task
priority: normal
created_at: 2026-09-30T14:07:18Z
updated_at: 2026-09-30T18:25:48Z
parent: folio-assistant-1xhc
---

## The incident, measured

PR #1589, 2026-09-30. `Repository gates (hard)` failed on `86e403cdfdd`. I
fixed the cause (`readme:subgraphs`, two stale directory READMEs), pushed twice,
and **no `Code-quality gates` run was ever created for either new head.** The
PR went on showing a red from a superseded commit.

The cause was not the queue and not a path filter. The PR was
**`mergeable_state: "dirty"`**, and GitHub creates no `pull_request` workflow
run for a conflicted PR, because there is no merge commit to test. Merging main
and pushing produced run `36726432307` within seconds — which is the
falsification: the conflict was the only thing suppressing run creation.

**Two signals actively read as fine while this held:**

1. Nine `Code-quality gates` runs were `in_progress` for SIBLING branches in
   the same two minutes, so the workflow was plainly firing — just not here.
2. The harness `check_suite.completed` notice said *"No third-party check suite
   on the PR's head_sha is still running or failed."* That is **true**, and it
   reads like green. **Absence of a run and success of a run are not
   distinguishable from it.**

## Why `g62s` cannot catch it, and why this case is the cheap one

Bean `g62s` built exactly this detector — `headUnjudged`, *"no run for the head
was ever created"* — and recorded it as **inert here**: of 36 workflows,
`pushTriggerOf` returns `true` for **0**, and the four `undefined` (filtered)
ones include `code-quality-gates.yml`. It then declined the "third thing",
evaluating `paths` / `paths-ignore` globs against the head commit's files,
as a scope decision for the owner rather than an afternoon — because getting
glob semantics subtly wrong reintroduces the false fires the design refuses.
That reasoning is sound and this bean does not reopen it.

**But this case is a different mechanism and needs none of it.** `g62s`
reasoned about **push** triggers and their path filters. The trigger that
produced no run here is `pull_request`, declared with **no `paths:` filter at
all** — its own `on:` block says so, and says why: *"The TypeScript job is the
gate for the whole repo, and a filter is how a gate stops covering the file that
broke it."*

So for a pull request there is nothing to evaluate. One fact already in hand
explains the absent run completely:

> `mergeable_state == "dirty"` ⇒ no `pull_request` run will be created for this
> head, and the newest run's conclusion describes a commit nobody is testing.

That is the same field bean `h2s9` is already about — it reads `unknown` as
"could not be read" when it means "not computed yet". `dirty` is the third
value, and it is not ambiguous.

## Done when

1. A PR whose `mergeable_state` is `dirty` is reported as **conflicted, CI not
   running** rather than as its newest run's conclusion. Distinct from `unknown`
   (not computed — `h2s9`) and from red.
2. `headUnjudged`, or whatever reports it, distinguishes three absent-run causes
   rather than one silence: a filtered trigger that owed no run (`g62s`'s
   conservative case, still silent), a conflicted PR (this bean, decidable), and
   a run that was never created for an unknown reason (a finding).
3. Falsified before shipping: a PR made conflicted is reported as conflicted and
   NOT as green; the same PR resolved is reported on its real run. Plant, fire,
   restore, pass.
4. The `check_suite.completed` reading — that "no suite failed" over zero suites
   is not a pass — is written down wherever an agent is told how to read PR
   events. **Prompted, not written unasked**: this bean records the finding, and
   whether it becomes corpus guidance is the owner's call
   (`surprise-to-corpus`).

## What this does NOT claim

That `g62s` was wrong, or that its inertness is a defect to fix by loosening
`pushTriggerOf`. Its own measurement shows loosening produces a false fire on
`jsonld-gen-check.yml`. The claim is narrower: **one absent-run cause is exactly
decidable today**, and it is the one that cost a real PR two wasted pushes.

_2026-09-30T18:23:03Z_ — Claimed by claude/magical-archimedes-4qkfxp-52cz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Built 2026-09-30 — boxes 1–3; box 4 is the owner's

Branch `claude/magical-archimedes-4qkfxp-52cz`.

- **`prVerdict(mergeableState, headVerdict)`**, a pure function in `src/workflow/check-verdict.ts` beside the existing precedence rules:
  - `dirty` gives **undetermined, "conflicted — no pull_request run will be created… NOT a pass"**, even over runs that all passed;
  - `unknown` cannot confirm a pass (a failure or pending run stands);
  - every other state falls through to the runs.
- **`bun run cat ci:watch --pr <n>`** reads the PR's head and `mergeable_state` on every poll, and prints the state.
  - **GitHub computes mergeability lazily.** Measured: seven open PRs read `unknown` on a first unauthenticated read, and one read `clean` 8 s later.
  - So `--pr` re-reads up to four times while the state is `unknown`, and names it if it is still unknown.

**Box 2 — three absent-run causes, for a PR:**
- **conflicted** is reported as such (this bean);
- a head with **no runs and no conflict** is `verdictOf`'s existing "no check runs on this commit — NOT a pass", which is the finding;
- **g62s's filtered-trigger** case stays in `check:ci-health`'s `headUnjudged`, which judges the default branch, where no conflict can exist.

**Box 3 — falsified on live PRs, not only fixtures** (`ci:watch --pr <n> --once`, 2026-09-30 18:24):
- #1652, #1628, #1615, #1590 and #1581 all read **dirty → UNDETERMINED, conflicted**.
- #1633 read `unknown` through four reads with one green quick check. The first version reported **PASS**; that is the defect the `unknown` rule now closes.
- Tests: three new cases in `check-verdict.test.ts` (18 pass).

**Box 4 is not written.** It asks whether the reading that "no suite failed" over zero suites is not a pass should become corpus guidance where agents are told how to read PR events. The bean marks that the owner's call; it is put to them 2026-09-30.

## 2026-09-30 19:10 — #1664 landed the core first, and with the better signal

#1664 (bean `6lre`) merged `verdictForCommit`, which reports a conflicted head as **undetermined**, cites this bean, and detects the conflict from the absence of `refs/pull/N/merge`. That is the forge's own answer. REST `mergeable_state`, which this branch had used, is computed lazily and can be served stale (`fx5r`).

So #1659 was narrowed when merging main:
- `prVerdict` and its tests are **withdrawn**, because they were a weaker duplicate.
- What remains is `ci:watch --pr <n>`. It reads the head from `refs/pull/<n>/head` on every poll (the same ref family the probe uses) and hands it to `verdictForCommit`.

Live, 2026-09-30 19:10, `ci:watch --pr <n> --once`:
- #1668 (conflicted) → UNDETERMINED: conflicted
- #1665 → FAIL on its real run

**New finding, not fixed here:** #1652, which is **merged**, also reads "CONFLICTED". A merged PR keeps `refs/pull/N/head` but loses `refs/pull/N/merge`, so `mergeStateForHead` cannot tell merged from conflicted. That matters only for `--pr` on a closed PR. It is `check-head-has-run`'s probe to refine, not this branch's.

## 2026-09-30 19:35 — a merge ref that is PRESENT can still be STALE

`ci:watch --pr 1665` reported a "partial check set", while REST said `dirty`. The cause: `refs/pull/1665/merge` was 8cdfbc1, which GitHub built for the **earlier** head 1b7b537. When a new head conflicts, GitHub leaves the old merge ref in place. `mergeStateForHead` read existence alone, so it called the head `mergeable`, and `noRunAdvice` then offered to dispatch a run on a tree that will never exist.

**Fixed in the follow-up to #1659:** the merge commit's second parent must BE the head. When it is not, the answer is `unknown`, never `mergeable`. It is also not `conflicted`, because a mergeable head's ref is stale too for about 15 s after a push (PR #813), and one read cannot tell the two apart.

Live, 2026-09-30:
- #1665, stale ref → `unknown`, where it used to be `mergeable`;
- #1673, fresh ref → `mergeable`.

## Box 4 — OWNER RULING 2026-09-30: write it. Done; the bean is complete

Asked in session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB: should the reading that "no suite failed" over zero suites is not a pass become guidance where agents learn to read PR events? **The owner chose to write it.** It is now in `skills/sdlc/sdlc-core/ci-health.md`, §"For ONE commit, zero checks is not a pass". That covers the conflicted PR that gets no `pull_request` run, the partial check set, and the merge ref built for an earlier head. The tools enforce it (`verdictForCommit` in #1664, `ci:watch --pr` in #1659, the stale-ref probe in #1675); the skill paragraph is for an agent reading events without them.

All four boxes are done: 1 to 3 via #1664, #1659 and #1675, and 4 here.

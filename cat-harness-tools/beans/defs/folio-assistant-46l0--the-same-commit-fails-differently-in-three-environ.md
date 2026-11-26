---
# folio-assistant-46l0
$schema: bean/1.0.0
title: The same commit fails DIFFERENTLY in three environments, so a green run cannot be read as a green tree
status: completed
type: bug
priority: normal
created_at: 2026-09-26T06:33:48Z
updated_at: 2026-10-22T16:34:57Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26 on ONE commit, `3c2523a8071`, three ways:

| where | `bun test` failures |
|---|---|
| GitHub Actions | **7** |
| a clean `git worktree` of that exact sha, full suite | **8** |
| the two disagreeing files, run alone | **0** |

The sets are not nested. CI had two the worktree did not (`this repository's own
corpus`, `the real corpus`); the worktree had three CI did not (`FOLIO_ROOT
detection`, `every instance is found`, `the reader is told the repository root`).
Pristine `origin/main` in a worktree gave the same 8 as the middle row, so the
worktree's extra three are an artefact of the worktree rather than of the branch
— all three are about locating the repository root.

## Why this is worth a bean and not a shrug

**"I ran it locally and it passed" is not evidence, in either direction.** In
one afternoon this cost:

- a fix nearly pushed for a failure that was not this PR's (the two corpus
  tests looked new because they had never appeared locally; they were on
  `main`'s own CI run all along)
- a "chain" claim in a merged commit message that over-attributed two gates,
  because they went red after a change and the counterfactual was not tested
- a bisect against `origin/main` to learn that a page had been translated

Each was caught by re-measuring in a THIRD place. None was caught by reading.

## Its relation to `sff8` — adjacent, not the same

`sff8` is contention inflating a per-test budget ~35x, so its symptom is a
**timeout**, and its remedy is about the budget. This is broader: the failures
above are **assertion failures**, not timeouts, and they differ by environment
rather than by load. `sff8`'s `profile-scoping` case is one instance of the
general shape; this is the shape.

Recorded here rather than appended to `sff8` for that reason. If the owner reads
them as one, fold this in.

## Done when

- [ ] Each of the five environment-sensitive tests is classified: legitimately
      environment-dependent (and then it should SAY so on failure), or wrongly
      coupled to its environment.
- [ ] The three worktree-only failures are confirmed as worktree artefacts —
      they all concern repository-root detection, so a detached worktree is
      plausibly just an unsupported layout, and if so the tests should skip
      rather than fail.
- [x] A stated answer to: what does a green local run entitle you to claim?
      Today the honest answer is "less than everyone assumes", and that is not
      written anywhere.

## Not claimed

Recorded and left `todo`. Found while driving three PRs through `main`'s red on
2026-09-26.

_2026-09-27T09:31:55Z_ — Claimed by claude/brave-hypatia-r820sf — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Re-measured 2026-09-27: the divergence does NOT reproduce — item 3 answered, 1 and 2 have no subject

Worked from `claude/brave-hypatia-r820sf`. **Items 1 and 2 are deliberately left
unchecked.** They are *moot*, not *done*, and ticking them would assert I had
classified five tests when there was nothing failing to classify. If the
divergence returns they become live again, which is why this bean stays open.

### The measurement

Three environments, one commit (`a7a1668b728`, far ahead of the `3c2523a8071` this
bean measured):

| where | `bun test` failures |
|---|---|
| GitHub Actions, PR #1461 | **0** (10 success, 2 skipped) |
| this checkout, full suite | **0** |
| a detached `git worktree` at the same sha, real dependencies, full suite | **0** — 12231 pass, 56 skip |

The three worktree-only failures this bean names — `FOLIO_ROOT detection`, `every
instance is found`, `the reader is told the repository root` — pass in the
worktree both as a 3-file subset (31/31) and inside the full suite. The two
CI-only ones are answered by CI's own green run rather than by a commissioned
one.

**Why this is not evidence the bean was wrong.** The tree changed materially in
between: `sff8`'s module-scope hoist removed the per-test-budget pressure, #1452
changed `saveQaScriptSidecar`, a new `check:environment` guard landed, and 18+
commits of `main` merged. A day-old divergence not reproducing after that is
expected; it says the instances are gone, not that the shape was imaginary.

### The one failure I DID find was my own measurement, and a new guard named it

The first worktree run came back **1 fail**: `this repository, right now > is not
distorted`. Cause, quoted from the check rather than inferred:

    "bean": "qook",
    "effect": "the root `node_modules` is a SYMLINK, so any tool that resolves a
               real path through it reports a location this repository does not contain"

I had symlinked `node_modules` into the worktree — and I had done what an earlier
session recorded doing, *confirming it git-ignored first*. **That is not
sufficient.** Git-ignoring addresses the corpus-scanning confound; path
resolution is a separate one. Replaced with a real `bun install` (379 packages,
189 MB) and re-ran: 0 failures.

So the class this bean is about is now **guarded** rather than merely absent, by
a check that did not exist when the bean was written. That is the most useful
thing this re-measurement found, and it is why item 3 could be written as an
inference rule rather than a warning about five named tests.

### Item 3 — done, in `skills/sdlc/sdlc-core/prepare-merge.md`

A new section, *"What a green LOCAL run entitles you to claim"*, beside the
existing *"A clean merge can produce a wrong artefact"* — same family: a green
signal meaning less than it seems. It states the entitlement in one line (*the
gates I ran passed, on the tree I ran them on, in this environment*) and then
four things it does **not** entitle, each with its cost:

- *"CI will pass"* — CI tests `refs/pull/N/merge`, a tree neither parent holds
  (`1xhc`);
- *"the gate set passed"* — only if you ran the gate set; a hand-picked subset
  cost two CI cycles on 2026-09-27, on `check:partition` and on `no check script
  is unrun`, neither visible to `tsc`, `eslint` or the targeted tests;
- *"nothing is failing, so nothing is wrong"* — a conflicted head produces no
  merge ref, so `pull_request` workflows never fire and the PR shows **zero**
  check runs, which reads as untested rather than red;
- *"it passed in isolation, so it is not mine"* — isolation removes the only
  condition under which it failed (`9v4m`, and `sff8`'s measured case).

Plus the environment clause: run `check:environment` before trusting a run from
any hand-built tree, and install dependencies rather than borrowing them.

### For the owner

This bean may now be closeable on the ground that the shape is guarded and the
instances are gone — but that is a judgement about whether items 1 and 2 still
want doing, and it is not mine to make.

**Correction, and it removes the second half of the question.** The line above
read *"`sff8` has since been measured and closed, which is an input to that"*.
**`sff8` is not closed** — `status: in-progress` on `main`, `updated_at`
2026-09-27T11:10:31Z, and [#1473](https://github.com/litlfred/folio-assistant/pull/1473)
(11:39Z, a sibling session) adds a measurement to it with its last box still
open and four options on it. Saying "closed" was the defect this whole branch is
about: a confident report of something I had not read.

Read, it answers the fold question outright, and the answer is **no**. #1473
reframes `sff8` as a **budget-to-cost mismatch**: at least **nine** tests
already run past the 5000 ms default and do **not** fail, because they derive
their own budget — `declared-directory-resolves.test.ts` at 22158 ms, at
600 ms/module — while everything else silently inherits 5000 ms, so the failure
is whichever default-budget test sits nearest the line when the machine is
busiest. That is a property of how a budget is **declared**. This bean's
failures are assertion failures that differ **by environment at the same load**,
and its remedy is a test SAYING which environment it depends on. Folding would
put those two remedies under one bean and give it no falsifier.

So one question remains rather than two: do items 1 and 2 still want doing, with
nothing currently failing to classify?

Verified: `skill:register` (6 artefacts current, 276 skills / 19 packages),
`skill:register:check`, `skills:docs:check`, `check:bean-restates-skill`,
`check:command-paths`, `check:declared-paths`, `kg:audit:check`,
`check:environment`.

_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

## Closed 2026-10-22 — owner ruling

Owner, 2026-10-22, asked whether to close as guarded (nothing failing to
classify; environment confounds caught by `check:environment`; item 3 in
prepare-merge): *"1 yes"*. Items 1 and 2 stay unticked on purpose — moot, not
done. If an environment-dependent divergence returns, open a new bean citing
this one. Session https://claude.ai/code/session_01JkK6uP3iU2etyMbrw7v3cu.

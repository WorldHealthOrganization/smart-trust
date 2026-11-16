---
# folio-assistant-h2s9
$schema: bean/1.0.0
title: The sweep asks gh for mergeable, whose UNKNOWN means 'not computed yet' — and renders it as 'could not be read'
status: completed
type: bug
priority: high
created_at: 2026-09-22T00:47:08Z
updated_at: 2026-10-07T05:12:00Z
parent: folio-assistant-1xhc
---

`sddf` fixed the sweep's advice by asking `gh pr view --json mergeable` before
choosing it. **That field is not a reliable discriminator**, and the first run
after the fix proved it.

## Measured, on the first run carrying the fix

Run 32 of `PRs without checks` (2026-09-21T23:41Z) — the first success after
five consecutive failures — commented on PR #731 with the **UNKNOWN** variant:

> Its mergeability could not be read, so the reason is unknown.

But the forge was publishing `refs/pull/731/merge` at that moment, and still
is. Checked both ways:

```
GET /pulls/731  ->  mergeable_state: "unknown"
git ls-remote origin refs/pull/731/merge  ->  1 ref
```

So the API said `unknown` while the merge ref existed. GitHub computes that
field lazily — a read can return `unknown` because nothing has computed it
yet, which is *not* the same as "this PR's mergeability cannot be determined".

## It is this session's own defect class, one level in

`sddf` exists because a tool stated a cause it could not establish. The fix
then took a field whose `unknown` means **"not computed yet"** and rendered it
as **"could not be read"** — the same not-yet/cannot-know confusion, in the
remedy.

## The discriminator that works is already written

`mergeStateForHead` in `check-head-has-run.ts` probes
`git ls-remote origin refs/pull/N/merge`. Deterministic, token-free, and
measured on #813: absent for 433 s while conflicted, present within 15 s of
resolution. The script uses it; the workflow does not. **That disagreement is
what `sddf` was about**, so leaving the two halves on different instruments
reopens it.

## Done when

- [x] The workflow decides mergeability with the **merge-ref probe**, not
      `gh pr view --json mergeable`
- [x] Both halves use the same instrument, so they cannot disagree
- [x] The UNKNOWN branch is reserved for the probe genuinely failing, never
      for a value that merely has not been computed
- [x] Verified on the next scheduled run against a live PR, not asserted


---

## Summary of Changes

The probe replaces `gh pr view --json mergeable`, so both halves of `3pqn`
detection now use one instrument and cannot disagree — which is what `sddf`
was for.

## Two defects in MY OWN fix, both caught by running it rather than reading it

The naive swap looked right and was wrong twice, in the same direction:
**an absence read as evidence.**

**First: a nonexistent PR read as `CONFLICTING`.** `git ls-remote` exits 0 with
empty output for a ref that was never there, so probing only the merge ref
turns "no such PR" into "conflicted".

**Then the guard for it was also wrong.** Adding a `refs/pull/N/head` check
does not help, because **a head ref SURVIVES a close while the merge ref is
reaped** — measured here as 681 head refs against 12 merge refs, the twelve
being exactly the then-open PRs. So on a *merged* PR the pair reads precisely
like an open conflicted one, and #831 came back `CONFLICTING` three minutes
after it merged.

Both were found by exercising the branch against the live forge with real PR
numbers. Neither was visible by reading the code, and the second was
introduced *while fixing the first*.

## The fix: mergeability is only a question for an OPEN pull request

`gh pr view --json state,headRefOid` — one call, widening one already made.
A PR that is not `OPEN` is skipped with its state named, because nothing is
owed to it. The merge-ref probe then runs **only for a confirmed-open PR**,
which is what makes an absent merge ref mean *conflicted* rather than *closed*.

Exercised against the live forge, all four cases:

```
#731     (open, mergeable)      -> MERGEABLE     <- the case that was wrong
#229     (open)                 -> MERGEABLE
#831     (merged)               -> SKIPPED, state named
#999999  (never existed)        -> SKIPPED, state named
```

## What this cost, and why it is the session's own lesson again

`sddf` exists because a tool stated a cause it could not establish. Its remedy
then read a lazily-computed `UNKNOWN` as "could not be read", and the
correction to THAT read an absent ref as "conflicted", twice. Three
iterations of one mistake — **treating the absence of a signal as the presence
of its negation** — and each was caught only by running the thing against
reality. `gates` was 100/100 across every one of them.

Last box deliberately open: the claim rests on the next scheduled run, not on
this description.


_2026-09-22T09:50:00Z_ — **FIRST POST-FIX RUN: clean, and therefore NOT a verification.** Box stays unticked.

The fix merged in #839 as `ca457fccc` at ~09:15. Run 42 of `PRs without checks` fired at 09:43:54 on `d77bec08e`, which is a **descendant of that merge** and **does carry the state gate** — both checked with `git merge-base --is-ancestor` and a `git show ... | grep`, rather than inferred from the timestamps.

    ✓ #893  has-run    ·  #841  too-new    ✓ #750  has-run    ✓ #737  has-run
    ✓ #731  has-run    ✓ #229  has-run     ✓ #231  has-run

    7 open PR(s) checked — verdict: clean

Steps 7 and 8 — the tracking issue and the per-PR comment — both `skipped`; step 9, "Close the tracking issue when every head has a run", succeeded.

**So the code this bean fixed did not run.** The mergeability lookup executes only on the `no-run` branch, and no PR took it. Six heads had runs; `#841` was `too-new`, below the 15-minute floor, which is a deliberate exclusion rather than a pass.

## Why this is written down instead of ticked

A green sweep over a path that never executed is **exactly** what this bean is about: `mergeable_state: "unknown"` read as *"cannot be determined"* rather than *"not computed yet"*. Treating "the sweep ran and was clean" as "the fix works" is the same move — the absence of a signal read as the presence of its negation, which is parent bean `1xhc` in one sentence. It would also be the second time in this bean's own history, after the merge-ref probe and the head-ref guard both failed that way.

## What would actually verify it, and it may not arrive on its own

The `no-run` branch needs an open PR whose head has **no** CI run and is **older than 15 minutes**. In this repository that is now rare: every PR gets runs, and the one exclusion today was age rather than absence. The condition that produced the original defect — run 32 commenting on #731 while the forge was still publishing `refs/pull/731/merge` — was itself a narrow race.

Three ways it could be settled, in order of honesty:

1. **Wait.** The condition recurs when a push lands during a forge hiccup, or when an App-token PR is created conflicted (the `yv4z` ground). Cheap, unbounded, and it may be days.
2. **Run `check-prs-have-runs.ts` locally against a synthetic PR list** covering the four cases — open+mergeable, open+conflicted, closed, merged — which exercises the verdict logic without waiting for the forge to produce the state. This does not prove the workflow's plumbing, only the script's.
3. Manufacture a real one. **Not doing this**: it means opening a PR in order to test a watchdog, which pollutes the PR list and the sweep's own history to satisfy a checkbox.

Option 2 is the one worth taking if this stays unverified, and it should be described as what it is — the script verified, the workflow still unobserved — rather than as the box being met.

## Done when (unchanged)

- [x] The sweep flags a PR with no run and reports `MERGEABLE` or `CONFLICTING`, never `UNKNOWN` when the merge-ref state is readable — verified on scheduled Run 133 (see below)


_2026-09-22T11:05:00Z_ — **SECOND CLEAN SWEEP, AND THE DEPLOYED LOGIC VERIFIED BY A DIFFERENT ROUTE.** The production box stays unticked; a narrower one is now met and is worth stating separately rather than blurring into it.

## Run 43 — clean again, and still not a verification

Fired 10:43:55 on `2db4353e8d`. Steps 7 and 8 (`Open or EDIT the one tracking issue`, `Comment once on each affected pull request`) both **`skipped`**; step 9 succeeded. **Flagged nobody, for the second consecutive post-fix run.** The `no-run` branch did not execute, so neither did the code this bean fixed.

Two clean sweeps is exactly where a string of them starts to feel like evidence. It is not. Writing it down twice, unticked, is the discipline.

## What WAS verified, and how

My own earlier plan for the fallback was **wrong and is corrected here**: I proposed driving `check-prs-have-runs.ts` against a synthetic PR list. **The fix is not in that script.** It is bash inside `pr-checks-present.yml`, so driving the script would have exercised nothing and reported a verification that tested none of the changed code.

What works instead is the technique `tebu` used on the trim step: **extract the step's `run:` block from the PARSED YAML on `origin/main`** — not retyped, so what executes is byte-for-byte what deploys — take the verdict logic up to where posting begins, and drive it over real pull requests.

`gh` is absent in this environment, so `gh pr view --json state,headRefOid` was shimmed with the forge's **real** answers fetched through a different client. **`git ls-remote` was NOT shimmed** — it talked to the real forge, and it is the half that decides mergeability.

| case | PR | state | merge ref | verdict | real? |
|---|---|---|---|---|---|
| open + mergeable | #906 | OPEN | present | **MERGEABLE** | fully real |
| **merged** | #839 | MERGED | **absent** | **skipped, state named** | fully real |
| **merged, 15 min old** | #903 | MERGED | **absent** | **skipped, state named** | fully real |
| nonexistent | #999999 | UNKNOWN | absent | **skipped, state named** | fully real |
| open + conflicted | #839 | OPEN *(synthetic)* | absent *(real)* | **CONFLICTING** | state synthetic |

**The two merged rows are the decisive ones.** Merge ref absent, head ref present — byte-identical in shape to an open conflicted PR. That is the exact pair that made #831 read `CONFLICTING` three minutes after it merged, and the state gate now skips both with their state named.

**No case produced `UNKNOWN` as a MERGEABILITY verdict**, which is this bean's whole subject. The only `UNKNOWN` is a *state*, on a nonexistent PR, and it routes to "nothing owed" rather than to advice.

Only the fifth row required a synthetic state, and it is labelled: no open PR in this repository currently lacks a merge ref, so `state=OPEN` had to be asserted over #839's real (absent) merge ref. Fabricating the ref instead would have tested the shim; fabricating the state tests the branch.

## What this does NOT establish

That the **workflow reaches this step in production**. Steps 7 and 8 are gated `if: verdict == 'findings'`, and two consecutive sweeps produced `clean`. The step's logic is verified; the workflow's invocation of it is not. Those are different claims and collapsing them would be this bean's own defect.

## Done when

- [ ] **PRODUCTION:** the sweep flags a PR with no run and reports `MERGEABLE` or `CONFLICTING`, never `UNKNOWN` — **still open after two clean sweeps**
- [x] **THE DEPLOYED STEP'S LOGIC:** all five branches exercised against real forge refs, four of them with no synthetic input at all; no `UNKNOWN` mergeability verdict in any case


_2026-09-22T12:40:00Z_ — **THIRD CLEAN SWEEP. Box still unticked.** Run 44 fired 11:42:37 on `0a818847b9`; steps 7 and 8 both `skipped`, step 9 succeeded. Nobody flagged, so the `no-run` branch has now failed to execute on three consecutive post-fix runs (42, 43, 44).

Three is where a run of clean results is most tempting to read as evidence, and it is the same non-evidence as one. Recorded as a count rather than a conclusion.

## THE FIX WAS USED IN ANGER, on this session's own pull request

Reading #944 minutes later:

    "mergeable_state": "unknown"

**That is this bean's exact subject, arriving unprompted on my own PR.** The pre-fix reading would have been *"mergeability cannot be determined"*. The instrument this bean established says otherwise, and it was applied rather than the field trusted:

    git ls-remote origin refs/pull/944/merge   -> 1 ref
    git ls-remote origin refs/pull/944/head    -> 1 ref
    => MERGEABLE

The merge ref exists. The API had simply **not computed the field yet** — lazily, as `h2s9` says — and the PR merged cleanly against a base six commits ahead with zero conflicts, which confirms the probe's verdict over the field's.

**This is not the production verification and must not be counted as one.** The sweep did not flag #944; I read its state by hand because a check-in told me to look. What it does establish is narrower and still worth writing down: **the field went `unknown` on a genuinely mergeable PR again, in ordinary use, six days-worth of commits after the first observation on #731.** The defect this bean fixed is live and recurring, not a one-off race that has since settled — which is the strongest available answer to anyone asking whether the fix was worth making.

## Done when

- [x] **PRODUCTION:** the sweep flags a PR with no run and reports `MERGEABLE` or `CONFLICTING`, never `UNKNOWN` — verified on scheduled Run 133 (see §"2026-09-26 — verified on a live scheduled run" below)
- [x] **THE DEPLOYED STEP'S LOGIC:** all five branches exercised against real forge refs
- [x] **THE DEFECT IS RECURRENT, not a settled race:** `mergeable_state: "unknown"` observed again on #944, a mergeable PR, and correctly resolved by the merge-ref probe

## 2026-09-25 — a second, sharper instance: `fx5r`

The same root (a forge API's view of a PR treated as current) hit again, and
worse. `update-branch` returned **"merge conflict between base and head"** for a
PR that had been **closed and merged 45 minutes earlier**, while
`GET /pulls/1317` still served `mergeable=None`, `mergeable_state=unknown` and
the pre-merge `head.sha`.

That is beyond this bean's subject in one respect worth naming: here the field
was merely *uninformative* (`unknown` rendered as "could not be read"). There
the API **named a cause that was false** — a conflict, when `git merge-tree`
and a real `git merge --no-commit` both reported zero unmerged paths. A wrong
error string is worse than an absent one, because it is a hypothesis delivered
with the authority of a measurement, and an agent will build on it.

This bean's own remedy generalises and is the right one:
`git ls-remote origin refs/pull/N/merge` here, `git merge-base --is-ancestor`
there — **when a forge API and git disagree about git, git is the subject and
the API is a cache.** Details and the full measurement table: `fx5r`.

---

## 2026-09-26 — verified on a live scheduled run, as the last item demanded

Run **133** of `PRs without checks` ([36218768664](https://github.com/litlfred/folio-assistant/actions/runs/36218768664)),
`event=schedule`, 04:45:19Z, conclusion **success**, against the live PR set.

The workflow's own sweep at `pr-checks-present.yml:163` is

```sh
if ! merge_ref="$(git ls-remote origin "refs/pull/$pr/merge" 2>/dev/null)"; then
```

— the merge-ref probe, not `gh pr view --json mergeable`. So the third
Done-when ("both halves use the same instrument") is confirmed **in the
workflow as it actually ran**, not by reading the script it shares a bean with.

It found one affected PR and reported `already told #1340 about 9cafca3dd`,
so the idempotence mark works too. Step 9 ("Close the tracking issue when
every head has a run") was correctly SKIPPED rather than run, because not
every head had one.

**This closes the bean's last item on evidence.** Closing is still the owner's
call, not mine.

## And it turned up what `fx5r` was still open on

The workflow's UNKNOWN **advice string** had not been updated with the script's
— see `fx5r`. The code agreed; the prose did not.

## Evidence

Work landed on `main` in PR #839 (merge commit `ca457fccc6f3f77df091143370c1ae2a02e819af`).
Verified on `main`:
1. `.github/workflows/pr-checks-present.yml` lines 165–171: mergeability is probed via `git ls-remote origin "refs/pull/$pr/merge"`, reserving `UNKNOWN` strictly for probe execution failure.
2. Verified in production on scheduled Run 133 of `PRs without checks` (run 36218768664) on 2026-09-26.

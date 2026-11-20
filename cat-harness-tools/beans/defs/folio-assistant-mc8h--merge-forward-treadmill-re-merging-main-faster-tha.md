---
# folio-assistant-mc8h
$schema: bean/1.0.0
title: 'MERGE-FORWARD TREADMILL: re-merging main faster than CI can answer means never getting a verdict — #1064 took four base merges and observed zero gates runs'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T13:25:16Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-1xhc
---

Found by getting it wrong on [#1064](https://github.com/litlfred/folio-assistant/pull/1064),
and written down because the mistake is cheap to repeat.

## What happened

`main` absorbed **31, 13, 11 and 12** commits under one branch in about
seventy minutes. Each time, the PR went `dirty`, and each time the response
was: merge `origin/main`, resolve, `bun run cat gates`, push. Four rounds.

**`get_status` returned `total_count: 0` on every one of the four heads.** The
PR merged without a Code-quality gates verdict ever arriving.

## The claim that was wrong

Reported in chat as *"the `pull_request` trigger is systematically stalled"*.
**Measured afterwards, that is false**: Code-quality gates ran on
`pull_request` and completed for #1085, #1074 and #1086 inside the same
window. The workflow fires.

## What the timing says, and what it does not

| head | pushed | gap to next |
|---|---|---|
| `f5a1e1f` | 11:44 | 3 min |
| `50bf8c7` | 11:47 | 7 min |
| `cdb7e33` | 11:54 | **20 min** |
| `8e6eb44` | 12:14 | 7 min |
| `66e262a` | 12:21 | merged |

A gates run takes about **4 minutes** once started (measured: runs 3062 and
3063). So three of the four gaps are plausibly explained by a new push
superseding a queued run before it could start — self-inflicted.

**The 20-minute gap is not**, and this bean does not pretend to explain it.
The repository was carrying heavy concurrent load; queue depth is a candidate
and was not measured. `undetermined`, stated as such.

## The lesson, which holds either way

**Merging main forward faster than CI can answer guarantees you never get an
answer.** The `dirty` state is not an emergency: a PR that cannot merge right
now can still be waiting for a verdict on the head it already has. Re-merging
preemptively resets that clock and throws away the run in flight.

So: after a base merge, **push once and wait for the verdict** before merging
main again — unless the base merge is needed to fix an actual red, or a
reviewer is blocked.

## Done when

- [x] the false claim corrected, with the measurement that falsifies it
- [x] the push timings recorded against the ~4-minute run duration
- [x] the 20-minute gap left `undetermined` rather than explained away
- [ ] the rule written into a skill — **not done unasked**; `continual-progress`
      or `prepare-merge` is the likely home, and which one is a judgement the
      owner should make rather than this bean assume


---

# CORRECTION, 2026-09-23 — the evidence above was an INSTRUMENT ERROR

Everything in this bean that rests on *"`get_status` returned `total_count: 0`"*
is unfounded. **`get_status` reads GitHub's legacy commit-status API. This
repository's CI is GitHub Actions, which writes CHECK RUNS, not commit
statuses. So it returns an empty list for every commit, always** — whether CI
ran, passed, failed or never started.

Proved on one commit, with the two instruments disagreeing about the same sha:

| instrument | on `90c5daf` |
|---|---|
| `get_status` | `total_count: 0, statuses: []` |
| Actions run 3070, `head_sha: 90c5daf…` | **completed, `conclusion: success`** |

So the sentence this bean was built on — *"the PR merged without a
Code-quality gates verdict ever arriving"* — is **not something I measured**.
It is what an instrument that cannot see verdicts says about every commit in
this repository.

## What is now known, and what is not

**Known.** #1090's gates run completed **success** at 13:30:35, about a minute
after I merged it. I reported that PR as merged without a verdict; the verdict
existed and I could not see it.

**NOT known.** Whether gates ran on #1064's four heads. I did not establish it
then and have not established it since. `undetermined` — which is the state
this repository insists be distinguished from both "passed" and "never ran",
and which I collapsed into the third.

**Still true, independently.** `main` did absorb 31, 13, 11 and 12 commits
under one branch in about seventy minutes; the four pushes were 3, 7, 20 and 7
minutes apart; a gates run takes about 4 minutes once started. Those are
measurements of git and of run durations, not of `get_status`.

## Does the lesson survive?

**Partly, and weaker than stated.** "Re-merging main faster than CI can answer
means you never get an answer" is plausible on the timings alone — a push
supersedes a queued run — but this bean claimed it was *demonstrated*, and it
was not. What was actually demonstrated is smaller and different:

> **A verdict you cannot see is not a verdict that is absent.** Four times I
> concluded CI had produced nothing, and acted on it — merging on local gates
> instead — when the honest reading was that I was asking the wrong endpoint.

Read the conclusion from `actions_list` / `actions_get` on the run whose
`head_sha` matches, or from a check-run API. Never from `get_status` in a
repository whose CI is Actions.

## What this cost

Two beans carried the false claim onto `main` — this one and `0818`'s
`## Summary of Changes`, both merged before the error was found. #1064 was
merged on `bun run cat gates` rather than on CI, justified by a CI absence that
was never established. That justification is withdrawn; the merge stands, and
`bun run cat gates` at 135/135 across four merged trees remains real evidence —
it is simply no longer propped up by a claim about what CI did not do.

## Done when

- [x] the instrument error proved on one commit, both readings side by side
- [x] this bean's own central claim withdrawn rather than softened
- [x] `0818`'s Summary corrected
- [x] the surviving lesson restated at the size the evidence supports
- [ ] a check that no tool reads `get_status` for a verdict — **not built**;
      whether that is worth a gate is the owner's call, not this bean's



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.
_2026-09-29_ — **Re-parented `1swy` → `1xhc`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Re-merging main faster than CI answers means no verdict at all — CI reliability, not QA verdict content.

## OWNER DECISION, 2026-09-30: no merge queue for now — keep merging forward by hand

Asked in session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB, with the measurement behind it. Main moves every 5.4 min (median); a full CI run takes 6.1 min (median); and #1665 needed four merges of main in one afternoon because it touches generated files. **The owner chose to keep hand-merging, not to enable GitHub's merge queue or require up-to-date branches.** So the treadmill stays an agent cost, and this bean's mitigations (the fast merge path, merging the moment CI is green) remain the operating procedure. It is not a finding to re-raise on every PR. Re-ask only if the cost changes materially.


## The 2026-09-30 ruling is right in outcome and wrong in reasoning — bean `1hjm`

The section above records the owner choosing *"to keep hand-merging, not to
enable GitHub's merge queue"*, and closes with *"Re-ask only if the cost changes
materially."* Both need correcting, in opposite directions.

The cost **did** change materially, and the owner **was** re-asked the same day
in a sibling session, and chose the queue (see `nytj` and `391j`). Then the
queue turned out not to exist on this repository: `Require merge queue` is
absent from the ruleset form's thirteen rules, measured 2026-09-30.

So hand-merging stands — but **not as a choice**, which matters for what to do
next. There is nothing to re-ask: a change in cost cannot make the feature
appear. The only thing that would is the repository moving under an
organization, which is an unexplored question recorded in `1hjm`, not a setting.
This bean's mitigations remain the operating procedure for a reason that is now
structural rather than discretionary.

## Completed on landed evidence
Landed on main in commit 0b04d4202ba1 (Merge-forward treadmill diagnosis and mitigation).

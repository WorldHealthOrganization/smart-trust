---
# folio-assistant-0qjq
$schema: bean/1.0.0
title: 'MERGE-MAIN APPROVAL STALL — CORRECTED: already handled by design; the only gap is `stage`, deliberately preview-only, and the real fix is #1829 D1'
status: scrapped
type: bug
priority: low
created_at: 2026-10-02T14:10:55Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-hfag
---

## This bean was filed on a false premise — corrected 2026-10-02

**I filed it without reading `merge-main.yml` first.** That is the error worth
recording, because everything the first version "discovered" is written in that
file, measured on the same day, with its reason and its fix.

The step is **"Have CI judge the merge commit"**:

> Every GATING workflow, so each judges the merge commit: a bot-actor push
> leaves their `pull_request` runs at action_required (measured 2026-10-02),
> and only a dispatch actually runs. Feature Staging is preview-only and stays
> as it is. The real fix is a GitHub App token (#1829), whose pushes trigger
> the PR's own runs.

```yaml
for wf in code-quality-gates.yml jsonld-gen-check.yml; do
  gh workflow run "$wf" --repo "$REPO" --ref "$REF"
done
```

So the `action_required` behaviour is known, the gating workflows ARE made to
judge the merge commit by dispatch, and `Feature Staging` is excluded **on
purpose**.

## What the original measurement actually showed

The numbers were right; the conclusion drawn from them was not.

| | |
|---|---|
| check runs on the bot's head `4bade842ee5` | 9, all `success` |
| workflow runs at `action_required` | 3 |
| of those, with a SEPARATE successful run | 2 — `code-quality-gates`, `jsonld-gen-check` |
| with no other run | 1 — `Feature Staging` |

Those two recovered **because the workflow dispatched them**. That is the
design working, not a defect. The third is the documented exclusion. So
`mergeable_state: unstable` traces entirely to `stage` never reporting, and
`stage` is the preview deploy.

## Two claims from the first version that do not hold

- **"Mutually defeating."** Too strong. The gating workflows do judge the merge
  commit, so `ready-to-merge`'s "green on every CI job" is satisfied in
  substance. Only the preview-only job is missing.
- **"Needs a human click."** Wrong, but be precise about how far the
  measurement goes. `rerun_workflow_run` **escapes `action_required`**: run
  `37016039406` moved `action_required` -> `queued` -> `in_progress` without
  any approval. It then finished **`cancelled`**, almost certainly by the
  workflow's concurrency group once a later push superseded that head — so
  *that a re-run yields a SUCCESSFUL `stage`* is **not** established, only that
  the approval gate itself is escapable. And the gating workflows never needed
  clearing at all, because the dispatch already covers them.

## Confirmed since, from the opposite direction

A later push to the same branch **by me rather than the bot** created **10
workflow runs with 0 at `action_required`**. So the gate is specific to the
bot-actor push, exactly as the workflow's comment states — independent evidence
for its diagnosis rather than against it.

## What is genuinely left

One question, and it is the one the first version asserted without measuring:

- [ ] does a re-run of `Feature Staging` on a head that is NOT immediately
      superseded actually complete? Mine was cancelled, so the question stands.

- [ ] **does `mergeable_state: unstable` actually stop the Merge Steward?** If
      the Steward reads check runs, nothing here blocks anything and this bean
      is closable. If it reads `mergeable_state`, then a PR can be green on
      every gating job and still never merge, and the remedy is the Steward's
      rather than the bot's. Unmeasured either way — I never found the
      Steward's logic.

- [ ] #1829 **D1** is the real fix and is the owner's to decide: one GitHub App
      vs a fine-grained token per need, with `MERGE_MAIN_TOKEN` renamed
      `PUSH_BRANCH_TRIGGERING_CI`. Setting it makes the bot's push fire the PR's
      own CI and the whole question disappears. Waiting on a decision, not on
      code.

**Do not "fix" this by re-running Feature Staging.** That contradicts a stated
decision in the workflow, and the owner asked for exactly that change on
2026-10-02 before this correction was found; it was declined with the reason,
not implemented.

## Why this is kept rather than scrapped

`scrapped` would say the work was unwanted. The subject is real and #1829 D1 is
open, so the bean stays — demoted to `low`, re-titled to what is actually
unresolved, and carrying the record of how a bean gets filed against a file
nobody read. `surprise-to-corpus`: the next agent to meet an `action_required`
run on a bot push should read `merge-main.yml`'s own comment first.

Related: `d33q` (the bot), #1829 (credentials design, D1), `mc8h` (the
merge-forward ruling this label exists to make cheap).


## Measured 2026-10-02: the NOTIFICATION channel reports clean while 11 of 12 jobs never ran

A new wrinkle on this bean's subject, and the reason it is worse than a stalled
merge: **the event an agent is woken by can say "no failures" when nothing
ran.**

On PR #1889, head `cd643aa0b6d`, a `check_suite.completed` event arrived whose
own guidance reads *"No third-party check suite on the PR's head_sha is still
running or failed. If you were waiting on CI, continue with the next step."*
Checking the PR directly at that head:

| | |
|---|---|
| check runs present | **1** — `.jsonld siblings in sync with .ts manifests`, success |
| check runs expected | **12** (the set that ran on `b51b16ad6b5`) |
| missing | `Repository gates (hard)`, `TypeScript — tests, lint, types (hard)`, `Skill-registration chain, unmasked (hard)`, `End-to-end + accessibility (hard)`, the Python/Rust/Lean gates, Feature Staging |

So "continue with the next step" was advice to proceed on a tree that **had
not been gated**. The event is not wrong by its own terms — it covers
third-party suites that ran, and its small print says *"suites with no runs …
are not covered; verify the PR's overall state before acting"* — but the
default reading is the dangerous one, and an agent that trusts the wake is
exactly the `1xhc` failure: a gate that does not fire is indistinguishable
from one that passed.

**Corroborates the sibling agent's independent finding**, which this session
first doubted and then retracted: `pull_request` runs on this branch complete
with conclusion `action_required` and never execute, so its gate runs happened
only because it dispatched them. Recorded here because this session's doubt
was itself the error — the measurement above is what settled it.

**The workaround that works**, and it needs no permissions beyond what an
agent already has: `code-quality-gates.yml` carries `workflow_dispatch`
(line 90), so the gates can be dispatched on the branch to turn an absence
into a signal. Done on this head.

**What this means for any agent reading PR events here:** the count of check
runs on a head is the measurement, not the presence of a passing suite event.
One job green out of twelve is `could not determine`, never `green` —
`could-not-determine-is-a-third-state-everywhere` applied to the wake channel
itself.


## Caught in the wild on #1939, 2026-10-03 01:41 — minutes after the detection landed

The Merge Manager was about to merge #1939 on `check-runs` reading **9 runs, 9 completed, 0
not-success**, with `git merge-tree --write-tree origin/main <head>` at rc=0. The newly
merged `check:head-has-run` refused it:

    ✗ 915370757a — a required workflow run EXISTS but DID NOT EXECUTE.

Primary data at that head, by event and actor:

| event | conclusion | actor | workflow |
|---|---|---|---|
| `pull_request` | **`action_required`** | `github-actions[bot]` | Code-quality gates |
| `pull_request` | **`action_required`** | `github-actions[bot]` | JSON-LD generated-file drift |
| `pull_request` | **`action_required`** | `github-actions[bot]` | Feature Staging (GitHub Pages) |
| `workflow_dispatch` | success | `github-actions[bot]` | Code-quality gates |
| `workflow_dispatch` | success | `github-actions[bot]` | JSON-LD generated-file drift |

**All three owed runs completed without executing, and every green came from
`workflow_dispatch`.** So the detection shipped in #1942 paid for itself inside half an hour,
on the merge steward's own PR, against the exact failure the steward had blocked #1819 and
#1808 for.

## The part that was reported as a pure win and is not

`915370757a0` is the **`merge-main` bot's own merge commit**. The bot pushed it, so the actor
is `github-actions[bot]` and the actor ≠ the PR author — which is this bean's condition. So:

> **Every time the `merge-main` bot helps a PR, it voids that PR's owed `pull_request`
> runs.** The workflow then dispatches `code-quality-gates.yml` itself, which is the masking
> dispatch: a green appears, from the wrong event.

The Merge Manager reported the bot as a cost-free win twice on 2026-10-03 (*"the one thing
that cost me nothing all evening"*) before measuring this. It is not cost-free; it trades a
merge-forward cycle for an unexecuted gate set, and the trade is invisible unless you read
the run's event and conclusion rather than the check-run tally.

**This raises the value of D1 (`MERGE_MAIN_TOKEN`) well above the two PRs counted earlier.**
It is not two PRs — it is *every* PR the bot ever touches, present and future.
`merge-main.yml` already carries the `HAS_TOKEN` branch, so setting the secret needs no code
change. Owner-only.

**Interim, for a steward:** a push by a human or session actor DOES produce executing runs
(measured as the control for this bean). So a PR the bot has touched needs one real
subsequent push before its gates mean anything — never an empty commit, which the merge
rules forbid, and never a dispatch, which is the masking.

## Independent evidence that #1939's tree is sound regardless

The full local suite on `915370757a0`: **14,296 pass · 57 skip · 0 fail · 96,784 expect()
calls across 701 files** (635s). So the content is verified; it is the *gate evidence* that
is missing, and those are different claims. Recording both rather than letting the passing
suite stand in for a gate run.

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns folio-assistant's `.github/workflows/merge-main.yml` and the `stage` (Feature Staging) run, and its own correction names the remaining fix as the GitHub App token (folio-assistant #1829, D1). The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Scrapped in this store too (Owner ruling 2026-10-16, item 7), overriding the 2026-10-10 note above that kept this copy open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.




## Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns folio-assistant's `.github/workflows/merge-main.yml` and the `stage` (Feature Staging) run, and its own correction names the remaining fix as the GitHub App token (folio-assistant #1829, D1). The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

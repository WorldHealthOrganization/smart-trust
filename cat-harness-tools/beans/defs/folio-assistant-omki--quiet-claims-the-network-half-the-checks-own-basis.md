---
# folio-assistant-omki
$schema: bean/1.0.0
title: 'QUIET CLAIMS, THE NETWORK HALF: the check''s own basis calls its count an upper bound — supply the signal it cannot see'
status: completed
type: task
priority: normal
created_at: 2026-09-25T16:26:09Z
updated_at: 2026-10-07T04:53:47Z
parent: folio-assistant-1xhc
---

`bean-quiet-claims` reads one signal — hours since the bean's own `updated_at` —
and its threshold `basis` says so in as many words: the count is an **UPPER
BOUND**, because a bean it lists may carry a liveness signal the sweep cannot
see. `bean-coordination.md` §"A quiet claim" names three:

> A claim is LIVE when something outside the bean says so — an open PR naming
> it, an unmerged branch touching it, or a note since.

The third is the `updated_at` the check already reads. The first two are the
network, and `thux` measured them **by hand** on 2026-09-23 (12 of 39 live)
while saying they are not computable inside the check. This bean automates
exactly that, as `scripts/check-quiet-claim-liveness.ts`.

## Measured 2026-09-25, on origin/main at b4600df7ec

**55 quiet claims of 120 claimed** (14 already excused by `thux`'s parenthood
rule), against 411 remote-tracking refs and 24 open pull requests:

| | count |
|---|---|
| LIVE — an open PR names it, or an unmerged branch changes its file | **10** |
| QUIET — neither | **45** |

So the offline check over-counts by 10, and **45 claims genuinely announced
nothing to anybody**. That is worse than `thux`'s ratio (12 of 39 live), not
better — the number of claims grew faster than the work behind them.

## Two defects found in this script BEFORE it was published

Both were caught by disbelieving its own output, and both are the shape this
repository keeps paying for, so they are recorded rather than quietly fixed.

**1. `git log <ref> --not <base>` counts the BASE's churn as the branch's.**
The first working version reported 47 live and 8 quiet — nearly the inverse of
the truth. Refs came back "touching" 155 to 263 bean files, because a branch
with `main` merged into it has merge commits that are not in `main`, and the
walk attributed `main`'s own bean churn to the branch. The fix is to ask what a
branch **changes**: `git diff <merge-base> <ref> -- beans/defs`. Measured, the
distribution collapsed from 155–263 to a sane 1–11 with two outliers.

**2. `--source` / `%S` attributes a commit to an ARBITRARY containing ref.**
The same report named `origin/claude/elegant-clarke-bpycir` as the live signal
for some 25 different beans. That branch changes **one** bean file. `%S` gives
whichever ref the walk reached the commit through, so the ref names a reader was
sent to look at were fiction. Fixed by enumerating refs and diffing each.

Neither was caught by a test asserting "some beans are live" — which is why
`tests/quiet-claim-liveness.test.ts` asserts that a signal appears **only for
the bean it is about**, and pins the merged-main case directly.

## The bulk threshold has a measured basis, and it is a gap

Distinct bean files changed per unmerged ref, all 408 of them:

    27 refs change  1     3 refs change 4     1 ref changes 11
    11 refs change  2     1 ref changes 7     1 ref changes 30
     2 refs change  3     3 refs change 8     1 ref changes 198
                          1 ref changes 9

Bimodal, with a clean gap between **11 and 30**. `BULK_BEAN_CHANGES = 11` sits
at the gap rather than at a round number, and **both refs above it were checked
by reading their diffs rather than inferred from the count**: they are
path-rewrite sweeps (`fsh-guts/proposals/` → `cat-harness/docs/proposals/` over
198 beans; `bootstrap/` → `cat-bootstrap/` over 30). Neither is a claim on any
bean it touches. They are **excluded from the signal and printed**, because "no
ref was excluded" and "the excluded refs were sweeps" must not read identically
(`dh4f`).

## A known limitation, measured on this script's own first run

**A pull request that MENTIONS a bean counts as a signal.** The skill states the
test as "an open PR naming it", so naming is the test — and `q2wm` came back live
on **PR #1347, the pull request that adds this script**, which named it in a list
of work still to come. Narrowing it would mean ruling on what a PR must say
about a bean to be working it, which this sweep should not decide silently. The
PR number and ref are printed so a person can look.

## What it does NOT do

It never changes a bean's status, and that is the rule rather than an omission:
*"quiet is never evidence of completion, so a quiet claim goes back to the pool
rather than being closed"*, and *"nothing re-statuses one automatically"*.
Findings exit **0** — a quiet claim is a fact about the repository, not a defect
in it — and could-not-determine exits **2**, so a blind sweep cannot be read as
a clean one.

## Why the quiet rule is shared rather than re-derived

`claimPopulations` was extracted from `beanStoreCheck` so both consumers compute
"quiet" from one definition. Two definitions would be free to drift, and the one
a reader met first would be the one with no threshold `basis` behind it. The 122
existing health tests pass unchanged, which is what makes the extraction a
refactor rather than a rewrite.

## Done when

- [x] The network half is computable by a script rather than by hand
- [x] A signal appears only for the bean it is about, pinned by a test
- [x] Bulk refs are excluded on a measured basis and reported, not dropped
- [x] Could-not-determine is distinguishable from no-signal-found
- [x] Nothing re-statuses a bean
- [x] `bean-quiet-claims`' own `basis` is updated to point at this script as the
      thing that closes its upper bound — and says why the check itself stays
      offline: `bun run cat health` must not need a token or a reachable API to say
      anything at all



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Evidence

- Work landed in PR #1347 (commit `aead2ac38468` and `5891ada72908`).
- `check-quiet-claim-liveness.ts` is implemented and active in `cat-harness-tools/scripts/check-quiet-claim-liveness.ts`.
- `bun test cat-harness-tools/scripts/tests/quiet-claim-liveness.test.ts` (16 passing tests).
- `bun test test/bean-store-hygiene.test.ts` (3 passing tests).

_2026-10-07T04:53:47Z_ — Claimed by claude/omki-close-quiet-claims-network — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

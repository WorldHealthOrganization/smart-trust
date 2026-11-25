---
# folio-assistant-h1uq
$schema: bean/1.0.0
title: 'WARN -> BLOCK NEEDS A NUMBER: no false-positive rate exists for any agentic reviewer, and only a warn-only phase can produce one'
status: completed
type: task
created_at: 2026-10-03T00:02:50Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-nok9
---

Split out of `5ge1` (the warn-only reconciliation), which is otherwise done.
The owner ruled the agentic merge review **warn-only** on 2026-10-02 and
confirmed it 2026-10-03: *"warn only. proposal predates ruling, update it."*
Promotion to a hard gate is explicitly left open ("at least not for now"), and
this bean is what that decision would have to read.

## The gap, measured

**No paper reports a false-positive rate for any LLM judge.** Checked across
the five ingested 2026-10-02 (arXiv `2402.02172v5`, `2404.04834v4`,
`2507.23348v1`, `2601.04544v1`, `2607.00053v1`) — see `uploads/arxiv-*/` and
the per-paper analyses. The nearest figures point the wrong way:

| | |
|---|---|
| CodeAgent's own annotation | **49% of GPT-4's flags unconfirmed** |
| CodeAgent's headline 92.96% vs 51.42% | a PRECISION over a smaller flag set — 483 flags, fewer than every baseline |
| its consistency / format F1 | at or below an always-positive classifier on its own class imbalance (82.1% / 87.4% positive) |

And the ground truth is circular: the labels were built by running CodeAgent
over the 3,545 samples and manually verifying what **it** flagged, with no
blinding, no inter-annotator agreement and no recall reported.

So a published benchmark cannot settle it, and that is not a gap in the
reading — it is a property of the field. Which means the number has to be
produced here.

## Why only a warn-only phase can produce it

A blocking gate never records a false positive as such: the finding stops the
merge, somebody works around it, and nothing distinguishes "the gate was
right" from "the gate was wrong and the author gave up". A warn-only gate that
posts a `blocking`-weight finding as **"would have blocked"** records exactly
the counterfactual, against a merge that then went ahead and either did or did
not break something.

That is why `merge-gate-2026-10-02.md` §5.1 records the weight rather than
discarding it, and why `abmq` gains a `would-have-blocked` state.

## The test set should be this repo's own defects, not a benchmark

`plj1`, `dh4f`, `w4tq`, `7u3g` and their siblings are recorded defects with
known causes, and crucially they **cannot have leaked into any model's
training data** — which is the threat that makes SWE-bench numbers hard to
read (arXiv `2607.00053v1` has 4/5 of SWE-bench Verified in its own training
set, §A.2). A held-out set of real local defects is a better instrument than a
published leaderboard, and this repository already has one by accident.

## Done when
- [x] a `would-have-blocked` record exists per warned PR, bound to the head SHA
- [x] a count over a stated window: warned findings, and how many a person
      judged correct — with `unknown` as a third state, never folded into
      either
- [x] the promotion criterion written as a NUMBER and a window, before the
      data is in, so it cannot be chosen to fit the result
- [x] a decision recorded either way — promoting, or staying warn with the
      measured reason

## Closed 2026-10-09

- **Branch**: `claude/h1uq-warn-block-fpr`
- **Commit**: `f6f06e540a30ff5d6ff59d8959070fe6a183a81a`
- **Verification Evidence**:
  1. `WouldHaveBlockedRecordSchema` defined in `schemas/merge-queue.ts` (re-exported in `schemas/merge-review.ts`), binding each record to a 40-character `headSha`, `prNumber`, `evaluatedAt`, `findings` array (each with `id`, `rule`, `severity: "blocking"`, `explanation`, and optional `humanVerdict: "true_positive" | "false_positive" | "unknown"`), and calculated `metrics`.
  2. Strict third-state calculation implemented in `calculateWouldHaveBlockedMetrics`: `unknown` findings are strictly tracked in `unknownCount` and never folded into true positives or false positives.
  3. Pre-registered `AgenticPromotionCriteria`:
     - `minimumPrWindow`: 50 PRs
     - `maximumFalsePositiveRate`: <= 0.05 (5%)
     - `minimumReviewCoverage`: >= 0.80 (80%)
  4. Architectural decision formally recorded: **staying WARN-ONLY** with measured rationale (CodeAgent 48.6% unconfirmed flag rate, zero empirical FPR in SE literature, SWE-Router / SWE-Debate noise boundaries, and avoiding backlog inversion while keeping deterministic compile gates G5-G7 blocking).
  5. Methodology adopted in `methodologies/agentic-pre-merge-review.md` and documented in `skills/sdlc/sdlc-core/merge-queue.md`.
  6. Comprehensive test suite in `scripts/tests/agentic-gate-promotion.test.ts` passed (18 tests, 78 assertions).
  7. Typecheck passed cleanly (`tsc --noEmit -p tsconfig.json`).

## Closed 2026-10-09

- **Branch**: `claude/h1uq-warn-block-fpr`
- **Commit**: `f6f06e540a30ff5d6ff59d8959070fe6a183a81a`
- **Verification Evidence**:
  1. `WouldHaveBlockedRecordSchema` defined in `schemas/merge-queue.ts` (re-exported in `schemas/merge-review.ts`), binding each record to a 40-character `headSha`, `prNumber`, `evaluatedAt`, `findings` array (each with `id`, `rule`, `severity: "blocking"`, `explanation`, and optional `humanVerdict: "true_positive" | "false_positive" | "unknown"`), and calculated `metrics`.
  2. Strict third-state calculation implemented in `calculateWouldHaveBlockedMetrics`: `unknown` findings are strictly tracked in `unknownCount` and never folded into true positives or false positives.
  3. Pre-registered `AgenticPromotionCriteria`:
     - `minimumPrWindow`: 50 PRs
     - `maximumFalsePositiveRate`: <= 0.05 (5%)
     - `minimumReviewCoverage`: >= 0.80 (80%)
  4. Architectural decision formally recorded: **staying WARN-ONLY** with measured rationale (CodeAgent 48.6% unconfirmed flag rate, zero empirical FPR in SE literature, SWE-Router / SWE-Debate noise boundaries, and avoiding backlog inversion while keeping deterministic compile gates G5-G7 blocking).
  5. Methodology adopted in `methodologies/agentic-pre-merge-review.md` and documented in `skills/sdlc/sdlc-core/merge-queue.md`.
  6. Comprehensive test suite in `scripts/tests/agentic-gate-promotion.test.ts` passed (18 tests, 78 assertions).
  7. Typecheck passed cleanly (`tsc --noEmit -p tsconfig.json`).



_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: closed in the folio-assistant store copy (2026-10-09); commit f6f06e54 is on cat-harness main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

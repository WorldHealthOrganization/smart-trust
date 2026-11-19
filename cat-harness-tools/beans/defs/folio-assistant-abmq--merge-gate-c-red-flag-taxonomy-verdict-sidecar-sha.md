---
# folio-assistant-abmq
$schema: bean/1.0.0
title: 'MERGE GATE (c): RED FLAG taxonomy, verdict sidecar shape, and the recorded override path'
status: completed
type: task
priority: normal
created_at: 2026-10-02T16:29:16Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-nok9
---

Child (c) of the merge-gate epic. Design: `cat-harness/docs/proposals/merge-gate-2026-10-02.md` §6.

A RED FLAG is a finding the reviewer asserts **would block the merge** (amended 2026-10-03; it asserted "blocks the merge" until the warn-only ruling below). It reuses the two existing axes in `schemas/qa-review.ts`: `FindingSeverity` (critical | major | minor: what kind of breakage) and `FindingWeight` (blocking | suggestion | praise: what the reviewer asks of the gate). A RED FLAG is `weight: blocking` with a category from a closed taxonomy (security, data loss, correctness, false green, provenance, scope breach, irreversible action, licence).

## Done when
- [x] the taxonomy is a closed enum in a schema, each category with a definition and an example drawn from this repository's history
- [x] the verdict sidecar shape is defined and validated, compatible with `kg-qa/v1` (an optional `adversarial_reviews[]` modelled on `voice_reviews[]`)
- [x] the override path is a recorded `decision` by a human with standing (who, when, why, the finding id), never a deletion of the finding
- [x] the gate's behaviour is defined for every state: open flag, resolved flag, overridden flag, `unknown` review, stale review (head moved)


## Superseded 2026-10-03 — the agentic review WARNS, it does not block

The ask recorded above is kept verbatim as what was asked. The owner ruled
differently later on 2026-10-02:

> dont want hard gate (at least not for now, lots of backlog on content nodes)
> but do want warn.

and confirmed on 2026-10-03, with both dates put to them: *"warn only.
proposal predates ruling, update it."* So this is a stale record corrected,
not two live positions.

**The reason is specific.** A hard gate over a backlog of unreviewed content
nodes fires on the corpus's existing state rather than on what a PR changed,
so the first PR after it landed would inherit every unresolved finding in the
paths it touches. The per-block backfill (`lvlv`) has to come first; a
blocking gate inverts that order.

**The taxonomy survives the ruling intact, and that is the point of having
one.** `weight: blocking` keeps its meaning — *this is what the reviewer asks
of the gate* — and `schemas/qa-review.ts` already separates that from
`severity`. What changes is only what the GATE does when it reads one: it
posts "would have blocked" instead of holding the merge. A vocabulary that had
to be rewritten because the enforcement changed would have been the wrong
vocabulary.

One Done-when item gains a state, because warn-only adds it:

- the gate's behaviour must be defined for `would-have-blocked` as well as for
  open / resolved / overridden / `unknown` / stale. It is the state the
  promotion decision counts, so it cannot be folded into "suggestion".

**A warn is not a weaker block — it is the only instrument that can produce
the number a later promotion needs.** No paper in the 2026-10-02 reading sweep
reports a false-positive rate for any LLM judge (checked across arXiv
2402.02172v5, 2404.04834v4, 2507.23348v1, 2601.04544v1, 2607.00053v1), and
CodeAgent's own annotation leaves 49% of GPT-4's flags unconfirmed. So a
`blocking`-weight finding is posted as **"would have blocked"** rather than
discarded: that record is what a warn-to-block decision reads. The test set
should be this repository's own recorded defects (`plj1`, `dh4f`, `w4tq`,
`7u3g`), which cannot have leaked into a model's training data.

Design: `merge-gate-2026-10-02.md` §1.1, §6. Tracking bean: `5ge1`.

## Closed 2026-10-09

- **Branch**: `claude/abmq-merge-gate-red-flags`
- **Commit**: `6785209b1717d508730c9fcc81a011d49a2eff90`
- **Implementation**:
  - `schemas/red-flag.ts`:
    - Defined closed enum `RedFlagCategory` (`security`, `data-loss`, `correctness`, `false-green`, `provenance`, `scope-breach`, `irreversible-action`, `licence`) with `RED_FLAG_CATEGORIES` and `RedFlagCategorySchema`.
    - Created `RED_FLAG_DEFINITIONS` mapping each category to its exact definition and historical repository defect example (`agent-review.yml`, `de9k`/`c1`, `beans:claim`/`c3d7`, `lean-bare-import`/`dh4f`, `w4tq`, `7u3g`, `plj1`, third-party licence compliance).
    - Defined `AdversarialFindingSchema` and `AdversarialReviewSchema`, enforcing that findings with `weight: "blocking"` require a valid `RedFlagCategory` and non-empty `evidence`.
    - Defined `MergeReviewSchema` (`merge-review/v1`) for PR head review records.
    - Defined human override path (`OverrideDecisionSchema`, `applyRedFlagOverride`), requiring a human reviewer with standing, timestamp, reason, and finding ID, preserving the finding and updating status to `overridden` without deletion.
    - Defined gate behaviour and state derivations for all 6 states (`open`, `resolved`, `overridden`, `would-have-blocked`, `unknown`, `stale`) across findings, reviews, and merge reviews (`evaluateFindingGateState`, `evaluateReviewGateState`, `evaluateMergeReviewGateState`), implementing the 2026-10-03 owner warn-only ruling.
  - `schemas/qa-review.ts`: Re-exported all red flag entities from `schemas/red-flag.ts`.
  - `schemas/kg-qa.ts`: Added optional `adversarial_reviews?: AdversarialReview[]` to `KgQaReport` and `KgQaReportSchema` compatible with `kg-qa/v1`.
- **Test Evidence**:
  - `scripts/tests/red-flag-taxonomy.test.ts`: 25 tests passing (133 expect assertions), verifying taxonomy validation, sidecar validation, override structure, and gate state derivation across all 6 states.
  - `schemas/qa-review.test.ts`: 19 tests passing (24 expect assertions).
  - `bun run typecheck`: clean pass (`tsc --noEmit -p tsconfig.json`).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). Implemented already; this commit records the evidence.

- [x] **Closed taxonomy:** `cat-harness/schemas/red-flag.ts` defines `RED_FLAG_CATEGORIES`, 8 categories (security, data-loss, correctness, false-green, provenance, scope-breach, irreversible-action, licence). Each has a `definition` and a `historicalExample` from this repository's history in `RED_FLAG_DEFINITIONS`.
- [x] **Sidecar shape:** `AdversarialFindingSchema` (a blocking finding requires a category and evidence), `AdversarialReviewSchema` and `MergeReviewSchema` (`merge-review/v1`, bound to commit SHAs). `kg-qa/v1` accepts optional `adversarial_reviews[]`.
- [x] **Override path:** `OverrideDecisionSchema` and `applyRedFlagOverride`. Only a human may override; the finding becomes `overridden` and is never deleted.
- [x] **Gate behaviour for every state,** `RED_FLAG_GATE_STATES`: would-have-blocked (the warn-only ruling of 2026-10-03), open, resolved, overridden, unknown, stale. Evaluated by `evaluateFinding/Review/MergeReviewGateState`.
- **Tests:** `scripts/tests/red-flag-taxonomy.test.ts` covers each item above, and passes in the CI-shaped mount.
- Not part of this bean: 3 failures in the audit-coverage "Adversarial Integration" tests (`adversarial-review-gate.test.ts`). Two are 5-second timeouts and one is an assertion on `adversarialCoverageByGraph`. They belong to the gate's wiring (sibling w8jq).

## Closed 2026-10-09

- **Branch**: `claude/abmq-merge-gate-red-flags`
- **Commit**: `6785209b1717d508730c9fcc81a011d49a2eff90`
- **Implementation**:
  - `schemas/red-flag.ts`:
    - Defined closed enum `RedFlagCategory` (`security`, `data-loss`, `correctness`, `false-green`, `provenance`, `scope-breach`, `irreversible-action`, `licence`) with `RED_FLAG_CATEGORIES` and `RedFlagCategorySchema`.
    - Created `RED_FLAG_DEFINITIONS` mapping each category to its exact definition and historical repository defect example (`agent-review.yml`, `de9k`/`c1`, `beans:claim`/`c3d7`, `lean-bare-import`/`dh4f`, `w4tq`, `7u3g`, `plj1`, third-party licence compliance).
    - Defined `AdversarialFindingSchema` and `AdversarialReviewSchema`, enforcing that findings with `weight: "blocking"` require a valid `RedFlagCategory` and non-empty `evidence`.
    - Defined `MergeReviewSchema` (`merge-review/v1`) for PR head review records.
    - Defined human override path (`OverrideDecisionSchema`, `applyRedFlagOverride`), requiring a human reviewer with standing, timestamp, reason, and finding ID, preserving the finding and updating status to `overridden` without deletion.
    - Defined gate behaviour and state derivations for all 6 states (`open`, `resolved`, `overridden`, `would-have-blocked`, `unknown`, `stale`) across findings, reviews, and merge reviews (`evaluateFindingGateState`, `evaluateReviewGateState`, `evaluateMergeReviewGateState`), implementing the 2026-10-03 owner warn-only ruling.
  - `schemas/qa-review.ts`: Re-exported all red flag entities from `schemas/red-flag.ts`.
  - `schemas/kg-qa.ts`: Added optional `adversarial_reviews?: AdversarialReview[]` to `KgQaReport` and `KgQaReportSchema` compatible with `kg-qa/v1`.
- **Test Evidence**:
  - `scripts/tests/red-flag-taxonomy.test.ts`: 25 tests passing (133 expect assertions), verifying taxonomy validation, sidecar validation, override structure, and gate state derivation across all 6 states.
  - `schemas/qa-review.test.ts`: 19 tests passing (24 expect assertions).
  - `bun run typecheck`: clean pass (`tsc --noEmit -p tsconfig.json`).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Summary of Changes

Re-triaged 2026-10-10 (lane B drain). Implemented already; this commit records the evidence.

- [x] **Closed taxonomy:** `cat-harness/schemas/red-flag.ts` defines `RED_FLAG_CATEGORIES`, 8 categories (security, data-loss, correctness, false-green, provenance, scope-breach, irreversible-action, licence). Each has a `definition` and a `historicalExample` from this repository's history in `RED_FLAG_DEFINITIONS`.
- [x] **Sidecar shape:** `AdversarialFindingSchema` (a blocking finding requires a category and evidence), `AdversarialReviewSchema` and `MergeReviewSchema` (`merge-review/v1`, bound to commit SHAs). `kg-qa/v1` accepts optional `adversarial_reviews[]`.
- [x] **Override path:** `OverrideDecisionSchema` and `applyRedFlagOverride`. Only a human may override; the finding becomes `overridden` and is never deleted.
- [x] **Gate behaviour for every state,** `RED_FLAG_GATE_STATES`: would-have-blocked (the warn-only ruling of 2026-10-03), open, resolved, overridden, unknown, stale. Evaluated by `evaluateFinding/Review/MergeReviewGateState`.
- **Tests:** `scripts/tests/red-flag-taxonomy.test.ts` covers each item above, and passes in the CI-shaped mount.
- Not part of this bean: 3 failures in the audit-coverage "Adversarial Integration" tests (`adversarial-review-gate.test.ts`). Two are 5-second timeouts and one is an assertion on `adversarialCoverageByGraph`. They belong to the gate's wiring (sibling w8jq).


## Summary of Changes

Re-triaged 2026-10-10 (lane B drain). Implemented already; this commit records the evidence.

- [x] **Closed taxonomy:** `cat-harness/schemas/red-flag.ts` defines `RED_FLAG_CATEGORIES`, 8 categories (security, data-loss, correctness, false-green, provenance, scope-breach, irreversible-action, licence). Each has a `definition` and a `historicalExample` from this repository's history in `RED_FLAG_DEFINITIONS`.
- [x] **Sidecar shape:** `AdversarialFindingSchema` (a blocking finding requires a category and evidence), `AdversarialReviewSchema` and `MergeReviewSchema` (`merge-review/v1`, bound to commit SHAs). `kg-qa/v1` accepts optional `adversarial_reviews[]`.
- [x] **Override path:** `OverrideDecisionSchema` and `applyRedFlagOverride`. Only a human may override; the finding becomes `overridden` and is never deleted.
- [x] **Gate behaviour for every state,** `RED_FLAG_GATE_STATES`: would-have-blocked (the warn-only ruling of 2026-10-03), open, resolved, overridden, unknown, stale. Evaluated by `evaluateFinding/Review/MergeReviewGateState`.
- **Tests:** `scripts/tests/red-flag-taxonomy.test.ts` covers each item above, and passes in the CI-shaped mount.
- Not part of this bean: 3 failures in the audit-coverage "Adversarial Integration" tests (`adversarial-review-gate.test.ts`). Two are 5-second timeouts and one is an assertion on `adversarialCoverageByGraph`. They belong to the gate's wiring (sibling w8jq).

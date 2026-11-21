<!-- GENERATED from cat-harness/processes/process/criterion-adjudication.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Criterion adjudication

> **Generated, and not the authority.** This is `cat-harness/processes/process/criterion-adjudication.bpmn` (process `Process_CriterionAdjudication`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Two reviewer entries for ONE QA criterion disagree: ask the adjudication, then do the one of three things that a criterion disagreement admits.

## Begin — Entries for one criterion disagree (`Start_CriterionDisagreement`)

- Begin here: The sidecar, not a complaint.
- Call `workflow_start` with `process: "Process_CriterionAdjudication"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_Adjudicate` (Adjudicate the criterion disagreement)

### 1. Adjudicate the criterion disagreement (`Call_Adjudicate`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `adjudication`.
- What: The shared judgement — entry condition, untainted dispatch, person-or-agent restriction — asked with THIS question's permitted answers.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Outcome` (Which of the three?)

### Decide — Which of the three? (`GW_Outcome`)

- The three are legitimate in the same way: what makes an outcome sound is not which one it is but that its reason was recorded.
- Call `workflow_complete` with `node: "GW_Outcome"` and `outcome` set to the label that holds:
  - «the finding stands» → `A_RecordEntry` (Write the entry that LEADS — keeping the checker's beneath it)
  - «the criterion does not apply here» → `A_ScopeCriterion` (Scope the criterion so it stops applying here)
  - «it applies; this is an exception» → `A_Dispensation` (Grant a dispensation, with its reason)

### 2. Write the entry that LEADS — keeping the checker's beneath it (`A_RecordEntry`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `adjudication`.
- What: Not relaxable, and the one step here that is not.
- Record it: `workflow_complete` with `node: "A_RecordEntry"`.
- next: → `End_Settled` (Settled, with the reason on the record)

### 3. Scope the criterion so it stops applying here (`A_ScopeCriterion`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `adjudication`.
- What: One edit to the criterion rather than ten overrules on the blocks it should never have covered.
- Record it: `workflow_complete` with `node: "A_ScopeCriterion"`.
- next: → `A_RecordEntry` (Write the entry that LEADS — keeping the checker's beneath it)

### 4. Grant a dispensation, with its reason (`A_Dispensation`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `adjudication`.
- What: The rule applies and this subject is a stated exception.
- Record it: `workflow_complete` with `node: "A_Dispensation"`.
- next: → `A_RecordEntry` (Write the entry that LEADS — keeping the checker's beneath it)

## Done — Settled, with the reason on the record (`End_Settled`)

- The instance completes here: Settled for this version of the source. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

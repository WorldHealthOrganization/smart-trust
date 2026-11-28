<!-- GENERATED from cat-harness/processes/process/adjudication.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Adjudication

> **Generated, and not the authority.** This is `cat-harness/processes/process/adjudication.bpmn` (process `Process_Adjudication`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A criterion's reviewer entries disagree and no mechanism can settle them: this is the judgement that does, and the record it must leave.

## Begin — Entries for one criterion disagree (`Start_Disagreement`)

- Begin here: The sidecar, not a complaint.
- Call `workflow_start` with `process: "Process_Adjudication"` and the subject this run is about; keep the instance id it returns.
- next: → `A_StateFinding` (State the finding and what it read)

### 1. State the finding and what it read (`A_StateFinding`)

- Who: the `Feedback provider` lane (role `feedback-provider`).
- Skill: `content-feedback`.
- What: Each provider says what it found and on what evidence.
- Record it: `workflow_complete` with `node: "A_StateFinding"`.
- next: → `GW_Adjudicable` (Are both sides present?)

### Decide — Are both sides present? (`GW_Adjudicable`)

- A missing entry is not a disagreement.
- Call `workflow_complete` with `node: "GW_Adjudicable"` and `outcome` set to the label that holds:
  - «both sides present» → `A_Dispatch` (Dispatch with adjudicator_sees — never the artefact)
  - «only one side» → `End_NotAdjudicable` (Not adjudicable — it is a review, a gate, or a bug report)

### 2. Dispatch with adjudicator_sees — never the artefact (`A_Dispatch`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `untainted-verification`.
- What: `UntaintedDispatch` on the criterion declares what each party is given; the caller names a subject and a criterion and does not hand-assemble a brief, because the party composing a brief by hand is the producer.
- Record it: `workflow_complete` with `node: "A_Dispatch"`.
- next: → `A_Adjudicate` (Adjudicate the disagreement)

## Done — Not adjudicable — it is a review, a gate, or a bug report (`End_NotAdjudicable`)

- The instance completes here: Each of those has somewhere else to go, and sending it there is the outcome rather than a failure of this process. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Adjudicate the disagreement (`A_Adjudicate`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- Skill: `adjudication`.
- What: The judgement itself, and the one step nothing here can check: if a mechanism could decide it, the process would not have been entered.
- Record it: `workflow_complete` with `node: "A_Adjudicate"`.
- next: → `End_Adjudicated` (Adjudicated, with the reason recorded)

## Done — Adjudicated, with the reason recorded (`End_Adjudicated`)

- The instance completes here: The judgement and its reason, and nothing about what follows from them. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

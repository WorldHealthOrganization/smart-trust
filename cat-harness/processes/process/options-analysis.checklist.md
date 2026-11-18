<!-- GENERATED from cat-harness/processes/process/options-analysis.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Options analysis

> **Generated, and not the authority.** This is `cat-harness/processes/process/options-analysis.bpmn` (process `Process_OptionsAnalysis`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A decision reached by a NAMED methodology, with its rejected options recorded.

## Begin — A decision is in play (`Start_Process_OptionsAnalysis`)

- Begin here.
- Call `workflow_start` with `process: "Process_OptionsAnalysis"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Frame` (Frame the decision and check the trigger)

### 1. Frame the decision and check the trigger (`A_Frame`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `opening-brief`.
- What: One sentence naming the KIND of thing being chosen, not the options — "which cache strategy", never "A or B".
- Record it: `workflow_complete` with `node: "A_Frame"`.
- next: → `GW_Trigger` (Irreversible or surprising?)

### Decide — Irreversible or surprising? (`GW_Trigger`)

- `A_Frame` has always ENDED with this question — "is this irreversible, or would the answer surprise someone?
- Call `workflow_complete` with `node: "GW_Trigger"` and `outcome` set to the label that holds:
  - «yes» → `A_Select` (Select the methodology by context)
  - «no» → `End_TriggerNotMet` (Trigger not met — the caller decides without an analysis)

### 2. Select the methodology by context (`A_Select`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: Ask the selection question in order, first yes decides: do the criteria RECUR with the same inputs having to produce the same answer; is this the CERTAINTY of a body of evidence behind a recommendation; is the context a BEAN recording a decision; otherwise a one-off choice among candidates.
- Record it: `workflow_complete` with `node: "A_Select"`.
- next: → `A_CheckEvidence` (Check the selected methodology's evidence base)

## Done — Trigger not met — the caller decides without an analysis (`End_TriggerNotMet`)

- The instance completes here: A SEPARATE end event, rather than a short-circuit into the other one, because the two outcomes are different facts for the caller: "no analysis was needed" is not "the analysis recommends X". `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Check the selected methodology's evidence base (`A_CheckEvidence`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `literature-search`.
- What: Before applying a methodology, establish that the thing being applied is what it claims to be.
- Record it: `workflow_complete` with `node: "A_CheckEvidence"`.
- next: → `A_Apply` (Apply it, and state each option's trade-offs)

### 4. Apply it, and state each option's trade-offs (`A_Apply`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: Follow the selected methodology as written — adopted whole, not blended with another.
- Record it: `workflow_complete` with `node: "A_Apply"`.
- next: → `A_Record` (Record the chosen option AND the rejected ones)

### 5. Record the chosen option AND the rejected ones (`A_Record`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `decision-audit`.
- What: The rejected options and why they lost are part of the output, not an appendix.
- Record it: `workflow_complete` with `node: "A_Record"`.
- next: → `End_Process_OptionsAnalysis` (Options and recommendation recorded)

## Done — Options and recommendation recorded (`End_Process_OptionsAnalysis`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

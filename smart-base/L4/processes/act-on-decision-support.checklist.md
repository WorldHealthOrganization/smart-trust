<!-- GENERATED from smart-base/L4/processes/act-on-decision-support.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Act on decision-support guidance

> **Generated, and not the authority.** This is `smart-base/L4/processes/act-on-decision-support.bpmn` (process `Process_ActOnDecisionSupport`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The point-of-care system applies one of the DAK's decision tables, published as a CPG-on-FHIR PlanDefinition, to one client ($apply) and shows the health worker what it proposes (a RequestGroup, or CDS Hooks cards).

## Begin — Guidance is due (`Start_GuidanceDue`)

- Begin here: The DAK's process reaches a step its decision table informs: what is due, what a result means, what to do next.
- Call `workflow_start` with `process: "Process_ActOnDecisionSupport"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Apply` (Apply the PlanDefinition)

### 1. Apply the PlanDefinition (`Task_Apply`)

- Who: the `Point-of-care system` lane (role `point-of-care-system`).
- Skill: `apply-decision-support`.
- What: PlanDefinition/$apply for this client (or a CDS Hooks call): every proposed request is a draft proposal, and nothing is written to the record.
- Record it: `workflow_complete` with `node: "Task_Apply"`.
- next: → `Gateway_HasGuidance` (Anything proposed?)

### Decide — Anything proposed? (`Gateway_HasGuidance`)

- Read from the result: an empty RequestGroup (or no card) asks the health worker nothing.
- Call `workflow_complete` with `node: "Gateway_HasGuidance"` and `outcome` set to the label that holds:
  - «yes» → `Task_Review` (Accept or decline the guidance)
  - «no» → `End_NoGuidance` (Nothing to act on)

### 2. Accept or decline the guidance (`Task_Review`)

- Who: the `Health worker` lane (role `health-worker`).
- Skill: `review-decision-support-guidance`.
- What: See the proposed actions on the device and accept or decline each one, one tap each ("accept all" is one tap); modify one only where the device offers it.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `Gateway_Accepted` (Any action accepted?)

### Optional, while `Task_Review` (Accept or decline the guidance) is open — Taps "add a reason" (`Event_AddReason`)

- Non-interrupting and opt-in: it happens only when the health worker taps "add a reason" while reviewing.
- Only if it happens: `workflow_complete` with `node: "Event_AddReason"` while `Task_Review` (Accept or decline the guidance) is enabled. That step stays enabled and nothing waits for this path; skipping it is the default.
- next: → `Task_Rationale` (Note the reason (optional))

## Done — Nothing to act on (`End_NoGuidance`)

- The instance completes here: The decision table proposed no action for this client. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Any action accepted? (`Gateway_Accepted`)

- Read from the decisions: at least one action accepted or modified.
- Call `workflow_complete` with `node: "Gateway_Accepted"` and `outcome` set to the label that holds:
  - «yes» → `Task_Activate` (Update the care plan)
  - «no» → `End_NoChange` (Guidance declined)

### 3. Note the reason (optional) (`Task_Rationale`)

- Who: the `Health worker` lane (role `health-worker`).
- Skill: `record-decision-rationale`.
- What: Optional: pick a coded reason or type one, or neither; one FHIR Provenance records who decided what about which guidance, and why.
- Record it: `workflow_complete` with `node: "Task_Rationale"`.
- next: → `End_Noted` (Reason recorded)

### 4. Update the care plan (`Task_Activate`)

- Who: the `Point-of-care system` lane (role `point-of-care-system`).
- Skill: `activate-accepted-guidance`.
- What: Make each accepted request active (intent plan or order) and reference it from the client's CarePlan, in one transaction; write nothing for a declined action.
- Record it: `workflow_complete` with `node: "Task_Activate"`.
- next: → `End_Activated` (Care plan updated)

## Done — Guidance declined (`End_NoChange`)

- The instance completes here: Nothing was accepted; the record is unchanged. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Reason recorded (`End_Noted`)

- The instance completes here: The Provenance is saved beside the decision. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Care plan updated (`End_Activated`)

- The instance completes here: The accepted actions are in the client's care plan. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

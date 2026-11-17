<!-- GENERATED from folio-assistant-core/processes/content/record-agent-step.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Record agent step

> **Generated, and not the authority.** This is `folio-assistant-core/processes/content/record-agent-step.bpmn` (process `Process_RecordAgentStep`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The one way an agent reports a move on a change set.

## Begin — Agent moved on a change set (`StartEvent_Moved`)

- Begin here: Picked the row up, proposed, opened or pushed its pull request, saw its preview go live, answered new feedback, or stopped and is waiting for people.
- Call `workflow_start` with `process: "Process_RecordAgentStep"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_WriteAgentRow` (Write the change set's Agent row)

### 1. Write the change set's Agent row (`Task_WriteAgentRow`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-agent-columns`.
- What: On the Agent tab, the change set's row: Agentic status (Not started, Working, PR open, Ready for review, Change merged or Needs human); Pull request; Staging review page; Staging built, PR head, Staging built from and Staging deploy from `agent-record.ts push`; and Agent step from `agent-record.ts s
- Record it: `workflow_complete` with `node: "Task_WriteAgentRow"`.
- next: → `Task_WriteFeedback` (Write Feedback (agent) from that row)

### 2. Write Feedback (agent) from that row (`Task_WriteFeedback`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-script`.
- What: Feedback (agent) in the fixed layout (the ask first, then Status: and Next:), linking the same pull request and preview the Agent row now names.
- Record it: `workflow_complete` with `node: "Task_WriteFeedback"`.
- next: → `Task_ReadBack` (Read back Agentic status and Staging review)

### 3. Read back Agentic status and Staging review (`Task_ReadBack`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-log-watch`.
- What: After the script's next run, read the row's Agentic status, Agentic status (filter) and Staging review.
- Record it: `workflow_complete` with `node: "Task_ReadBack"`.
- next: → `Gateway_Agrees` (Sheet agrees with Feedback (agent)?)

### Decide — Sheet agrees with Feedback (agent)? (`Gateway_Agrees`)

- Call `workflow_complete` with `node: "Gateway_Agrees"` and `outcome` set to the label that holds:
  - «no: fix the Agent row, never the copied columns» → `Task_WriteAgentRow` (Write the change set's Agent row)
  - «yes» → `EndEvent_Recorded` (Step recorded)

## Done — Step recorded (`EndEvent_Recorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

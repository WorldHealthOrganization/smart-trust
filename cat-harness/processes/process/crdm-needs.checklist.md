<!-- GENERATED from cat-harness/processes/process/crdm-needs.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM Phase 1 — needs

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-needs.bpmn` (process `Process_CRDM_Needs`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Identify the stakeholders, synthesise a needs statement from the sources, and loop until the BA and the stakeholders both recognise it.

## Begin — Phase begins (`Start_Process_CRDM_Needs`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Needs"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Stakeholders` (Phase 1: Identify stakeholders)

### 1. Phase 1: Identify stakeholders (`A_Stakeholders`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: The agent asks the BA who is affected by this change.
- Record it: `workflow_complete` with `node: "A_Stakeholders"`.
- next: → `A_Synthesise` (Phase 1: Synthesise needs from sources)

### 2. Phase 1: Synthesise needs from sources (`A_Synthesise`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: From the chat, issue, uploads and library sources, write a clear, jargon-free statement of what is needed and why, tied to a concrete workflow.
- Record it: `workflow_complete` with `node: "A_Synthesise"`.
- next: → `BA_ReviewNeeds` (Review synthesised needs statement)

### 3. Review synthesised needs statement (`BA_ReviewNeeds`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`.
- What: The BA reviews what the agent synthesised and checks it against what they actually need.
- Record it: `workflow_complete` with `node: "BA_ReviewNeeds"`.
- next: → `S_ConfirmNeeds` (Confirm needs statement)

### 4. Confirm needs statement (`S_ConfirmNeeds`)

- Who: the `Stakeholders` lane (role `stakeholder`).
- What: Stakeholders confirm, on the issue, that the needs statement says what they need — or say what to change.
- Record it: `workflow_complete` with `node: "S_ConfirmNeeds"`.
- next: → `GW_Needs` (BA approves?)

### Decide — BA approves? (`GW_Needs`)

- The BA's answer to the needs statement.
- Call `workflow_complete` with `node: "GW_Needs"` and `outcome` set to the label that holds:
  - «revise» → `A_Synthesise` (Phase 1: Synthesise needs from sources)
  - «yes» → `End_Process_CRDM_Needs` (Phase complete)

## Done — Phase complete (`End_Process_CRDM_Needs`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

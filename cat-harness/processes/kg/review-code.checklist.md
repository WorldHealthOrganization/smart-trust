<!-- GENERATED from cat-harness/processes/kg/review-code.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Code node review

> **Generated, and not the authority.** This is `cat-harness/processes/kg/review-code.bpmn` (process `Process_CodeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Judging changed CODE NODES — Tool definitions and schema definition nodes — on whether they are correct NODES, not merely correct code.

## Begin — Code nodes changed (`Start_CodeNodes`)

- Begin here.
- Call `workflow_start` with `process: "Process_CodeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_RunNodeAudits` (Run the node audits)

### 1. Run the node audits (`Task_RunNodeAudits`)

- Who: the `Code reviewer` lane (role `code-reviewer`).
- Skill: `code-node-review`.
- What: `check:tools`, `kg:audit` and `typecheck`.
- Record it: `workflow_complete` with `node: "Task_RunNodeAudits"`.
- next: → `GW_NodeKind` (Which node kind?)

### Decide — Which node kind? (`GW_NodeKind`)

- What kind of node is under review?
- Call `workflow_complete` with `node: "GW_NodeKind"` and `outcome` set to the label that holds:
  - «Tool» → `Task_ReviewTool` (Review the Tool node)
  - «schema» → `Task_ReviewSchema` (Review the schema definition node)

### 2. Review the Tool node (`Task_ReviewTool`)

- Who: the `Code reviewer` lane (role `code-reviewer`).
- Skill: `skills-and-tools`, `covered-is-not-reachable`.
- What: Does it name skills, and do they resolve?
- Record it: `workflow_complete` with `node: "Task_ReviewTool"`.
- next: → `GW_Join`

### 3. Review the schema definition node (`Task_ReviewSchema`)

- Who: the `Code reviewer` lane (role `code-reviewer`).
- Skill: `code-node-review`, `site-presentation-assets`.
- What: Does the node declare what KIND of node it is?
- Record it: `workflow_complete` with `node: "Task_ReviewSchema"`.
- next: → `GW_Join`

### Merge — `GW_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_RecordVerdict` (Record the verdict on the node)

### 4. Record the verdict on the node (`Task_RecordVerdict`)

- Who: the `Code reviewer` lane (role `code-reviewer`).
- Skill: `code-node-review`.
- What: Findings are advice, not commits — the same separation the generic reviewer lane keeps.
- Record it: `workflow_complete` with `node: "Task_RecordVerdict"`.
- next: → `End_CodeReviewed` (Code nodes reviewed)

## Done — Code nodes reviewed (`End_CodeReviewed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

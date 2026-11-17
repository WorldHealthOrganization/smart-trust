<!-- GENERATED from cat-harness/sdlc/processes/bean-close.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Close the bean

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/bean-close.bpmn` (process `Process_BeanClose`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The closing half of every bean's life: end it in a state that says why.

## Begin — The caller's work has stopped (`Close_Start`)

- Begin here.
- Call `workflow_start` with `process: "Process_BeanClose"` and the subject this run is about; keep the instance id it returns.
- next: → `Close_Outcome` (Outcome?)

### Decide — Outcome? (`Close_Outcome`)

- The performer's judgement on the work the caller did, and one of three recorded endings.
- Call `workflow_complete` with `node: "Close_Outcome"` and `outcome` set to the label that holds:
  - «done» → `Close_Complete` (Complete (no unchecked todos left))
  - «not wanted» → `Close_Scrap` (Scrap with reasons NEVER delete)
  - «blocked» → `Close_RecordBlocker` (Record the blocker and hand back)

### 1. Complete (no unchecked todos left) (`Close_Complete`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Only once nothing is unchecked, and with a summary of what changed.
- Record it: `workflow_complete` with `node: "Close_Complete"`.
- next: → `Close_Archive` (Archive the bean (completed or scrapped))

### 2. Scrap with reasons NEVER delete (`Close_Scrap`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: `status: scrapped`, plus a "Reasons for Scrapping" section.
- Record it: `workflow_complete` with `node: "Close_Scrap"`.
- next: → `Close_Archive` (Archive the bean (completed or scrapped))

### 3. Record the blocker and hand back (`Close_RecordBlocker`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Blocked is not scrapped.
- Record it: `workflow_complete` with `node: "Close_RecordBlocker"`.
- next: → `Close_HandedBack` (Blocked — handed back)

### 4. Archive the bean (completed or scrapped) (`Close_Archive`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Move the bean, now completed or scrapped, into the archive, with a line saying which process closed it.
- Record it: `workflow_complete` with `node: "Close_Archive"`.
- next: → `Close_Archived` (Recorded and archived)

## Done — Blocked — handed back (`Close_HandedBack`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Recorded and archived (`Close_Archived`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

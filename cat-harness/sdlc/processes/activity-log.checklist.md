<!-- GENERATED from cat-harness/sdlc/processes/activity-log.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Agent activity log

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/activity-log.bpmn` (process `Process_ActivityLog`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

What an agent writes down about its own run, and what a person can do with it afterwards: task starts and ends, messages and errors, persisted where somebody can read them.

## Begin — A task begins (`Start_Task`)

- Begin here.
- Call `workflow_start` with `process: "Process_ActivityLog"` and the subject this run is about; keep the instance id it returns.
- next: → `A_LogStart` (Log task-start)

## Begin — The periodic sweep fires (`Start_Sweep`)

- Begin here.
- Call `workflow_start` with `process: "Process_ActivityLog"` and the subject this run is about; keep the instance id it returns.
- next: → `A_EmptyAll` (Discard all entries, or a whole session)

## Begin — A person asks to empty the log (`Start_Empty`)

- Begin here.
- Call `workflow_start` with `process: "Process_ActivityLog"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_EmptyScope` (One entry or all?)

### 1. Log task-start (`A_LogStart`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `activity-log`.
- What: Write a task-start entry before touching anything: summary, actor, and the process/task/bean/branch/session it belongs to where they exist.
- Record it: `workflow_complete` with `node: "A_LogStart"`.
- next: → `A_DoWork` (Do the work)

### 2. Discard all entries, or a whole session (`A_EmptyAll`)

- Who: the `Log operator (human)` lane (role `user`).
- Skill: `activity-log`.
- What: Remove every entry, one session's, or those before a date — emptyLog with { all }, { session } or { before }; there is no default selector.
- Record it: `workflow_complete` with `node: "A_EmptyAll"`.
- next: → `End_Emptied` (Log emptied)

### Decide — One entry or all? (`Gateway_EmptyScope`)

- Asked when a person asks to empty the log: which entries?
- Call `workflow_complete` with `node: "Gateway_EmptyScope"` and `outcome` set to the label that holds:
  - «one» → `A_EmptyOne` (Discard one entry by id)
  - «all / periodic» → `A_EmptyAll` (Discard all entries, or a whole session)

### 3. Do the work (`A_DoWork`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- What: The task itself.
- Record it: `workflow_complete` with `node: "A_DoWork"`.
- next: → `GW_DoWork` (Task complete?)

## Done — Log emptied (`End_Emptied`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Discard one entry by id (`A_EmptyOne`)

- Who: the `Log operator (human)` lane (role `user`).
- Skill: `activity-log`.
- What: Remove one entry by its stable id, with emptyLog({ id }).
- Record it: `workflow_complete` with `node: "A_EmptyOne"`.
- next: → `End_Emptied` (Log emptied)

### Decide — Task complete? (`GW_DoWork`)

- Which way the work goes after it.
- Call `workflow_complete` with `node: "GW_DoWork"` and `outcome` set to the label that holds:
  - «no» → `A_LogMessage` (Log a message or an error)
  - «yes» → `A_LogEnd` (Log task-end)

### 5. Log a message or an error (`A_LogMessage`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `activity-log`.
- What: Write a message or error entry whenever a later reader would need it.
- Record it: `workflow_complete` with `node: "A_LogMessage"`.
- next: → `A_DoWork` (Do the work)

### 6. Log task-end (`A_LogEnd`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `activity-log`.
- What: Write a task-end entry, with the outcome in the detail.
- Record it: `workflow_complete` with `node: "A_LogEnd"`.
- next: → `Gateway_Capture` (Capture enabled?)

### Decide — Capture enabled? (`Gateway_Capture`)

- Asked after a task ends: is log capture switched on for this session?
- Call `workflow_complete` with `node: "Gateway_Capture"` and `outcome` set to the label that holds:
  - «on» → `A_PersistLog` (Persist the log to the data store)
  - «off or unknown» → `A_ReportCaptureState` (Report the capture state)

### 7. Persist the log to the data store (`A_PersistLog`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `activity-log`.
- What: Capture is explicitly on — by <cat-harness.processes:log capture="on"/> on the process or by config — so the entries go to the git data store.
- Record it: `workflow_complete` with `node: "A_PersistLog"`.
- next: → `End_Task` (Task logged)

### 8. Report the capture state (`A_ReportCaptureState`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `activity-log`.
- What: Capture is off or unknown, so nothing is committed.
- Record it: `workflow_complete` with `node: "A_ReportCaptureState"`.
- next: → `End_Task` (Task logged)

## Done — Task logged (`End_Task`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

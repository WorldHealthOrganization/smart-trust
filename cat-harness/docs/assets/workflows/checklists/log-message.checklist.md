<!-- GENERATED from bootstrap/processes/log-message.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Log a message

> **Generated, and not the authority.** This is `bootstrap/processes/log-message.bpmn` (process `Process_LogMessage`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A SUB-PROCESS, never an entry point.

## Begin — An actor has something to record (`Start_LogMessage`)

- Begin here.
- Call `workflow_start` with `process: "Process_LogMessage"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Compose` (Compose the message)

### 1. Compose the message (`A_Compose`)

- Who: the `Actor` lane.
- Skill: `log-message`.
- What: Five required strings — timestamp, actor, process, task, message — and one optional markdown body.
- Record it: `workflow_complete` with `node: "A_Compose"`.
- next: → `GW_Complete` (Required fields: all five present?)

### Decide — Required fields: all five present? (`GW_Complete`)

- Checks the composed message against the five required fields of the log-message skill (skills/log-message.md, table "The message"): timestamp, actor, process, task and message.
- Call `workflow_complete` with `node: "GW_Complete"` and `outcome` set to the label that holds:
  - «no» → `End_NotLogged` (Not recorded — say so)
  - «yes» → `A_Record` (Record it where a person can read it)

## Done — Not recorded — say so (`End_NotLogged`)

- The instance completes here: An incomplete message is NOT logged and the actor says it could not log. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Record it where a person can read it (`A_Record`)

- Who: the `Logger` lane (role `logger`).
- Skill: `logger`.
- What: Performed by the Logger, which records and decides nothing.
- Record it: `workflow_complete` with `node: "A_Record"`.
- next: → `End_Logged` (Recorded)

## Done — Recorded (`End_Logged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

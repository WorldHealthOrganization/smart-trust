<!-- GENERATED from cat-harness/processes/process/secure-agent-permissions.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Secure agent permissions

> **Generated, and not the authority.** This is `cat-harness/processes/process/secure-agent-permissions.bpmn` (process `Process_SecureAgentPermissions`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Secure the permissions a coding agent needs to take part in this harness's processes, from the human who can grant them, and write each grant into the agent Tool's own configuration through that Tool's adapter.

## Begin — Session opened, or an action was denied (`Start_Secure`)

- Begin here.
- Call `workflow_start` with `process: "Process_SecureAgentPermissions"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_IdentifyTools` (Identify the agent Tool(s) acting here)

### 1. Identify the agent Tool(s) acting here (`Task_IdentifyTools`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: Which coding-agent Tool is running this session, and which others the layer is configured for (each has its own config files: AGENTS.md is read by many; Claude Code, Gemini CLI, Cursor, Copilot and Codex each add their own).
- Record it: `workflow_complete` with `node: "Task_IdentifyTools"`.
- next: → `Task_ReadGrants` (Compare what the processes need with what is granted)

### 2. Compare what the processes need with what is granted (`Task_ReadGrants`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: The needed set is the agent-permissions skill's list (write generated projections: CI only, never the agent; edit hooks or settings; run the gates; push a feature branch; open a PR), scoped to what this layer's processes actually call.
- Record it: `workflow_complete` with `node: "Task_ReadGrants"`.
- next: → `GW_Gap` (Anything needed and not granted?)

### Decide — Anything needed and not granted? (`GW_Gap`)

- `none missing` when every needed permission has a recorded grant reflected in the Tool's config; `missing` otherwise, including a rule present in the config with no grant on the record.
- Call `workflow_complete` with `node: "GW_Gap"` and `outcome` set to the label that holds:
  - «none missing» → `End_Current` (Permissions current)
  - «missing» → `Task_Explain` (Explain each missing permission, with the exact config diff)

## Done — Permissions current (`End_Current`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Explain each missing permission, with the exact config diff (`Task_Explain`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: Per permission: what it allows the agent to do without asking, why a process here needs it, the narrowest form that would do, and the exact change to the Tool's config.
- Record it: `workflow_complete` with `node: "Task_Explain"`.
- next: → `Task_OwnerGrants` (Grant, narrow or refuse each)

### 4. Grant, narrow or refuse each (`Task_OwnerGrants`)

- Who: the `Owner` lane (role `user`).
- Skill: `agent-permissions`.
- What: The owner's answer, per permission, in their own words.
- Record it: `workflow_complete` with `node: "Task_OwnerGrants"`.
- next: → `Task_RecordGrant` (Record each answer: who, when, scope, the quote)

### 5. Record each answer: who, when, scope, the quote (`Task_RecordGrant`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: One record per permission: by, on, tool, permission, scope (session, instance, or until a date), the config diff, and evidence (the owner's words verbatim, with where they were said).
- Record it: `workflow_complete` with `node: "Task_RecordGrant"`.
- next: → `GW_Granted` (Anything granted?)

### Decide — Anything granted? (`GW_Granted`)

- `granted` when the owner granted at least one permission (as asked or narrowed); `refused` when they granted none.
- Call `workflow_complete` with `node: "GW_Granted"` and `outcome` set to the label that holds:
  - «refused» → `End_Refused` (Refused: actions keep asking)
  - «granted» → `Task_WriteConfig` (Write it through the Tool's adapter)

## Done — Refused: actions keep asking (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Write it through the Tool's adapter (`Task_WriteConfig`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `agent-permissions`.
- What: The exact diff the owner saw, nothing more, written by the person or by the agent under their consent to that diff.
- Record it: `workflow_complete` with `node: "Task_WriteConfig"`.
- next: → `End_Granted` (Granted, recorded)

## Done — Granted, recorded (`End_Granted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

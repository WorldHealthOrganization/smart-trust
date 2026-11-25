<!-- GENERATED from cat-harness/processes/kg/kg-separation-authorise.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Authorise the extraction

> **Generated, and not the authority.** This is `cat-harness/processes/kg/kg-separation-authorise.bpmn` (process `Process_KgSeparationAuthorise`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Reports what would move, with sizes and what breaks, and asks the administrator to authorise the extraction; the gateway after the ask reads the answer.

## Begin — Ready to leave (`Start_Authorise`)

- Begin here.
- Call `workflow_start` with `process: "Process_KgSeparationAuthorise"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Propose` (Report what moves — sizes, what breaks)

### 1. Report what moves — sizes, what breaks (`Task_Propose`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `deletion-requires-confirmation`.
- What: The agent reports and waits: what would move, how large, what in the parent breaks, and the rollback.
- Shared step `GT_ReportWhatMoves`.
- Record it: `workflow_complete` with `node: "Task_Propose"`.
- next: → `Task_Authorise` (Ask to authorise the extraction)

### 2. Ask to authorise the extraction (`Task_Authorise`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: A repository cut changes the substrate every other process binds to; that is a person's decision.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Authorised` (Authorised?)

### Decide — Authorised? (`GW_Authorised`)

- Reads the administrator's answer to the ask before it.
- Call `workflow_complete` with `node: "GW_Authorised"` and `outcome` set to the label that holds:
  - «authorised» → `End_Authorised` (Authorised)
  - «declined» → `End_NotAuthorised` (Declined)

## Done — Authorised (`End_Authorised`)

- The instance completes here: The administrator authorised the extraction. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Declined (`End_NotAuthorised`)

- The instance completes here: Declined: the graph stays in place, ready to leave. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

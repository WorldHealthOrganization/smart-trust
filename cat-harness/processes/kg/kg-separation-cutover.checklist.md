<!-- GENERATED from cat-harness/processes/kg/kg-separation-cutover.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Cut over to the separated graph

> **Generated, and not the authority.** This is `cat-harness/processes/kg/kg-separation-cutover.bpmn` (process `Process_KgSeparationCutover`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Retires the parent's copy and measures the cutover with separation:cutover:check until every condition holds.

## Begin — First release consumed (`Start_Cutover`)

- Begin here.
- Call `workflow_start` with `process: "Process_KgSeparationCutover"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Cutover` (Cutover: retire the parent's copy)

### 1. Cutover: retire the parent's copy (`Task_Cutover`)

- Who: the `Administrator` lane (role `administrator`).
- Skill: `deletion-requires-confirmation`.
- What: The one commit worth reverting, made only after the parent consumes the release and every identifier dereferences.
- Record it: `workflow_complete` with `node: "Task_Cutover"`.
- next: → `Task_CutoverCheck` (Measure the cutover: separation:cutover:check)

### 2. Measure the cutover: separation:cutover:check (`Task_CutoverCheck`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `kg-separation`.
- What: Run `bun run cat separation:cutover:check --site` in the SEPARATED repository (Tool `separation-cutover-check`).
- Record it: `workflow_complete` with `node: "Task_CutoverCheck"`.
- next: → `GW_CutoverComplete` (Cutover complete?)

### Decide — Cutover complete? (`GW_CutoverComplete`)

- Decided by the exit of `separation:cutover:check`: 0 every condition measured and passed, 1 a condition failed, 2 one could not be determined or was not run (without `--site` the answer is never complete).
- Call `workflow_complete` with `node: "GW_CutoverComplete"` and `outcome` set to the label that holds:
  - «complete» → `End_CutOver` (Cut over)
  - «a condition failed» → `Task_Cutover` (Cutover: retire the parent's copy)
  - «could not determine» → `End_CutoverUnknown` (UNKNOWN: not shown complete)

## Done — Cut over (`End_CutOver`)

- The instance completes here: Every cutover condition holds, measured. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — UNKNOWN: not shown complete (`End_CutoverUnknown`)

- The instance completes here: The check could not determine it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from cat-harness/sdlc/processes/generated-file-drift.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Check a generated file still matches its source

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/generated-file-drift.bpmn` (process `Process_GeneratedFileDrift`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Check that a committed generated file still matches the source it is generated from.

## Begin — File to check (`Start_Change`)

- Begin here: A caller's job has started: on a pull request, a push to main, or a dispatch.
- Call `workflow_start` with `process: "Process_GeneratedFileDrift"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Check` (Regenerate from the source and diff)

### 1. Regenerate from the source and diff (`Task_Check`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- What: Run the caller's generator with --check: regenerate the file from its source in memory and diff it against the committed copy.
- Record it: `workflow_complete` with `node: "Task_Check"`.
- next: → `GW_Drift` (Did anything change?)

### Decide — Did anything change? (`GW_Drift`)

- Answered by the diff Task_Check takes.
- Call `workflow_complete` with `node: "GW_Drift"` and `outcome` set to the label that holds:
  - «no» → `End_Clean` (In sync)
  - «yes» → `End_Drift` (Stale: job red)

## Done — In sync (`End_Clean`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Stale: job red (`End_Drift`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

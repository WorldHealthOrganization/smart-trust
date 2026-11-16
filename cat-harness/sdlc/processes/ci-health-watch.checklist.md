<!-- GENERATED from cat-harness/sdlc/processes/ci-health-watch.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Is CI actually working on the default branch?

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/ci-health-watch.bpmn` (process `Process_CiHealth`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Is CI actually working on the default branch: record each workflow's state on one tracking issue, and fail the job only when the state could not be determined.

## Begin — Weekly (Mon 09:17 UTC), a FAILING gating run on main, or on dispatch (`Start_Sweep`)

- Begin here: Three ways in, and the first two answer different questions.
- Call `workflow_start` with `process: "Process_CiHealth"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Check` (Run check:ci-health, WRITING the report file)

### 1. Run check:ci-health, WRITING the report file (`Task_Check`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Run check:ci-health --out, writing the report file before any exit path.
- Record it: `workflow_complete` with `node: "Task_Check"`.
- next: → `Call_Watch` (Report the verdict on the tracking issue)

### 2. Report the verdict on the tracking issue (`Call_Watch`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- What: Runs the shared tracking watch with the label `ci-health`.
- A subprocess (`Process_TrackedWatch`, with `label` = `ci-health`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Reported` (Verdict reported)

## Done — Verdict reported (`End_Reported`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

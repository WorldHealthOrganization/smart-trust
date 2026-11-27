<!-- GENERATED from cat-harness/sdlc/processes/repository-health-watch.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Is the repository itself healthy?

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/repository-health-watch.bpmn` (process `Process_RepoHealth`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Is the repository itself healthy — what the review previews cost the publish branch, what a clone costs, whether the work plan holds duplicates or unhonoured claims — reported in one tracking issue and never acted on.

## Begin — Daily (06:41 UTC), or on dispatch (`Start_Sweep`)

- Begin here.
- Call `workflow_start` with `process: "Process_RepoHealth"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Check` (Run the health checks, keeping the report either way)

### 1. Run the health checks, keeping the report either way (`Task_Check`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `deletion-requires-confirmation`.
- What: Run bun run cat health --out and upload the JSON report whatever the verdict — on unknown it is the only evidence of why the sweep went blind.
- Record it: `workflow_complete` with `node: "Task_Check"`.
- next: → `Call_Watch` (Report the verdict on the tracking issue)

### 2. Report the verdict on the tracking issue (`Call_Watch`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- What: Runs the shared tracking watch with the label `repo-health`.
- A subprocess (`Process_TrackedWatch`, with `label` = `repo-health`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Reported` (Verdict reported)

## Done — Verdict reported (`End_Reported`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

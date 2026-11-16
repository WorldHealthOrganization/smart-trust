<!-- GENERATED from cat-harness/sdlc/processes/pr-checks-present.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Which open pull requests have no CI run on their head?

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/pr-checks-present.bpmn` (process `Process_PrChecksPresent`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Find the open pull requests whose head has no CI run, past an age gate, and say so on one tracking issue and once per head on the pull request.

## Begin — Hourly (:37), or on dispatch (`Start_Sweep`)

- Begin here.
- Call `workflow_start` with `process: "Process_PrChecksPresent"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Sweep` (Ask whether each open PR head has a run)

### 1. Ask whether each open PR head has a run (`Task_Sweep`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Run check:prs-have-runs --min-age-minutes 15, writing the report file first.
- Record it: `workflow_complete` with `node: "Task_Sweep"`.
- next: → `Call_Watch` (Report the verdict on the tracking issue)

### 2. Report the verdict on the tracking issue (`Call_Watch`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- What: Runs the shared tracking watch with the label `pr-no-checks`.
- A subprocess (`Process_TrackedWatch`, with `label` = `pr-no-checks`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Found` (Any head with no run?)

### Decide — Any head with no run? (`GW_Found`)

- Reads which end the tracking watch reached.
- Call `workflow_complete` with `node: "GW_Found"` and `outcome` set to the label that holds:
  - «yes» → `Task_Comment` (Comment once per PR and head)
  - «no» → `End_Done` (Every head has a run, or could not tell)

### 3. Comment once per PR and head (`Task_Comment`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Comment on each affected open PR once per (PR, head sha): a hidden marker carrying the sha is checked first, so a re-run on the same head stays silent and a new push can be reported again.
- Record it: `workflow_complete` with `node: "Task_Comment"`.
- next: → `End_Recorded` (Recorded: job stays green)

## Done — Every head has a run, or could not tell (`End_Done`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Recorded: job stays green (`End_Recorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

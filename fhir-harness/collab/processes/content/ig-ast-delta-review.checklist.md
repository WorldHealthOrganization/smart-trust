<!-- GENERATED from fhir-harness/collab/processes/content/ig-ast-delta-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Is the incremental IG AST what a full build would have produced?

> **Generated, and not the authority.** This is `fhir-harness/collab/processes/content/ig-ast-delta-review.bpmn` (process `Process_IgAstDeltaReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The review step of an incremental FHIR IG build, as its own subprocess: list and inspect the differences between the incremental IG AST and what a full build would have produced, then accept them or raise a finding.

## Begin — Base AST and merged head AST exist (`Start_Ready`)

- Begin here: Reached after an incremental build (IncrementalBuildCli) has merged the rebuilt cone into the base, or after a full build when comparing an incremental AST with a full one.
- Call `workflow_start` with `process: "Process_IgAstDeltaReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Validity` (Check the base AST against the inputs)

### 1. Check the base AST against the inputs (`Task_Validity`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-ast-delta`.
- What: `ig-ast.ts validity <base> --ig <root>`: folio-assistant-core's compiledValidity on the manifest's inputs, with the input digest recomputed by the same algorithm as the Java writer.
- Record it: `workflow_complete` with `node: "Task_Validity"`.
- next: → `GW_Valid` (Base AST valid for its inputs?)

### Decide — Base AST valid for its inputs? (`GW_Valid`)

- Answered by Task_Validity's exit code.
- Call `workflow_complete` with `node: "GW_Valid"` and `outcome` set to the label that holds:
  - «yes» → `Task_Diff` (Diff the two ASTs)
  - «no — stale or
cannot tell» → `End_Stale` (Base stale — run a full build)

### 2. Diff the two ASTs (`Task_Diff`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-ast-delta`.
- What: `ig-ast.ts diff <base> <head> --plan plan.json --site <site>/ast-delta/`: resources added, removed, changed (with an element-level differential) and version-changed; edges added and removed; the plan's decision.
- Record it: `workflow_complete` with `node: "Task_Diff"`.
- next: → `Task_Review` (Read the delta)

## Done — Base stale — run a full build (`End_Stale`)

- The instance completes here: No delta is shown. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Read the delta (`Task_Review`)

- Who: the `QC reviewer` lane (role `qc-reviewer`).
- Skill: `ig-ast-delta`.
- What: Start at the delta index; open each changed resource's page.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `GW_Explained` (Every difference explained?)

### Decide — Every difference explained? (`GW_Explained`)

- Answered by the reviewer in Task_Review.
- Call `workflow_complete` with `node: "GW_Explained"` and `outcome` set to the label that holds:
  - «yes» → `End_Accepted` (Delta accepted — on to the QC gates)
  - «no» → `Task_FileCoupling` (Note the missed coupling on the work plan)

## Done — Delta accepted — on to the QC gates (`End_Accepted`)

- The instance completes here: Hands back to ig-incremental-build at Task_Qa. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Note the missed coupling on the work plan (`Task_FileCoupling`)

- Who: the `QC reviewer` lane (role `qc-reviewer`).
- Skill: `todo-manager`.
- What: Append to the IG AST work-plan item: the resource key, the differential path, and why it is unexplained.
- Record it: `workflow_complete` with `node: "Task_FileCoupling"`.
- next: → `End_FullBuild` (Coupling filed — run a full build)

## Done — Coupling filed — run a full build (`End_FullBuild`)

- The instance completes here: The incremental result is not used. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from folio-assistant-core/collab/processes/content/content-change-review-make.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Make the content change

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-change-review-make.bpmn` (process `Process_ContentChangeReviewMake`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Making one requested change to a folio's content on a feature branch: work out its scope, branch, edit the narrative and any deterministic logic, assess what else it touches and how to absorb that, and push.

## Begin — Receive change request (`Start_Agent`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentChangeReviewMake"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DetectScope` (Detect change scope & impact)

### 1. Detect change scope & impact (`Task_DetectScope`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- What: Agent analyses the requested change: - Which content blocks are affected?
- Record it: `workflow_complete` with `node: "Task_DetectScope"`.
- next: → `Task_CreateBranch` (Create feature branch)

### 2. Create feature branch (`Task_CreateBranch`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `feature-staging`.
- What: Agent creates a feature branch from main.
- Record it: `workflow_complete` with `node: "Task_CreateBranch"`.
- next: → `Task_EditContent` (Edit narrative content blocks)

### 3. Edit narrative content blocks (`Task_EditContent`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `content-author`.
- What: Agent modifies the relevant content blocks (.md files, block manifests).
- Record it: `workflow_complete` with `node: "Task_EditContent"`.
- next: → `Task_EditLogic` (Edit deterministic logic (if needed))

### 4. Edit deterministic logic (if needed) (`Task_EditLogic`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `content-author`.
- What: If the content change affects decision logic, indicators, or workflows: - Update CQL expressions - Update DMN decision tables - Adjust indicator definitions skill: dak-authoring, fhir-pipeline
- Record it: `workflow_complete` with `node: "Task_EditLogic"`.
- next: → `Task_AssessImpact` (Assess downstream impact)

### 5. Assess downstream impact (`Task_AssessImpact`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `content-graph`.
- What: Agent reviews downstream implications: - Will indicators need adjustment?
- Record it: `workflow_complete` with `node: "Task_AssessImpact"`.
- next: → `Call_OptionsAnalysis` (Options analysis how to absorb the impact)

### 6. Options analysis how to absorb the impact (`Call_OptionsAnalysis`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- What: On the edge OUT of `Task_AssessImpact` and before `Task_CommitPush`, because the impact assessment is the evidence the options are weighed against.
- A subprocess (`Process_OptionsAnalysis`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_CommitPush` (Commit, push, update PR)

### 7. Commit, push, update PR (`Task_CommitPush`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `prepare-merge-auto`, `before-after-preview`.
- What: Agent commits all changes to the feature branch and pushes.
- Record it: `workflow_complete` with `node: "Task_CommitPush"`.
- next: → `End_Agent` (Feature branch ready)

## Done — Feature branch ready (`End_Agent`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

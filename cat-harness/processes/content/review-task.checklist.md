<!-- GENERATED from cat-harness/processes/content/review-task.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Review task

> **Generated, and not the authority.** This is `cat-harness/processes/content/review-task.bpmn` (process `Process_Review`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The generic review position: classify what changed, descend into the review that fits it, consolidate what comes back, and accept or send back.

## Begin — Change to review (`Start_ChangeToReview`)

- Begin here.
- Call `workflow_start` with `process: "Process_Review"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ClassifyChange` (Classify what changed)

### 1. Classify what changed (`Task_ClassifyChange`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`.
- What: Prose, code nodes, or both.
- Record it: `workflow_complete` with `node: "Task_ClassifyChange"`.
- next: → `GW_Kind` (Prose, code, or both?)

### Decide — Prose, code, or both? (`GW_Kind`)

- What changed decides which review it gets, from Task_ClassifyChange's scoping.
- Call `workflow_complete` with `node: "GW_Kind"` and `outcome` set to the label that holds:
  - «prose» → `Call_NarrativeReview` (Narrative review)
  - «code nodes» → `Call_CodeReview` (Code node review)
  - «prose and the code it describes» → `Call_NarrativeCodeReview` (Prose and the code it describes)

### 2. Narrative review (`Call_NarrativeReview`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- What: Descend into Process_NarrativeReview.
- A subprocess (`Process_NarrativeReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Join`

### 3. Code node review (`Call_CodeReview`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- What: Descend into Process_CodeReview.
- A subprocess (`Process_CodeReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Join`

### 4. Prose and the code it describes (`Call_NarrativeCodeReview`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- What: Descend into Process_NarrativeCodeReview: judge what the pair checks could not settle (a stale pair, a false or undetermined claim), and send a disagreement with a checker to adjudication.
- Record it: `workflow_complete` with `node: "Call_NarrativeCodeReview"`.
- next: → `GW_Join`

### Merge — `GW_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_Consolidate` (Consolidate findings)

### 5. Consolidate findings (`Task_Consolidate`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- Skill: `content-review`.
- What: One report from however many subprocesses ran.
- Record it: `workflow_complete` with `node: "Task_Consolidate"`.
- next: → `Task_EditorDecides` (Accept, or send back)

### 6. Accept, or send back (`Task_EditorDecides`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `content-validate`.
- What: The editor's lane, kept separate on purpose: the reviewer who judged the change is not the position that accepts it.
- Record it: `workflow_complete` with `node: "Task_EditorDecides"`.
- next: → `End_Reviewed` (Decision recorded)

## Done — Decision recorded (`End_Reviewed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from folio-assistant-core/processes/content/contributor-feedback.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Contributor feedback on a working draft

> **Generated, and not the authority.** This is `folio-assistant-core/processes/content/contributor-feedback.bpmn` (process `Process_ContributorFeedback`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A document is still being written, and the Authoring Committee gives feedback on it in a shared Contributor Feedback sheet.

## Begin — Feedback on the working draft (`StartEvent_Feedback`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContributorFeedback"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_StartRow` (Start a change-set row)

### 1. Start a change-set row (`Task_StartRow`)

- Who: the `Authoring Committee` lane (role `authoring-committee`).
- Skill: `review-sheet-script`.
- What: A member adds a row on the Contributor Feedback tab: a title, the Selected Sections it is about (a dropdown from the document's table of contents) and their feedback in their own Blue column.
- Record it: `workflow_complete` with `node: "Task_StartRow"`.
- next: → `Task_Propose` (Propose a direction)

### 2. Propose a direction (`Task_Propose`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-script`.
- What: Reads: the row (Title, Selected Sections, the Contributor Feedback columns, Disposition) and the sections it names.
- Record it: `workflow_complete` with `node: "Task_Propose"`.
- next: → `Task_ReadyForAgent` (Set Ready for agent to Yes)

### 3. Set Ready for agent to Yes (`Task_ReadyForAgent`)

- Who: the `Editor` lane (role `editor`).
- Skill: `review-sheet-script`.
- What: An Editor agrees the direction and sets the row's Ready for agent (Orange) to Yes.
- Record it: `workflow_complete` with `node: "Task_ReadyForAgent"`.
- next: → `Task_EditInPullRequest` (Edit the document in the row's pull request)

### 4. Edit the document in the row's pull request (`Task_EditInPullRequest`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-script`.
- What: One row, one branch, one active pull request: the agent edits on the row's branch and opens its pull request, or updates it when the row comes round again.
- Record it: `workflow_complete` with `node: "Task_EditInPullRequest"`.
- next: → `Task_AnswerPreview` (Review the preview and answer)

### 5. Review the preview and answer (`Task_AnswerPreview`)

- Who: the `Authoring Committee` lane (role `authoring-committee`).
- Skill: `review-sheet-script`.
- What: Members read the preview and answer in their Blue columns, or leave them as they are when the change is right.
- Record it: `workflow_complete` with `node: "Task_AnswerPreview"`.
- next: → `Gateway_FeedbackChanged` (Feedback changed since the proposal?)

### Decide — Feedback changed since the proposal? (`Gateway_FeedbackChanged`)

- Answered by the script, which compares the row's Blue cells with the basis the agent wrote.
- Call `workflow_complete` with `node: "Gateway_FeedbackChanged"` and `outcome` set to the label that holds:
  - «changed» → `Task_Propose` (Propose a direction)
  - «agreed» → `Task_QaGate` (QA gate: check dispositions and PR)

### 6. QA gate: check dispositions and PR (`Task_QaGate`)

- Who: the `QA reviewer (independent)` lane (role `qc-reviewer`).
- Skill: `review-sheet-script`.
- What: Reads: the change set's Disposition (change set), the people's Blue Disposition and feedback, the pull request's diff at its head commit, and the staging QA report.
- Record it: `workflow_complete` with `node: "Task_QaGate"`.
- next: → `Gateway_QaPassed` (QA gate passed for the PR's head?)

### Decide — QA gate passed for the PR's head? (`Gateway_QaPassed`)

- Call `workflow_complete` with `node: "Gateway_QaPassed"` and `outcome` set to the label that holds:
  - «failed» → `Task_EditInPullRequest` (Edit the document in the row's pull request)
  - «passed» → `Task_ReadyForMerge` (Set Ready for merge to Yes)

### 7. Set Ready for merge to Yes (`Task_ReadyForMerge`)

- Who: the `Editor` lane (role `editor`).
- Skill: `review-sheet-script`.
- What: An Editor sets the row's Ready for merge (Orange) to Yes once the QA gate has passed for the pull request's head commit.
- Record it: `workflow_complete` with `node: "Task_ReadyForMerge"`.
- next: → `Task_Merge` (Merge the pull request)

### 8. Merge the pull request (`Task_Merge`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-script`.
- What: The agent merges the row's pull request, and Agentic status says merged.
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `Task_CloseChangeSet` (Close the change set: the issue, then the sheet row)

### 9. Close the change set: the issue, then the sheet row (`Task_CloseChangeSet`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `review-sheet-agent-columns`.
- What: Closing is one step with two tools, GitHub and the review sheet.
- Record it: `workflow_complete` with `node: "Task_CloseChangeSet"`.
- next: → `EndEvent_Merged` (Change merged and closed)

## Done — Change merged and closed (`EndEvent_Merged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

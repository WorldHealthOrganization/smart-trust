<!-- GENERATED from folio-assistant-core/collab/processes/content/public-comment-change.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Make a decided public comment change

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/public-comment-change.bpmn` (process `Process_PublicCommentChange`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Called by Process_PublicComment (CallActivity_MakeChange) once the editor's decision on a comment changes the document.

## Begin — The editor's decision changes the document (`StartEvent_ChangeDecided`)

- Begin here: Entered from Process_PublicComment when the editor decides accepted or accepted-modified.
- Call `workflow_start` with `process: "Process_PublicCommentChange"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_AuthorEdits` (Edit the document as decided, on a feature branch)

### 1. Edit the document as decided, on a feature branch (`Task_AuthorEdits`)

- Who: the `Author (human or agentic)` lane (role `author`).
- Skill: `public-comment`.
- What: public-comment edit --branch: the author (human, or an agent in the author role) edits the folio's blocks as the decision says, on a feature branch for one change-set.
- Record it: `workflow_complete` with `node: "Task_AuthorEdits"`.
- next: → `CallActivity_ChangeSet` (Review the change set on its staging preview)

### 2. Review the change set on its staging preview (`CallActivity_ChangeSet`)

- Who: the `Change set — feature branch and staging` lane (role `build-pipeline`).
- Skill: `staging-review`.
- What: The content-change review of the author's branch: its PR lists the PC refs it answers, and its staging preview is the after side of every deep link.
- A subprocess (`Process_ContentChangeReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_QaGate` (QA gate: check dispositions against the people and the pull request)

### 3. QA gate: check dispositions against the people and the pull request (`Task_QaGate`)

- Who: the `QA reviewer (independent)` lane (role `qc-reviewer`).
- Skill: `public-comment`.
- What: Before Ready for merge.
- Record it: `workflow_complete` with `node: "Task_QaGate"`.
- next: → `Gateway_QaPassed` (QA gate passed for the PR's head?)

### Decide — QA gate passed for the PR's head? (`Gateway_QaPassed`)

- Call `workflow_complete` with `node: "Gateway_QaPassed"` and `outcome` set to the label that holds:
  - «failed» → `Task_AuthorEdits` (Edit the document as decided, on a feature branch)
  - «passed» → `Task_Incorporate` (Mark incorporated when the change set merges)

### 4. Mark incorporated when the change set merges (`Task_Incorporate`)

- Who: the `Change set — feature branch and staging` lane (role `build-pipeline`).
- Skill: `public-comment`.
- What: public-comment incorporate, naming the branch, PR and staging URL; done by the folio's workflow when the PR that closes a change-set issue merges.
- Record it: `workflow_complete` with `node: "Task_Incorporate"`.
- next: → `EndEvent_ChangeMerged` (Merged, comments incorporated)

## Done — Merged, comments incorporated (`EndEvent_ChangeMerged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

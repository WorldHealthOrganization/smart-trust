<!-- GENERATED from folio-assistant-core/collab/processes/content/content-change-review-committee.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Committee review of a content change

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-change-review-committee.bpmn` (process `Process_ContentChangeReviewCommittee`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The review committee's review of one staged content change, ending in an approval or a request for changes: compare staged against main, slice the change and review each slice, settle withdrawn comments and disputed findings, gate on coverage, review the editorial dependencies and the impact, and de

## Begin — PR submitted for review (`Start_Reviewer`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentChangeReviewCommittee"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_CompareBeforeAfter` (Compare main vs staging)

### 1. Compare main vs staging (`Task_CompareBeforeAfter`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `staging-review`, `visual-diff`, `rendered-impact`.
- What: The review starts from the Change Set's RENDERED list (skill rendered-impact): every rendered file the change alters, predicted from each renderer's dependency cone and checked against the build.
- Record it: `workflow_complete` with `node: "Task_CompareBeforeAfter"`.
- next: → `Task_IngestComments` (Ingest tagged review comments)

### 2. Ingest tagged review comments (`Task_IngestComments`)

- Who: the `Review Coordinator` lane (role `review-coordinator`).
- Skill: `review-comments`.
- What: Every PR conversation comment that starts with `block: <label>` becomes a `review-comment/1.0.0` todo (open), idempotently, and is published with the preview as `review-comments.json`.
- Record it: `workflow_complete` with `node: "Task_IngestComments"`.
- next: → `Task_SliceAndAssign` (Slice the change and assign reviewers)

### 3. Slice the change and assign reviewers (`Task_SliceAndAssign`)

- Who: the `Review Coordinator` lane (role `review-coordinator`).
- Skill: `review-heatmap`, `staging-review`, `rendered-impact`.
- What: From the ChangeSet, its rendered list (skill rendered-impact: each changed rendered page is assigned like a changed block) and the heat map on the review page: cut the change into slices a reviewer can hold (usually a section, or a run of sections where the heat map clusters), and assign each slice 
- Record it: `workflow_complete` with `node: "Task_SliceAndAssign"`.
- next: → `Call_ReviewSlices` (Review each slice)

### 4. Review each slice (`Call_ReviewSlices`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `content-review`, `review-comments`.
- What: review-task.bpmn, once per slice, in parallel lanes by role.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Withdraw` (A comment withdrawn?)

### Decide — A comment withdrawn? (`GW_Withdraw`)

- Asked after the slices are reviewed: did a reviewer withdraw a comment?
- Call `workflow_complete` with `node: "GW_Withdraw"` and `outcome` set to the label that holds:
  - «Yes» → `Task_WithdrawComment` (Withdraw a review comment)
  - «No» → `GW_Disputed_Join`

### 5. Withdraw a review comment (`Task_WithdrawComment`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `review-comments`.
- What: The reviewer who made a comment takes it back (it was a misreading, or a later slice answered it).
- Record it: `workflow_complete` with `node: "Task_WithdrawComment"`.
- next: → `GW_Disputed_Join`

### Merge — `GW_Disputed_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_Disputed` (A finding disputed?)

### Decide — A finding disputed? (`GW_Disputed`)

- Is any finding disputed between author and reviewer?
- Call `workflow_complete` with `node: "GW_Disputed"` and `outcome` set to the label that holds:
  - «Yes» → `Call_Adjudication` (Adjudicate the disagreement)
  - «No» → `GW_Covered_Join`

### 6. Adjudicate the disagreement (`Call_Adjudication`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `adjudication`.
- What: adjudication.bpmn.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Covered_Join`

### Merge — `GW_Covered_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_Covered` (Every changed block and page reviewed?)

### Decide — Every changed block and page reviewed? (`GW_Covered`)

- Computed, not chosen: `decisions/review-coverage-gate.dmn` reads `uncoveredBlocks` (changed blocks with neither a verdict nor a reasoned waiver) and `openDefects`, and, where the build published a rendered impact, `unreviewedPages`, `undeterminedInputs` and `missedPages` with their `rendered` and `m
- Computed by the DMN table `decisions/review-coverage-gate.dmn#Decision_ReviewCoverageGate`: call `workflow_complete` with `node: "GW_Covered"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «no» → `Task_SliceAndAssign` (Slice the change and assign reviewers)
  - «yes» → `Task_ReviewUses` (Review the editorial dependencies)

### 7. Review the editorial dependencies (`Task_ReviewUses`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `uses-editorial-review`.
- What: `uses[]` is what a READER must have read to follow the block — never populated from the formal dependency graph.
- Record it: `workflow_complete` with `node: "Task_ReviewUses"`.
- next: → `Task_ReviewImpact` (Review impact assessment)

### 8. Review impact assessment (`Task_ReviewImpact`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `content-review`.
- What: Committee reviews the agent's impact assessment: - Were all downstream effects identified?
- Record it: `workflow_complete` with `node: "Task_ReviewImpact"`.
- next: → `GW_Approved` (Changes approved?)

### Decide — Changes approved? (`GW_Approved`)

- The committee's decision on the impact assessment.
- Call `workflow_complete` with `node: "GW_Approved"` and `outcome` set to the label that holds:
  - «No» → `Task_RequestChanges` (Request changes)
  - «Yes» → `Task_Approve` (Approve)

### 9. Request changes (`Task_RequestChanges`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `content-review`, `content-review`.
- What: Committee provides feedback.
- Record it: `workflow_complete` with `node: "Task_RequestChanges"`.
- next: → `End_ChangesRequested` (changes requested)

### 10. Approve (`Task_Approve`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `decision-audit`.
- What: The committee approves the change: the judgement, recorded with the evidence it rests on.
- Record it: `workflow_complete` with `node: "Task_Approve"`.
- next: → `End_Reviewer` (approved)

## Done — changes requested (`End_ChangesRequested`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — approved (`End_Reviewer`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from folio-assistant-core/collab/processes/content/public-comment.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Public comment on a review draft

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/public-comment.bpmn` (process `Process_PublicComment`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A frozen, line-numbered draft went out for public review.

## Begin — Comments returned on the review version (`StartEvent_CommentsReturned`)

- Begin here.
- Call `workflow_start` with `process: "Process_PublicComment"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Ingest` (Ingest and place each comment)

## Begin — Feedback on one block ([feedback] link) (`StartEvent_BlockFeedback`)

- Begin here: A reader presses [feedback] on a block of the rendered document and opens a GitHub issue about that block, from the folio's block-feedback issue form when it has one (skill block-actions).
- Call `workflow_start` with `process: "Process_PublicComment"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Ingest` (Ingest and place each comment)

## Begin — Commenter withdraws a comment (`StartEvent_WithdrawRequested`)

- Begin here.
- Call `workflow_start` with `process: "Process_PublicComment"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Withdraw` (Record the withdrawal)

### 1. Ingest and place each comment (`Task_Ingest`)

- Who: the `Intake agent` lane (role `ingestion-agent`).
- Skill: `public-comment`.
- What: public-comment import / import-narrative: one record per row or cited passage, anchored through review-anchors.json.
- Record it: `workflow_complete` with `node: "Task_Ingest"`.
- next: → `Task_Triage` (Triage: confirm the anchor, type and priority)

### 2. Record the withdrawal (`Task_Withdraw`)

- Who: the `Public commenter` lane (role `feedback-provider`).
- Skill: `public-comment`.
- What: public-comment withdraw, from any open status.
- Record it: `workflow_complete` with `node: "Task_Withdraw"`.
- next: → `EndEvent_Withdrawn` (Withdrawn, coordinator and committee told)

### 3. Triage: confirm the anchor, type and priority (`Task_Triage`)

- Who: the `Review coordinator` lane (role `review-coordinator`).
- Skill: `public-comment`.
- What: public-comment triage / reassign / duplicate.
- Record it: `workflow_complete` with `node: "Task_Triage"`.
- next: → `Gateway_Triage` (Duplicate, plain editorial, or to be weighed?)

## Done — Withdrawn, coordinator and committee told (`EndEvent_Withdrawn`)

- The instance completes here: A message end: the review coordinator and any committee members assigned to the comment are told it is withdrawn, so nobody keeps working on it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Duplicate, plain editorial, or to be weighed? (`Gateway_Triage`)

- Call `workflow_complete` with `node: "Gateway_Triage"` and `outcome` set to the label that holds:
  - «duplicate» → `EndEvent_Duplicate` (Closed as a duplicate)
  - «to be weighed» → `Task_ProposeChangeSets` (Propose change-sets, as records with no issue yet)
  - «plain editorial» → `Task_EditorDecides` (Decide, weighing the recommendations)

## Done — Closed as a duplicate (`EndEvent_Duplicate`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Propose change-sets, as records with no issue yet (`Task_ProposeChangeSets`)

- Who: the `Intake agent` lane (role `ingestion-agent`).
- Skill: `public-comment`.
- What: public-comment-changesets seed / propose: the agent groups the comments to be weighed into change-sets, one per change the document may need, each a record under changesets/ with its requirements and members.
- Record it: `workflow_complete` with `node: "Task_ProposeChangeSets"`.
- next: → `Task_GroupChangeSets` (Agree each change-set's requirements on its issue)

### 5. Decide, weighing the recommendations (`Task_EditorDecides`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: public-comment decide, or decide: code on GitHub from a login in config.json editors.
- Record it: `workflow_complete` with `node: "Task_EditorDecides"`.
- next: → `Gateway_ChangesDocument` (Does the decision change the document?)

### 6. Agree each change-set's requirements on its issue (`Task_GroupChangeSets`)

- Who: the `Review committee` lane (role `reviewer`).
- Skill: `public-comment`.
- What: A change-set gets its primary GitHub issue the first time somebody engages with it (the Discuss form, a recommendation or decision on one of its comments, a mention, a PR), opened by the folio's public-comment workflow; any number of other issues may discuss it and are linked.
- Record it: `workflow_complete` with `node: "Task_GroupChangeSets"`.
- next: → `Task_RerouteChangeSet` (Re-route to another committee)

### Decide — Does the decision change the document? (`Gateway_ChangesDocument`)

- Call `workflow_complete` with `node: "Gateway_ChangesDocument"` and `outcome` set to the label that holds:
  - «no: not accepted, noted, deferred» → `EndEvent_Decided` (Decided, answer recorded)
  - «yes: accepted» → `CallActivity_MakeChange` (Make the change, check it and merge it)

### 7. Re-route to another committee (`Task_RerouteChangeSet`)

- Who: the `Review committee` lane (role `reviewer`).
- Skill: `public-comment`.
- What: public-comment-changesets reroute, or cs-committee: <TWG> — <why> on GitHub from a person in the committee or editor lane.
- Record it: `workflow_complete` with `node: "Task_RerouteChangeSet"`.
- next: → `Task_Assign` (Assign to committee members)

## Done — Decided, answer recorded (`EndEvent_Decided`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Make the change, check it and merge it (`CallActivity_MakeChange`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: The second phase, drawn on its own page (public-comment-change.bpmn): an author edits the document as decided on a feature branch, the change set is reviewed on its staging preview, an independent QA gate checks the dispositions against the pull request, and each comment it answers is marked incorpo
- A subprocess (`Process_PublicCommentChange`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Incorporated` (Incorporated in the document)

### 9. Assign to committee members (`Task_Assign`)

- Who: the `Review coordinator` lane (role `review-coordinator`).
- Skill: `public-comment`.
- What: public-comment assign: by GitHub login.
- Record it: `workflow_complete` with `node: "Task_Assign"`.
- next: → `Task_CommitteeRecommends` (Recommend a decision, with a rationale)

## Done — Incorporated in the document (`EndEvent_Incorporated`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 10. Recommend a decision, with a rationale (`Task_CommitteeRecommends`)

- Who: the `Review committee` lane (role `reviewer`).
- Skill: `public-comment`.
- What: A GitHub comment tagged pc: PC-0042 / recommend: code, from a login in config.json committee, or public-comment recommend.
- Record it: `workflow_complete` with `node: "Task_CommitteeRecommends"`.
- next: → `Task_EditorDecides` (Decide, weighing the recommendations)

<!-- GENERATED from folio-assistant-core/collab/processes/content/content-change-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Content Change and Review

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-change-review.bpmn` (process `Process_ContentChangeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Getting a change to a folio's CONTENT from a request into a published rendering: the author says what they want, an agent works out its scope and makes it, a review committee accepts or refuses it, and the pipeline deploys.

## Begin — Author requests content change (`Start_Author`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentChangeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DescribeChange` (Describe the desired change)

### 1. Describe the desired change (`Task_DescribeChange`)

- Who: the `Content Author` lane (role `author`).
- What: Author describes the content change in natural language.
- Record it: `workflow_complete` with `node: "Task_DescribeChange"`.
- next: → `Call_BeanOpen` (Open the bean)

### 2. Open the bean (`Call_BeanOpen`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)
  - «claimed» → `Call_MakeChange` (Make the change)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Make the change (`Call_MakeChange`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `content-author`.
- What: content-change-review-make.bpmn: scope the change, branch, edit content and logic, assess and absorb the downstream impact, and push.
- A subprocess (`Process_ContentChangeReviewMake`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_StageChange` (Stage the change)

### 4. Stage the change (`Call_StageChange`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: content-change-review-stage.bpmn: build and deploy the branch to its staging preview, link it on the pull request, and watch the branch's CI.
- A subprocess (`Process_ContentChangeReviewStage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_ReviewStaging` (Review staged rendering)

### 5. Review staged rendering (`Task_ReviewStaging`)

- Who: the `Content Author` lane (role `author`).
- Skill: `staging-review`.
- What: Author reviews the rendered feature branch at <pages-url>/branches/<branch-slug>/ and compares against the main site.
- Record it: `workflow_complete` with `node: "Task_ReviewStaging"`.
- next: → `GW_AuthorSatisfied` (Satisfied with changes?)

### Decide — Satisfied with changes? (`GW_AuthorSatisfied`)

- The author's own call after looking at the staged rendering.
- Call `workflow_complete` with `node: "GW_AuthorSatisfied"` and `outcome` set to the label that holds:
  - «No» → `Task_RequestRevision` (Request further revisions)
  - «Yes» → `Task_SubmitForReview` (Submit to review committee)

### 6. Request further revisions (`Task_RequestRevision`)

- Who: the `Content Author` lane (role `author`).
- Skill: `staging-review`.
- What: Author provides feedback on what needs adjustment.
- Record it: `workflow_complete` with `node: "Task_RequestRevision"`.
- next: → `Task_Iterate` (Iterate on author feedback)

### 7. Submit to review committee (`Task_SubmitForReview`)

- Who: the `Content Author` lane (role `author`).
- Skill: `staging-review`.
- What: Author submits the PR for formal review by the guidance review committee.
- Record it: `workflow_complete` with `node: "Task_SubmitForReview"`.
- next: → `Call_CommitteeReview` (Review the change)

### 8. Iterate on author feedback (`Task_Iterate`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `content-author`, `before-after-preview`.
- What: Agent receives revision requests from the author and applies changes.
- Record it: `workflow_complete` with `node: "Task_Iterate"`.
- next: → `Call_StageChange` (Stage the change)

### 9. Review the change (`Call_CommitteeReview`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `content-review`.
- What: content-change-review-committee.bpmn: compare staged against main, slice the change and review each slice, settle withdrawals and disputes, gate on coverage, review the impact, and either approve or request changes.
- A subprocess (`Process_ContentChangeReviewCommittee`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_CommitteeApproved` (Approved?)

### Decide — Approved? (`GW_CommitteeApproved`)

- Reads which end content-change-review-committee reached.
- Call `workflow_complete` with `node: "GW_CommitteeApproved"` and `outcome` set to the label that holds:
  - «changes requested» → `Task_Iterate` (Iterate on author feedback)
  - «approved» → `Call_Publish` (Merge and publish)

### 10. Merge and publish (`Call_Publish`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `prepare-merge`.
- What: content-change-review-publish.bpmn: merge on the owner's explicit confirmation, then remove the staging preview, rebuild main and watch it.
- A subprocess (`Process_ContentChangeReviewPublish`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_BeanClose` (Close the bean)

### 11. Close the bean (`Call_BeanClose`)

- Who: the `Folio-Assistant Agent` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Agent` (Change closed)

## Done — Change closed (`End_Agent`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

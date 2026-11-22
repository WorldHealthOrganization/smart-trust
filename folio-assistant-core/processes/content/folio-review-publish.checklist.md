<!-- GENERATED from folio-assistant-core/processes/content/folio-review-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Review and publish a folio

> **Generated, and not the authority.** This is `folio-assistant-core/processes/content/folio-review-publish.bpmn` (process `Process_FolioReviewPublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Review a rendered folio and publish it, or send it back with changes.

## Begin — Rendered, ready for review (`Start_Rendered`)

- Begin here: The calling authoring process has validated and rendered the folio.
- Call `workflow_start` with `process: "Process_FolioReviewPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Review` (Review and record feedback)

### 1. Review and record feedback (`Task_Review`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`.
- What: The reviewer this folio binds.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `Gateway_ReviewOutcome` (Ready to publish?)

### Decide — Ready to publish? (`Gateway_ReviewOutcome`)

- The reviewer's call after the review.
- Call `workflow_complete` with `node: "Gateway_ReviewOutcome"` and `outcome` set to the label that holds:
  - «iterate» → `End_ChangesAsked` (Changes asked)
  - «approved» → `Task_Publish` (Publish)
  - «Authoring Committee feedback» → `Call_ContributorFeedback` (Contributor feedback)

## Done — Changes asked (`End_ChangesAsked`)

- The instance completes here: Ends with the feedback recorded. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Publish (`Task_Publish`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `content-publish`.
- What: See draft-to-publication.bpmn for the review and release path this expands into.
- Record it: `workflow_complete` with `node: "Task_Publish"`.
- next: → `End_Published` (Published)

### 3. Contributor feedback (`Call_ContributorFeedback`)

- Who: the `Authoring Committee` lane (role `authoring-committee`).
- Skill: `review-sheet-script`.
- What: Process_ContributorFeedback: while the document is a working draft, the Authoring Committee gives feedback through the Contributor Feedback sheet, and each change set is edited and merged in its own pull request.
- A subprocess (`Process_ContributorFeedback`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_FeedbackIn` (Feedback in: changes asked)

## Done — Published (`End_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Feedback in: changes asked (`End_FeedbackIn`)

- The instance completes here: The committee's feedback is in. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

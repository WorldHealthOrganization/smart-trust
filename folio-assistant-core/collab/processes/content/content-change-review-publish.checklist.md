<!-- GENERATED from folio-assistant-core/collab/processes/content/content-change-review-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Merge and publish a content change

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-change-review-publish.bpmn` (process `Process_ContentChangeReviewPublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Merging an approved content change on the owner's explicit confirmation and publishing it: remove the staging preview, rebuild the main site and watch it.

## Begin — Change approved (`Start_Publish`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentChangeReviewPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Merge` (Merge, on explicit confirmation)

### 1. Merge, on explicit confirmation (`Task_Merge`)

- Who: the `Review Committee` lane (role `reviewer`).
- Skill: `prepare-merge`.
- What: The owner says "merge it", and only then is the branch merged.
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `GW_Merged` (PR merged?)

### Decide — PR merged? (`GW_Merged`)

- Was the PR merged?
- Call `workflow_complete` with `node: "GW_Merged"` and `outcome` set to the label that holds:
  - «Yes» → `Task_CleanupStaging` (Remove branches/<slug>/)
  - «No» → `End_NotMerged` (Not merged: preview kept)

### 2. Remove branches/<slug>/ (`Task_CleanupStaging`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: When the PR is merged or closed, the cleanup job removes the branches/<slug>/ directory from gh-pages so stale previews don't accumulate.
- Record it: `workflow_complete` with `node: "Task_CleanupStaging"`.
- next: → `Task_RebuildMain` (Rebuild main site)

## Done — Not merged: preview kept (`End_NotMerged`)

- The instance completes here: The approval did not end in a merge. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Rebuild main site (`Task_RebuildMain`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `content-publish`.
- What: docs-site.yml triggers on the merge commit to main, rebuilding the root of gh-pages with the accepted changes.
- Record it: `workflow_complete` with `node: "Task_RebuildMain"`.
- next: → `Task_WatchMainCI` (Note the main-branch watch)

### 4. Note the main-branch watch (`Task_WatchMainCI`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `watch`, `todo-manager`.
- What: Second dispatch point: the change was approved and merged, and the root of the site has been rebuilt from main.
- Record it: `workflow_complete` with `node: "Task_WatchMainCI"`.
- next: → `End_Pipeline` (Deployment complete)

## Done — Deployment complete (`End_Pipeline`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

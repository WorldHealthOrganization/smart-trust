<!-- GENERATED from folio-assistant-core/collab/processes/content/content-change-review-stage.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Stage the content change

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-change-review-stage.bpmn` (process `Process_ContentChangeReviewStage`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Putting one push of a content change where a person can look at it: build the staging site, deploy it under the branch's slug, link it on the pull request, and watch the branch's CI.

## Begin — Push to feature branch (`Start_Pipeline`)

- Begin here.
- Call `workflow_start` with `process: "Process_ContentChangeReviewStage"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_BuildStaging` (Build staging site)

### 1. Build staging site (`Task_BuildStaging`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: feature-staging.yml triggers: 1.
- Record it: `workflow_complete` with `node: "Task_BuildStaging"`.
- next: → `Task_DeployStaging` (Deploy to branches/<slug>/)

### 2. Deploy to branches/<slug>/ (`Task_DeployStaging`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: The stage job copies the built site into gh-pages under branches/<branch-slug>/, then `staging-share.ts apply` keeps only the files that differ from the live site.
- Record it: `workflow_complete` with `node: "Task_DeployStaging"`.
- next: → `Task_CommentPR` (Comment staging URL on PR)

### 3. Comment staging URL on PR (`Task_CommentPR`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`, `rendered-impact`.
- What: Bot comments or updates the staging URL on the PR.
- Record it: `workflow_complete` with `node: "Task_CommentPR"`.
- next: → `Task_WatchBranchCI` (Open the branch-watch bean)

### 4. Open the branch-watch bean (`Task_WatchBranchCI`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `watch`, `todo-manager`.
- What: First dispatch point for a CI watcher: the feature branch has changed and a staging build now exists to watch.
- Record it: `workflow_complete` with `node: "Task_WatchBranchCI"`.
- next: → `End_Staged` (Staged for review)

## Done — Staged for review (`End_Staged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

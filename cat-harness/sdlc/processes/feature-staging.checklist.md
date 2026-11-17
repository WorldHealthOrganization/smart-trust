<!-- GENERATED from cat-harness/sdlc/processes/feature-staging.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Staging a feature branch preview, and taking it down

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/feature-staging.bpmn` (process `Process_FeatureStaging`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The lifecycle of a feature branch's review preview: staged on a push, taken down when its pull request closes, or removed by an explicit dispatch.

## Begin — Pull request opened, synchronised or reopened (`Start_PR`)

- Begin here.
- Call `workflow_start` with `process: "Process_FeatureStaging"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_AgentBuilt` (Agent build matches tree?)

## Begin — Pull request closed (`Start_Closed`)

- Begin here.
- Call `workflow_start` with `process: "Process_FeatureStaging"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Slug` (Derive the slug from the head ref)

## Begin — Dispatched with cleanup_slug (`Start_Dispatch`)

- Begin here.
- Call `workflow_start` with `process: "Process_FeatureStaging"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Validate` (Check the slug and its confirmation)

### Decide — Agent build matches tree? (`GW_AgentBuilt`)

- Check whether branches/<slug>/_build-record.json on gh-pages was written by the agent (builder = "agent") for the exact git tree of refs/pull/<n>/merge (record.tree = MERGE_SHA^{tree}).
- Call `workflow_complete` with `node: "GW_AgentBuilt"` and `outcome` set to the label that holds:
  - «yes —
defer» → `Task_Defer` (Defer build and queue verify sweep)
  - «no — build now» → `GW_MergeBuild`

### 1. Derive the slug from the head ref (`Task_Slug`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: Derive the slug from the PR's head ref: every character outside [a-zA-Z0-9._-] becomes '-', runs of '-' collapse, and leading or trailing '-' is trimmed.
- Record it: `workflow_complete` with `node: "Task_Slug"`.
- next: → `GW_Confirmed` (Removal confirmed?)

### 2. Check the slug and its confirmation (`Task_Validate`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `deletion-requires-confirmation`.
- What: Guarded three ways because a dispatch input is a DELETION TRIGGER.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `Task_Preflight` (Re-evaluate liveness AT REMOVAL TIME)

### 3. Defer build and queue verify sweep (`Task_Defer`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: Set the preview/agent-build commit status on the PR head to pending, post the preview-build-verify notice on the PR, and exit the critical-path run so the runner is free.
- Record it: `workflow_complete` with `node: "Task_Defer"`.
- next: → `GW_MergeBuild`

### Merge — `GW_MergeBuild`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_Build` (Build the docs site)

### Decide — Removal confirmed? (`GW_Confirmed`)

- THREE inputs, two outcomes, and bean `1feu` set the split: a MERGED pull request needs no label, because the merge IS the confirmation — a person decided the content belongs on `main`, which says more about the preview than a label does.
- Call `workflow_complete` with `node: "GW_Confirmed"` and `outcome` set to the label that holds:
  - «merged, or labelled» → `Task_Remove` (Remove the preview and log it)
  - «closed unmerged,
no label» → `Task_LogRetained` (Append `retained`, with why it stays)

### 4. Re-evaluate liveness AT REMOVAL TIME (`Task_Preflight`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `deletion-requires-confirmation`.
- What: Re-evaluated AT REMOVAL TIME, through the same `previewLiveness` the health sweep uses rather than a second implementation of it.
- Record it: `workflow_complete` with `node: "Task_Preflight"`.
- next: → `GW_Live` (Still in use?)

### 5. Build the docs site (`Task_Build`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: Build the preview from the PR's head (or, on an off-critical-path verify_pr dispatch, rebuild refs/pull/<n>/merge in full to verify an agent-built preview) and write _build-record.json: regenerate the generated docs, trim what this preview does not need, render the BPMN diagrams, then Jekyll, TypeDo
- Record it: `workflow_complete` with `node: "Task_Build"`.
- next: → `GW_VerifyMatch` (Verified identical to agent build?)

### 6. Remove the preview and log it (`Task_Remove`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `deletion-requires-confirmation`.
- What: ONE COMMIT for the removal and its record.
- Record it: `workflow_complete` with `node: "Task_Remove"`.
- next: → `End_Removed` (Preview gone, with its reason)

### 7. Append `retained`, with why it stays (`Task_LogRetained`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: Records that a removal was considered and refused, or that a preview still stands because a signal fired; without the entry that leaves no trace, and nobody can tell why a preview is still up.
- Shared step `GT_LogRetained`.
- Record it: `workflow_complete` with `node: "Task_LogRetained"`.
- next: → `Task_Notice` (Post the retention notice on the PR)

### Decide — Still in use? (`GW_Live`)

- THREE states, and the third is why this gateway exists.
- Call `workflow_complete` with `node: "GW_Live"` and `outcome` set to the label that holds:
  - «no signal —
safe to remove» → `Task_RemoveDisp` (Remove it AND append `removed` — one commit)
  - «live, OR
could not tell» → `End_Refused` (REFUSED — nothing removed)

### Decide — Verified identical to agent build? (`GW_VerifyMatch`)

- On an off-critical-path verify run (verify_pr), preview-record.ts compare checks the CI rebuild's _build-record.json against the agent's record on gh-pages across every file outside the per-build metadata (staging.json, _build-record.json, .staged-at, build.yml).
- Call `workflow_complete` with `node: "GW_VerifyMatch"` and `outcome` set to the label that holds:
  - «no, or
CI build» → `Task_Deploy` (Push to the CDN under branches/)
  - «yes — keep agent files» → `GW_MergeComment`

## Done — Preview gone, with its reason (`End_Removed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Post the retention notice on the PR (`Task_Notice`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `staging-review`.
- What: Removal was not confirmed, so the preview stays: post a retention notice on the PR giving its URL and saying it has NOT been removed, and the two ways to remove it: the staging:cleanup label while the PR is open, or, once it is closed, a Run workflow dispatch with cleanup_slug and a matching cleanup
- Record it: `workflow_complete` with `node: "Task_Notice"`.
- next: → `End_Retained` (Preview kept)

### 9. Remove it AND append `removed` — one commit (`Task_RemoveDisp`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `deletion-requires-confirmation`.
- What: Say what is going — size and file count — then remove branches/<slug>/ and append `removed` to the render log in the SAME commit, so a preview cannot vanish without a record of who dispatched it and why.
- Record it: `workflow_complete` with `node: "Task_RemoveDisp"`.
- next: → `End_RemovedDisp` (Preview gone)

## Done — REFUSED — nothing removed (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 10. Push to the CDN under branches/ (`Task_Deploy`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-kg-to-cdn`.
- What: A PREVIEW IS THE GENERAL STEP WITH A DIFFERENT ROOT (owner, 2026-09-30: "independent of staging vs publication … just rendering").
- A subprocess (`Process_RenderKgToCdn`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_LogRendered` (Append `rendered` to the render log)

### Merge — `GW_MergeComment`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_Comment` (Comment the preview URL on the PR)

## Done — Preview kept (`End_Retained`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Preview gone (`End_RemovedDisp`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Append `rendered` to the render log (`Task_LogRendered`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: Its OWN commit, not part of the deploy.
- Record it: `workflow_complete` with `node: "Task_LogRendered"`.
- next: → `GW_MergeComment`

### 12. Comment the preview URL on the PR (`Task_Comment`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `staging-review`.
- What: Post, or update in place, one comment on the PR giving the preview URL (branches/<slug>/) and the commit it was built from.
- Record it: `workflow_complete` with `node: "Task_Comment"`.
- next: → `End_Staged` (Preview live)

## Done — Preview live (`End_Staged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 13. Repeat the slug, exactly, to confirm (`H_Confirm`)

- Who: the `Human actor` lane (role `user`).
- Skill: `deletion-requires-confirmation`.
- What: The one step in this process that is a person's.
- Record it: `workflow_complete` with `node: "H_Confirm"`.
- next: → `Start_Dispatch` (Dispatched with cleanup_slug)

<!-- GENERATED from cat-harness/processes/ui/staging-render-log.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Render log — the publish branch keeps its own history

> **Generated, and not the authority.** This is `cat-harness/processes/ui/staging-render-log.bpmn` (process `Process_RenderLog`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Every change to the publish branch appends an entry to `_render-log/<day>.jsonl`.

## Begin — Publish branch is about to change (`Start_Process_RenderLog`)

- Begin here.
- Call `workflow_start` with `process: "Process_RenderLog"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_What` (What is happening?)

### Decide — What is happening? (`GW_What`)

- What is about to happen to the publish branch?
- Call `workflow_complete` with `node: "GW_What"` and `outcome` set to the label that holds:
  - «deploy» → `A_LogRendered` (Append `rendered`)
  - «takedown» → `A_Preflight` (Preflight: is the preview live?)
  - «full-replace deploy» → `A_LogRestored` (Append `restored`)

### 1. Append `rendered` (`A_LogRendered`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: A re-deploy is a rendering, so it gets its own entry rather than overwriting the last.
- Record it: `workflow_complete` with `node: "A_LogRendered"`.
- next: → `End_Process_RenderLog` (Entry appended; history intact)

### 2. Preflight: is the preview live? (`A_Preflight`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: `previewLiveness` — a disjunction over open-pr, unmerged-branch and recent-commit, shared with the health sweep so the two cannot disagree.
- Record it: `workflow_complete` with `node: "A_Preflight"`.
- next: → `GW_Live` (Any liveness signal fired?)

### 3. Append `restored` (`A_LogRestored`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: A full-replace deploy (`docs-site.yml`, the only publisher without keep_files) wipes the branch; `restore-staging` carries the previews AND this log back in.
- Record it: `workflow_complete` with `node: "A_LogRestored"`.
- next: → `End_Process_RenderLog` (Entry appended; history intact)

## Done — Entry appended; history intact (`End_Process_RenderLog`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Any liveness signal fired? (`GW_Live`)

- Answered by the preflight: did any liveness signal fire for this preview?
- Call `workflow_complete` with `node: "GW_Live"` and `outcome` set to the label that holds:
  - «yes — refuse» → `A_LogRetained` (Append `retained` with the reason)
  - «no» → `A_LogRemoved` (Append `removed` with the reason)

### 4. Append `retained` with the reason (`A_LogRetained`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: Records that a removal was considered and refused, or that a preview still stands because a signal fired; without the entry that leaves no trace, and nobody can tell why a preview is still up.
- Shared step `GT_LogRetained`.
- Record it: `workflow_complete` with `node: "A_LogRetained"`.
- next: → `End_Process_RenderLog` (Entry appended; history intact)

### 5. Append `removed` with the reason (`A_LogRemoved`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: BEFORE the removal, not after: a job that dies mid-step must leave a record of the intent rather than an artefact that vanished with no entry.
- Record it: `workflow_complete` with `node: "A_LogRemoved"`.
- next: → `A_Remove` (Remove the artefact)

### 6. Remove the artefact (`A_Remove`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `render-logging`.
- What: `rm -rf branches/<slug>`.
- Record it: `workflow_complete` with `node: "A_Remove"`.
- next: → `End_Process_RenderLog` (Entry appended; history intact)

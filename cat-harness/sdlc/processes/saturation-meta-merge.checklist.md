<!-- GENERATED from cat-harness/sdlc/processes/saturation-meta-merge.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Saturation meta-merge: land the ready PRs when the runners are full

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/saturation-meta-merge.bpmn` (process `Process_SaturationMetaMerge`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Landing a batch while the runners are full: cancel everything queued, pause new work, consolidate all ready PRs on one meta-merge branch, skip CI and rendering, and merge it, holding the swarm siblings until it is done.

## Begin — Runners saturated (`Start_Saturated`)

- Begin here: Called by the merge manager watch when queued runs are 60+ minutes old and nothing has landed, or when the owner says the runners are full.
- Call `workflow_start` with `process: "Process_SaturationMetaMerge"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Hold` (Broadcast the hold to siblings)

### 1. Broadcast the hold to siblings (`Task_Hold`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Message every sibling that pushes to the repositories involved: what is about to land, and hold pushes, merges and run cancels until done.
- Record it: `workflow_complete` with `node: "Task_Hold"`.
- next: → `Task_SibHold` (Hold, and name the heads to merge)

### 2. Hold, and name the heads to merge (`Task_SibHold`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `saturation-meta-merge`.
- What: A sibling that owns a PR in the batch names the head it wants merged.
- Record it: `workflow_complete` with `node: "Task_SibHold"`.
- next: → `Task_Ask` (Dry-run, then ask the owner naming every PR)

### 3. Dry-run, then ask the owner naming every PR (`Task_Ask`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `ask-the-person`.
- What: Stack the PRs on a meta-merge branch without pushing.
- Record it: `workflow_complete` with `node: "Task_Ask"`.
- next: → `Task_Owner` (Choose A, B, C or D)

### 4. Choose A, B, C or D (`Task_Owner`)

- Who: the `Owner` lane (role `user`).
- What: Only the owner's own tap or words approve the landing.
- Record it: `workflow_complete` with `node: "Task_Owner"`.
- next: → `Gw_Go` (Go?)

### Decide — Go? (`Gw_Go`)

- A or B is yes.
- Call `workflow_complete` with `node: "Gw_Go"` and `outcome` set to the label that holds:
  - «Yes» → `Task_Land` (Cancel queued PR runs; build, push, merge)
  - «No» → `Task_Done` (Post done to every held sibling)

### 5. Cancel queued PR runs; build, push, merge (`Task_Land`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `saturation-meta-merge`.
- What: Never cancel a main push run that has started.
- Record it: `workflow_complete` with `node: "Task_Land"`.
- next: → `Task_Done` (Post done to every held sibling)

### 6. Post done to every held sibling (`Task_Done`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Post done with what landed and what is still open, also when nothing was merged.
- Record it: `workflow_complete` with `node: "Task_Done"`.
- next: → `Gw_Merged` (Merged?)

### Decide — Merged? (`Gw_Merged`)

- Call `workflow_complete` with `node: "Gw_Merged"` and `outcome` set to the label that holds:
  - «Yes» → `Task_MainRun` (Run main's checks)
  - «No» → `End_Nothing` (Hold released, nothing merged)

### 7. Run main's checks (`Task_MainRun`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- What: The merge starts main's checks.
- Record it: `workflow_complete` with `node: "Task_MainRun"`.
- next: → `Task_Report` (Report what landed and main's verdict)

## Done — Hold released, nothing merged (`End_Nothing`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Report what landed and main's verdict (`Task_Report`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: One message to the owner: what merged, main's verdict per repository, and any open decision.
- Record it: `workflow_complete` with `node: "Task_Report"`.
- next: → `End_Landed` (Landed and reported)

## Done — Landed and reported (`End_Landed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

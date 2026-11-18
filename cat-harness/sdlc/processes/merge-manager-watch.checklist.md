<!-- GENERATED from cat-harness/sdlc/processes/merge-manager-watch.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Merge manager watch: wake, read the queue live, route

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-manager-watch.bpmn` (process `Process_MergeManagerWatch`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The loop run by the session that holds the merge-steward lane (actor merge-manager, skill merge-manager-watcher): elected, appointed, or holding it for its own PRs only.

## Begin — Timer, PR event, request, main run, or sibling message (`Start_Wake`)

- Begin here: The sweep cadence, as a backstop: every 10-15 minutes while a P0 PR is in flight, every 30 minutes otherwise.
- Call `workflow_start` with `process: "Process_MergeManagerWatch"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Read` (Read the queue, acknowledge requests)

### 1. Read the queue, acknowledge requests (`Task_Read`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Read live, never from a stored copy: the open PRs (draft, head, mergeable, owed checks, open owner decisions), the queued and running runs with the age of the oldest, the latest main push run, each PR owner's last push or comment, and every harness repository's open main-red issue with its newest fa
- Record it: `workflow_complete` with `node: "Task_Read"`.
- next: → `Gw_Needed` (Still holding the lane?)

### Decide — Still holding the lane? (`Gw_Needed`)

- Yes while this session holds the lane.
- Call `workflow_complete` with `node: "Gw_Needed"` and `outcome` set to the label that holds:
  - «Yes» → `Gw_Route` (What does the queue need?)
  - «No» → `Task_Lapse` (Announce the hand-over)

### Decide — What does the queue need? (`Gw_Route`)

- Saturated: queued runs are 60+ minutes old and nothing has landed, or the owner says the runners are full.
- Call `workflow_complete` with `node: "Gw_Route"` and `outcome` set to the label that holds:
  - «Saturated» → `Task_Relieve` (Relieve the runners)
  - «Ready» → `Gw_Green` (All green per rule 1?)
  - «Stalled» → `Call_Stalled` (Stalled-agent triage)
  - «Nothing» → `End_Idle` (Nothing to do)
  - «Main red» → `Gw_RedOwned` (Owned?)

### 2. Announce the hand-over (`Task_Lapse`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Tell every sibling and the owner, and update the durable note with the session that holds the lane now.
- Record it: `workflow_complete` with `node: "Task_Lapse"`.
- next: → `End_Lapsed` (Lane released)

### 3. Relieve the runners (`Task_Relieve`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Enforce the pacing rule of continual-progress (owner ruling, 2026-11-07, card Cancel CI): close superseded or duplicate PRs, such as a re-pin whose commits another open PR already carries, and cancel their runs; cancel stale queued runs that never started, never a main push run that has started; ask
- Record it: `workflow_complete` with `node: "Task_Relieve"`.
- next: → `Call_Meta` (Saturation meta-merge)

### Decide — All green per rule 1? (`Gw_Green`)

- Every check run on the head SHA has finished, and anything pending blocks; wait for every tier, e2e included.
- Call `workflow_complete` with `node: "Gw_Green"` and `outcome` set to the label that holds:
  - «Yes» → `Gw_Approved` (Pre-approved?)
  - «No» → `End_NotGreen` (Not green yet)

### 4. Stalled-agent triage (`Call_Stalled`)

- Who: the `Merge steward` lane (role `merge-steward`).
- What: A PR owner who stalled: tell the owner, then take the stalled PR over.
- A subprocess (`Process_StalledAgentTriage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_StalledDone` (Wake handled)

## Done — Nothing to do (`End_Idle`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Owned? (`Gw_RedOwned`)

- Coordinate, never duplicate.
- Call `workflow_complete` with `node: "Gw_RedOwned"` and `outcome` set to the label that holds:
  - «Yes» → `End_RedOwned` (Owned: coordinate)
  - «No» → `Gw_RedCause` (Which cause?)

## Done — Lane released (`End_Lapsed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Saturation meta-merge (`Call_Meta`)

- Who: the `Merge steward` lane (role `merge-steward`).
- What: Offer the card and land only on the owner's tap.
- A subprocess (`Process_SaturationMetaMerge`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_MetaDone` (Wake handled)

### Decide — Pre-approved? (`Gw_Approved`)

- Yes when the owner already said to merge this PR when green, so no second card is needed.
- Call `workflow_complete` with `node: "Gw_Approved"` and `outcome` set to the label that holds:
  - «Yes» → `Gw_Train` (Rides the train?)
  - «No» → `Task_Card` (Post the request in chat, then the batch card)

## Done — Not green yet (`End_NotGreen`)

- The instance completes here: Do not merge. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Wake handled (`End_StalledDone`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Owned: coordinate (`End_RedOwned`)

- The instance completes here: Tell the owning thread what the sweep saw (the failing run, and any other repository it reddens), track its PR like any other in the lane, and open no second fixer. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Which cause? (`Gw_RedCause`)

- Sort each failure into one cause before dispatching, because the fix lands in a different place for each.
- Call `workflow_complete` with `node: "Gw_RedCause"` and `outcome` set to the label that holds:
  - «Infrastructure» → `Task_Rerun` (Re-run the failed job once)
  - «Code or pins» → `Task_DispatchFixer` (Dispatch a fixer)

## Done — Wake handled (`End_MetaDone`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Rides the train? (`Gw_Train`)

- Yes for a folio-assistant PR that does not change .github/workflows/.
- Call `workflow_complete` with `node: "Gw_Train"` and `outcome` set to the label that holds:
  - «Yes» → `Call_Train` (Merge train)
  - «No» → `Task_Direct` (Merge it through merge:guard)

### 6. Post the request in chat, then the batch card (`Task_Card`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `interaction-modality`.
- What: The sibling's six lines go into the merge manager's chat first; a request with no rendered preview and no reason goes back to the sibling (owner ruling, 2026-11-07).
- Record it: `workflow_complete` with `node: "Task_Card"`.
- next: → `Owner_Approve` (Approve the batch card)

### 7. Re-run the failed job once (`Task_Rerun`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Infrastructure is re-run, not fixed: re-run the failed job once.
- Record it: `workflow_complete` with `node: "Task_Rerun"`.
- next: → `End_RedHandled` (Fix under way)

### 8. Dispatch a fixer (`Task_DispatchFixer`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: One fixer agent per cause, never one per repository.
- Record it: `workflow_complete` with `node: "Task_DispatchFixer"`.
- next: → `End_RedHandled` (Fix under way)

### 9. Merge train (`Call_Train`)

- Who: the `Merge steward` lane (role `merge-steward`).
- What: Add the merge-train label instead of merging; the train lands the batch with one CI run.
- A subprocess (`Process_MergeTrain`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Done` (Wake handled)

### 10. Merge it through merge:guard (`Task_Direct`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: A workflow PR, or a PR in a repository with no train, merges directly.
- Record it: `workflow_complete` with `node: "Task_Direct"`.
- next: → `End_Done` (Wake handled)

### 11. Approve the batch card (`Owner_Approve`)

- Who: the `Owner` lane (role `user`).
- Skill: `interaction-modality`.
- What: In the merge manager's session only: one card per batch, naming each PR, after its six lines were posted in that chat.
- Record it: `workflow_complete` with `node: "Owner_Approve"`.
- next: → `Gw_Train` (Rides the train?)

## Done — Fix under way (`End_RedHandled`)

- The instance completes here: The next wake reads main again; the red stays on the sweep until the next main run is green. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Wake handled (`End_Done`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

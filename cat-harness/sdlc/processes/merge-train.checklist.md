<!-- GENERATED from cat-harness/sdlc/processes/merge-train.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A merge train

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-train.bpmn` (process `Process_MergeTrain`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Land the ready pull requests as one train: place each by the merge-priority decision table, merge the members with `merge-base`, run the gate set on the combination, and on red eject the culprit rather than reject the train.

## Begin — Admitted PRs waiting (`Start_Train`)

- Begin here.
- Call `workflow_start` with `process: "Process_MergeTrain"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ReadLive` (Read each queued PR's live facts)

## Begin — Owner wants a PR moved (`Start_Override`)

- Begin here.
- Call `workflow_start` with `process: "Process_MergeTrain"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Override` (Place it by hand, with a reason)

### 1. Read each queued PR's live facts (`Task_ReadLive`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: From GitHub and the checkout, now: authored paths, shared declarations, size, conflict risk and overlap KIND against the other queued PRs (T3), own CI and whether it ran on the head (T2).
- Record it: `workflow_complete` with `node: "Task_ReadLive"`.
- next: → `Task_TakeNext` (Take the next PR in queue order)

### 2. Place it by hand, with a reason (`Task_Override`)

- Who: the `Owner` lane (role `user`).
- Skill: `interaction-modality`.
- What: Recorded as a queue entry whose placement is `override` with a position and a reason; the schema refuses one without a reason.
- Record it: `workflow_complete` with `node: "Task_Override"`.
- next: → `End_OverrideRecorded` (Override recorded)

### 3. Take the next PR in queue order (`Task_TakeNext`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: Owner overrides at their positions first, then by the table's rank, then by PR number, oldest first (`scripts/merge-queue.ts` `orderQueue`).
- Record it: `workflow_complete` with `node: "Task_TakeNext"`.
- next: → `GW_Placement` (Where does this PR go?)

## Done — Override recorded (`End_OverrideRecorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Where does this PR go? (`GW_Placement`)

- Computed, not chosen: decisions/merge-priority.dmn (hit policy FIRST) over the live facts plus `ownerOverride`.
- Computed by the DMN table `decisions/merge-priority.dmn#Decision_MergePriority`: call `workflow_complete` with `node: "GW_Placement"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «admit» → `Task_Admit` (Admit it to the train, record the train id)
  - «hand back» → `Call_HandBack` (Hand it back)

### 4. Admit it to the train, record the train id (`Task_Admit`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: Writes the queue entry's `trainId` and `placement` (rule, class, rank) with who decided and when.
- Record it: `workflow_complete` with `node: "Task_Admit"`.
- next: → `GW_Next`

### 5. Hand it back (`Call_HandBack`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-conflict-patterns`.
- What: `merge-refusal.bpmn` (PR #1888, bean `zacz`): a bean under the right epic, a hand-back to the owning session with a fail condition (agent-handoff, #1884), or a dispatch when nobody owns it.
- A subprocess (`Process_MergeRefusal`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `PG_HandBack` (Train goes on; sibling fixes)

### Merge — `GW_Next`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_More` (Train full, or queue empty?)

### Do all of — Train goes on; sibling fixes (`PG_HandBack`)

- Work every branch; none is optional. Branches: → `GW_Next`, → `Task_SiblingFix` (Fix the PR, then re-signal ready)
- The engine passes through this gateway itself; there is nothing to record here.

### Decide — Train full, or queue empty? (`GW_More`)

- `more` while the queue has admissible PRs and the train is under its cap; `full` otherwise.
- Call `workflow_complete` with `node: "GW_More"` and `outcome` set to the label that holds:
  - «more» → `Task_TakeNext` (Take the next PR in queue order)
  - «full» → `Call_ChecksPresent` (Find members with no CI on their head)

### 6. Fix the PR, then re-signal ready (`Task_SiblingFix`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `bean-coordination`.
- What: On the sibling's own branch: merge main in, fix, push, and re-mark ready (`ready: <head sha>`).
- Record it: `workflow_complete` with `node: "Task_SiblingFix"`.
- next: → `End_Requeued` (Back in the queue)

### 7. Find members with no CI on their head (`Call_ChecksPresent`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: GitHub runs no `pull_request` CI while a PR conflicts, so a member can arrive with nothing on its head (bean `u7be` item 3).
- A subprocess (`Process_PrChecksPresent`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_MergeMembers` (Merge each member onto the base)

## Done — Back in the queue (`End_Requeued`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Merge each member onto the base (`Call_MergeMembers`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `prepare-merge`.
- What: `merge-base.bpmn` once per member, in order, `--no-regen`; then ONE `bun run cat regen` over the result.
- A subprocess (`Process_MergeBase`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_AllMerged` (Every member merged?)

### Decide — Every member merged? (`GW_AllMerged`)

- `refused` when `merge-base` refused a member's conflict: that member is ejected (T1) rather than the whole train aborted.
- Call `workflow_complete` with `node: "GW_AllMerged"` and `outcome` set to the label that holds:
  - «merged» → `Call_Gates` (Run the gate set on the train)
  - «refused» → `Task_Eject` (Eject the culprit, record why)

### 9. Run the gate set on the train (`Call_Gates`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: Every gate CI runs, on the combination (R2): a member that passes alone can still break `main` with another.
- A subprocess (`Process_CodeQualityGates`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Green` (Train green?)

### 10. Eject the culprit, record why (`Task_Eject`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: T1 (R3; SQ19 §2.2 p.
- Record it: `workflow_complete` with `node: "Task_Eject"`.
- next: → `Call_EjectHandBack` (Hand the culprit back)

### Decide — Train green? (`GW_Green`)

- Read per job from the check runs on the train's head, never from the legacy status API.
- Call `workflow_complete` with `node: "GW_Green"` and `outcome` set to the label that holds:
  - «green» → `Call_MergeToMain` (Land each member)
  - «red» → `Task_RetryFlaky` (Retry a declared-flaky gate once)

### 11. Hand the culprit back (`Call_EjectHandBack`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-conflict-patterns`.
- What: The same hand-back as a refused placement (#1888), carrying the ejection's evidence (R4).
- A subprocess (`Process_MergeRefusal`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_MergeMembers` (Merge each member onto the base)

### 12. Land each member (`Call_MergeToMain`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Once per member, in train order, at the SHA the train's gate set tested.
- A subprocess (`Process_MergeToMain`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Landed` (Landed)

### 13. Retry a declared-flaky gate once (`Task_RetryFlaky`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: T7, narrow (R11; TAP17 Table II p.
- Record it: `workflow_complete` with `node: "Task_RetryFlaky"`.
- next: → `GW_StillRed` (Still red?)

## Done — Landed (`End_Landed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Still red? (`GW_StillRed`)

- `green` if the only red gate was a declared flake that passed on retry; `red` otherwise, and a member is to blame.
- Call `workflow_complete` with `node: "GW_StillRed"` and `outcome` set to the label that holds:
  - «green» → `Call_MergeToMain` (Land each member)
  - «red» → `Task_Attribute` (Attribute the failure: each member's own CI first)

### 14. Attribute the failure: each member's own CI first (`Task_Attribute`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: T2 (SQ19 §2.1 pp.
- Record it: `workflow_complete` with `node: "Task_Attribute"`.
- next: → `GW_Culprit` (Culprit evident?)

### Decide — Culprit evident? (`GW_Culprit`)

- `evidence` when exactly the suspects' own CI explains the red; `bisect` when every member is green alone.
- Call `workflow_complete` with `node: "GW_Culprit"` and `outcome` set to the label that holds:
  - «evidence» → `Task_Eject` (Eject the culprit, record why)
  - «bisect» → `Task_Bisect` (Bisect the train)

### 15. Bisect the train (`Task_Bisect`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-queue`.
- What: Halve the members and re-run the gates on each half until the conflicting one is found: two or three CI runs for three to six members.
- Record it: `workflow_complete` with `node: "Task_Bisect"`.
- next: → `Task_Eject` (Eject the culprit, record why)

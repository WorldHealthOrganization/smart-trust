<!-- GENERATED from cat-harness/sdlc/processes/merge-request.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Merge request: find or elect the merge manager

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-request.bpmn` (process `Process_MergeRequest`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The sibling's side of merging.

## Begin — Feature work starts (`Sib_Start`)

- Begin here: A sibling session starts work on a feature branch, which may need a change still in another open PR.
- Call `workflow_start` with `process: "Process_MergeRequest"` and the subject this run is about; keep the instance id it returns.
- next: → `Sib_GwDepends` (Depends on an unmerged PR?)

### Decide — Depends on an unmerged PR? (`Sib_GwDepends`)

- Yes when the work needs a change that is still in an open, unmerged PR, in this repository or in a lower layer.
- Call `workflow_complete` with `node: "Sib_GwDepends"` and `outcome` set to the label that holds:
  - «Yes» → `Sib_Stack` (Stack on it and keep working)
  - «No» → `Sib_Ready` (Make the PR ready)

### 1. Stack on it and keep working (`Sib_Stack`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `continual-progress`.
- What: Same repository: branch from the dependency PR's branch and open a draft PR whose base is that branch; pull the dependency in with merge commits, never rebase or force-push another session's branch.
- Record it: `workflow_complete` with `node: "Sib_Stack"`.
- next: → `Sib_Retarget` (When the base lands, retarget)

### 2. Make the PR ready (`Sib_Ready`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `continual-progress`.
- What: Its own work is done and its full tier is green as judged; it is marked ready by the queue rule (continual-progress, Pace the ready marking).
- Record it: `workflow_complete` with `node: "Sib_Ready"`.
- next: → `Sib_GwActive` (Merge manager active?)

### 3. When the base lands, retarget (`Sib_Retarget`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `continual-progress`.
- What: Retarget the PR onto main and merge main in; across layers, send repin+merge: the merge manager re-pins to the dependency's merge commit on main, so pins only move forward (owner ruling, 2026-11-13).
- Record it: `workflow_complete` with `node: "Sib_Retarget"`.
- next: → `Sib_Ready` (Make the PR ready)

### Decide — Merge manager active? (`Sib_GwActive`)

- Yes when the latest "merge manager: <session id>" announcement in the coordination group names a session that is live: active, and it answered within the stall window (holding.stalledAfterMinutes).
- Call `workflow_complete` with `node: "Sib_GwActive"` and `outcome` set to the label that holds:
  - «Yes» → `Sib_Send` (Send the six-line merge request)
  - «No» → `Sib_Elect` (Elect the merge manager with the siblings)

### 4. Send the six-line merge request (`Sib_Send`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `merge-manager-watcher`.
- What: To the merge manager: the PR URL and full head SHA, the session URL, 1-3 sentences on the change, the rendered preview URL or no preview with a reason, what to look for, and full tier green as judged (owner ruling, 2026-11-07).
- Record it: `workflow_complete` with `node: "Sib_Send"`.
- next: → `Sib_GwAcked` (Acknowledged in time?)

### 5. Elect the merge manager with the siblings (`Sib_Elect`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `merge-manager-watcher`.
- What: The deterministic rule (electHolder): the active session that owns the P0 PR, else the earliest-created active session, the session id breaking a tie.
- Record it: `workflow_complete` with `node: "Sib_Elect"`.
- next: → `Sib_GwWon` (Elected this session?)

### Decide — Acknowledged in time? (`Sib_GwAcked`)

- Yes when the merge manager acknowledged the request within the stall window.
- Call `workflow_complete` with `node: "Sib_GwAcked"` and `outcome` set to the label that holds:
  - «Yes» → `Sib_EndQueued` (With the merge manager)
  - «No» → `Sib_CallStalled` (Stalled-agent triage)

### Decide — Elected this session? (`Sib_GwWon`)

- Call `workflow_complete` with `node: "Sib_GwWon"` and `outcome` set to the label that holds:
  - «Yes» → `Sib_Announce` (Announce and note the merge manager)
  - «No» → `Sib_Send` (Send the six-line merge request)

## Done — With the merge manager (`Sib_EndQueued`)

- The instance completes here: The merge manager owns the landing from here: it reports landed, or hands the PR back with the reason. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Stalled-agent triage (`Sib_CallStalled`)

- Who: the `Sibling session` lane (role `sibling-session`).
- What: Tell the owner that the merge manager stalled, then re-elect with the stalled session excluded.
- A subprocess (`Process_StalledAgentTriage`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Sib_Elect` (Elect the merge manager with the siblings)

### 7. Announce and note the merge manager (`Sib_Announce`)

- Who: the `Sibling session` lane (role `sibling-session`).
- Skill: `merge-manager-watcher`.
- What: Send "merge manager: <session id>" to every sibling and the owner, and note it durably on the coordination work item, so it is used by all, including siblings started later.
- Record it: `workflow_complete` with `node: "Sib_Announce"`.
- next: → `Sib_CallWatch` (Merge manager watch)

### 8. Merge manager watch (`Sib_CallWatch`)

- Who: the `Sibling session` lane (role `sibling-session`).
- What: The elected session holds the merge steward lane and runs its loop until it hands over or the lane lapses.
- A subprocess (`Process_MergeManagerWatch`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Sib_EndHolds` (Lane handed over or lapsed)

## Done — Lane handed over or lapsed (`Sib_EndHolds`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

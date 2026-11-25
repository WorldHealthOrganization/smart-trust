<!-- GENERATED from cat-harness/sdlc/processes/swarm-dispatch-and-monitor.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Swarm dispatch and monitor

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/swarm-dispatch-and-monitor.bpmn` (process `Process_SwarmDispatchAndMonitor`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Binds or cold-resumes any multi-agent swarm on a parent Swarm Work Item (epic or milestone in beans, for example a repository Stability epic, a proof-closure epic, or a literature-audit epic) carrying measurable exit criteria (EC-1..EC-k), structured child queues (completed, active, queued, idle-bac

## Begin — Swarm start or takeover (`Swarm_Start`)

- Begin here: Parallel workstreams are requested for a goal epic, or a successor coordinator/merge-steward takes over cold after a session stall exceeding the liveness window.
- Call `workflow_start` with `process: "Process_SwarmDispatchAndMonitor"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_InitOrClaimSwarmEpic` (Bind or resume swarm epic)

### 1. Bind or resume swarm epic (`Task_InitOrClaimSwarmEpic`)

- Who: the `Coordinator` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: Query beans for an active parent Swarm Work Item (epic or milestone, parameterized by --epic-id or --swarm-title; check before creating).
- Record it: `workflow_complete` with `node: "Task_InitOrClaimSwarmEpic"`.
- next: → `Swarm_Decompose` (Decompose disjoint sub-beans)

### 2. Decompose disjoint sub-beans (`Swarm_Decompose`)

- Who: the `Coordinator` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: Verify that a swarm is justified over serial execution (swarm-management), partition the goal into child work items with disjoint writable paths, explicit Done-when criteria, and non-compute-heavy idle-backlog items, and size worker count, model tiers (cost-aware routing), and host concurrency bound
- Record it: `workflow_complete` with `node: "Swarm_Decompose"`.
- next: → `Swarm_GwWaived` (Swarm-spawn waived?)

### Decide — Swarm-spawn waived? (`Swarm_GwWaived`)

- Yes when an active owner confirmation waiver explicitly covers swarm-spawn up to this worker count and model tier, quoted in the turn report.
- Call `workflow_complete` with `node: "Swarm_GwWaived"` and `outcome` set to the label that holds:
  - «No» → `Owner_DecideSpawn` (Decide swarm card)
  - «Yes» → `Swarm_OpenBean` (Open the swarm epic)

### 3. Decide swarm card (`Owner_DecideSpawn`)

- Who: the `Owner` lane (role `user`).
- Skill: `interaction-modality`.
- What: Coordinator posts the full context, exit criteria, worker count, model tiers, relative token cost, reporting mode (on-demand vs periodic), options, and recommendation in chat, followed immediately by a tappable card; the owner approves or declines.
- Record it: `workflow_complete` with `node: "Owner_DecideSpawn"`.
- next: → `Swarm_GwApproved` (Spawn approved?)

### 4. Open the swarm epic (`Swarm_OpenBean`)

- Who: the `Coordinator` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: Claim the parent Swarm Work Item and initial worker sub-beans in the shared beans store through Process_BeanOpen and push state to the branch store so sibling sessions see every active claim and handover header.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_DispatchWorker` (Dispatch workers with skill brief)

### Decide — Spawn approved? (`Swarm_GwApproved`)

- Yes when the owner approves the swarm card.
- Call `workflow_complete` with `node: "Swarm_GwApproved"` and `outcome` set to the label that holds:
  - «No» → `Swarm_EndSerial` (Run serially)
  - «Yes» → `Swarm_OpenBean` (Open the swarm epic)

### 5. Dispatch workers with skill brief (`Task_DispatchWorker`)

- Who: the `Coordinator` lane (role `session-coordinator`).
- Skill: `dispatch-agent`.
- What: Spawned siblings start with a blank context: inject the mandatory role-specific Process & Skill Launch Block into every worker prompt (for a Merge Steward: repo local skills, merge-manager-watcher, merge-queue / Process_MergeTrain + merge-overlap + Process_MergeRefusal, merge-to-main + Task_LocalGat
- Record it: `workflow_complete` with `node: "Task_DispatchWorker"`.
- next: → `Work_Execute` (Execute slice or idle backlog)

## Done — Run serially (`Swarm_EndSerial`)

- The instance completes here: Swarm declined or unjustified; work proceeds sequentially one child work item at a time. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Execute slice or idle backlog (`Work_Execute`)

- Who: the `Worker agents` lane (role `authoring-agent`).
- Skill: `continual-progress`.
- What: Each worker executes its claimed disjoint slice in its worktree (or advances a right-scoped non-heavy idle-backlog item in a separate worktree while waiting on single-core compute, never checking out mid-build), emits live progress blocks, runs verification, pushes its branch and PR, and emits DONE 
- Record it: `workflow_complete` with `node: "Work_Execute"`.
- next: → `Call_MonitorSweep` (Sweep, triage and sync handover)

### 7. Sweep, triage and sync handover (`Call_MonitorSweep`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: Run Process_SwarmMonitorSweep on reactive wakeups, routine check-in ticks, or on-demand status requests: inspect worker progress, queues, and compressed/swap memory, triage leaks or stalls, assign non-heavy idle-backlog items to compute-bound workers, push a fresh Cold-Start Handover Runbook to bean
- A subprocess (`Process_SwarmMonitorSweep`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Mon_GwReadyPr` (Verified PR ready?)

### Decide — Verified PR ready? (`Mon_GwReadyPr`)

- Yes when a completed worker branch passes independent parent verification (typecheck, tests, and applicable gates) and is ready for merge-steward intake.
- Call `workflow_complete` with `node: "Mon_GwReadyPr"` and `outcome` set to the label that holds:
  - «Yes» → `Steward_QueuePr` (Queue PR in merge watch)
  - «No» → `Mon_GwJoinNext`

### 8. Queue PR in merge watch (`Steward_QueuePr`)

- Who: the `Merge steward` lane (role `merge-steward`).
- Skill: `merge-manager-watcher`.
- What: Hand the verified six-line merge request (or ready-to-merge / needs-repin label) to the active merge steward for batch approval and merge-train landing; neither workers nor monitor self-merge outside the merge-steward lane.
- A subprocess (`Process_MergeManagerWatch`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Mon_GwJoinNext`

### Merge — `Mon_GwJoinNext`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Mon_GwContinue` (Slots active or refillable?)

### Decide — Slots active or refillable? (`Mon_GwContinue`)

- Yes while workers remain live or unclaimed, unblocked child items remain before exit criteria EC-1..EC-k are all met, with healthy host headroom and no Andon halt.
- Call `workflow_complete` with `node: "Mon_GwContinue"` and `outcome` set to the label that holds:
  - «Yes» → `Mon_Refill` (Refill slots and re-arm timer)
  - «Drained» → `Mon_CloseBean` (Close or park swarm epic)

### 9. Refill slots and re-arm timer (`Mon_Refill`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: Claim the next unblocked child work items in the shared beans store (pushing updated queue and handover state to the branch store), dispatch fresh isolated-worktree workers into freed slots with the mandatory role-specific Process & Skill Launch Block and progress contract, and re-arm the 2-to-4-min
- Record it: `workflow_complete` with `node: "Mon_Refill"`.
- next: → `Work_Execute` (Execute slice or idle backlog)

### 10. Close or park swarm epic (`Mon_CloseBean`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `todo-manager`.
- What: Cancel any remaining wakeup or periodic report timer and run Process_BeanClose on the parent Swarm Work Item: complete and archive once EC-1..EC-k are satisfied, or record explicit blockers and cold-takeover dispatch lines in beans and hand back cleanly.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Mon_EndClosed` (Swarm closed)

## Done — Swarm closed (`Mon_EndClosed`)

- The instance completes here: All swarm exit criteria have been met or cleanly parked, the final two-table Human-Consumable Swarm Status Report is published, and the Swarm Work Item state is synced. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

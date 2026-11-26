<!-- GENERATED from cat-harness/sdlc/processes/swarm-dispatch-and-monitor-sweep.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Swarm monitor sweep and handover sync

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/swarm-dispatch-and-monitor-sweep.bpmn` (process `Process_SwarmMonitorSweep`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Executes one stall-safe Swarm Monitor check-in sweep inside Process_SwarmDispatchAndMonitor: extracts live worker progress, measures repository queues and host CPU, disk, and compressed or swapped memory, intervenes on leaks or stalls, assigns right-scoped non-heavy idle-backlog work to workers wait

## Begin — Monitor wakeup or check-in (`Sweep_Start`)

- Begin here: Triggered by a worker completion/blocker event, a 2-to-4-minute fallback timer, a scheduled periodic check-in, or an on-demand owner status request.
- Call `workflow_start` with `process: "Process_SwarmMonitorSweep"` and the subject this run is about; keep the instance id it returns.
- next: → `Mon_Sweep` (Sweep progress, queues and swap)

### 1. Sweep progress, queues and swap (`Mon_Sweep`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: Run the targeted JSONL progress extractor, query live forge PR/issue counts and synced beans states against origin/main, and inspect CPU load, root disk free space (df -h /), and total plus compressed/swap memory (top -l 1 -o mem -stats pid,command,mem,cmprs on macOS or VmRSS + VmSwap on Linux, neve
- Record it: `workflow_complete` with `node: "Mon_Sweep"`.
- next: → `Mon_GwHealthy` (Stall, drift or swap leak?)

### Decide — Stall, drift or swap leak? (`Mon_GwHealthy`)

- Yes when any worker subprocess breaches the memory+compressed/swap or root-disk floor, a worker is silent for over 3 minutes or repeats step counters across two sweeps, workers collide on a path, or completed slices diverge structurally.
- Call `workflow_complete` with `node: "Mon_GwHealthy"` and `outcome` set to the label that holds:
  - «Yes» → `Mon_Triage` (Nudge, kill leak or pull Andon)
  - «No» → `Mon_GwJoinTriage`

### 2. Nudge, kill leak or pull Andon (`Mon_Triage`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: Immediately SIGKILL any runaway subprocess leaking into compressed memory or swapfiles and message its worker; nudge a silent worker via SendMessage; route dead sessions through stalled-agent-triage; or pull the Andon cord to halt remaining workers on structural divergence or host exhaustion.
- Record it: `workflow_complete` with `node: "Mon_Triage"`.
- next: → `Mon_GwJoinTriage`

### Merge — `Mon_GwJoinTriage`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Mon_GwIdleCompute` (Worker idle on compute?)

### Decide — Worker idle on compute? (`Mon_GwIdleCompute`)

- Yes when a worker is waiting on single-core or long-running background compute (build, solver, or CI) with no substantive foreground work and non-heavy idle-backlog items exist.
- Call `workflow_complete` with `node: "Mon_GwIdleCompute"` and `outcome` set to the label that holds:
  - «Yes» → `Task_AssignIdleComputeBacklog` (Assign non-heavy idle backlog)
  - «No» → `Mon_GwJoinIdle`

### 3. Assign non-heavy idle backlog (`Task_AssignIdleComputeBacklog`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `idle-backlog`.
- What: Assign a right-scoped, non-compute-heavy item from the parent Swarm Work Item's idle-backlog queue (documentation, metadata, review checklists, or disjoint lightweight edits in a separate git worktree, never running git checkout inside the active build's worktree) instead of letting the worker sleep
- Record it: `workflow_complete` with `node: "Task_AssignIdleComputeBacklog"`.
- next: → `Mon_GwJoinIdle`

### Merge — `Mon_GwJoinIdle`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_RefreshSwarmHandover` (Refresh and push epic handover)

### 4. Refresh and push epic handover (`Task_RefreshSwarmHandover`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: On every routine monitor check-in tick and milestone transition (whether chat reporting is periodic or quiet on-demand), update the parent Swarm Work Item's Cold-Start Handover Runbook (origin/main SHA, EC-1..EC-k exit status, merged/open PR wave queues, worktree-to-branch-to-HEAD-to-role/PID table,
- Record it: `workflow_complete` with `node: "Task_RefreshSwarmHandover"`.
- next: → `Mon_GwReportDue` (Report requested or periodic?)

### Decide — Report requested or periodic? (`Mon_GwReportDue`)

- Yes when the owner asks for status on-demand, when a user-enabled periodic report timer fires, or when a milestone/exit gate transitions.
- Call `workflow_complete` with `node: "Mon_GwReportDue"` and `outcome` set to the label that holds:
  - «Yes» → `Mon_Report` (Publish scoreboard and status table)
  - «Quiet» → `Mon_GwJoinReport`

### 5. Publish scoreboard and status table (`Mon_Report`)

- Who: the `Swarm monitor` lane (role `swarm-monitor`).
- Skill: `swarm-monitor`.
- What: Publish the standardized two-table Human-Consumable Swarm Status Report with zero naked worker codes, bare PR ranges, or unglossed bean IDs: (Table 1) Live Repository Queue Scoreboard across PRs, Work Items, and Issues with host headroom, and (Table 2) Full Multi-Track End-State, Queue, and Worker S
- Record it: `workflow_complete` with `node: "Mon_Report"`.
- next: → `Mon_GwJoinReport`

### Merge — `Mon_GwJoinReport`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Sweep_End` (Sweep complete)

## Done — Sweep complete (`Sweep_End`)

- The instance completes here: Progress, headroom, idle-backlog assignments, Cold-Start Handover Runbook in beans, and any due human status report are complete for this check-in. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

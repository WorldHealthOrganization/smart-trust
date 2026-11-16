<!-- GENERATED from cat-harness/sdlc/processes/stalled-agent-triage.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Stalled-agent triage: collect handovers, consolidate themes, recommend, re-route

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/stalled-agent-triage.bpmn` (process `Process_StalledAgentTriage`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

When agents stall (context exhausted, container lost, session timed out) their work is spread over PRs, branches, beans and process runs.

## Begin — Agents stalled, or owner asks to pick up their work (`Start_SAT`)

- Begin here.
- Call `workflow_start` with `process: "Process_StalledAgentTriage"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Footprint` (Find the footprint)

### 1. Find the footprint (`A_Footprint`)

- Who: the `Triage agent` lane (role `authoring-agent`).
- Skill: `stalled-agent-triage`.
- What: handover notes (beans/notes, title 'handover:'), open PRs and branches by session or time window, in-progress beans, workflow instances, last PR and issue comments.
- Record it: `workflow_complete` with `node: "A_Footprint"`.
- next: → `A_Collect` (Collect or reconstruct a handover report per agent)

### 2. Collect or reconstruct a handover report per agent (`A_Collect`)

- Who: the `Triage agent` lane (role `authoring-agent`).
- Skill: `handover-report`.
- What: Use the agent's own report and check it against live state; if none, ask the agent if it is still reachable, else reconstruct with the handover-report template and mark it reconstructed.
- Record it: `workflow_complete` with `node: "A_Collect"`.
- next: → `A_Consolidate` (Consolidate into 2-4 themes, with a recommendation each)

### 3. Consolidate into 2-4 themes, with a recommendation each (`A_Consolidate`)

- Who: the `Triage agent` lane (role `authoring-agent`).
- Skill: `stalled-agent-triage`.
- What: Group by what the work delivers, not by agent.
- Record it: `workflow_complete` with `node: "A_Consolidate"`.
- next: → `U_Decide` (Decide each theme)

### 4. Decide each theme (`U_Decide`)

- Who: the `User` lane (role `user`).
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Record` (Record the triage and claim the picked-up work)

### 5. Record the triage and claim the picked-up work (`A_Record`)

- Who: the `Triage agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: A 'triage: <date>' bean note on each theme's epic; new or re-parented beans; claims via beans:claim.
- Record it: `workflow_complete` with `node: "A_Record"`.
- next: → `S_Reroute` (Re-route open PRs that lost their driver)

### 6. Re-route open PRs that lost their driver (`S_Reroute`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `coordinate`.
- What: Green, up-to-date PRs join the queue; mid-merge branches are re-driven from the PR head, never guessed at; red PRs go back to the new driver.
- Record it: `workflow_complete` with `node: "S_Reroute"`.
- next: → `End_SAT` (Stalled work has an owner and a place in the plan)

## Done — Stalled work has an owner and a place in the plan (`End_SAT`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

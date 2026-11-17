<!-- GENERATED from cat-harness/library/processes/refresh-materialized.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Refresh materialized remote content

> **Generated, and not the authority.** This is `cat-harness/library/processes/refresh-materialized.bpmn` (process `Process_RefreshMaterialized`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Keep a materialized copy of remote content current: what changed upstream, what changed locally, and what to do when both did — an archival copy is never re-fetched and gets a fixity check instead.

## Begin — A copy is due for re-check (`StartEvent_Due`)

- Begin here.
- Call `workflow_start` with `process: "Process_RefreshMaterialized"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_Purpose` (working, or archival?)

### Decide — working, or archival? (`Gateway_Purpose`)

- Is this copy kept as a working copy or as an archive?
- Call `workflow_complete` with `node: "Gateway_Purpose"` and `outcome` set to the label that holds:
  - «archival» → `Task_Fixity` (ARCHIVAL verify fixity — never re-fetch)
  - «working» → `Task_Upstream` (WORKING what changed upstream)

### 1. ARCHIVAL verify fixity — never re-fetch (`Task_Fixity`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Re-compute the digest and compare.
- Record it: `workflow_complete` with `node: "Task_Fixity"`.
- next: → `EndEvent_Fresh` (Fresh, and the graph records against what)

### 2. WORKING what changed upstream (`Task_Upstream`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Compare the recorded upstreamVersion against the source.
- Record it: `workflow_complete` with `node: "Task_Upstream"`.
- next: → `Task_Local` (What changed LOCALLY since)

## Done — Fresh, and the graph records against what (`EndEvent_Fresh`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. What changed LOCALLY since (`Task_Local`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The half nothing answers today.
- Record it: `workflow_complete` with `node: "Task_Local"`.
- next: → `Gateway_Both` (Both changed?)

### Decide — Both changed? (`Gateway_Both`)

- Did the copy change both upstream and locally since it was fetched?
- Call `workflow_complete` with `node: "Gateway_Both"` and `outcome` set to the label that holds:
  - «yes» → `Task_Adjudicate` (Adjudicate the conflict)
  - «no» → `Task_Apply` (Re-materialize and record new fixity)

### 4. Adjudicate the conflict (`Task_Adjudicate`)

- Who: the `Contributor (human or agent)` lane (role `user`).
- Skill: `materialize-remote`, `adjudication`.
- What: A human or agentic decision, never a merge rule.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Outcome` (Which side, and on what terms?)

### 5. Re-materialize and record new fixity (`Task_Apply`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The gates are re-asked, not inherited: a licence can change, and a collection can grow past the size a caller agreed to.
- Record it: `workflow_complete` with `node: "Task_Apply"`.
- next: → `EndEvent_Fresh` (Fresh, and the graph records against what)

### Decide — Which side, and on what terms? (`GW_Outcome`)

- Four answers, and they do four different things; without this gateway the process would ask which side wins and then discard the answer.
- Call `workflow_complete` with `node: "GW_Outcome"` and `outcome` set to the label that holds:
  - «the remote wins» → `Task_Apply` (Re-materialize and record new fixity)
  - «the local edit wins» → `Task_KeepLocal` (Keep the edit, re-pin)
  - «neither whole — reconcile» → `Task_Reconcile` (Reconcile the two by hand)
  - «not decidable today» → `Task_RecordConflict` (Record the conflict: no decision, no re-pin)

### 6. Keep the edit, re-pin (`Task_KeepLocal`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: The local edit wins, so nothing is re-materialized — and the pin moves to the upstream revision that was compared against.
- Record it: `workflow_complete` with `node: "Task_KeepLocal"`.
- next: → `EndEvent_Diverged` (Diverged on purpose, and the record says why)

### 7. Reconcile the two by hand (`Task_Reconcile`)

- Who: the `Contributor (human or agent)` lane (role `user`).
- Skill: `materialize-remote`.
- What: Neither side wins whole: the contributor produces content that is neither the local copy nor the remote one, and THEN it is applied.
- Record it: `workflow_complete` with `node: "Task_Reconcile"`.
- next: → `Task_Apply` (Re-materialize and record new fixity)

### 8. Record the conflict: no decision, no re-pin (`Task_RecordConflict`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `materialize-remote`.
- What: Both copies stay and the conflict is written down with what each side says.
- Record it: `workflow_complete` with `node: "Task_RecordConflict"`.
- next: → `EndEvent_Diverged` (Diverged on purpose, and the record says why)

## Done — Diverged on purpose, and the record says why (`EndEvent_Diverged`)

- The instance completes here: Not a failure and not freshness. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

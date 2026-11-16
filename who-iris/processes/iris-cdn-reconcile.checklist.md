<!-- GENERATED from who-iris/processes/iris-cdn-reconcile.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — IRIS CDN weekly reconciliation

> **Generated, and not the authority.** This is `who-iris/processes/iris-cdn-reconcile.bpmn` (process `Process_IrisCdnReconcile`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The DSpace REST API reports no deletions, so once a week every item id IRIS lists is compared with what the library holds.

## Begin — Weekly, Sunday 04:00 UTC (`Start_Weekly`)

- Begin here.
- Call `workflow_start` with `process: "Process_IrisCdnReconcile"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ListAll` (List every item id IRIS reports)

### 1. List every item id IRIS reports (`Task_ListAll`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- Record it: `workflow_complete` with `node: "Task_ListAll"`.
- next: → `Task_Compare` (Compare with the ids the library holds)

### 2. Compare with the ids the library holds (`Task_Compare`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- Record it: `workflow_complete` with `node: "Task_Compare"`.
- next: → `GW_Plausible` (Missing share under 1%?)

### Decide — Missing share under 1%? (`GW_Plausible`)

- A listing that came back short (a paging fault, an outage) must not read as a mass withdrawal.
- Call `workflow_complete` with `node: "GW_Plausible"` and `outcome` set to the label that holds:
  - «no» → `Task_Escalate` (Treat the listing as faulty; escalate)
  - «yes» → `Task_Recheck` (Re-check each missing item by id)

### 3. Treat the listing as faulty; escalate (`Task_Escalate`)

- Who: the `IRIS CDN Exporter (agent)` lane (role `iris-cdn-exporter`).
- Skill: `iris-cdn-exporter`.
- Record it: `workflow_complete` with `node: "Task_Escalate"`.
- next: → `End_Refused` (Nothing marked)

### 4. Re-check each missing item by id (`Task_Recheck`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- Record it: `workflow_complete` with `node: "Task_Recheck"`.
- next: → `Task_MarkWithdrawn` (Mark confirmed items withdrawn (keep bytes))

## Done — Nothing marked (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Mark confirmed items withdrawn (keep bytes) (`Task_MarkWithdrawn`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- What: The record gets a withdrawn state; its bitstreams stay addressable, because a citation to them may exist.
- Record it: `workflow_complete` with `node: "Task_MarkWithdrawn"`.
- next: → `Call_Rebuild` (Rebuild the whole graph (sorted output))

### 6. Rebuild the whole graph (sorted output) (`Call_Rebuild`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-oxigraph`, `nquads-distribution`.
- A subprocess (`Process_NQuadsDistribution`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_SignPublish` (Sign and publish the release)

### 7. Sign and publish the release (`Call_SignPublish`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-signing`.
- A subprocess (`Process_IrisCdnSignPublish`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Reconciled` (Reconciled)

## Done — Reconciled (`End_Reconciled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

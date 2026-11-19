<!-- GENERATED from who-iris/processes/iris-cdn-initial-load.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — IRIS CDN initial load

> **Generated, and not the authority.** This is `who-iris/processes/iris-cdn-initial-load.bpmn` (process `Process_IrisCdnInitialLoad`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The first full export of WHO IRIS onto Cloudflare (git on Artifacts, bytes in R2): every item record and every bitstream: metadata plus PDFs.

## Begin — Owner approves an initial load (`Start_LoadApproved`)

- Begin here.
- Call `workflow_start` with `process: "Process_IrisCdnInitialLoad"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_StateBudget` (State scope and budget, with denominators)

### 1. State scope and budget, with denominators (`Task_StateBudget`)

- Who: the `Owner` lane (role `iris-cdn-owner`).
- Skill: `iris-cdn-exporter`.
- What: Items, files and bytes upstream (273,559 items, 1,057,223 files, 361.55 GiB as last transcribed), the storage target for each kind of file, and a request rate IRIS will tolerate.
- Record it: `workflow_complete` with `node: "Task_StateBudget"`.
- next: → `Task_PlanBatches` (Plan batches by community and collection)

### 2. Plan batches by community and collection (`Task_PlanBatches`)

- Who: the `IRIS CDN Exporter (agent)` lane (role `iris-cdn-exporter`).
- Skill: `iris-cdn-exporter`, `iris-dspace`.
- What: One batch per collection (large collections split by page).
- Record it: `workflow_complete` with `node: "Task_PlanBatches"`.
- next: → `Task_HarvestBatch` (Harvest a batch of item records (REST))

### 3. Harvest a batch of item records (REST) (`Task_HarvestBatch`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`, `iris-dspace`.
- What: DSpace REST: the item, its metadata, bundles and bitstream descriptors.
- Record it: `workflow_complete` with `node: "Task_HarvestBatch"`.
- next: → `Task_FetchBitstreams` (Fetch bitstreams not already held)

### 4. Fetch bitstreams not already held (`Task_FetchBitstreams`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- What: A bitstream is stored under its SHA-256.
- Record it: `workflow_complete` with `node: "Task_FetchBitstreams"`.
- next: → `GW_Fixity` (Bytes match the IRIS checksum?)

### Decide — Bytes match the IRIS checksum? (`GW_Fixity`)

- DSpace reports an MD5 checksum per bitstream.
- Call `workflow_complete` with `node: "GW_Fixity"` and `outcome` set to the label that holds:
  - «yes» → `Task_StoreBytes` (Store bytes under SHA-256 (skip if held))
  - «no» → `Task_Quarantine` (Quarantine and report the mismatch)

### 5. Store bytes under SHA-256 (skip if held) (`Task_StoreBytes`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- Record it: `workflow_complete` with `node: "Task_StoreBytes"`.
- next: → `Task_Checkpoint` (Commit the batch checkpoint)

### 6. Quarantine and report the mismatch (`Task_Quarantine`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- What: Not published, not retried silently.
- Record it: `workflow_complete` with `node: "Task_Quarantine"`.
- next: → `GW_More_Join`

### 7. Commit the batch checkpoint (`Task_Checkpoint`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- What: state/initial-load.json in the Cloudflare git repository.
- Record it: `workflow_complete` with `node: "Task_Checkpoint"`.
- next: → `GW_More_Join`

### Merge — `GW_More_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_More` (More batches?)

### Decide — More batches? (`GW_More`)

- Call `workflow_complete` with `node: "GW_More"` and `outcome` set to the label that holds:
  - «yes» → `Task_HarvestBatch` (Harvest a batch of item records (REST))
  - «no» → `Call_BuildGraph` (Build the graph partitions)

### 8. Build the graph partitions (`Call_BuildGraph`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-oxigraph`, `nquads-distribution`.
- What: The platform process nquads-distribution (cat-harness): spine plus one partition per community, zero blank nodes, sorted N-Quads.
- A subprocess (`Process_NQuadsDistribution`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_SignPublish` (Sign and publish the release)

### 9. Sign and publish the release (`Call_SignPublish`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-signing`.
- A subprocess (`Process_IrisCdnSignPublish`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_ReviewLoad` (Review the load report; open beans for gaps)

### 10. Review the load report; open beans for gaps (`Task_ReviewLoad`)

- Who: the `IRIS CDN Exporter (agent)` lane (role `iris-cdn-exporter`).
- Skill: `iris-cdn-exporter`.
- Record it: `workflow_complete` with `node: "Task_ReviewLoad"`.
- next: → `End_Loaded` (Initial release published and verified)

## Done — Initial release published and verified (`End_Loaded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

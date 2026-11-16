<!-- GENERATED from who-iris/processes/iris-cdn-nightly.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — IRIS CDN nightly change ingest

> **Generated, and not the authority.** This is `who-iris/processes/iris-cdn-nightly.bpmn` (process `Process_IrisCdnNightly`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Every night: ask the IRIS DSpace REST API which items changed since the last published run, ingest only those, rebuild the whole graph (sorted output keeps unchanged partitions byte-identical), and publish a signed release.

## Begin — Every night, 02:00 UTC (`Start_Nightly`)

- Begin here.
- Call `workflow_start` with `process: "Process_IrisCdnNightly"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ReadCursor` (Read the cursor of the last published run)

### 1. Read the cursor of the last published run (`Task_ReadCursor`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- What: state/cursor.json in the Cloudflare git repository: the lastModified of the newest item in the last VERIFIED release.
- Record it: `workflow_complete` with `node: "Task_ReadCursor"`.
- next: → `Task_ListChanged` (List items changed since the cursor)

### 2. List items changed since the cursor (`Task_ListChanged`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- What: scripts/iris-cdn/rest-feed.ts changedSince: a Discovery search for lastModified at or after the cursor, sorted by dc.date.accessioned (IRIS rejects a lastModified sort), paged until an item is older than the cursor.
- Record it: `workflow_complete` with `node: "Task_ListChanged"`.
- next: → `GW_Any` (Anything changed?)

### Decide — Anything changed? (`GW_Any`)

- Call `workflow_complete` with `node: "GW_Any"` and `outcome` set to the label that holds:
  - «no» → `End_NoChange` (Nothing published, nothing committed)
  - «yes» → `Task_FetchChanged` (Fetch the changed records and bitstream lists)

## Done — Nothing published, nothing committed (`End_NoChange`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Fetch the changed records and bitstream lists (`Task_FetchChanged`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`, `iris-dspace`.
- Record it: `workflow_complete` with `node: "Task_FetchChanged"`.
- next: → `Task_FetchNewBytes` (Fetch only bitstreams whose checksum changed)

### 4. Fetch only bitstreams whose checksum changed (`Task_FetchNewBytes`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- Record it: `workflow_complete` with `node: "Task_FetchNewBytes"`.
- next: → `Task_WriteRecords` (Write canonical records into the library)

### 5. Write canonical records into the library (`Task_WriteRecords`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-exporter`.
- What: A record whose canonical bytes equal the held ones is not rewritten.
- Record it: `workflow_complete` with `node: "Task_WriteRecords"`.
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
- next: → `Task_AdvanceCursor` (Commit the advanced cursor)

### 8. Commit the advanced cursor (`Task_AdvanceCursor`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-rest-feed`.
- What: Only after the release verified.
- Record it: `workflow_complete` with `node: "Task_AdvanceCursor"`.
- next: → `Task_Review` (Review the run report; open beans for anomalies)

### 9. Review the run report; open beans for anomalies (`Task_Review`)

- Who: the `IRIS CDN Exporter (agent)` lane (role `iris-cdn-exporter`).
- Skill: `iris-cdn-exporter`.
- What: Anomalies: a change count far from the recent median, quarantined bitstreams, a verification that came back unknown, a partition over its size ceiling.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `End_Done` (Night published and reviewed)

## Done — Night published and reviewed (`End_Done`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

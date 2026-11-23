<!-- GENERATED from cat-harness/library/processes/document-ingestion.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Basic ingestion — an upload to an asset catalogued in library/

> **Generated, and not the authority.** This is `cat-harness/library/processes/document-ingestion.bpmn` (process `Process_Ingestion`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Accepts an upload, records its extracted metadata in the knowledge graph, and catalogues the asset in `library/` — held if materialized, referenced if not.

## Begin — A contributor has a file for the folio (`StartEvent_Dropped`)

- Begin here: ONE OF TWO ENTRY POINTS.
- Call `workflow_start` with `process: "Process_Ingestion"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Place` (Place it in uploads/ by a declared route)

### 1. Place it in uploads/ by a declared route (`Task_Place`)

- Who: the `Contributor (human or agent)` lane (role `user`).
- Skill: `upload-routes`.
- What: THE FIRST LINK: everything downstream of here takes a file that is already in the queue, so without this step how the file got there is governed by nothing.
- Record it: `workflow_complete` with `node: "Task_Place"`.
- next: → `Task_ExtractMetadata` (Extract its metadata into the KG)

### 2. Extract its metadata into the KG (`Task_ExtractMetadata`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `asset-extraction`.
- What: THE METADATA STEP.
- Record it: `workflow_complete` with `node: "Task_ExtractMetadata"`.
- next: → `Gateway_Materialized` (Materialized?)

### Decide — Materialized? (`Gateway_Materialized`)

- Answered from the materialization state (`schemas/kg/materialization-state.ts`): `materialized` means the bytes are here; `referenced` means we know where they are and hold none.
- Call `workflow_complete` with `node: "Gateway_Materialized"` and `outcome` set to the label that holds:
  - «materialized» → `Task_PlaceInLibrary` (Place the asset in library/<slug>/)
  - «referenced» → `Task_CatalogueReference` (Record it in library/ as referenced)

### 3. Place the asset in library/<slug>/ (`Task_PlaceInLibrary`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `library-ingestion`.
- What: The materialized branch.
- Record it: `workflow_complete` with `node: "Task_PlaceInLibrary"`.
- next: → `EndEvent_Catalogued` (Asset catalogued)

### 4. Record it in library/ as referenced (`Task_CatalogueReference`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `library-ingestion`.
- What: The referenced branch.
- Record it: `workflow_complete` with `node: "Task_CatalogueReference"`.
- next: → `EndEvent_Catalogued` (Asset catalogued)

## Done — Asset catalogued (`EndEvent_Catalogued`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

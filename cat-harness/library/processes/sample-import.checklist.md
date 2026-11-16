<!-- GENERATED from cat-harness/library/processes/sample-import.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Sample import into a structured data store

> **Generated, and not the authority.** This is `cat-harness/library/processes/sample-import.bpmn` (process `Process_SampleImport`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The SDLC for testing an import of a SAMPLE of a remote source into a knowledge graph or other structured store.

## Begin — A sample of a remote source is proposed (`StartEvent_Proposed`)

- Begin here: The caller names a source (ideally one with a source descriptor in the declared sources/ of the layer that owns the corpus) and a reason to try it.
- Call `workflow_start` with `process: "Process_SampleImport"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Scope` (Scope the sample: items, store, permanence)

## Begin — A permanent sample is due or changed upstream (`StartEvent_Upstream`)

- Begin here: The second entry.
- Call `workflow_start` with `process: "Process_SampleImport"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_Refresh` (Refresh materialized content)

### 1. Scope the sample: items, store, permanence (`Task_Scope`)

- Who: the `Contributor (human or agent)` lane (role `user`).
- Skill: `sample-import`.
- What: Three answers, recorded before anything is fetched.
- Record it: `workflow_complete` with `node: "Task_Scope"`.
- next: → `Call_Materialize` (Materialize remote content (the five gates))

### 2. Refresh materialized content (`Call_Refresh`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`, `materialize-remote`.
- What: Refresh is not re-import: what changed upstream, what changed locally since, and what to do when both did.
- A subprocess (`Process_RefreshMaterialized`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Refreshed` (Refreshed)

### 3. Materialize remote content (the five gates) (`Call_Materialize`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`, `materialize-remote`.
- What: The shared subprocess.
- A subprocess (`Process_MaterializeRemote`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_Materialized` (Materialized?)

## Done — Refreshed (`EndEvent_Refreshed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Materialized? (`Gateway_Materialized`)

- Read off materialize-remote's end state, never re-decided.
- Call `workflow_complete` with `node: "Gateway_Materialized"` and `outcome` set to the label that holds:
  - «yes» → `Gateway_Permanent` (Meant to be permanent?)
  - «no, or unknown» → `EndEvent_Refused` (Not imported; stays referenced, with why)

### Decide — Meant to be permanent? (`Gateway_Permanent`)

- The answer from Task_Scope.
- Call `workflow_complete` with `node: "Gateway_Permanent"` and `outcome` set to the label that holds:
  - «permanent» → `Task_Library` (Land it in library/)
  - «trial» → `Task_Trial` (Keep it as a trial: the unpublished trashcan)

## Done — Not imported; stays referenced, with why (`EndEvent_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Land it in library/ (`Task_Library`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`.
- What: A permanent sample joins the library as an L1 source, with the materialization record (purpose, gates, fixity) beside it.
- Record it: `workflow_complete` with `node: "Task_Library"`.
- next: → `Task_ImportTest` (Import into the store, and test the import)

### 5. Keep it as a trial: the unpublished trashcan (`Task_Trial`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`.
- What: A trial goes to the kept trashcan: addressable, exported, never published.
- Record it: `workflow_complete` with `node: "Task_Trial"`.
- next: → `Task_ImportTest` (Import into the store, and test the import)

### 6. Import into the store, and test the import (`Task_ImportTest`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`.
- What: The part only this process does.
- Record it: `workflow_complete` with `node: "Task_ImportTest"`.
- next: → `Gateway_Passed` (Every check passed?)

### Decide — Every check passed? (`Gateway_Passed`)

- All of them, and each one ran.
- Call `workflow_complete` with `node: "Gateway_Passed"` and `outcome` set to the label that holds:
  - «yes» → `EndEvent_Imported` (Sample imported and tested)
  - «no, or could not run» → `Task_RecordFindings` (Record what failed)

## Done — Sample imported and tested (`EndEvent_Imported`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Record what failed (`Task_RecordFindings`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `sample-import`.
- What: Which check failed, on which items, and the evidence.
- Record it: `workflow_complete` with `node: "Task_RecordFindings"`.
- next: → `EndEvent_Failed` (Import failed, findings recorded)

## Done — Import failed, findings recorded (`EndEvent_Failed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

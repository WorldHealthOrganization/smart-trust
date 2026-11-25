<!-- GENERATED from folio-assistant-core/collab/processes/library/l1-document-ingestion.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — L1 document ingestion — a document to the L1 source knowledge graph

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/library/l1-document-ingestion.bpmn` (process `Process_L1DocumentIngestion`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

L1 document ingestion — a document to the L1 source knowledge graph.

## Begin — A document is offered for L1 ingestion (`StartEvent_Document`)

- Begin here: A document whose text and structure are wanted as L1 source content.
- Call `workflow_start` with `process: "Process_L1DocumentIngestion"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `CallActivity_Basic` (Basic ingestion (harness))
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Basic ingestion (harness) (`CallActivity_Basic`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `library-ingestion`.
- What: The harness's `document-ingestion.bpmn`: accept the upload by a declared route, extract its metadata into the KG, and catalogue the asset in library/ — placed if materialized, recorded as referenced if not.
- A subprocess (`Process_Ingestion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Detect` (Detect media type, mint a doc id)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Detect media type, mint a doc id (`Task_Detect`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Sniff the media type rather than trusting the extension, and mint the doc id from the page-1 arXiv stamp where there is one, else from the filename.
- Record it: `workflow_complete` with `node: "Task_Detect"`.
- next: → `Task_Licence` (Establish the licence from the upload)

### 4. Establish the licence from the upload (`Task_Licence`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: EARLY: before any derivation, because library/ is holds: content and anything derived first is committed, so refusing it later is a deletion nobody may take unasked.
- Record it: `workflow_complete` with `node: "Task_Licence"`.
- next: → `CallActivity_Extract` (Extract structure)

### 5. Extract structure (`CallActivity_Extract`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: See ingest-extract-structure.bpmn.
- A subprocess (`Process_ExtractStructure`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `CallActivity_Derive` (Derive content from the assets)

### 6. Derive content from the assets (`CallActivity_Derive`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: See ingest-derive-content.bpmn.
- A subprocess (`Process_DeriveContent`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_ThemeSource` (A theme source? (author's judgement))

### Decide — A theme source? (author's judgement) (`Gateway_ThemeSource`)

- Human or agentic judgement at the gateway, not a declared predicate.
- Call `workflow_complete` with `node: "Gateway_ThemeSource"` and `outcome` set to the label that holds:
  - «yes» → `CallActivity_IngestTheme` (Ingest the theme)
  - «no» → `CallActivity_BuildKg` (Build the L1 knowledge graph)

### 7. Ingest the theme (`CallActivity_IngestTheme`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-art-intake`.
- What: See ingest-theme.bpmn.
- A subprocess (`Process_IngestTheme`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `CallActivity_BuildKg` (Build the L1 knowledge graph)

### 8. Build the L1 knowledge graph (`CallActivity_BuildKg`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: See ingest-build-l1-kg.bpmn.
- A subprocess (`Process_BuildL1Kg`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `CallActivity_Gate` (L1 completeness gate)

### 9. L1 completeness gate (`CallActivity_Gate`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: See ingest-l1-completeness-gate.bpmn.
- A subprocess (`Process_L1Gate`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_Complete` (L1 complete?)

### Decide — L1 complete? (`Gateway_Complete`)

- The verdict of the L1 completeness gate.
- Call `workflow_complete` with `node: "Gateway_Complete"` and `outcome` set to the label that holds:
  - «gap» → `Task_OpenBean` (Record the gap as a bean)
  - «complete» → `Task_Promote` (Move into library/<bib-slug>/)

### 10. Record the gap as a bean (`Task_OpenBean`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `todo-manager`.
- What: A missing derived artefact is a tracked gap, not a silent omission.
- Record it: `workflow_complete` with `node: "Task_OpenBean"`.
- next: → `CallActivity_Derive` (Derive content from the assets)

### 11. Move into library/<bib-slug>/ (`Task_Promote`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: The folder name IS the bibliography citation key, so a citation and a directory are the same string.
- Record it: `workflow_complete` with `node: "Task_Promote"`.
- next: → `CallActivity_PublishStatements` (Publish the extracted statements)

### 12. Publish the extracted statements (`CallActivity_PublishStatements`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `publish-extracted-statements`.
- What: THE ENTRY IS COMPLETE HERE, so its statements are published here.
- A subprocess (`Process_PublishExtractedStatements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_SummaryQueue` (Summarise prose blocks, in every language)

### 13. Summarise prose blocks, in every language (`Task_SummaryQueue`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: A QA sidecar of general document ingestion, drained slowly.
- Record it: `workflow_complete` with `node: "Task_SummaryQueue"`.
- next: → `Task_Errata` (Record errata in the source's own text)

### 14. Record errata in the source's own text (`Task_Errata`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: Owner, 2026-11-11 (card Q-ODD-1 = A, and "add to L1 doc schema errata").
- Record it: `workflow_complete` with `node: "Task_Errata"`.
- next: → `Task_Citeable` (Available to cite as an L1 source)

### 15. Available to cite as an L1 source (`Task_Citeable`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Every knowledge-graph reference to this source now resolves through library/.
- Record it: `workflow_complete` with `node: "Task_Citeable"`.
- next: → `Call_BeanClose` (Close the bean)

### 16. Close the bean (`Call_BeanClose`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Ingested` (Ingested)

## Done — Ingested (`EndEvent_Ingested`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

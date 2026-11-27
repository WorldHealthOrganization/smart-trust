<!-- GENERATED from folio-assistant-core/processes/library/ingest-build-l1-kg.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ingestion subprocess — build the L1 knowledge graph

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/ingest-build-l1-kg.bpmn` (process `Process_BuildL1Kg`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Build the L1 knowledge graph from what ingestion derived: Dublin Core, the manifest, the assets, their binding and their links.

## Begin — Derived content ready (`StartEvent_Derived2`)

- Begin here.
- Call `workflow_start` with `process: "Process_BuildL1Kg"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Dublin` (Write dublin-core.jsonld (the record of truth))

### 1. Write dublin-core.jsonld (the record of truth) (`Task_Dublin`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: One standalone Dublin Core record per folder.
- Record it: `workflow_complete` with `node: "Task_Dublin"`.
- next: → `Task_Manifest` (Write manifest.jsonld referencing it)

### 2. Write manifest.jsonld referencing it (`Task_Manifest`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Write manifest.jsonld for the folder: its @id, @type folio:SourceDocument, what it contains and its provenance, referencing the standalone dublin-core.jsonld as the record of truth rather than copying its fields.
- Record it: `workflow_complete` with `node: "Task_Manifest"`.
- next: → `Task_Assets` (Record assets[] — local path or remote URL)

### 3. Record assets[] — local path or remote URL (`Task_Assets`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: kind / role / url-or-path / checksum / retrieved.
- Record it: `workflow_complete` with `node: "Task_Assets"`.
- next: → `Task_Bind` (Bind the folder to its bibliography slug)

### 4. Bind the folder to its bibliography slug (`Task_Bind`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Bind the folder name to the document's bibliography slug, so library/<bib-slug>/ and its citation key are the same string: a citation resolves to a directory without a lookup table between them.
- Record it: `workflow_complete` with `node: "Task_Bind"`.
- next: → `Task_Glossary` (Read glossary into candidate terms)

### 5. Read glossary into candidate terms (`Task_Glossary`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `glossary-terms`.
- What: The source's glossary and abbreviations sections become candidate terms of a folio-glossary/v1 scheme with the Tool glossary-from-source, verbatim, each with source file#line, and an acronym as the notation of the term it expands.
- Record it: `workflow_complete` with `node: "Task_Glossary"`.
- next: → `Task_References` (Extract reference lists)

### 6. Extract reference lists (`Task_References`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: Each reference list of the source (a References, Bibliography or Further reading section, in any of the six UN languages) becomes folio-reference/v1 nodes with the Tool references-extract: one node per cited work, provenance extracted, derivedFrom the section it was read from, and printed the entry 
- Record it: `workflow_complete` with `node: "Task_References"`.
- next: → `Task_Link` (Link L1 nodes into the corpus graph)

### 7. Link L1 nodes into the corpus graph (`Task_Link`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Anything in library/ is L1 source content.
- Record it: `workflow_complete` with `node: "Task_Link"`.
- next: → `EndEvent_KgBuilt` (L1 graph built)

## Done — L1 graph built (`EndEvent_KgBuilt`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

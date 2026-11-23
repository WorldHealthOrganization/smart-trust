<!-- GENERATED from folio-assistant-core/processes/library/ingest-derive-content.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ingestion subprocess — derive content from the assets

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/ingest-derive-content.bpmn` (process `Process_DeriveContent`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Derive content from an ingested source's assets: the archive, technical metadata, figures and tables, images, audio, tabular data, footnotes and provenance.

## Begin — Assets in hand (`StartEvent_Assets`)

- Begin here.
- Call `workflow_start` with `process: "Process_DeriveContent"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_Fan` (Per asset kind)

### Do all of — Per asset kind (`Gateway_Fan`)

- Work every branch; none is optional. Branches: → `Task_Archive` (Archive → greppable contents manifest), → `Task_TechMeta` (File info, sizes, hashes, timestamps, mimetype), → `Task_FiguresTables` (Extract figures and tables), → `Task_Audio` (Transcribe and translate audio), → `Task_Tabular` (Sheet names, headers, shape, narrative), → `Task_Footnotes` (Footnotes and the marks that call them)
- The engine passes through this gateway itself; there is nothing to record here.

### 1. Archive → greppable contents manifest (`Task_Archive`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: NOT IMPLEMENTED; see docs/document-ingestion.md.
- Record it: `workflow_complete` with `node: "Task_Archive"`.
- next: → `Gateway_Join` (All kinds done)

### 2. File info, sizes, hashes, timestamps, mimetype (`Task_TechMeta`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: NOT IMPLEMENTED; see docs/document-ingestion.md.
- Record it: `workflow_complete` with `node: "Task_TechMeta"`.
- next: → `Gateway_Join` (All kinds done)

### 3. Extract figures and tables (`Task_FiguresTables`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: The pdf-images.py, pdf-vector-labels.py and pdf-vector-figures.py arms extract the raster images and the figures drawn as vectors (grouped and rendered).
- Record it: `workflow_complete` with `node: "Task_FiguresTables"`.
- next: → `Task_Image` (Narrative description per image, localized)

### 4. Transcribe and translate audio (`Task_Audio`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: No Tool yet; the method, and the choice of recogniser, is skill audio-transcription.
- Record it: `workflow_complete` with `node: "Task_Audio"`.
- next: → `Gateway_Join` (All kinds done)

### 5. Sheet names, headers, shape, narrative (`Task_Tabular`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Tools tabular-csv and tabular-xlsx, as CSVW (skill tabular-metadata).
- Record it: `workflow_complete` with `node: "Task_Tabular"`.
- next: → `Gateway_Join` (All kinds done)

### 6. Footnotes and the marks that call them (`Task_Footnotes`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: The pdf-footnotes.py arm (owner, 2026-11-11, "also foot notes/marks"): from the page layout, each note at the foot of a page and every superscript mark in the text that calls it, written to footnotes.json (folio-document-footnotes/v1) with the block that holds the page.
- Record it: `workflow_complete` with `node: "Task_Footnotes"`.
- next: → `Gateway_Join` (All kinds done)

### Wait for all — All kinds done (`Gateway_Join`)

- Continue only when every one of the 6 incoming branches is done; the engine passes through itself.
- next: → `Task_Provenance` (Cite the author of every narrative)

### 7. Narrative description per image, localized (`Task_Image`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Applies equally to an image EXTRACTED FROM A PDF (Task_FiguresTables), not only to an uploaded one.
- Record it: `workflow_complete` with `node: "Task_Image"`.
- next: → `Gateway_Join` (All kinds done)

### 8. Cite the author of every narrative (`Task_Provenance`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: A generated description is a claim by someone.
- Record it: `workflow_complete` with `node: "Task_Provenance"`.
- next: → `EndEvent_Derived` (Derived)

## Done — Derived (`EndEvent_Derived`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

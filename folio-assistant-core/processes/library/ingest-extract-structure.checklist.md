<!-- GENERATED from folio-assistant-core/processes/library/ingest-extract-structure.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ingestion subprocess — extract structure

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/ingest-extract-structure.bpmn` (process `Process_ExtractStructure`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Extract the structure of an uploaded source: its text layer, OCR where it has none or where a page's text layer fails the page check, sections, structure and claim candidates.

## Begin — Binary in hand (`StartEvent_Binary`)

- Begin here.
- Call `workflow_start` with `process: "Process_ExtractStructure"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_HasText` (Embedded text layer?)

### Decide — Embedded text layer? (`Gateway_HasText`)

- Does the binary carry an embedded text layer?
- Call `workflow_complete` with `node: "Gateway_HasText"` and `outcome` set to the label that holds:
  - «yes» → `Task_ExtractText` (Extract the text layer)
  - «no — scanned» → `Task_Ocr` (OCR to ocr/page-*.txt)

### 1. Extract the text layer (`Task_ExtractText`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: The document has a text layer: extract it with pdf-extract (pdfminer.six, then a zero-dependency content-stream reader).
- Record it: `workflow_complete` with `node: "Task_ExtractText"`.
- next: → `Task_PageCheck` (Check each page; OCR pages that fail)

### 2. OCR to ocr/page-*.txt (`Task_Ocr`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Each page is read in the document's languages (--lang-hint, from dc.language.iso), narrowed to the script the page shows.
- Record it: `workflow_complete` with `node: "Task_Ocr"`.
- next: → `Task_Sections` (Split into sections/*.md with doc_brief front-matter)

### 3. Check each page; OCR pages that fail (`Task_PageCheck`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `l1-document-ingestion`.
- What: Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "force OCR when a page's text layer fails a quality check".
- Record it: `workflow_complete` with `node: "Task_PageCheck"`.
- next: → `Task_Sections` (Split into sections/*.md with doc_brief front-matter)

### 4. Split into sections/*.md with doc_brief front-matter (`Task_Sections`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Contextual retrieval: a chunk in isolation loses what makes it mean anything, so each section carries the document brief.
- Record it: `workflow_complete` with `node: "Task_Sections"`.
- next: → `Task_Structure` (Write structure.json)

### 5. Write structure.json (`Task_Structure`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Write structure.json (pdf-structure/v1): doc id, TOC from the PDF outline or inferred from headings, page ranges, metadata, and source{} with the sha256 and a mimetype sniffed from the bytes, never the extension.
- Record it: `workflow_complete` with `node: "Task_Structure"`.
- next: → `Task_Candidates` (Extract claim candidates)

### 6. Extract claim candidates (`Task_Candidates`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: candidates.json holds extracted theorems and definitions.
- Record it: `workflow_complete` with `node: "Task_Candidates"`.
- next: → `EndEvent_Structured` (Structured)

## Done — Structured (`EndEvent_Structured`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

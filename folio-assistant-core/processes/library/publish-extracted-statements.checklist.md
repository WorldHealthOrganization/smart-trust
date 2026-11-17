<!-- GENERATED from folio-assistant-core/processes/library/publish-extracted-statements.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Publish extracted statements with source links

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/publish-extracted-statements.bpmn` (process `Process_PublishExtractedStatements`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Makes every statement extracted from a library source readable, with a link back to where it came from, in the folio's working artifact AND in the shared extraction viewer, and keeps the pages current.

## Begin — Sources added to the artifact (`StartEvent_Statements`)

- Begin here.
- Call `workflow_start` with `process: "Process_PublishExtractedStatements"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Collect` (Collect each statement with its source section)

### 1. Collect each statement with its source section (`Task_Collect`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `publish-extracted-statements`.
- What: For every statement extracted from the library entries the artifact draws on, read three things off files: the statement verbatim, the library entry it came from, and the section of that entry, as a library reference (layer, library id, section id).
- Record it: `workflow_complete` with `node: "Task_Collect"`.
- next: → `Gateway_Any` (Any statements?)

### Decide — Any statements? (`Gateway_Any`)

- A referenced source, a dataset or a source with no normative content yields none.
- Call `workflow_complete` with `node: "Gateway_Any"` and `outcome` set to the label that holds:
  - «yes» → `Task_RenderArtifact` (Render them in the artifact's own pages)
  - «none» → `EndEvent_Nothing` (Nothing to publish)

### 2. Render them in the artifact's own pages (`Task_RenderArtifact`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `publish-extracted-statements`.
- What: The statements are written into pages of the folio's working artifact, so a reader of the artifact finds them without leaving it.
- Record it: `workflow_complete` with `node: "Task_RenderArtifact"`.
- next: → `Task_RenderViewer` (Publish them in the shared viewer)

## Done — Nothing to publish (`EndEvent_Nothing`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Publish them in the shared viewer (`Task_RenderViewer`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `publish-extracted-statements`.
- What: The same statements, with the same two links, are published in the shared extraction viewer, reachable from the site's sources menu.
- Record it: `workflow_complete` with `node: "Task_RenderViewer"`.
- next: → `Task_CheckCurrent` (Check pages are current, links resolve)

### 4. Check pages are current, links resolve (`Task_CheckCurrent`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `publish-extracted-statements`.
- What: The generator's check mode regenerates in memory and fails on any difference from the committed pages, and on any source link that does not resolve.
- Record it: `workflow_complete` with `node: "Task_CheckCurrent"`.
- next: → `EndEvent_Published` (Statements published with source links)

## Done — Statements published with source links (`EndEvent_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

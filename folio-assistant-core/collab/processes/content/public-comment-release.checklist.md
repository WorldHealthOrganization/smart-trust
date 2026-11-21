<!-- GENERATED from folio-assistant-core/collab/processes/content/public-comment-release.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Release a draft for public comment

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/public-comment-release.bpmn` (process `Process_PublicCommentRelease`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The whole public comment cycle around the comments themselves.

## Begin — Draft ready for public comment (`StartEvent_DraftReady`)

- Begin here: The draft has passed publication QA and been circulated (Process_Publication), and the review committee decides it should go out for public comment.
- Call `workflow_start` with `process: "Process_PublicCommentRelease"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_AgreeReleaseDate` (Agree the release date and comment period)

### 1. Agree the release date and comment period (`Task_AgreeReleaseDate`)

- Who: the `Review committee and editor` lane (role `review-coordinator`).
- Skill: `public-comment`.
- What: The review committee and the editor agree when the public comment release goes out and when comment closes.
- Record it: `workflow_complete` with `node: "Task_AgreeReleaseDate"`.
- next: → `Task_BuildPcRelease` (Build the public comment release)

### 2. Build the public comment release (`Task_BuildPcRelease`)

- Who: the `Release build and archive (pipeline)` lane (role `build-pipeline`).
- Skill: `document-publishing`.
- What: Freeze the draft as "Draft for Public Comment Release vX": a PDF with fixed line numbers and a site copy under a permanent PC/<version>/ path (not branches/, never deleted on merge).
- Record it: `workflow_complete` with `node: "Task_BuildPcRelease"`.
- next: → `Task_SetUpChannels` (Set up the comment channels, with instructions and links)

### 3. Set up the comment channels, with instructions and links (`Task_SetUpChannels`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment-channels`, `public-comment`, `review-sheet-script`.
- What: Before anything is sent, the editor sets up each channel the review will use: the review sheet, the GitHub issue forms, an offline Excel sheet and a Google Form, each constrained to the release's fixed references, with precise instructions, all links, and how submitters are recorded.
- Record it: `workflow_complete` with `node: "Task_SetUpChannels"`.
- next: → `Task_WriteAnnouncement` (Write the announcement, with links)

### 4. Write the announcement, with links (`Task_WriteAnnouncement`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment-channels`, `public-comment`.
- What: A short communication for the public: what is under review, the comment period, a high-level description of the process, and links to the release, every channel and the published process.
- Record it: `workflow_complete` with `node: "Task_WriteAnnouncement"`.
- next: → `Task_Distribute` (Distribute to the public)

### 5. Distribute to the public (`Task_Distribute`)

- Who: the `Review committee and editor` lane (role `review-coordinator`).
- Skill: `public-comment`.
- What: The committee and the editor send the announcement through their channels.
- Record it: `workflow_complete` with `node: "Task_Distribute"`.
- next: → `CallActivity_PublicComment` (Public comment on the release)

### 6. Public comment on the release (`CallActivity_PublicComment`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: Each comment that comes back through any channel is ingested and placed, triaged, grouped by theme into change sets, recommended on by the committee and decided by the editor (Process_PublicComment).
- A subprocess (`Process_PublicComment`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_ArchiveRelease` (Archive the release with the review)

### 7. Archive the release with the review (`Task_ArchiveRelease`)

- Who: the `Release build and archive (pipeline)` lane (role `build-pipeline`).
- Skill: `document-publishing`.
- What: When comment closes, the release (PDF, PC/<version> site and the channel exports) is archived with the review record, so every comment's citation can still be followed.
- Record it: `workflow_complete` with `node: "Task_ArchiveRelease"`.
- next: → `EndEvent_Closed` (Comment closed, release archived)

## Done — Comment closed, release archived (`EndEvent_Closed`)

- The instance completes here: The public comment period is over and its release is archived. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

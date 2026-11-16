<!-- GENERATED from folio-assistant-core/collab/processes/content/authoring-a-document.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Authoring a document

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/authoring-a-document.bpmn` (process `Process_DocumentAuthoring`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a document folio — structured prose and policy guidance, with no Lean and no required TeX — is authored, built and reviewed end to end.

## Begin — New document (`StartEvent_NewDocument`)

- Begin here.
- Call `workflow_start` with `process: "Process_DocumentAuthoring"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Plan` (Plan the document)

### 1. Plan the document (`Task_Plan`)

- Who: the `Author (person)` lane (role `author`).
- Skill: `content-plan`.
- What: Scope it: chapters, the blocks each needs, which statements are normative.
- Record it: `workflow_complete` with `node: "Task_Plan"`.
- next: → `Call_BeanOpen` (Open the bean)

### 2. Open the bean (`Call_BeanOpen`)

- Who: the `Work plan (beans)` lane (role `work-plan`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_SeedPlan` (Seed the work plan)
  - «not yours» → `End_BeanNotYours` (Not yours: left alone)

### 3. Seed the work plan (`Task_SeedPlan`)

- Who: the `Work plan (beans)` lane (role `work-plan`).
- Skill: `todo-manager`.
- What: The plan becomes beans, so a resumed session or a sibling agent can pick it up.
- Shared step `GT_SeedWorkPlan`.
- Record it: `workflow_complete` with `node: "Task_SeedPlan"`.
- next: → `Task_Scaffold` (Scaffold the folio)

## Done — Not yours: left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Scaffold the folio (`Task_Scaffold`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `document-structure`.
- What: folio_init writes content/, uploads/, library/, the manifests, the builder shim and AGENTS.md.
- Record it: `workflow_complete` with `node: "Task_Scaffold"`.
- next: → `Task_AuthorBlocks` (Author blocks)

### 5. Author blocks (`Task_AuthorBlocks`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `document-authoring`, `normative-statements`.
- What: Every block edit runs the HCI validation gate — see editing-hci-validation.bpmn.
- Record it: `workflow_complete` with `node: "Task_AuthorBlocks"`.
- next: → `Task_ProfileCheck` (Check the profile)

### 6. Check the profile (`Task_ProfileCheck`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `content-validate`.
- What: content_profile_check: no math kind, no lean field, no .lean sibling.
- Record it: `workflow_complete` with `node: "Task_ProfileCheck"`.
- next: → `Gateway_ProfileClean` (Within the declared profile?)

### Decide — Within the declared profile? (`Gateway_ProfileClean`)

- Answered by the profile check: does every block stay within the folio's declared content profile?
- Call `workflow_complete` with `node: "Gateway_ProfileClean"` and `outcome` set to the label that holds:
  - «violations» → `Task_AuthorBlocks` (Author blocks)
  - «clean» → `Task_Validate` (Validate)

### 7. Validate (`Task_Validate`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `content-validate`.
- What: Schema and constraint checks over every block.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `Call_PublishStatements` (Publish extracted statements)

### 8. Publish extracted statements (`Call_PublishStatements`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `publish-extracted-statements`.
- What: The document draws on library sources; every statement extracted from them is published in the document's own pages and in the shared extraction viewer, each linked to its library entry and section, before the document is rendered.
- A subprocess (`Process_PublishExtractedStatements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Render` (Render MD, HTML and PDF)

### 9. Render MD, HTML and PDF (`Task_Render`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `document-publishing`.
- What: Assemble to Markdown, then pandoc.
- Record it: `workflow_complete` with `node: "Task_Render"`.
- next: → `Call_ReviewPublish` (Review and publish)

### 10. Review and publish (`Call_ReviewPublish`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `content-review`.
- What: Core's shared review-and-publish process (Process_FolioReviewPublish): the reviewer reads the rendered folio and approves it, asks for changes, or sends a working draft to the Authoring Committee.
- A subprocess (`Process_FolioReviewPublish`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Published` (Published?)

### Decide — Published? (`GW_Published`)

- Reads which end Process_FolioReviewPublish reached.
- Call `workflow_complete` with `node: "GW_Published"` and `outcome` set to the label that holds:
  - «yes» → `Call_BeanClose` (Close the bean)
  - «no» → `Task_AuthorBlocks` (Author blocks)

### 11. Close the bean (`Call_BeanClose`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Published` (Document published)

## Done — Document published (`EndEvent_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

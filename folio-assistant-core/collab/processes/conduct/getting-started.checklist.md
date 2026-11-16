<!-- GENERATED from folio-assistant-core/collab/processes/conduct/getting-started.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Getting started

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/conduct/getting-started.bpmn` (process `Process_GettingStarted`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Somebody said "create a folio": work out which request they meant, with the branch computed by a decision table that may answer "ask", and what has to be true before anything is written, through to a live site.

## Begin — "create a folio" (`StartEvent_AskToStart`)

- Begin here.
- Call `workflow_start` with `process: "Process_GettingStarted"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DetectModality` (Detect the interaction modality)

### 1. Detect the interaction modality (`Task_DetectModality`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `interaction-modality`.
- What: Before the first question is asked, establish HOW to ask it: audio, ordinary chat, selectable options for a user with limited hand function, large-type for low vision.
- Record it: `workflow_complete` with `node: "Task_DetectModality"`.
- next: → `Task_ReadFacts` (Read the repository facts)

### 2. Read the repository facts (`Task_ReadFacts`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `getting-started`.
- What: Mechanical, read-only: does the layer's config (its `index.config.json` entry; a legacy `<name>.config.json` only as a fallback) declare a contentType, does the working tree hold somebody's existing project, and what has the user actually said.
- Record it: `workflow_complete` with `node: "Task_ReadFacts"`.
- next: → `Gateway_Intent` (What is the user asking for?)

### Decide — What is the user asking for? (`Gateway_Intent`)

- Computed, not chosen.
- Computed by the DMN table `decisions/folio-intent.dmn#Decision_FolioIntent`: call `workflow_complete` with `node: "Gateway_Intent"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «ask» → `Task_AskIntent` (Choose from the offered options)
  - «overlay» → `Task_ScanRepo` (Scan the repo for content worth importing)
  - «new-repo» → `Task_CreateRepo` (Create the repository)
  - «new-content» → `EndEvent_HandOff` (Handed to content authoring)
  - «add-folio» → `Task_Scaffold` (Scaffold the folio (folio_init))

### 3. Choose from the offered options (`Task_AskIntent`)

- Who: the `User (person)` lane (role `user`).
- Skill: `interaction-modality`, `getting-started`.
- What: The question is presented as a short list of selectable options, never as free prose, and the list names the top-level content types the agent knows about.
- Record it: `workflow_complete` with `node: "Task_AskIntent"`.
- next: → `Task_ReadFacts` (Read the repository facts)

### 4. Scan the repo for content worth importing (`Task_ScanRepo`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `repo-conversion`, `document-intake`.
- What: Read-only.
- Record it: `workflow_complete` with `node: "Task_ScanRepo"`.
- next: → `Task_ChooseHarnessed` (Choose what the harness reads)

### 5. Create the repository (`Task_CreateRepo`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `repo-conversion`.
- What: Only on the new-repo branch, and only after the user has named it.
- Record it: `workflow_complete` with `node: "Task_CreateRepo"`.
- next: → `Task_Scaffold` (Scaffold the folio (folio_init))

## Done — Handed to content authoring (`EndEvent_HandOff`)

- The instance completes here: The misspeak case. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Scaffold the folio (folio_init) (`Task_Scaffold`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `getting-started`.
- What: content/, uploads/, library/, the first manifests, <slug>.json and index.config.json (the layer's config inline in its entry; no <slug>.config.json), the builder shim, AGENTS.md with its stubs, .mcp.json, the session-start hook and the beans store.
- Record it: `workflow_complete` with `node: "Task_Scaffold"`.
- next: → `Call_BeanOpen` (Open the bean)

### 7. Choose what the harness reads (`Task_ChooseHarnessed`)

- Who: the `User (person)` lane (role `user`).
- Skill: `repo-conversion`, `interaction-modality`.
- What: A PERSON'S STEP: the scan's `markers` that are not yet declared are offered as selectable options — one per marker, each with its paths and what declaring it means, plus "none of these" — and the person picks which parts of the repository to load into the KG.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_ConfirmImport` (Import what, where, and who does it)

### 8. Open the bean (`Call_BeanOpen`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### 9. Import what, where, and who does it (`Task_ConfirmImport`)

- Who: the `User (person)` lane (role `user`).
- Skill: `repo-conversion`, `dispatch-agent`.
- What: Three questions the scan cannot answer: import these or not; library or content for each group; leave the files where they are or reorganize to declutter.
- Record it: `workflow_complete` with `node: "Task_ConfirmImport"`.
- next: → `Task_Scaffold` (Scaffold the folio (folio_init))

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_SeedPlan` (Seed the work plan)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 10. Seed the work plan (`Task_SeedPlan`)

- Who: the `Onboarding agent (system)` lane (role `onboarding-agent`).
- Skill: `todo-manager`.
- What: The first beans: what the author said they want to get started on, one bean per top-level content object they named.
- Record it: `workflow_complete` with `node: "Task_SeedPlan"`.
- next: → `Task_ProvisionGhPages` (Provision gh-pages)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Provision gh-pages (`Task_ProvisionGhPages`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `getting-started`.
- What: Before Pages is switched on, make sure the gh-pages branch exists — the semantics of A_Provision in bootstrap-tools' render-kg-to-github-pages.bpmn, first half.
- Record it: `workflow_complete` with `node: "Task_ProvisionGhPages"`.
- next: → `Task_PagesBootstrap` (Start the Pages build and derive the URL)

### 12. Start the Pages build and derive the URL (`Task_PagesBootstrap`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `getting-started`.
- What: scripts/pages-bootstrap.ts: check the gh-pages branch first (absent is `unprovisioned`), derive the site URL from the git remote or the layer's config (its index.config.json entry), report whether a publish workflow exists and the Pages source it needs, and optionally probe until the site answers.
- Record it: `workflow_complete` with `node: "Task_PagesBootstrap"`.
- next: → `Gateway_Live` (Is the site answering?)

### Decide — Is the site answering? (`Gateway_Live`)

- Computed from decisions/pages-live-gate.dmn.
- Computed by the DMN table `decisions/pages-live-gate.dmn#Decision_PagesLive`: call `workflow_complete` with `node: "Gateway_Live"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «live» → `Task_ReportUrl` (Hand over the live link)
  - «not-yet» → `Task_ReportPending` (Say where it will be)
  - «unknown» → `Task_ReportUnknown` (Say it could not be confirmed)
  - «unprovisioned» → `Task_ProvisionGhPages` (Provision gh-pages)

### 13. Hand over the live link (`Task_ReportUrl`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `getting-started`.
- What: Confirmed live.
- Record it: `workflow_complete` with `node: "Task_ReportUrl"`.
- next: → `Call_BeanClose` (Close the bean)

### 14. Say where it will be (`Task_ReportPending`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `getting-started`.
- What: A measured 404.
- Record it: `workflow_complete` with `node: "Task_ReportPending"`.
- next: → `Call_BeanClose` (Close the bean)

### 15. Say it could not be confirmed (`Task_ReportUnknown`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `getting-started`.
- What: No URL, no probe, or a failed request.
- Record it: `workflow_complete` with `node: "Task_ReportUnknown"`.
- next: → `Call_BeanClose` (Close the bean)

### 16. Close the bean (`Call_BeanClose`)

- Who: the `Publish — GitHub Pages` lane (role `publish-target`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Ready` (Ready to author)

## Done — Ready to author (`EndEvent_Ready`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

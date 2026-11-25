<!-- GENERATED from folio-assistant-core/collab/processes/content/content-lifecycle.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Content lifecycle

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/content-lifecycle.bpmn` (process `Process_Lifecycle`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One cycle of a folio from plan to retirement, calling editing and the draft-to-publication path as call activities.

## Begin — Folio initiative (`StartEvent_Initiative`)

- Begin here.
- Call `workflow_start` with `process: "Process_Lifecycle"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Plan` (Plan scope, team, artifacts)

### 1. Plan scope, team, artifacts (`Task_Plan`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `content-plan`.
- What: Scope the work, identify artifacts and actors, form the team, set the timeline.
- Record it: `workflow_complete` with `node: "Task_Plan"`.
- next: → `Call_BeanOpen` (Open the bean)

### 2. Open the bean (`Call_BeanOpen`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_SeedBeans` (Seed the work plan)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 3. Seed the work plan (`Task_SeedBeans`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `todo-manager`.
- What: The plan becomes beans, so a resumed session or a sibling agent can pick it up.
- Shared step `GT_SeedWorkPlan`.
- Record it: `workflow_complete` with `node: "Task_SeedBeans"`.
- next: → `CallActivity_Editing` (Editing and HCI validation)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Editing and HCI validation (`CallActivity_Editing`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `content-author`, `content-validate`, `content-review`.
- What: See editing-hci-validation.bpmn.
- A subprocess (`Process_Editing`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Test` (Integration test and QA sweep)

### 5. Integration test and QA sweep (`Task_Test`)

- Who: the `Validation and QA (mechanical + agents)` lane (role `validation-pipeline`).
- Skill: `content-test`.
- What: Corpus-wide checks that a single-block gate cannot make: cross-references, build green, proof status, QA axes across the whole folio.
- Record it: `workflow_complete` with `node: "Task_Test"`.
- next: → `CallActivity_Publication` (Draft, review and publish)

### 6. Draft, review and publish (`CallActivity_Publication`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `content-review`, `content-publish`.
- What: See draft-to-publication.bpmn.
- A subprocess (`Process_Publication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Feedback` (Triage published feedback)

### 7. Triage published feedback (`Task_Feedback`)

- Who: the `Review team and SMEs` lane (role `reviewer`).
- Skill: `content-feedback`.
- What: Implementer and reader feedback on the published folio, triaged by severity and scope.
- Record it: `workflow_complete` with `node: "Task_Feedback"`.
- next: → `Task_FeedbackBeans` (File feedback as beans)

### 8. File feedback as beans (`Task_FeedbackBeans`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `todo-manager`, `content-feedback`.
- What: Triaged feedback re-enters the work plan as beans, which is how the next cycle knows what it is for.
- Record it: `workflow_complete` with `node: "Task_FeedbackBeans"`.
- next: → `Gateway_NextCycle` (More content?)

### Decide — More content? (`Gateway_NextCycle`)

- Asked after feedback is filed as beans: is there more content to write for this folio?
- Call `workflow_complete` with `node: "Gateway_NextCycle"` and `outcome` set to the label that holds:
  - «yes» → `CallActivity_Editing` (Editing and HCI validation)
  - «no» → `Task_Retire` (Retire or archive)

### 9. Retire or archive (`Task_Retire`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `content-retire`.
- What: No more content is planned: deprecate the folio.
- Record it: `workflow_complete` with `node: "Task_Retire"`.
- next: → `Call_BeanClose` (Close the bean)

### 10. Close the bean (`Call_BeanClose`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Retired` (Folio retired)

## Done — Folio retired (`EndEvent_Retired`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

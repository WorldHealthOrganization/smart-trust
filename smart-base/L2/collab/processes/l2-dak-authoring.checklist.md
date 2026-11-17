<!-- GENERATED from smart-base/L2/collab/processes/l2-dak-authoring.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — L2 DAK authoring

> **Generated, and not the authority.** This is `smart-base/L2/collab/processes/l2-dak-authoring.bpmn` (process `Process_L2Dak`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a WHO SMART Guidelines L2 Digital Adaptation Kit is authored by a business analyst, a terminologist and a clinical SME under a programme manager.

## Begin — WHO guideline / recommendations (`StartEvent_Guideline`)

- Begin here.
- Call `workflow_start` with `process: "Process_L2Dak"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ScopeDak` (Scope the DAK)

### 1. Scope the DAK (`Task_ScopeDak`)

- Who: the `Programme manager / technical officer` lane (role `programme-manager`).
- Skill: `content-plan`.
- What: Enumerate the processes, decisions and data elements the guideline implies; identify the actors.
- Record it: `workflow_complete` with `node: "Task_ScopeDak"`.
- next: → `Task_L1Library` (Build the L1 library from Component 1)

### 2. Build the L1 library from Component 1 (`Task_L1Library`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `dak-l1-library`.
- What: Ingest the DAK into the library; it is L2, so it gets no L1 graph.
- Record it: `workflow_complete` with `node: "Task_L1Library"`.
- next: → `Call_PublishStatements` (Publish extracted statements)

### 3. Publish extracted statements (`Call_PublishStatements`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `publish-extracted-statements`.
- What: Statements extracted from the Component 1 sources are published as pages of the DAK and in the shared l1-extraction viewer, each linked to its library entry and section, before L2 authoring starts from them.
- A subprocess (`Process_PublishExtractedStatements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_BeanOpen` (Open the bean)

### 4. Open the bean (`Call_BeanOpen`)

- Who: the `Work plan — beans (shared by humans and agents)` lane (role `work-plan`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before creating, find out whose the bean is, and claim it, or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- `claimed`: the bean is in progress and this process works it.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_SeedBeans` (Seed the work plan)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 5. Seed the work plan (`Task_SeedBeans`)

- Who: the `Work plan — beans (shared by humans and agents)` lane (role `work-plan`).
- Skill: `todo-manager`.
- What: Turn the scope into child beans of the DAK's bean, one per DAK component: the DAK's work plan holds the work plan of each component.
- Record it: `workflow_complete` with `node: "Task_SeedBeans"`.
- next: → `Gateway_AuthorMerge`

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Merge — `Gateway_AuthorMerge`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_AuthorFork`

### Do all of — `Gateway_AuthorFork`

- Work every branch; none is optional. Branches: → `Task_Personas` (Personas and scenarios), → `Task_Bpmn` (Business processes · BPMN 2.0), → `Task_DataDict` (Data dictionary and core data elements), → `Task_Indicators` (Indicators and requirements), → `Task_Terminology` (Terminology bindings), → `Task_Dmn` (Decision logic · DMN tables)
- The engine passes through this gateway itself; there is nothing to record here.

### 6. Personas and scenarios (`Task_Personas`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `l2-component-edit-review`.
- What: Author the DAK's personas and the user scenarios they appear in.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### 7. Business processes · BPMN 2.0 (`Task_Bpmn`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `bpmn-authoring`, `l2-component-edit-review`.
- What: Author the DAK's L2 business processes as BPMN 2.0 with Diagram Interchange: a .bpmn with no x/y on its shapes renders blank.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### 8. Data dictionary and core data elements (`Task_DataDict`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `l2-component-edit-review`.
- What: Author the data dictionary and core data elements: structured but not FHIR, reviewable by a clinician, so L3 can be derived from them rather than written twice.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### 9. Indicators and requirements (`Task_Indicators`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `indicator-extraction`, `l2-component-edit-review`.
- What: Author the indicators and the functional and non-functional requirements.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### 10. Terminology bindings (`Task_Terminology`)

- Who: the `Terminologist` lane (role `terminologist`).
- Skill: `terminology-management`, `l2-component-edit-review`.
- What: ICD-11, SNOMED CT and LOINC bindings, governed separately from the artefacts that cite them.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### 11. Decision logic · DMN tables (`Task_Dmn`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `dmn-authoring`, `l2-component-edit-review`.
- What: Author the decision and scheduling logic as DMN tables within the FEEL subset the interpreter implements (any, literals, comparisons, one-of); ranges, not() and function calls are refused at load.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_AuthorJoin`

### Wait for all — `Gateway_AuthorJoin`

- Continue only when every one of the 6 incoming branches is done; the engine passes through itself.
- next: → `Gateway_ReviewFork`

### Do all of — `Gateway_ReviewFork`

- Work every branch; none is optional. Branches: → `Task_SmeValidate` (Clinical validation), → `Task_AssembleDak` (Assemble and validate the DAK)
- The engine passes through this gateway itself; there is nothing to record here.

### 12. Clinical validation (`Task_SmeValidate`)

- Who: the `Clinical SME` lane (role `clinical-sme`).
- Skill: `content-review`.
- What: Ground truth: does the DAK say what the guideline says?
- Record it: `workflow_complete` with `node: "Task_SmeValidate"`.
- next: → `Gateway_Accurate` (Clinically accurate?)

### 13. Assemble and validate the DAK (`Task_AssembleDak`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `content-validate`.
- What: Assemble the validated components and run content validation: schemas, cross-component consistency and terminology bindings.
- Record it: `workflow_complete` with `node: "Task_AssembleDak"`.
- next: → `Call_BeanClose` (Close the bean)

### Decide — Clinically accurate? (`Gateway_Accurate`)

- `changes needed` goes back to the author and the reworked DAK is assembled again; `validated` records the adjudication.
- Call `workflow_complete` with `node: "Gateway_Accurate"` and `outcome` set to the label that holds:
  - «changes needed» → `Gateway_AuthorMerge`
  - «validated» → `Call_BeanClose_2` (Close the bean)

### 14. Close the bean (`Call_BeanClose`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why: complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_L2Ready` (L2 DAK ready for L3)

### 15. Close the bean (`Call_BeanClose_2`)

- Who: the `Clinical SME` lane (role `clinical-sme`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why: complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Validated` (Clinically validated)

## Done — L2 DAK ready for L3 (`EndEvent_L2Ready`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Clinically validated (`EndEvent_Validated`)

- The instance completes here: The SME's adjudication is recorded. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

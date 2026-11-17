<!-- GENERATED from fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — L3 FHIR IG pipeline

> **Generated, and not the authority.** This is `fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn` (process `Process_L3Fhir`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How an L3 FHIR Implementation Guide is authored in FSH, built with SUSHI, the validator and the IG Publisher, reviewed and published, starting from a source model that is ready.

## Begin — Source model ready (`StartEvent_ModelReady`)

- Begin here: The IG's source model is ready: l3-fhir-authoring's required sourceModel.
- Call `workflow_start` with `process: "Process_L3Fhir"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_AuthorFsh` (Author FSH profiles)

### 1. Author FSH profiles (`Task_AuthorFsh`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `l3-fhir-authoring`.
- What: Write the FSH profiles, value sets and definitions the source model calls for.
- Record it: `workflow_complete` with `node: "Task_AuthorFsh"`.
- next: → `Task_Sushi` (Compile FSH to FHIR JSON)

### 2. Compile FSH to FHIR JSON (`Task_Sushi`)

- Who: the `Build pipeline — SUSHI · validator · IG Publisher` lane (role `build-pipeline`).
- Skill: `l3-fhir-authoring`.
- What: Compile the FSH to FHIR JSON with SUSHI.
- Record it: `workflow_complete` with `node: "Task_Sushi"`.
- next: → `Task_Validate` (Validate against profiles)

### 3. Validate against profiles (`Task_Validate`)

- Who: the `Build pipeline — SUSHI · validator · IG Publisher` lane (role `build-pipeline`).
- Skill: `fhir-validation`.
- What: Validate the compiled resources against their profiles and the packages they constrain.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `Gateway_Valid` (FHIR valid?)

### Decide — FHIR valid? (`Gateway_Valid`)

- Answered by validating the resources against their profiles.
- Call `workflow_complete` with `node: "Gateway_Valid"` and `outcome` set to the label that holds:
  - «no» → `Task_AuthorFsh` (Author FSH profiles)
  - «yes» → `Task_QcGates` (QC gates)

### 4. QC gates (`Task_QcGates`)

- Who: the `QC reviewer` lane (role `qc-reviewer`).
- Skill: `quality-control`.
- What: The QC reviewer rules on the aggregate QA against the publication gates.
- Record it: `workflow_complete` with `node: "Task_QcGates"`.
- next: → `Gateway_QcPass` (QC clean?)

### Decide — QC clean? (`Gateway_QcPass`)

- Answered by the QC gates.
- Call `workflow_complete` with `node: "Gateway_QcPass"` and `outcome` set to the label that holds:
  - «no» → `Task_QcBeans` (File QC findings as beans)
  - «yes» → `Call_PublishStatements` (Publish extracted statements)

### 5. File QC findings as beans (`Task_QcBeans`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `todo-manager`.
- What: Each QC finding becomes a bean on the work plan, which the modeller and the agents both see.
- Record it: `workflow_complete` with `node: "Task_QcBeans"`.
- next: → `Task_AuthorFsh` (Author FSH profiles)

### 6. Publish extracted statements (`Call_PublishStatements`)

- Who: the `Build pipeline — SUSHI · validator · IG Publisher` lane (role `build-pipeline`).
- Skill: `publish-extracted-statements`.
- What: The IG draws on library sources; every statement extracted from them is published as pages of the IG and in the shared extraction viewer, each linked to its library entry and section, before the IG Publisher builds the site.
- A subprocess (`Process_PublishExtractedStatements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_IgPublisher` (IG Publisher build)

### 7. IG Publisher build (`Task_IgPublisher`)

- Who: the `Build pipeline — SUSHI · validator · IG Publisher` lane (role `build-pipeline`).
- Skill: `ig-publication`.
- What: Run the IG Publisher: it renders output/, writes each resource's JSON, the package, canonicals and qa.json, and does the two things no cache can — validates every resource against its profiles and resolves the dependency closure with terminology expansion.
- Record it: `workflow_complete` with `node: "Task_IgPublisher"`.
- next: → `Task_PublishIg` (Publish the IG site)

### 8. Publish the IG site (`Task_PublishIg`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `content-publish`, `ig-publication`, `ig-binary-artefacts`.
- What: Release authorisation and review follow draft-to-publication.bpmn.
- Record it: `workflow_complete` with `node: "Task_PublishIg"`.
- next: → `EndEvent_IgPublished` (Published IG site)

## Done — Published IG site (`EndEvent_IgPublished`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

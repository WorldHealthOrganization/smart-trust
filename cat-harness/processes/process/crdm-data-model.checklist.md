<!-- GENERATED from cat-harness/processes/process/crdm-data-model.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM data model

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-data-model.bpmn` (process `Process_CRDM_DataModel`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Draft the data model from the BPA and the requirements, have the BA confirm the entities and the stakeholders confirm the cardinalities, and loop until both.

## Begin — Requirements agreed (`Start_Process_CRDM_DataModel`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_DataModel"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Entities` (Identify entities from the BPA and requirements)

### 1. Identify entities from the BPA and requirements (`A_Entities`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-data-model`.
- What: Every verb in the BPA whose object is a candidate entity, and every noun in a requirement.
- Record it: `workflow_complete` with `node: "A_Entities"`.
- next: → `A_Relations` (Relations and cardinalities, both ways)

### 2. Relations and cardinalities, both ways (`A_Relations`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-data-model`.
- What: Stated in both directions, because "one attestation per report" and "one report per attestation" are different claims and a model with only the first cannot say whether a re-signature is an update or a second row.
- Record it: `workflow_complete` with `node: "A_Relations"`.
- next: → `BA_ConfirmEntities` (Confirm the entities are the ones meant)

### 3. Confirm the entities are the ones meant (`BA_ConfirmEntities`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-data-model`.
- What: A naming question.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `S_ConfirmCardinality` (Confirm the cardinalities)

### 4. Confirm the cardinalities (`S_ConfirmCardinality`)

- Who: the `Stakeholders` lane (role `stakeholder`).
- Skill: `crdm-data-model`.
- What: An operational question, asked of the people who run the process because they know where the exceptions are.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Model` (Entities recognised and every cardinality answered?)

### Decide — Entities recognised and every cardinality answered? (`GW_Model`)

- Answered by the BA after confirming cardinalities: are the entities recognised and every cardinality answered?
- Call `workflow_complete` with `node: "GW_Model"` and `outcome` set to the label that holds:
  - «revise» → `A_Entities` (Identify entities from the BPA and requirements)
  - «yes» → `A_Declare` (Declare the model where a tool can read it)

### 5. Declare the model where a tool can read it (`A_Declare`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-data-model`.
- What: A model in prose is a proposal; a model in the declaration is a model.
- Record it: `workflow_complete` with `node: "A_Declare"`.
- next: → `End_Process_CRDM_DataModel` (Model declared)

## Done — Model declared (`End_Process_CRDM_DataModel`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

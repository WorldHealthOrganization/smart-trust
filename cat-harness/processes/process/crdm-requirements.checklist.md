<!-- GENERATED from cat-harness/processes/process/crdm-requirements.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM requirements

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-requirements.bpmn` (process `Process_CRDM`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A feature request turned into agreed, signed-off requirements and delivered, with one call activity per CRDM phase from issue linking to close-out.

## Begin — Need identified (`Start_BA`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM"` and the subject this run is about; keep the instance id it returns.
- next: → `BA_Submit` (Describe the need (chat, issue, discussion))

### 1. Describe the need (chat, issue, discussion) (`BA_Submit`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`.
- What: The BA describes the capability gap in their own words.
- Record it: `workflow_complete` with `node: "BA_Submit"`.
- next: → `A_Detect` (Detect feature request (crdm-detect skill))

### 2. Detect feature request (crdm-detect skill) (`A_Detect`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-detect`.
- What: Recognise the request as a platform capability change rather than content work, from crdm-detect's signals.
- Record it: `workflow_complete` with `node: "A_Detect"`.
- next: → `GW_Feature` (Feature?)

### Decide — Feature? (`GW_Feature`)

- Answered by crdm-detect: is this request a feature request, a change to the platform, rather than content work?
- Call `workflow_complete` with `node: "GW_Feature"` and `outcome` set to the label that holds:
  - «no» → `End_Content` (Continue authoring)
  - «yes» → `Call_Issue` (Link the work to an issue)

## Done — Continue authoring (`End_Content`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Link the work to an issue (`Call_Issue`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Feature work must be linked to a GitHub issue.
- A subprocess (`Process_CRDM_Issue`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Needs` (Phase 1 Needs)

### 4. Phase 1 Needs (`Call_Needs`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Identify the stakeholders, synthesise a needs statement from the sources, and loop until the BA and the stakeholders both recognise it.
- A subprocess (`Process_CRDM_Needs`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Requirements` (Phases 2–4 BPA + requirements)

### 5. Phases 2–4 BPA + requirements (`Call_Requirements`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Map the current workflow, then define the requirements and the impact they carry, and loop until approved.
- A subprocess (`Process_CRDM_Requirements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_DataModel` (Data model Entities + cardinalities)

### 6. Data model Entities + cardinalities (`Call_DataModel`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Between requirements and sign-off, and the order is the argument: requirements are statements about things, and the model says what the things ARE.
- A subprocess (`Process_CRDM_DataModel`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Signoff` (Phase 5 Plan + sign-off)

### 7. Phase 5 Plan + sign-off (`Call_Signoff`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: The approved requirements become work-plan items, the BA signs off, and the branch is announced on the issue.
- A subprocess (`Process_CRDM_Signoff`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Deliver` (Phase 6 Implement + acceptance)

### 8. Phase 6 Implement + acceptance (`Call_Deliver`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: One phase and not three, because the loops say so: an increment the BA rejects, an MVP that is not ready, and stakeholder findings all route back into implementation.
- A subprocess (`Process_CRDM_Deliver`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Close` (Close-out)

### 9. Close-out (`Call_Close`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: The stakeholders sign off, the BA confirms every criterion is met, and only then does the agent close the issue.
- A subprocess (`Process_CRDM_Close`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_CRDM` (Feature delivered)

## Done — Feature delivered (`End_CRDM`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from smart-base/L3/collab/processes/dak-l3-ig.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — L2 DAK to L3 FHIR IG

> **Generated, and not the authority.** This is `smart-base/L3/collab/processes/dak-l3-ig.bpmn` (process `Process_DakL3Ig`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a WHO SMART Guidelines L2 Digital Adaptation Kit becomes a published L3 FHIR Implementation Guide: map the DAK's L2 content to the FHIR artefacts it calls for, then run fhir-harness's generic L3 pipeline (Process_L3Fhir) with that mapping as its source model.

## Begin — L2 DAK ready (`StartEvent_L2Ready`)

- Begin here: Produced by l2-dak-authoring.bpmn (EndEvent_L2Ready).
- Call `workflow_start` with `process: "Process_DakL3Ig"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_MapL2` (Map L2 → L3)

### 1. Map L2 → L3 (`Task_MapL2`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `l3-fhir-authoring`, `l2-dak-authoring`.
- What: Each data element becomes a profile, each value set a ValueSet, each decision a PlanDefinition / Library.
- Record it: `workflow_complete` with `node: "Task_MapL2"`.
- next: → `CallActivity_L3Fhir` (L3 FHIR IG pipeline (fhir-harness))

### 2. L3 FHIR IG pipeline (fhir-harness) (`CallActivity_L3Fhir`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `l3-fhir-authoring`.
- What: fhir-harness's l3-fhir-pipeline.bpmn, from its StartEvent_ModelReady with the mapping above as the source model: author FSH, SUSHI, validate, QC, IG Publisher, publish.
- A subprocess (`Process_L3Fhir`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_IgPublished` (FHIR IG published)

## Done — FHIR IG published (`EndEvent_IgPublished`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

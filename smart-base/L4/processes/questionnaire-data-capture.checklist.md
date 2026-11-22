<!-- GENERATED from smart-base/L4/processes/questionnaire-data-capture.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Capture data with an SDC questionnaire

> **Generated, and not the authority.** This is `smart-base/L4/processes/questionnaire-data-capture.bpmn` (process `Process_QuestionnaireDataCapture`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A health worker completes one of the DAK's forms, a FHIR R4 Questionnaire conforming to Structured Data Capture, as their device renders it, and the point-of-care system turns the completed QuestionnaireResponse into the resources it stands for by the extraction the form declares (SDC $extract).

## Begin — A form is due (`Start_FormDue`)

- Begin here: The DAK's process reaches a step that records data on a form: registering a client, a visit, a referral.
- Call `workflow_start` with `process: "Process_QuestionnaireDataCapture"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Complete` (Complete the form)

### 1. Complete the form (`Task_Complete`)

- Who: the `Health worker` lane (role `health-worker`).
- Skill: `complete-sdc-questionnaire`.
- What: Complete the SDC Questionnaire as the device renders it: confirm or correct each pre-populated answer, answer every enabled required item within its constraints, and submit.
- Record it: `workflow_complete` with `node: "Task_Complete"`.
- next: → `Gateway_Extracts` (Form declares an extraction?)

### Decide — Form declares an extraction? (`Gateway_Extracts`)

- Read from the Questionnaire, not decided: an SDC extraction extension (targetStructureMap, itemExtractionContext or observationExtract) is present, or it is not.
- Call `workflow_complete` with `node: "Gateway_Extracts"` and `outcome` set to the label that holds:
  - «yes» → `Task_Extract` (Extract and save the resources)
  - «no» → `End_Stored` (Response stored)

### 2. Extract and save the resources (`Task_Extract`)

- Who: the `Point-of-care system` lane (role `point-of-care-system`).
- Skill: `extract-questionnaire-response`.
- What: Run SDC $extract by the method the Questionnaire declares and save the resulting transaction Bundle whole, queued when offline.
- Record it: `workflow_complete` with `node: "Task_Extract"`.
- next: → `End_Extracted` (Resources saved)

## Done — Response stored (`End_Stored`)

- The instance completes here: The form declares no extraction: the QuestionnaireResponse itself is the record. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Resources saved (`End_Extracted`)

- The instance completes here: The client's resources, and the response they came from, are in the record. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

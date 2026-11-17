<!-- GENERATED from cat-harness/processes/process/crdm-close.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM close-out

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-close.bpmn` (process `Process_CRDM_Close`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The stakeholders sign off, the BA confirms every criterion is met, the feature lands on `main` through the `merge-to-main` sub-process, and only then does the agent close the issue.

## Begin — Phase begins (`Start_Process_CRDM_Close`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Close"` and the subject this run is about; keep the instance id it returns.
- next: → `S_FeatureSignoff` (Feature sign-off on issue)

### 1. Feature sign-off on issue (`S_FeatureSignoff`)

- Who: the `Stakeholders` lane (role `stakeholder`).
- What: Stakeholders sign off on the delivered feature on the issue, having tested the built artefact rather than a description of it.
- Record it: `workflow_complete` with `node: "S_FeatureSignoff"`.
- next: → `BA_Confirm` (Confirm all criteria met)

### 2. Confirm all criteria met (`BA_Confirm`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `adjudication`.
- What: The business analyst confirms every acceptance criterion from the requirements is met.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_RecordSignoff` (Record the sign-off attestation)

### 3. Record the sign-off attestation (`A_RecordSignoff`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `adjudication`.
- What: THE RECORD, and not relaxable, because a judgement nobody wrote down is indistinguishable from one never made (`adjudication`, A_RecordEntry).
- Shared step `GT_RecordSignoff`.
- Record it: `workflow_complete` with `node: "A_RecordSignoff"`.
- next: → `GW_SignoffRecorded` (Sign-off on the record?)

### Decide — Sign-off on the record? (`GW_SignoffRecorded`)

- Computed, never chosen: `decisions/requirement-signoff-recorded.dmn` reads `signoffRecorded` and `signoffOutcome`, which `check:requirements` prints from the set's recorded sign-offs (its signoff-facts flag).
- Computed by the DMN table `decisions/requirement-signoff-recorded.dmn#Decision_RequirementSignoffRecorded`: call `workflow_complete` with `node: "GW_SignoffRecorded"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «proceed» → `Call_MergeToMain` (Land the feature's PRs)
  - «stop» → `End_NotAccepted` (Not accepted — recorded, with its reason)
  - «missing» → `A_RecordSignoff` (Record the sign-off attestation)

### 4. Land the feature's PRs (`Call_MergeToMain`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: Phase 6's "explicit confirmation before merging to main", made a step that can refuse.
- Record it: `workflow_complete` with `node: "Call_MergeToMain"`.
- next: → `A_Close` (Close issue ONLY on BA authorisation)

## Done — Not accepted — recorded, with its reason (`End_NotAccepted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Close issue ONLY on BA authorisation (`A_Close`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Reachable only through BA_Confirm, which is the BA saying every criterion is met.
- Record it: `workflow_complete` with `node: "A_Close"`.
- next: → `End_Process_CRDM_Close` (Phase complete)

## Done — Phase complete (`End_Process_CRDM_Close`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

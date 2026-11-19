<!-- GENERATED from cat-harness/processes/process/crdm-signoff.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM Phase 5 — beans and sign-off

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-signoff.bpmn` (process `Process_CRDM_Signoff`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The approved requirements become work-plan items, the BA signs off, and the branch is announced on the issue.

## Begin — Phase begins (`Start_Process_CRDM_Signoff`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Signoff"` and the subject this run is about; keep the instance id it returns.
- next: → `A_CreateBeans` (Phase 5: Create beans)

### 1. Phase 5: Create beans (`A_CreateBeans`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: The agent mints the implementation beans itself with `beans create`, running the exact-title existence check first.
- Record it: `workflow_complete` with `node: "A_CreateBeans"`.
- next: → `BA_Signoff` (Sign off on requirements)

### 2. Sign off on requirements (`BA_Signoff`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `adjudication`.
- What: The business analyst / requester signs off on the agreed requirement set, on the issue: what was agreed and what was deferred.
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
  - «proceed» → `A_OfferKg` (Offer KG destinations for the agreed set)
  - «stop» → `End_SignoffStopped` (Not approved — recorded, with its reason)
  - «missing» → `A_RecordSignoff` (Record the sign-off attestation)

### 4. Offer KG destinations for the agreed set (`A_OfferKg`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `kg-contribution-offer`.
- What: Without this step, agreed and signed-off requirements exist only as an issue and a conversation, and the knowledge graph never learns them.
- Record it: `workflow_complete` with `node: "A_OfferKg"`.
- next: → `BA_ChooseKg` (Choose a destination, or none)

## Done — Not approved — recorded, with its reason (`End_SignoffStopped`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Choose a destination, or none (`BA_ChooseKg`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `kg-contribution-offer`.
- What: A PERSON'S STEP, and `none` is one of the answers rather than a refusal to answer.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_KgChosen` (A destination?)

### Decide — A destination? (`GW_KgChosen`)

- Drawn as a branch rather than folded into the task above, because `none` being a real outcome is the property worth being able to see.
- Call `workflow_complete` with `node: "GW_KgChosen"` and `outcome` set to the label that holds:
  - «a graph» → `A_RecordKg` (Run placement, file a bean)
  - «none — recorded
as an answer» → `A_AnnounceBranch` (Announce the branch on the issue)

### 6. Run placement, file a bean (`A_RecordKg`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `placement`.
- What: The offer produces a DECISION, not a node.
- Record it: `workflow_complete` with `node: "A_RecordKg"`.
- next: → `A_AnnounceBranch` (Announce the branch on the issue)

### 7. Announce the branch on the issue (`A_AnnounceBranch`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: On CREATING the feature branch, comment on the issue: the branch name, the process and phase, and the beans claimed.
- Record it: `workflow_complete` with `node: "A_AnnounceBranch"`.
- next: → `End_Process_CRDM_Signoff` (Phase complete)

## Done — Phase complete (`End_Process_CRDM_Signoff`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

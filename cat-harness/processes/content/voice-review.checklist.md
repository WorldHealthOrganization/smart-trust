<!-- GENERATED from cat-harness/processes/content/voice-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Voice overlay review

> **Generated, and not the authority.** This is `cat-harness/processes/content/voice-review.bpmn` (process `Process_VoiceReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The voice axis: load whichever editorial voices are active, run each rule's mechanical half, and decide — for each finding — whether the prose is wrong, the rule does not apply to this content, or this block is a stated exception.

## Begin — Base voice adjudicated (`Start_BaseVoiceDone`)

- Begin here.
- Call `workflow_start` with `process: "Process_VoiceReview"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_AnyActive` (Any voice activated?)

### Decide — Any voice activated? (`GW_AnyActive`)

- Is any voice activated for this block, beyond the base voice already adjudicated?
- Call `workflow_complete` with `node: "GW_AnyActive"` and `outcome` set to the label that holds:
  - «none» → `End_NoVoice` (No voice — nothing to review)
  - «one or more» → `Task_LoadActive` (Load the active voices)

## Done — No voice — nothing to review (`End_NoVoice`)

- The instance completes here: A pass, not a gap. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 1. Load the active voices (`Task_LoadActive`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: The activated set only, never everything shipped.
- Record it: `workflow_complete` with `node: "Task_LoadActive"`.
- next: → `Task_MechanicalHalf` (Run the rule's mechanical half)

### 2. Run the rule's mechanical half (`Task_MechanicalHalf`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: Whatever `patterns` and `terminology` the rule carries.
- Record it: `workflow_complete` with `node: "Task_MechanicalHalf"`.
- next: → `Task_OpenCitation` (Open the rule's citation)

### 3. Open the rule's citation (`Task_OpenCitation`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: Every rule resolves to a real `library/` section or a KG node, and carries the quote it was read from.
- Record it: `workflow_complete` with `node: "Task_OpenCitation"`.
- next: → `GW_QuoteSupports` (Does the quote support the rule?)

### Decide — Does the quote support the rule? (`GW_QuoteSupports`)

- Answered by opening the rule's citation: does the quoted source support the rule?
- Call `workflow_complete` with `node: "GW_QuoteSupports"` and `outcome` set to the label that holds:
  - «no» → `Task_RuleIsWrong` (The RULE is the defect — bean it)
  - «yes» → `Task_Adjudicate` (Adjudicate: prose, scope, or exception)

### 4. The RULE is the defect — bean it (`Task_RuleIsWrong`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: A rule its own quote does not support is a finding against the voice, not against the block.
- Record it: `workflow_complete` with `node: "Task_RuleIsWrong"`.
- next: → `GW_MoreVoices_Join`

### 5. Adjudicate: prose, scope, or exception (`Task_Adjudicate`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`, `adjudication`.
- What: The same three outcomes as the base voice axis.
- A subprocess (`Process_CriterionAdjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_MoreVoices_Join`

### Merge — `GW_MoreVoices_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_MoreVoices` (Another active voice?)

### Decide — Another active voice? (`GW_MoreVoices`)

- Is another active voice left to review?
- Call `workflow_complete` with `node: "GW_MoreVoices"` and `outcome` set to the label that holds:
  - «yes» → `Task_MechanicalHalf` (Run the rule's mechanical half)
  - «no» → `Task_RecordOnSidecar` (Record on the block's QA sidecar)

### 6. Record on the block's QA sidecar (`Task_RecordOnSidecar`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: Through `qa-merge-findings`, so the icon and the published witness agree with the decision.
- Record it: `workflow_complete` with `node: "Task_RecordOnSidecar"`.
- next: → `End_VoiceReviewed` (Voices adjudicated)

## Done — Voices adjudicated (`End_VoiceReviewed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

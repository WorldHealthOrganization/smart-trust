<!-- GENERATED from cat-harness/processes/content/review-narrative.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Narrative review

> **Generated, and not the authority.** This is `cat-harness/processes/content/review-narrative.bpmn` (process `Process_NarrativeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Judging changed PROSE: read what the mechanical checkers flagged, decide which findings are real, then look at the two things no checker can judge — whether the editorial dependencies still hold and whether a translation still says what the source does.

## Begin — Prose changed (`Start_ProseChanged`)

- Begin here.
- Call `workflow_start` with `process: "Process_NarrativeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ReadFindings` (Read the sidecar findings)

### 1. Read the sidecar findings (`Task_ReadFindings`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `content-review`.
- What: Open the block's `.qa.json`, not just the evidence line: register is a property of the passage, and the sidecar quotes one line of it.
- Record it: `workflow_complete` with `node: "Task_ReadFindings"`.
- next: → `Task_AdjudicateVoice` (Adjudicate the voice findings)

### 2. Adjudicate the voice findings (`Task_AdjudicateVoice`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-editorial-review`, `adjudication`.
- What: Three outcomes, all legitimate: the register is wrong for this genre; the criterion does not belong in this genre and should carry `profiles`; or the block is a stated exception and a reviewer entry records why.
- A subprocess (`Process_CriterionAdjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_VoiceOverlay` (Voice overlay review)

### 3. Voice overlay review (`Call_VoiceOverlay`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `voice-overlay-review`.
- What: Descend into Process_VoiceReview for whichever named voices the folio has ACTIVATED — the WHO editorial style, the guideline-development register, the publication design conventions, the Milnor exposition standard.
- A subprocess (`Process_VoiceReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Translated` (Translated?)

### Decide — Translated? (`GW_Translated`)

- Does this block have translations?
- Call `workflow_complete` with `node: "GW_Translated"` and `outcome` set to the label that holds:
  - «yes» → `Task_ReviewTranslation` (Review the translation)
  - «no» → `GW_Join`

### 4. Review the translation (`Task_ReviewTranslation`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `translation-manager`.
- What: Coverage, preserved terms and echoes are mechanical.
- Record it: `workflow_complete` with `node: "Task_ReviewTranslation"`.
- next: → `GW_Join`

### Merge — `GW_Join`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_RecordFindings` (Record findings as advice)

### 5. Record findings as advice (`Task_RecordFindings`)

- Who: the `Narrative reviewer` lane (role `narrative-reviewer`).
- Skill: `content-feedback`.
- What: A reviewer cannot accept a change — that is the editor's lane — so the output is findings on the sidecar, not a commit.
- Record it: `workflow_complete` with `node: "Task_RecordFindings"`.
- next: → `End_NarrativeReviewed` (Narrative reviewed)

## Done — Narrative reviewed (`End_NarrativeReviewed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

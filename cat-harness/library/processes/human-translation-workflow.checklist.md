<!-- GENERATED from cat-harness/library/processes/human-translation-workflow.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Human Translation Workflow

> **Generated, and not the authority.** This is `cat-harness/library/processes/human-translation-workflow.bpmn` (process `Process_HumanTranslation`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The human half of translation: a coordinator assigns a locale to a qualified translator, the translator works in their own tool, a subject-matter expert judges accuracy, and only then is the result official.

## Begin — Translation needed for content node(s) (`Start_TranslationNeeded`)

- Begin here: A translation coordinator identifies one or more content nodes that require human translation into a target locale.
- Call `workflow_start` with `process: "Process_HumanTranslation"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_IdentifyContent` (Identify content and target locale)

### 1. Identify content and target locale (`Task_IdentifyContent`)

- Who: the `Translation Coordinator` lane (role `translation-coordinator`).
- Skill: `translation-manager`.
- What: The coordinator selects: - Which content nodes need translation (block, section, chapter, or folio) - The target locale (one of the supportedLocales in <name>.config.json) - The priority and deadline
- Record it: `workflow_complete` with `node: "Task_IdentifyContent"`.
- next: → `Task_ExtractPOT` (Extract the POT)

### 2. Extract the POT (`Task_ExtractPOT`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: Scan the source content and write the translatable strings to .pot files at the configured granularity: segment prose by paragraph, shield what must not be translated (math, code, labels, Lean companions) as placeholders, normalise whitespace, and extract metadata such as titles, alt text and captio
- Shared step `GT_ExtractPot`.
- Record it: `workflow_complete` with `node: "Task_ExtractPOT"`.
- next: → `Task_PrepareGlossary` (Prepare domain glossary)

### 3. Prepare domain glossary (`Task_PrepareGlossary`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: Builds the locale term base for the target locale from the layered glossaries, has it reviewed, and hands it to the translator with the POT.
- Record it: `workflow_complete` with `node: "Task_PrepareGlossary"`.
- next: → `Task_AssignTranslator` (Assign to qualified human translator)

### 4. Assign to qualified human translator (`Task_AssignTranslator`)

- Who: the `Translation Coordinator` lane (role `translation-coordinator`).
- Skill: `translation-manager`.
- What: The coordinator assigns the translation to a qualified translator, ideally a domain SME for the content area.
- Record it: `workflow_complete` with `node: "Task_AssignTranslator"`.
- next: → `Task_ReceiveAssignment` (Receive assignment and materials)

### 5. Receive assignment and materials (`Task_ReceiveAssignment`)

- Who: the `Human Translator` lane (role `translator`).
- Skill: `translation-manager`, `translation-manager`, `translation-manager`.
- What: The translator receives: - .pot file with source strings (msgid) - Domain glossary with approved term translations - Context notes per string - Style guide and WHO terminology references Tools: Poedit, Weblate, Crowdin, or direct .po editing.
- Record it: `workflow_complete` with `node: "Task_ReceiveAssignment"`.
- next: → `Task_TranslateInTool` (Translate strings in preferred tool)

### 6. Translate strings in preferred tool (`Task_TranslateInTool`)

- Who: the `Human Translator` lane (role `translator`).
- Skill: `translation-manager`.
- What: The translator works through each msgid, producing msgstr translations.
- Record it: `workflow_complete` with `node: "Task_TranslateInTool"`.
- next: → `Task_SubmitPO` (Submit completed .po file)

### 7. Submit completed .po file (`Task_SubmitPO`)

- Who: the `Human Translator` lane (role `translator`).
- Skill: `translation-manager`, `translation-manager`, `translation-manager`.
- What: The translator submits the completed .po file back to the pipeline.
- Record it: `workflow_complete` with `node: "Task_SubmitPO"`.
- next: → `Task_CheckCompleteness` (Check translation completeness)

### 8. Check translation completeness (`Task_CheckCompleteness`)

- Who: the `Translation Coordinator` lane (role `translation-coordinator`).
- Skill: `translation-manager`.
- What: Verify that all msgid entries have msgstr translations.
- Record it: `workflow_complete` with `node: "Task_CheckCompleteness"`.
- next: → `Gateway_Complete` (Complete enough?)

### Decide — Complete enough? (`Gateway_Complete`)

- Answered by the completeness check on the submitted PO file: are enough strings translated?
- Call `workflow_complete` with `node: "Gateway_Complete"` and `outcome` set to the label that holds:
  - «Incomplete» → `Task_RequestMoreWork` (Request completion of remaining strings)
  - «Complete» → `Task_InjectPO` (Inject the PO)

### 9. Request completion of remaining strings (`Task_RequestMoreWork`)

- Who: the `Translation Coordinator` lane (role `translation-coordinator`).
- Skill: `translation-manager`.
- What: Return to the translator with a list of untranslated or fuzzy strings that need attention.
- Record it: `workflow_complete` with `node: "Task_RequestMoreWork"`.
- next: → `Task_TranslateInTool` (Translate strings in preferred tool)

### 10. Inject the PO (`Task_InjectPO`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: Read the .po file and the source .md, substitute msgstr for msgid, unshield the placeholders, and write the translated .md to translations/<locale>/.
- Shared step `GT_InjectPo`.
- Record it: `workflow_complete` with `node: "Task_InjectPO"`.
- next: → `Task_RoundTripQA` (Round-trip translation QA)

### 11. Round-trip translation QA (`Task_RoundTripQA`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: Back-translate the target-language .md into the source language and compare the meaning with the original.
- Shared step `GT_RoundTripQa`.
- Record it: `workflow_complete` with `node: "Task_RoundTripQA"`.
- next: → `Task_SMEReview` (Review translation for accuracy)

### 12. Review translation for accuracy (`Task_SMEReview`)

- Who: the `Subject-Matter Expert / Reviewer` lane (role `reviewer`).
- Skill: `translation-manager`, `translation-manager`, `translation-manager`.
- What: A subject-matter expert reviews the injected translated markdown for: - Clinical/technical accuracy of terminology - Preservation of meaning from the source - Cultural appropriateness for the target locale - Consistency with the domain glossary For WHO content: the SME verifies that normative statem
- Record it: `workflow_complete` with `node: "Task_SMEReview"`.
- next: → `Gateway_Accurate` (Translation accurate?)

### Decide — Translation accurate? (`Gateway_Accurate`)

- The SME's result.
- Call `workflow_complete` with `node: "Gateway_Accurate"` and `outcome` set to the label that holds:
  - «Needs
correction» → `Task_ReturnForCorrection` (Return for correction with annotations)
  - «Accurate» → `Task_AppendDisclaimer` (Append WHO disclaimer (if DAK))

### 13. Return for correction with annotations (`Task_ReturnForCorrection`)

- Who: the `Subject-Matter Expert / Reviewer` lane (role `reviewer`).
- Skill: `translation-manager`.
- What: The reviewer annotates specific passages that need correction and returns to the translator with detailed feedback.
- Record it: `workflow_complete` with `node: "Task_ReturnForCorrection"`.
- next: → `Task_TranslateInTool` (Translate strings in preferred tool)

### 14. Append WHO disclaimer (if DAK) (`Task_AppendDisclaimer`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: For WHO SMART Guidelines content, automatically appends the WHO legal disclaimer: - Translation not created by WHO - English edition is authoritative original - WHO not responsible for translation accuracy Only applies when folio contentType includes WHO/DAK content.
- Record it: `workflow_complete` with `node: "Task_AppendDisclaimer"`.
- next: → `Task_Signoff` (Sign off translation as official)

### 15. Sign off translation as official (`Task_Signoff`)

- Who: the `Subject-Matter Expert / Reviewer` lane (role `reviewer`).
- Skill: `translation-manager`.
- What: The reviewer signs off the translation, making it official.
- Record it: `workflow_complete` with `node: "Task_Signoff"`.
- next: → `Task_WriteStatus` (Write status.json (official))

### 16. Write status.json (official) (`Task_WriteStatus`)

- Who: the `Automated Pipeline` lane (role `build-pipeline`).
- Skill: `translation-manager`.
- What: Record the translation's standing in translations/<locale>/status.json.
- Shared step `GT_WriteTranslationStatus`, with `official` = `true`.
- Record it: `workflow_complete` with `node: "Task_WriteStatus"`.
- next: → `End_OfficialTranslation` (Translation is official)

## Done — Translation is official (`End_OfficialTranslation`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

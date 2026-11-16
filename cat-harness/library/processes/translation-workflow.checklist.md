<!-- GENERATED from cat-harness/library/processes/translation-workflow.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Translation Workflow

> **Generated, and not the authority.** This is `cat-harness/library/processes/translation-workflow.bpmn` (process `Process_Translation`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The machine half of translation, end to end: extract the translatable strings, inject a catalogue back, check the result by back-translating it, and track whether the source has moved since.

## Begin — Content authored (source locale) (`Start_ContentAuthored`)

- Begin here: Source content exists in the folio's defaultLocale.
- Call `workflow_start` with `process: "Process_Translation"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_PotExtract` (Extract translatable strings (POT))

### 1. Extract translatable strings (POT) (`Task_PotExtract`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Scan the source content and write the translatable strings to .pot files at the configured granularity: segment prose by paragraph, shield what must not be translated (math, code, labels, Lean companions) as placeholders, normalise whitespace, and extract metadata such as titles, alt text and captio
- Shared step `GT_ExtractPot`.
- Record it: `workflow_complete` with `node: "Task_PotExtract"`.
- next: → `Task_TermBase` (Build and review the locale term base)

### 2. Build and review the locale term base (`Task_TermBase`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Before translating: build the locale term base from the layered glossaries, review it, and translate with it.
- Record it: `workflow_complete` with `node: "Task_TermBase"`.
- next: → `Task_Translate` (Produce translation (PO file))

### 3. Produce translation (PO file) (`Task_Translate`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Translation of .pot → .po, with the locale term base, by one of: 1.
- Record it: `workflow_complete` with `node: "Task_Translate"`.
- next: → `Task_PoInject` (Inject translations (PO → Markdown))

### 4. Inject translations (PO → Markdown) (`Task_PoInject`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Read the .po file and the source .md, substitute msgstr for msgid, unshield the placeholders, and write the translated .md to translations/<locale>/.
- Shared step `GT_InjectPo`.
- Record it: `workflow_complete` with `node: "Task_PoInject"`.
- next: → `Task_RoundTripQA` (Round-trip translation QA (back-translate))

### 5. Round-trip translation QA (back-translate) (`Task_RoundTripQA`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Back-translate the target-language .md into the source language and compare the meaning with the original.
- Shared step `GT_RoundTripQa`.
- Record it: `workflow_complete` with `node: "Task_RoundTripQA"`.
- next: → `Task_GlossaryCheck` (Check glossary terms (translation:glossary:check))

### 6. Check glossary terms (translation:glossary:check) (`Task_GlossaryCheck`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: After translating: run `translation:glossary:check --instance <dir> --locale <locale>`, fix the violations, and include its glossary section in the KG QA report.
- Record it: `workflow_complete` with `node: "Task_GlossaryCheck"`.
- next: → `Gateway_Drift` (Drift or bad terminology?)

### Decide — Drift or bad terminology? (`Gateway_Drift`)

- Answered by the round-trip (back-translation) QA and the glossary check: did either flag drift or a terminology miss?
- Call `workflow_complete` with `node: "Gateway_Drift"` and `outcome` set to the label that holds:
  - «Drift detected» → `Task_Adjudicate` (Adjudicate the flagged passage (human))
  - «Clean» → `Task_WriteUnofficial` (Write status.json (unofficial))

### 7. Adjudicate the flagged passage (human) (`Task_Adjudicate`)

- Who: the `Human reviewer / adjudicator` lane (role `translation-adjudicator`).
- Skill: `translation-manager`, `adjudication`.
- What: A human SME or editor reviews the flagged passage.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_PostQA` (Which of the three?)

### 8. Write status.json (unofficial) (`Task_WriteUnofficial`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Record the translation's standing in translations/<locale>/status.json.
- Shared step `GT_WriteTranslationStatus`, with `official` = `false`.
- Record it: `workflow_complete` with `node: "Task_WriteUnofficial"`.
- next: → `Gateway_Signoff` (Human sign-off?)

### Decide — Which of the three? (`Gateway_PostQA`)

- The three this diagram's own adjudication step has always promised — *"Accept the translation as-is (false positive) / Edit the translation and re-run QA / Reject and request re-translation"* — and until 2026-09-23 it offered TWO.
- Call `workflow_complete` with `node: "Gateway_PostQA"` and `outcome` set to the label that holds:
  - «Reject — re-translate» → `Task_Translate` (Produce translation (PO file))
  - «Accept as-is (false positive)» → `Task_WriteUnofficial` (Write status.json (unofficial))
  - «Edit and re-run QA» → `Task_EditTranslation` (Edit the flagged passage and re-inject)

### Decide — Human sign-off? (`Gateway_Signoff`)

- Is a human sign-off happening now?
- Call `workflow_complete` with `node: "Gateway_Signoff"` and `outcome` set to the label that holds:
  - «Yes» → `Task_Signoff` (Sign off translation (human adjudicator))
  - «Not now» → `End_TranslationComplete` (Translation complete)

### 9. Edit the flagged passage and re-inject (`Task_EditTranslation`)

- Who: the `Human reviewer / adjudicator` lane (role `translation-adjudicator`).
- Skill: `translation-manager`.
- What: The reviewer corrects the passage in the PO rather than sending the whole translation back.
- Record it: `workflow_complete` with `node: "Task_EditTranslation"`.
- next: → `Task_PoInject` (Inject translations (PO → Markdown))

### 10. Sign off translation (human adjudicator) (`Task_Signoff`)

- Who: the `Human reviewer / adjudicator` lane (role `translation-adjudicator`).
- Skill: `translation-manager`.
- What: A human reviewer signs off the translation at the chosen hierarchy level (block, section, chapter, or folio).
- Record it: `workflow_complete` with `node: "Task_Signoff"`.
- next: → `Task_WriteOfficial` (Write status.json (official))

## Done — Translation complete (`End_TranslationComplete`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Write status.json (official) (`Task_WriteOfficial`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: Record the translation's standing in translations/<locale>/status.json.
- Shared step `GT_WriteTranslationStatus`, with `official` = `true`.
- Record it: `workflow_complete` with `node: "Task_WriteOfficial"`.
- next: → `Task_StalenessCheck` (Check staleness (source hash))

### 12. Check staleness (source hash) (`Task_StalenessCheck`)

- Who: the `Agent / platform (automated)` lane (role `authoring-agent`).
- Skill: `translation-manager`.
- What: On source content change: computes sha256(source.md) and compares to each translation's status.json sourceHash.
- Record it: `workflow_complete` with `node: "Task_StalenessCheck"`.
- next: → `End_Stale` (Translation marked stale (re-enter at Extract))

## Done — Translation marked stale (re-enter at Extract) (`End_Stale`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

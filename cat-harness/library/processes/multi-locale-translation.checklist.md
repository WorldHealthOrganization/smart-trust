<!-- GENERATED from cat-harness/library/processes/multi-locale-translation.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Multi-locale translation

> **Generated, and not the authority.** This is `cat-harness/library/processes/multi-locale-translation.bpmn` (process `Process_MultiLocaleTranslation`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Translate one or more layers into several locales at once, as a team: one source-language lead, one translator per locale, an untainted round trip, and the owner's merge window.

## Begin — Locales requested (`Start_ML`)

- Begin here.
- Call `workflow_start` with `process: "Process_MultiLocaleTranslation"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ML_Scope` (Set locales, scope and merge window)

### 1. Set locales, scope and merge window (`Task_ML_Scope`)

- Who: the `Owner` lane (role `user`).
- What: Which layers, which locales, which assets (pages, diagrams, glossary, FHIR terms), and the window in which locale PRs may be merged.
- Record it: `workflow_complete` with `node: "Task_ML_Scope"`.
- next: → `Task_ML_Extract` (Extract every template once)

### 2. Extract every template once (`Task_ML_Extract`)

- Who: the `Source-language lead` lane (role `translation-source-lead`).
- Skill: `translation-manager`.
- What: Scan the source content and write the translatable strings to .pot files at the configured granularity: segment prose by paragraph, shield what must not be translated (math, code, labels, Lean companions) as placeholders, normalise whitespace, and extract metadata such as titles, alt text and captio
- Shared step `GT_ExtractPot`.
- Record it: `workflow_complete` with `node: "Task_ML_Extract"`.
- next: → `Task_ML_SourcePR` (Merge the one source PR to main)

### 3. Merge the one source PR to main (`Task_ML_SourcePR`)

- Who: the `Source-language lead` lane (role `translation-source-lead`).
- Skill: `translation-manager`.
- What: All the templates in one PR to main, merged before any locale starts, so every translator branches from the same main.
- Record it: `workflow_complete` with `node: "Task_ML_SourcePR"`.
- next: → `Task_ML_Watcher` (Schedule the refresh watcher)

### 4. Schedule the refresh watcher (`Task_ML_Watcher`)

- Who: the `Source-language lead` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Schedule a fresh session that follows `translation-refresh` on each layer, so a template that moves after today is caught by its check failing, not by a reader.
- Record it: `workflow_complete` with `node: "Task_ML_Watcher"`.
- next: → `Task_ML_Translate` (Translate one locale)

### 5. Translate one locale (`Task_ML_Translate`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: From the merged templates, with the locale term base: `translations/<locale>/**.po`, a translation-node manifest beside each (`official: false`, `generatedBy: "agent"`, or `"machine"` where `translation:candidates` filled an empty entry with its first candidate, which stays fuzzy; no `status.json`),
- Record it: `workflow_complete` with `node: "Task_ML_Translate"`.
- next: → `Gateway_ML_SourceError` (Source-text error found?)

### Decide — Source-text error found? (`Gateway_ML_SourceError`)

- Did translating show a mistake in the source text?
- Call `workflow_complete` with `node: "Gateway_ML_SourceError"` and `outcome` set to the label that holds:
  - «Yes» → `Task_ML_SourceIssue` (File the source errors as one issue)
  - «No» → `Task_ML_Gates` (Run the deterministic gates)

### 6. File the source errors as one issue (`Task_ML_SourceIssue`)

- Who: the `Source-language lead` lane (role `translation-source-lead`).
- Skill: `translation-manager`.
- What: One issue for every source-text error the translators found, each with its location and the reading the translator took.
- Record it: `workflow_complete` with `node: "Task_ML_SourceIssue"`.
- next: → `Task_ML_Gates` (Run the deterministic gates)

### 7. Run the deterministic gates (`Task_ML_Gates`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Template currency, catalogue coverage, placeholder, tag and URL preservation, officiality, `kg:locale`, and the locale's supplements compiling with no SUSHI error and passing their structural checks.
- Record it: `workflow_complete` with `node: "Task_ML_Gates"`.
- next: → `Gateway_ML_Gates` (Gates pass?)

### Decide — Gates pass? (`Gateway_ML_Gates`)

- Answered by the gates' own exit codes, never by reading their output.
- Call `workflow_complete` with `node: "Gateway_ML_Gates"` and `outcome` set to the label that holds:
  - «Yes» → `Call_ML_RoundTrip` (Untainted round trip on a sample)
  - «No: fix, re-run» → `Task_ML_Translate` (Translate one locale)

### 8. Untainted round trip on a sample (`Call_ML_RoundTrip`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- What: The sample: every diagram label, the personas and scenarios, and a seeded random fraction of the rest.
- A subprocess (`Process_TranslationRoundTrip`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_ML_Glossary` (Check glossary consistency)

### 9. Check glossary consistency (`Task_ML_Glossary`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: `translation:glossary:check`, against the layered term base: the normative reference glossaries first, then each layer in the order the index config lists it, the layer's own glossary last and never overriding.
- Record it: `workflow_complete` with `node: "Task_ML_Glossary"`.
- next: → `Task_ML_QAReport` (Write the locale's QA report)

### 10. Write the locale's QA report (`Task_ML_QAReport`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: One report per locale under `test/results/translation-qa/`: coverage, the gates, the round trip with its counts and every drift ruling, the glossary violations and sense checks, and the source errors reported.
- Record it: `workflow_complete` with `node: "Task_ML_QAReport"`.
- next: → `Task_ML_LocalePR` (Open the locale PR to main)

### 11. Open the locale PR to main (`Task_ML_LocalePR`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: One PR per locale, based on and targeting main.
- Record it: `workflow_complete` with `node: "Task_ML_LocalePR"`.
- next: → `Gateway_ML_Drift` (Drift ruled?)

### Decide — Drift ruled? (`Gateway_ML_Drift`)

- Answered by the round-trip adjudicator's recorded verdicts for this locale: did it rule any pair drift?
- Call `workflow_complete` with `node: "Gateway_ML_Drift"` and `outcome` set to the label that holds:
  - «Yes» → `Task_ML_FixDrift` (Fix each drift on the PR)
  - «No» → `Task_ML_Merge` (Validate and merge in the window)

### 12. Fix each drift on the PR (`Task_ML_FixDrift`)

- Who: the `Locale translator (one per locale)` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Correct each string the adjudicator ruled drift, on the locale PR, and note the fix beside the ruling in the QA report.
- Record it: `workflow_complete` with `node: "Task_ML_FixDrift"`.
- next: → `Task_ML_Merge` (Validate and merge in the window)

### 13. Validate and merge in the window (`Task_ML_Merge`)

- Who: the `Source-language lead` lane (role `translation-source-lead`).
- Skill: `translation-manager`.
- What: Read each locale's QA report, confirm the PR is green, and merge it inside the owner's merge window.
- Record it: `workflow_complete` with `node: "Task_ML_Merge"`.
- next: → `End_ML` (On main)

## Done — On main (`End_ML`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

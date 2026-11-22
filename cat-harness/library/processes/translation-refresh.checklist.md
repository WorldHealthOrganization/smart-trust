<!-- GENERATED from cat-harness/library/processes/translation-refresh.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Translation refresh (watcher)

> **Generated, and not the authority.** This is `cat-harness/library/processes/translation-refresh.bpmn` (process `Process_TranslationRefresh`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Keep every locale current after the source moves: detect, refresh the templates, merge them into each locale, translate only what is new or fuzzy, check it, and land one PR per layer on main.

## Begin — Scheduled run (`Start_TR`)

- Begin here: A scheduled fresh session, or a template check that failed on a PR or on main.
- Call `workflow_start` with `process: "Process_TranslationRefresh"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_TR_ColdStart` (Cold start: mount and attach)

### 1. Cold start: mount and attach (`Task_TR_ColdStart`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Lay down every pinned layer from each layer's lock, as its AGENTS.md cold start says, and attach each repository the run will change.
- Record it: `workflow_complete` with `node: "Task_TR_ColdStart"`.
- next: → `Task_TR_Detect` (Detect what moved)

### 2. Detect what moved (`Task_TR_Detect`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: `translation:status --instance <root>` for new, obsolete and fuzzy strings, and the instance's template check.
- Record it: `workflow_complete` with `node: "Task_TR_Detect"`.
- next: → `Gateway_TR_Changed` (Anything to refresh?)

### Decide — Anything to refresh? (`Gateway_TR_Changed`)

- Answered from the detection commands' output: `Yes` when any template check fails or any count of new, obsolete or fuzzy strings is above zero.
- Call `workflow_complete` with `node: "Gateway_TR_Changed"` and `outcome` set to the label that holds:
  - «Yes» → `Task_TR_Templates` (Refresh the templates)
  - «No» → `End_TR_Current` (Current)

### 3. Refresh the templates (`Task_TR_Templates`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Re-run the layer's extractors, once for every locale: pages, diagrams, glossary schemes.
- Record it: `workflow_complete` with `node: "Task_TR_Templates"`.
- next: → `Task_TR_MergeLocales` (Merge into each locale)

## Done — Current (`End_TR_Current`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Merge into each locale (`Task_TR_MergeLocales`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Merge each refreshed template into every locale's catalogue: new strings arrive empty, changed ones fuzzy, and obsolete ones are kept as `#~` entries, never deleted.
- Record it: `workflow_complete` with `node: "Task_TR_MergeLocales"`.
- next: → `Task_TR_Translate` (Translate new and fuzzy only)

### 5. Translate new and fuzzy only (`Task_TR_Translate`)

- Who: the `Locale translator` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Only the empty and fuzzy entries, in every locale, with the terms the term base fixes.
- Record it: `workflow_complete` with `node: "Task_TR_Translate"`.
- next: → `Task_TR_Gates` (Re-run the gates)

### 6. Re-run the gates (`Task_TR_Gates`)

- Who: the `Locale translator` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Officiality, catalogue coverage, translated links, `kg:locale`, `translation:glossary:check`, and the supplements compiling.
- Record it: `workflow_complete` with `node: "Task_TR_Gates"`.
- next: → `Gateway_TR_Gates` (Gates pass?)

### Decide — Gates pass? (`Gateway_TR_Gates`)

- `Yes` only when every gate exits 0.
- Call `workflow_complete` with `node: "Gateway_TR_Gates"` and `outcome` set to the label that holds:
  - «Yes» → `Call_TR_RoundTrip` (Round trip on the changed strings)
  - «No: fix» → `Task_TR_Translate` (Translate new and fuzzy only)

### 7. Round trip on the changed strings (`Call_TR_RoundTrip`)

- Who: the `Locale translator` lane (role `locale-translator`).
- What: The untainted round trip, with the sample restricted to the strings this run translated.
- A subprocess (`Process_TranslationRoundTrip`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_TR_Report` (QA report and one PR to main)

### 8. QA report and one PR to main (`Task_TR_Report`)

- Who: the `Locale translator` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Write each locale's QA report, then open one PR for the layer, based on and targeting main.
- Record it: `workflow_complete` with `node: "Task_TR_Report"`.
- next: → `Task_TR_SourceIssue` (Report source errors as one issue)

### 9. Report source errors as one issue (`Task_TR_SourceIssue`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Any source-text error the translators found goes into one issue on the source, with its location.
- Record it: `workflow_complete` with `node: "Task_TR_SourceIssue"`.
- next: → `Gateway_TR_Window` (Merge-when-green, and all green?)

### Decide — Merge-when-green, and all green? (`Gateway_TR_Window`)

- Three facts, all read live: the layer's AGENTS.md declares merge-when-green, every check on the PR is green, and the untainted round trip on the changed strings records no fail.
- Call `workflow_complete` with `node: "Gateway_TR_Window"` and `outcome` set to the label that holds:
  - «Yes» → `Task_TR_Merge` (Merge the PR)
  - «No» → `End_TR_Waiting` (PR left open)

### 10. Merge the PR (`Task_TR_Merge`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Merge the layer's PR to main, then confirm the template checks pass on main.
- Record it: `workflow_complete` with `node: "Task_TR_Merge"`.
- next: → `Task_TR_PruneRulings` (Prune the rulings of removed strings)

## Done — PR left open (`End_TR_Waiting`)

- The instance completes here: Open only, red, uncertain or failing: the PR stays open, the owner is told, and the next run looks again. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Prune the rulings of removed strings (`Task_TR_PruneRulings`)

- Who: the `Source-language lead (watcher)` lane (role `translation-source-lead`).
- Skill: `translation-refresh`.
- What: Drop the round-trip rulings of strings main no longer holds, with the layer's prune command (its AGENTS.md names it, by convention `translation-qa:prune`), once the PR is on main.
- Record it: `workflow_complete` with `node: "Task_TR_PruneRulings"`.
- next: → `End_TR_Merged` (Refreshed)

## Done — Refreshed (`End_TR_Merged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

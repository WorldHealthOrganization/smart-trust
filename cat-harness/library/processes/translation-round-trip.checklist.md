<!-- GENERATED from cat-harness/library/processes/translation-round-trip.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Translation round trip (untainted)

> **Generated, and not the authority.** This is `cat-harness/library/processes/translation-round-trip.bpmn` (process `Process_TranslationRoundTrip`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Did the meaning survive the translation?

## Begin — Strings to check (`Start_RT`)

- Begin here: One locale's catalogue has passed the deterministic gates: every placeholder, tag and URL preserved, every template current.
- Call `workflow_start` with `process: "Process_TranslationRoundTrip"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_RT_Sample` (Draw the sample)

### 1. Draw the sample (`Task_RT_Sample`)

- Who: the `Locale translator` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: On a first translation: every diagram label, every persona and scenario string, and a seeded random fraction of the rest, with the seed written down so the sample can be drawn again.
- Record it: `workflow_complete` with `node: "Task_RT_Sample"`.
- next: → `Gateway_RT_Dispatch` (Two parties available?)

### Decide — Two parties available? (`Gateway_RT_Dispatch`)

- Can a back-translator and an adjudicator be dispatched as two separate parties, neither of them the producer?
- Call `workflow_complete` with `node: "Gateway_RT_Dispatch"` and `outcome` set to the label that holds:
  - «Yes» → `Task_RT_BackTranslate` (Back-translate the target text)
  - «No» → `Task_RT_RecordNA` (Record could not dispatch)

### 2. Back-translate the target text (`Task_RT_BackTranslate`)

- Who: the `Back-translator` lane (role `back-translator`).
- Skill: `untainted-verification`.
- What: Render each target string into the source language, from the target text alone, using no tools, and say so in a TOOLS_USED line that is recorded.
- Record it: `workflow_complete` with `node: "Task_RT_BackTranslate"`.
- next: → `Task_RT_PreScreen` (Pre-screen every pair)

### 3. Record could not dispatch (`Task_RT_RecordNA`)

- Who: the `Locale translator` lane (role `locale-translator`).
- Skill: `translation-manager`.
- What: Write one entry, `result: "n/a"`, `metrics.dispatch: "unavailable"`, with the reason.
- Record it: `workflow_complete` with `node: "Task_RT_RecordNA"`.
- next: → `End_RT_NA` (Not verified)

### 4. Pre-screen every pair (`Task_RT_PreScreen`)

- Who: the `Round-trip adjudicator` lane (role `round-trip-adjudicator`).
- Skill: `translation-manager`.
- What: Mechanically, over every (source, back-translation) pair: flag a pair whose negation, modal, quantifier, number or code tokens differ, and a pair whose word overlap is low.
- Record it: `workflow_complete` with `node: "Task_RT_PreScreen"`.
- next: → `Task_RT_Rule` (Read and rule each flagged pair)

## Done — Not verified (`End_RT_NA`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Read and rule each flagged pair (`Task_RT_Rule`)

- Who: the `Round-trip adjudicator` lane (role `round-trip-adjudicator`).
- Skill: `untainted-verification`, `translation-manager`.
- What: Read every flagged pair in full and rule it drift or not drift, with the reason.
- Record it: `workflow_complete` with `node: "Task_RT_Rule"`.
- next: → `Task_RT_Record` (Record both witnesses)

### 6. Record both witnesses (`Task_RT_Record`)

- Who: the `Round-trip adjudicator` lane (role `round-trip-adjudicator`).
- Skill: `untainted-verification`.
- What: Record the adjudicator's verdict first and the back-translator's rendering behind it (`translation:roundtrip --payload`), so a reader can ask both who ruled and on what basis.
- Record it: `workflow_complete` with `node: "Task_RT_Record"`.
- next: → `End_RT_Ruled` (Verdicts recorded)

## Done — Verdicts recorded (`End_RT_Ruled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

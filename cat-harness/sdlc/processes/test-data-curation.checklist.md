<!-- GENERATED from cat-harness/sdlc/processes/test-data-curation.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Test Data Curation — Fixed Sets and Generated Recipes

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/test-data-curation.bpmn` (process `Process_TestDataCuration`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

General curation process for fixed (`test-data-fixed/1.0.0`) and generated (`test-data-generated/1.0.0`) test data sets.

## Begin — Test data needed for a test plan case (`Start_Curation`)

- Begin here.
- Call `workflow_start` with `process: "Process_TestDataCuration"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_ClassifySet` (Classify data set: fixed (curated) or generated (recipe))
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Classify data set: fixed (curated) or generated (recipe) (`Task_ClassifySet`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Decide whether the test case requires a small, committed, cited fixed data set (`test-data-fixed/1.0.0`, usable as certification evidence once reviewed) or a deterministic generated recipe (`test-data-generated/1.0.0`, `template` + `params` + `seed`, never stored materialised).
- Record it: `workflow_complete` with `node: "Task_ClassifySet"`.
- next: → `GW_SetKind` (Fixed or generated?)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Fixed or generated? (`GW_SetKind`)

- Routes to the fixed-set curation branch (`fixed`) or the generated-recipe synthesis branch (`generated`).
- Call `workflow_complete` with `node: "GW_SetKind"` and `outcome` set to the label that holds:
  - «fixed» → `Task_CurateFixed` (Author the fixed test data set)
  - «generated» → `Task_DetermineSpecialisation` (Determine the content type and its specialisation)

### 3. Author the fixed test data set (`Task_CurateFixed`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Write the curated `records` and optional `citations` with `$schema: "test-data-fixed/1.0.0"` and `kind: "fixed"` into the layer's declared `test-data-fixed` directory (`schemas/sdlc/test-data.ts`).
- Record it: `workflow_complete` with `node: "Task_CurateFixed"`.
- next: → `GW_NeedsSmeReview` (Exercises decision support or indicator definition?)

### 4. Determine the content type and its specialisation (`Task_DetermineSpecialisation`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Read the folio's `contentType` and the `specialisation` registered for it (`TestDataSpecialisationSchema` in `schemas/sdlc/test-data.ts`): `fhir-templating` for FHIR IG and DAK content, `markdown-fixture` for document folios, `lean-counterexample` for proof folios, `tabular-cohort` for aggregate ind
- Record it: `workflow_complete` with `node: "Task_DetermineSpecialisation"`.
- next: → `Call_ContentTypeSpecialisation` (Synthesise the recipe with that specialisation)

### Decide — Exercises decision support or indicator definition? (`GW_NeedsSmeReview`)

- When the fixed data set exercises clinical/scientific decision support or an indicator definition, it must pass SME review (`Process_SmeTestDataReview`) before `review` is recorded and the set can stand as certification evidence.
- Call `workflow_complete` with `node: "GW_NeedsSmeReview"` and `outcome` set to the label that holds:
  - «yes» → `Call_SmeReview` (SME review of cases or cohorts)
  - «no» → `GW_JoinFixed` (Fixed set ready)

### 5. Synthesise the recipe with that specialisation (`Call_ContentTypeSpecialisation`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: BOUND BY THE CONTENT TYPE, so no `calledElement` is written here: each specialisation process belongs to the layer that owns its content type, and a lower layer cannot name a higher layer\'s process.
- Record it: `workflow_complete` with `node: "Call_ContentTypeSpecialisation"`.
- next: → `Task_WriteRecipe` (Write the generated-data recipe)

### 6. SME review of cases or cohorts (`Call_SmeReview`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Calls `Process_SmeTestDataReview` (`sdlc/processes/sme-test-data-review.bpmn`) so a human SME in a `judgementOnly` lane reviews each worked case (`decision-support`) or cohort plus expected value (`indicator-definition`) and records an attributable `sme-case-verdict/1.0.0` node.
- A subprocess (`Process_SmeTestDataReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_JoinFixed` (Fixed set ready)

### Merge — Fixed set ready (`GW_JoinFixed`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_MergeKind` (Data set written)

### 7. Write the generated-data recipe (`Task_WriteRecipe`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Record `contentType`, `specialisation`, `template`, `params`, `seed`, and the canonical `sha256` digest (`computeGeneratedSetDigest`) with `$schema: "test-data-generated/1.0.0"` and `kind: "generated"` in the layer's declared `test-data-generated` directory.
- Record it: `workflow_complete` with `node: "Task_WriteRecipe"`.
- next: → `GW_MergeKind` (Data set written)

### Merge — Data set written (`GW_MergeKind`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_VerifySelfIdentifying` (Verify file self-identifies by $schema and kind and bind into test plan)

### 8. Verify file self-identifies by $schema and kind and bind into test plan (`Task_VerifySelfIdentifying`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-data-sets`.
- What: Parse the file with `discriminateTestDataSet` (`schemas/sdlc/test-data.ts`) to confirm a consumer can tell fixed from generated from the file content alone (never the path), verify `verifyGeneratedSetDigest` on generated sets, and bind the resulting `TestDataRef` (`toTestDataRef`) into the `test-pla
- Record it: `workflow_complete` with `node: "Task_VerifySelfIdentifying"`.
- next: → `Call_BeanClose` (Close the bean)

### 9. Close the bean (`Call_BeanClose`)

- Who: the `Tester` lane (role `tester`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Curated` (Test data set curated and bound into plan)

## Done — Test data set curated and bound into plan (`End_Curated`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

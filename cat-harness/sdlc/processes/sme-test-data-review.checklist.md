<!-- GENERATED from cat-harness/sdlc/processes/sme-test-data-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — SME Review of Decision Support and Indicator Test Data

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/sme-test-data-review.bpmn` (process `Process_SmeTestDataReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

SME review of fixed test data for clinical or scientific decision support and indicator definitions.

## Begin — Fixed test data set for decision support or indicator definition (`Start_SmeReview`)

- Begin here.
- Call `workflow_start` with `process: "Process_SmeTestDataReview"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_SubjectKind` (Subject kind: decision support or indicator definition?)

### Decide — Subject kind: decision support or indicator definition? (`GW_SubjectKind`)

- Selects the unit of review required by `SmeCaseVerdictKind` (`schemas/sdlc/test-data.ts`): a worked `case` for `decision-support`, or a `cohort` plus `expectedValue` for `indicator-definition`.
- Call `workflow_complete` with `node: "GW_SubjectKind"` and `outcome` set to the label that holds:
  - «decision-support» → `Task_PrepareWorkedCase` (Prepare the worked case: input, logic, output)
  - «indicator-definition» → `Task_PrepareCohort` (Prepare the cohort: inputs, expected and computed)

### 1. Prepare the worked case: input, logic, output (`Task_PrepareWorkedCase`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Assemble the `DecisionSupportWorkedCase` (`id`, `summary`, `decisionLogicRef`, structured `input`, `systemOutput`, and optional `expectedGuidance`) from the fixed data set so the SME can judge clinical/scientific correctness without reading raw schema internals.
- Record it: `workflow_complete` with `node: "Task_PrepareWorkedCase"`.
- next: → `GW_ReadyForSme` (Review unit prepared)

### 2. Prepare the cohort: inputs, expected and computed (`Task_PrepareCohort`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `test-data-sets`.
- What: Assemble the `IndicatorCohortCase` (`id`, `summary`, `indicatorRef`, `populationSize`, `inputs`, `expectedValue`, `computedValue`, and optional `period`, `numerator`, `denominator`) from the fixed data set for SME review.
- Record it: `workflow_complete` with `node: "Task_PrepareCohort"`.
- next: → `GW_ReadyForSme` (Review unit prepared)

### Merge — Review unit prepared (`GW_ReadyForSme`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_SmeJudge` (Judge whether the case or cohort is right)

### 3. Judge whether the case or cohort is right (`Task_SmeJudge`)

- Who: the `Clinical / scientific SME` lane (role `clinical-sme`).
- What: Performed by the human SME in `Lane_SME` (`clinical-sme`, `judgementOnly: true`).
- Record it: `workflow_complete` with `node: "Task_SmeJudge"`.
- next: → `Task_RecordCaseVerdict` (Record the SME's verdict and rationale)

### 4. Record the SME's verdict and rationale (`Task_RecordCaseVerdict`)

- Who: the `Tester` lane (role `tester`).
- Skill: `test-data-sets`.
- What: Write the `sme-case-verdict/1.0.0` node (`SmeCaseVerdictKind` in `schemas/sdlc/test-data.ts`) recording `dataSetRef`, `subjectKind`, the worked `case` or `cohort`, `verdict`, `rationale`, the SME's attributable human identity (`reviewer: { kind: "human", provider, handle, role }`), and `reviewedAt` 
- Record it: `workflow_complete` with `node: "Task_RecordCaseVerdict"`.
- next: → `GW_VerdictOutcome` (SME verdict outcome?)

### Decide — SME verdict outcome? (`GW_VerdictOutcome`)

- Routes on the recorded `verdict` field of the `sme-case-verdict/1.0.0` node: `pass` marks the fixed set reviewed and usable as certification evidence; `fail` or `needs-revision` withholds `reviewed: true` until the logic or case is revised.
- Call `workflow_complete` with `node: "GW_VerdictOutcome"` and `outcome` set to the label that holds:
  - «pass» → `End_Reviewed` (Case/verdict pair recorded; fixed data set is audited evidence)
  - «fail or needs-revision» → `End_NeedsRevision` (Discrepancy recorded; logic or case returned for revision)

## Done — Case/verdict pair recorded; fixed data set is audited evidence (`End_Reviewed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Discrepancy recorded; logic or case returned for revision (`End_NeedsRevision`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

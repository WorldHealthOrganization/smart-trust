<!-- GENERATED from smart-base/collab/processes/content/smart-guideline-end-to-end.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — SMART Guideline end to end

> **Generated, and not the authority.** This is `smart-base/collab/processes/content/smart-guideline-end-to-end.bpmn` (process `Process_SgEndToEnd`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

From a use case to a consuming application: identify the L1 guidelines, ingest them into an L1 knowledge graph, choose the L2 DAKs to build on, create or adapt the L2 assets, choose the L3 IGs to build on, produce the L3 assets, then build the L4 consuming application the requester describes.

## Begin — Use case to support (`StartEvent_Need`)

- Begin here: Someone needs a SMART Guideline, new or adapted, for a use case.
- Call `workflow_start` with `process: "Process_SgEndToEnd"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DescribeUseCase` (0 · Describe the use case)

### 1. 0 · Describe the use case (`Task_DescribeUseCase`)

- Who: the `Requester (country team / implementer)` lane (role `user`).
- Skill: `guideline-use-case`.
- What: Population, setting, jurisdiction, interventions in scope.
- Record it: `workflow_complete` with `node: "Task_DescribeUseCase"`.
- next: → `Task_IdentifyL1` (1 · Identify L1 guidelines and recommendations)

### 2. 1 · Identify L1 guidelines and recommendations (`Task_IdentifyL1`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `dak-l1-library`.
- What: Component 1 sources of any DAK already in scope first, then WHO IRIS and the jurisdiction's own guidelines.
- Record it: `workflow_complete` with `node: "Task_IdentifyL1"`.
- next: → `Fork_L1`

### Do all of — `Fork_L1`

- Work every branch; none is optional. Branches: → `Task_AdjL1` (Adjudicate the L1 source list), → `Gateway_InKg` (All sources in an L1 KG?)
- The engine passes through this gateway itself; there is nothing to record here.

### 3. Adjudicate the L1 source list (`Task_AdjL1`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`.
- What: Clinical SME: each source with why it was included or left out.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjL1` (Adjudicated)

### Decide — All sources in an L1 KG? (`Gateway_InKg`)

- Call `workflow_complete` with `node: "Gateway_InKg"` and `outcome` set to the label that holds:
  - «no» → `Task_IngestKg` (2 · Ingest into the L1 KG)
  - «yes» → `Gateway_KgMerge`

## Done — Adjudicated (`End_AdjL1`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. 2 · Ingest into the L1 KG (`Task_IngestKg`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `recommendation-extraction`, `dak-l1-library`.
- What: Per source not yet extracted: cat ingest into library/, the generic-document layer (l1-library), then the L1 layer (recommendations, remarks, practices, scenario candidates) into library/<bib>/l1-extraction/.
- Record it: `workflow_complete` with `node: "Task_IngestKg"`.
- next: → `Fork_Kg`

### Merge — `Gateway_KgMerge`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_DepsL2` (3 · Choose L2 dependencies (WHO / jurisdiction DAKs))

### Do all of — `Fork_Kg`

- Work every branch; none is optional. Branches: → `Task_AdjKg` (Adjudicate the L1 KG), → `Gateway_KgMerge`
- The engine passes through this gateway itself; there is nothing to record here.

### 5. 3 · Choose L2 dependencies (WHO / jurisdiction DAKs) (`Task_DepsL2`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l2-dependency-choice`, `smart-base-tools`, `decision-comparison`.
- What: From the L1 KG: which existing DAKs to reuse, adapt, extend or reject, each with evidence and reason.
- Record it: `workflow_complete` with `node: "Task_DepsL2"`.
- next: → `Fork_DepsL2`

### 6. Adjudicate the L1 KG (`Task_AdjKg`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `recommendation-extraction`.
- What: l1-extraction-reviewer signs exclusions and coverage; Clinical SME reviews recommendations beside the printed page.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjKg` (Adjudicated)

### Do all of — `Fork_DepsL2`

- Work every branch; none is optional. Branches: → `Task_AdjDepsL2` (Adjudicate L2 dependencies), → `Task_L2` (4 · Create / adapt L2 DAK assets)
- The engine passes through this gateway itself; there is nothing to record here.

## Done — Adjudicated (`End_AdjKg`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Adjudicate L2 dependencies (`Task_AdjDepsL2`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `decision-audit`.
- What: Programme manager and business analyst: one row per candidate DAK, rejected ones included.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjDepsL2` (Adjudicated)

### 8. 4 · Create / adapt L2 DAK assets (`Task_L2`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l2-dak-authoring`, `smart-base-tools`, `dak-preprocessing`, `dak-postprocessing`, `wireframe-design-review`, `feature-staging`.
- What: The authoring steps of l2-dak-authoring.bpmn (personas and scenarios, BPMN, DMN, data dictionary, indicators and requirements, terminology), plus the design of each data-entry form as wireframe candidates (wireframe-design-review, design use) from the persona, the user scenario and the core data ele
- Record it: `workflow_complete` with `node: "Task_L2"`.
- next: → `Fork_L2`

## Done — Adjudicated (`End_AdjDepsL2`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Do all of — `Fork_L2`

- Work every branch; none is optional. Branches: → `Task_AdjL2` (Review each L2 asset (before / after if adapted)), → `Task_DepsL3` (5 · Choose L3 dependencies (WHO / jurisdiction IGs))
- The engine passes through this gateway itself; there is nothing to record here.

### 9. Review each L2 asset (before / after if adapted) (`Task_AdjL2`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`, `visual-diff`, `wireframe-design-review`.
- What: One review item per created or changed asset, shown as its reviewer reads it (diagram, table, data-dictionary rows); an adapted asset as a diff against its pinned upstream.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjL2` (Adjudicated)

### 10. 5 · Choose L3 dependencies (WHO / jurisdiction IGs) (`Task_DepsL3`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l3-dependency-choice`, `ig-artifact-ingestion`, `smart-base-tools`, `decision-comparison`.
- What: Index each candidate IG, then match the L1 KG and the L2 assets against it: reuse, adapt, extend or reject per IG, and record per artefact type the candidate's toolchain (CQL refresh, test-case format, example generator), which stage 6 then uses.
- Record it: `workflow_complete` with `node: "Task_DepsL3"`.
- next: → `Fork_DepsL3`

## Done — Adjudicated (`End_AdjL2`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Do all of — `Fork_DepsL3`

- Work every branch; none is optional. Branches: → `Task_AdjDepsL3` (Adjudicate L3 dependencies), → `Task_L3Ready` (Check L3 readiness)
- The engine passes through this gateway itself; there is nothing to record here.

### 11. Adjudicate L3 dependencies (`Task_AdjDepsL3`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `decision-audit`.
- What: FHIR modeller and terminologist: one row per candidate IG, rejected ones included.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjDepsL3` (Adjudicated)

### 12. Check L3 readiness (`Task_L3Ready`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l3-readiness`.
- What: The order rule as a check with its own contract (skill l3-readiness).
- Record it: `workflow_complete` with `node: "Task_L3Ready"`.
- next: → `Gateway_L3Ready` (L1 extraction and L2 assets exist, review requested?)

## Done — Adjudicated (`End_AdjDepsL3`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — L1 extraction and L2 assets exist, review requested? (`Gateway_L3Ready`)

- Decided on Task_L3Ready's ready: yes only when every L3 asset about to be written has an L2 asset upstream, every L2 asset an L1 node, and each review has been requested (opened and staged, verdict not awaited).
- Call `workflow_complete` with `node: "Gateway_L3Ready"` and `outcome` set to the label that holds:
  - «yes» → `Task_L3` (6 · Produce L3 assets)
  - «no» → `Task_L2` (4 · Create / adapt L2 DAK assets)

### 13. 6 · Produce L3 assets (`Task_L3`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l3-fhir-authoring`, `l2-dak-authoring`, `smart-base-tools`, `feature-staging`.
- What: The mapping and pipeline of dak-l3-ig.bpmn, up to a clean IG build.
- Record it: `workflow_complete` with `node: "Task_L3"`.
- next: → `Fork_L3`

### Do all of — `Fork_L3`

- Work every branch; none is optional. Branches: → `Task_AdjL3` (Review each L3 asset (before / after if adapted)), → `Task_DescribeApp` (7 · L4: describe the consuming application)
- The engine passes through this gateway itself; there is nothing to record here.

### 14. Review each L3 asset (before / after if adapted) (`Task_AdjL3`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`, `ig-ast-delta`, `wireframe-design-review`, `fhir-questionnaire-wireframe`.
- What: One review item per created or changed resource: differential, each Questionnaire against the L2 wireframe it was derived from (field to item: fhir-harness fhir-questionnaire-wireframe, whose check is check-wireframe-questionnaire), CQL beside its DMN rule with test results, terminology expansions.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjL3` (Adjudicated)

### 15. 7 · L4: describe the consuming application (`Task_DescribeApp`)

- Who: the `Requester (country team / implementer)` lane (role `user`).
- Skill: `l4-application-brief`.
- What: Who uses it, on what device, which L2 processes and L3 resources it covers, connectivity, the systems it talks to.
- Record it: `workflow_complete` with `node: "Task_DescribeApp"`.
- next: → `Task_WireframeApp` (8a · L4: wireframe the application)

## Done — Adjudicated (`End_AdjL3`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 16. 8a · L4: wireframe the application (`Task_WireframeApp`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `wireframe-design-review`.
- What: To-be mode, from the stage-7 intent: two or more candidates, web and mobile, with real content from the L2 personas and scenarios.
- Record it: `workflow_complete` with `node: "Task_WireframeApp"`.
- next: → `Task_BuildApp` (8b · L4: build the consuming application)

### 17. 8b · L4: build the consuming application (`Task_BuildApp`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l4-application-build`.
- What: Against the stage-6 IG build, with conformance tests from the IG's examples and test cases.
- Record it: `workflow_complete` with `node: "Task_BuildApp"`.
- next: → `Fork_App`

### Do all of — `Fork_App`

- Work every branch; none is optional. Branches: → `Task_AdjApp` (Adjudicate the L4 wireframes and application), → `EndEvent_AppBuilt` (L4 application built)
- The engine passes through this gateway itself; there is nothing to record here.

### 18. Adjudicate the L4 wireframes and application (`Task_AdjApp`)

- Who: the `Human adjudicators` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`, `wireframe-design-review`.
- What: Business analyst and clinical SME walk it through each L2 user scenario; FHIR modeller checks L3 conformance.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_AdjApp` (Adjudicated)

## Done — L4 application built (`EndEvent_AppBuilt`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Adjudicated (`End_AdjApp`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

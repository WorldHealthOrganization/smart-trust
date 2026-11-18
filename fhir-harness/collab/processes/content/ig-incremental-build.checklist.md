<!-- GENERATED from fhir-harness/collab/processes/content/ig-incremental-build.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Incremental IG build

> **Generated, and not the authority.** This is `fhir-harness/collab/processes/content/ig-incremental-build.bpmn` (process `Process_IgIncremental`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

An incremental build for a FHIR Implementation Guide: compile, validate and re-render only the dependency cone of a change, then gate on QA and deploy.

## Begin — Source changed (`StartEvent_SourceChanged`)

- Begin here: A push to a PR branch (review path) or to main / a release (publish path).
- Call `workflow_start` with `process: "Process_IgIncremental"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Restore` (Restore derived state)

### 1. Restore derived state (`Task_Restore`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Calls the harness's one cache process, `Process_Cache` (cat-harness, skill `cache-first-ci`), with this IG build as its consumer.
- A subprocess (`Process_Cache`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_Restore` (Cache usable?)

### Decide — Cache usable? (`Gateway_Restore`)

- Answered by the exit code of `ig-cache restore` (Task_Restore): 0 is a usable cache and takes `yes`, into the cone machinery.
- Call `workflow_complete` with `node: "Gateway_Restore"` and `outcome` set to the label that holds:
  - «yes» → `Task_Cone` (Compute the cone of the change)
  - «no» → `Task_FullBuild` (Full publisher build)
  - «environment error» → `Task_LogEnvError` (Log the environment error on the bean)

### 2. Compute the cone of the change (`Task_Cone`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: `fsh-cone --changed` (scripts/fsh-cone.ts) over the changed files: the forward cone is what to rebuild, the backward cone is what to check out.
- Record it: `workflow_complete` with `node: "Task_Cone"`.
- next: → `Task_ConeReport` (Post the cone report on the PR)

### 3. Full publisher build (`Task_FullBuild`)

- Who: the `Publisher + validator services (JVM)` lane (role `ig-publisher-service`).
- Skill: `ig-publication`.
- What: Exit 1 or 3 from restore: the whole IG is built.
- Record it: `workflow_complete` with `node: "Task_FullBuild"`.
- next: → `Task_Qa` (Run QC gates on the aggregate QA)

### 4. Log the environment error on the bean (`Task_LogEnvError`)

- Who: the `FHIR modeller / PR author (person + authoring agent)` lane (role `fhir-modeller`).
- Skill: `todo-manager`.
- What: Exit 2 from restore: the cache store or the toolchain could not be reached.
- Record it: `workflow_complete` with `node: "Task_LogEnvError"`.
- next: → `EndEvent_EnvError` (Build stopped: environment error)

### 5. Post the cone report on the PR (`Task_ConeReport`)

- Who: the `PR reviewer / QC reviewer` lane (role `qc-reviewer`).
- Skill: `quality-control`, `quality-control`, `quality-control`.
- What: Review path: the reviewer sees what this change rebuilds — how many artefacts, and whether a hub (a shared RuleSet, CQL library or value set) is touched — before the build finishes.
- Record it: `workflow_complete` with `node: "Task_ConeReport"`.
- next: → `Task_Checkout` (Restricted checkout of the backward cone)

### 6. Run QC gates on the aggregate QA (`Task_Qa`)

- Who: the `PR reviewer / QC reviewer` lane (role `qc-reviewer`).
- Skill: `quality-control`.
- What: qa.json is the aggregate of per-artefact outcomes; the reviewer reads the cone's rows first.
- Record it: `workflow_complete` with `node: "Task_Qa"`.
- next: → `Gateway_QcPass` (QC clean?)

## Done — Build stopped: environment error (`EndEvent_EnvError`)

- The instance completes here: Nothing was built. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Restricted checkout of the backward cone (`Task_Checkout`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: git sparse-checkout of the cone's files plus sushi-config.yaml, ig.ini and the alias files — a median of three files, p90 eleven, measured on the SMART Immunizations IG.
- Record it: `workflow_complete` with `node: "Task_Checkout"`.
- next: → `Task_Sushi` (SUSHI on the restricted tank)

### Decide — QC clean? (`Gateway_QcPass`)

- Decided in the reviewer's QC gate (Task_Qa, `quality-control`) over qa.json, the aggregate of per-artefact outcomes, reading the cone's rows first.
- Call `workflow_complete` with `node: "Gateway_QcPass"` and `outcome` set to the label that holds:
  - «no» → `Task_QcBeans` (File QC findings as beans)
  - «yes» → `Gateway_Path` (PR branch, or main / release?)

### 8. SUSHI on the restricted tank (`Task_Sushi`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `l3-fhir-authoring`.
- What: Compile the restricted checkout with SUSHI — the cone's FSH, not the whole IG.
- Record it: `workflow_complete` with `node: "Task_Sushi"`.
- next: → `Task_ContextLoad` (Load or reuse the warm context)

### 9. File QC findings as beans (`Task_QcBeans`)

- Who: the `FHIR modeller / PR author (person + authoring agent)` lane (role `fhir-modeller`).
- Skill: `todo-manager`.
- What: QC failed on the aggregate: file each finding as a bean, so it is tracked on the work plan rather than lost in qa.json.
- Record it: `workflow_complete` with `node: "Task_QcBeans"`.
- next: → `EndEvent_FindingsQc` (Findings back to the author)

### Decide — PR branch, or main / release? (`Gateway_Path`)

- Answered by the push that started the process.
- Call `workflow_complete` with `node: "Gateway_Path"` and `outcome` set to the label that holds:
  - «PR branch» → `Task_DeployPreview` (Deploy the preview site)
  - «main / release» → `Task_Deploy` (Deploy the site)

### 10. Load or reuse the warm context (`Task_ContextLoad`)

- Who: the `Publisher + validator services (JVM)` lane (role `ig-publisher-service`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: The validator's server mode holds the loaded dependency packages, snapshots and expansions in its session cache.
- Record it: `workflow_complete` with `node: "Task_ContextLoad"`.
- next: → `Task_Validate` (Validate the cone (fhir_validate))

## Done — Findings back to the author (`EndEvent_FindingsQc`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 11. Deploy the preview site (`Task_DeployPreview`)

- Who: the `PR reviewer / QC reviewer` lane (role `qc-reviewer`).
- Skill: `content-publish`.
- What: A preview never seeds the shared cache.
- Record it: `workflow_complete` with `node: "Task_DeployPreview"`.
- next: → `EndEvent_Preview` (Preview published)

### 12. Deploy the site (`Task_Deploy`)

- Who: the `Publication manager — deploy and seed` lane (role `publication-manager`).
- Skill: `content-publish`, `ig-publication`.
- What: Deploy the site built from main or a release.
- Record it: `workflow_complete` with `node: "Task_Deploy"`.
- next: → `Task_Seed` (Seed the cache from the green build)

### 13. Validate the cone (fhir_validate) (`Task_Validate`)

- Who: the `Publisher + validator services (JVM)` lane (role `ig-publisher-service`).
- Skill: `fhir-validation`.
- What: Validate the cone's resources against the warm validator and report the cone that was checked.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `Gateway_Valid` (Valid?)

## Done — Preview published (`EndEvent_Preview`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 14. Seed the cache from the green build (`Task_Seed`)

- Who: the `Publication manager — deploy and seed` lane (role `publication-manager`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: Only a green build of main or a release seeds.
- Record it: `workflow_complete` with `node: "Task_Seed"`.
- next: → `EndEvent_Published` (IG site published, cache seeded)

### Decide — Valid? (`Gateway_Valid`)

- Answered by Task_Validate — the cone's resources checked against the warm validator.
- Call `workflow_complete` with `node: "Gateway_Valid"` and `outcome` set to the label that holds:
  - «no» → `Task_LogFindings` (Log findings on the bean)
  - «yes» → `Task_Render` (Re-render the cone's records (fhir_narrative · skip lists))

## Done — IG site published, cache seeded (`EndEvent_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 15. Log findings on the bean (`Task_LogFindings`)

- Who: the `FHIR modeller / PR author (person + authoring agent)` lane (role `fhir-modeller`).
- Skill: `todo-manager`.
- What: Validation failed: record the findings on the change's bean, so the work plan says what blocks it.
- Record it: `workflow_complete` with `node: "Task_LogFindings"`.
- next: → `EndEvent_Findings` (Findings back to the author)

### 16. Re-render the cone's records (fhir_narrative · skip lists) (`Task_Render`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: Narrative and fragments for the cone only: the publisher's -no-validate / -no-narrative complements today, Rapido's differential build once its tracker is persisted.
- Record it: `workflow_complete` with `node: "Task_Render"`.
- next: → `Task_Merge` (Merge restored and rebuilt records)

## Done — Findings back to the author (`EndEvent_Findings`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 17. Merge restored and rebuilt records (`Task_Merge`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`.
- What: Combine the restored per-artefact records with the cone's freshly rendered ones into one complete set, so the meta-index rebuild that follows has every artefact's record and never re-derives one.
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `Task_Index` (Rebuild the meta-index (ig_metaindex_rebuild))

### 18. Rebuild the meta-index (ig_metaindex_rebuild) (`Task_Index`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`, `ig-publication`, `ig-publication`.
- What: The whole-IG aggregates only — artifacts, TOC, canonicals, expansions, package, QA aggregate.
- Record it: `workflow_complete` with `node: "Task_Index"`.
- next: → `Task_Site` (Assemble the site)

### 19. Assemble the site (`Task_Site`)

- Who: the `Incremental build (system)` lane (role `build-pipeline`).
- Skill: `ig-publication`.
- What: Assemble the site from the merged records: the IG template and a Jekyll build over output/.
- Record it: `workflow_complete` with `node: "Task_Site"`.
- next: → `Task_Qa` (Run QC gates on the aggregate QA)

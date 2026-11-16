<!-- GENERATED from cat-harness/processes/process/crdm-deliver.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM Phase 6 — implement, MVP, acceptance

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-deliver.bpmn` (process `Process_CRDM_Deliver`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One phase and not three, because the loops say so: an increment the BA rejects, an MVP that is not ready, and stakeholder findings all route back into implementation.

## Begin — Phase begins (`Start_Process_CRDM_Deliver`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Deliver"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_OptionsAnalysis` (Options analysis how to implement)

### 1. Options analysis how to implement (`Call_OptionsAnalysis`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: On the single edge from `Start_Process_CRDM_Deliver` into `A_Implement`, so the approach is chosen before any code exists.
- A subprocess (`Process_OptionsAnalysis`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Implement` (Phase 6: Implement (feature branch + PR))

### 2. Phase 6: Implement (feature branch + PR) (`A_Implement`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `continual-progress`.
- What: Inner loop: agent claims a bean, implements on feature branch, opens PR, posts summary to the issue.
- Record it: `workflow_complete` with `node: "A_Implement"`.
- next: → `A_CodeAudit` (Audit the code nodes the increment adds)

### 3. Audit the code nodes the increment adds (`A_CodeAudit`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: Descend into the review task for what this increment CHANGED IN THE GRAPH — Tool definitions in `tools/` and schema definition nodes under `schemas/`.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_Summary` (Post summary to issue)

### 4. Post summary to issue (`A_Summary`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `staging-review`.
- What: What was accomplished, what remains, and the staging links: one deep link per changed page on the preview, with the same page on main (feedback-deep-links).
- Record it: `workflow_complete` with `node: "A_Summary"`.
- next: → `BA_ReviewIncrement` (Review increment (test behaviour))

### 5. Review increment (test behaviour) (`BA_ReviewIncrement`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`.
- What: Inner loop: the BA tests each delivered increment against the acceptance criteria.
- Record it: `workflow_complete` with `node: "BA_ReviewIncrement"`.
- next: → `GW_IncrementOK` (Meets criteria?)

### Decide — Meets criteria? (`GW_IncrementOK`)

- The BA's result from testing the increment's behaviour.
- Call `workflow_complete` with `node: "GW_IncrementOK"` and `outcome` set to the label that holds:
  - «no» → `A_Implement` (Phase 6: Implement (feature branch + PR))
  - «yes» → `GW_MVPReady` (MVP ready for stakeholders?)

### Decide — MVP ready for stakeholders? (`GW_MVPReady`)

- Asked after an increment passes: is the whole MVP ready for stakeholders?
- Call `workflow_complete` with `node: "GW_MVPReady"` and `outcome` set to the label that holds:
  - «not yet» → `A_Implement` (Phase 6: Implement (feature branch + PR))
  - «yes» → `A_DeployStaging` (Deploy the MVP to staging)

### 6. Deploy the MVP to staging (`A_DeployStaging`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `feature-staging`.
- What: An MVP is shared AS A branches/ DEPLOY, not as a description of one.
- Record it: `workflow_complete` with `node: "A_DeployStaging"`.
- next: → `BA_ShareMVP` (Share MVP with stakeholders)

### 7. Share MVP with stakeholders (`BA_ShareMVP`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`, `staging-review`.
- What: Outer loop: the BA presents the accumulated increments to stakeholders as a testable MVP.
- Record it: `workflow_complete` with `node: "BA_ShareMVP"`.
- next: → `S_TestMVP` (Test MVP in own context)

### 8. Test MVP in own context (`S_TestMVP`)

- Who: the `Stakeholders` lane (role `stakeholder`).
- What: Stakeholders test the delivered feature in their own workflow, with their own data.
- Record it: `workflow_complete` with `node: "S_TestMVP"`.
- next: → `GW_StakeholderOK` (Accepted?)

### Decide — Accepted? (`GW_StakeholderOK`)

- The stakeholder's result from testing the MVP in their own context.
- Call `workflow_complete` with `node: "GW_StakeholderOK"` and `outcome` set to the label that holds:
  - «findings» → `BA_TranslateFeedback` (Translate feedback into agent direction)
  - «accepted» → `End_Process_CRDM_Deliver` (Phase complete)

### 9. Translate feedback into agent direction (`BA_TranslateFeedback`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`.
- What: The BA translates stakeholder findings into actionable direction: new beans or bean updates for the agent.
- Record it: `workflow_complete` with `node: "BA_TranslateFeedback"`.
- next: → `A_Implement` (Phase 6: Implement (feature branch + PR))

## Done — Phase complete (`End_Process_CRDM_Deliver`)

- The instance completes here: THERE IS NO THEME REVIEW HERE, and that is a rule rather than an omission: theme review happens at INGESTION ONLY, called from `ingest-theme.bpmn`, where the graphical assets arrive and are determined, not here, where they have already been built into what shipped. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

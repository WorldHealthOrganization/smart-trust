<!-- GENERATED from cat-harness/processes/process/crdm-requirements-definition.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM Phases 2–4 — BPA and requirements

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-requirements-definition.bpmn` (process `Process_CRDM_Requirements`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Map the current workflow, then define the requirements and the impact they carry, and loop until approved.

## Begin — Phase begins (`Start_Process_CRDM_Requirements`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Requirements"` and the subject this run is about; keep the instance id it returns.
- next: → `A_MapWorkflow` (Phase 2: Map current workflow (BPA))

### 1. Phase 2: Map current workflow (BPA) (`A_MapWorkflow`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `bpmn-authoring`.
- What: Business-process analysis here means reading the existing diagrams under processes/ and drawing the gap, so the skill that implements this step is the BPMN one.
- Record it: `workflow_complete` with `node: "A_MapWorkflow"`.
- next: → `A_DefineReqs` (Phases 3–4: Define requirements + impact)

### 2. Phases 3–4: Define requirements + impact (`A_DefineReqs`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`, `data-modelling`.
- What: Two skills, because this step is two things: the requirements come from the CRDM process, the impact half is a question about the entities and relations the change touches, which is what data modelling answers; a folio-content skill such as `content-graph` is not one this harness diagram can bind.
- Record it: `workflow_complete` with `node: "A_DefineReqs"`.
- next: → `GW_RenderedSurface` (Does a requirement change a rendered surface (page, visualiser, navbar, form, app screen)?)

### Decide — Does a requirement change a rendered surface (page, visualiser, navbar, form, app screen)? (`GW_RenderedSurface`)

- Answered from the requirements A_DefineReqs just wrote: does any of them change what a person sees — a page, a visualiser, the navbar, a form, an app screen?
- Call `workflow_complete` with `node: "GW_RenderedSurface"` and `outcome` set to the label that holds:
  - «yes» → `Call_Wireframe` (Wireframe candidates (web + mobile))
  - «no» → `A_CompareOptions` (Phase 4a: Compare the viable options)

### 3. Wireframe candidates (web + mobile) (`Call_Wireframe`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `wireframe-design-review`.
- What: Design use of wireframe-design-review, before implementation: a written design intent, at least two mid-fidelity candidates each with a web and a mobile layout, the mechanical checks, and a blind review.
- A subprocess (`Process_WireframeDesignReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_CompareOptions` (Phase 4a: Compare the viable options)

### 4. Phase 4a: Compare the viable options (`A_CompareOptions`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `decision-comparison`.
- What: Phase 4 often ends with a CHOICE rather than a plan, and this is the step that hands it over.
- Record it: `workflow_complete` with `node: "A_CompareOptions"`.
- next: → `BA_ReviewReqs` (Review requirements and impact analysis)

### 5. Review requirements and impact analysis (`BA_ReviewReqs`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `crdm-requirements-workflow`.
- What: The BA reviews the formal requirements and the impact analysis the agent produced.
- Record it: `workflow_complete` with `node: "BA_ReviewReqs"`.
- next: → `S_ApproveReqs` (Approve requirements)

### 6. Approve requirements (`S_ApproveReqs`)

- Who: the `Stakeholders` lane (role `stakeholder`).
- What: Stakeholders approve the requirements and impact analysis on the issue, or send them back for revision.
- Record it: `workflow_complete` with `node: "S_ApproveReqs"`.
- next: → `GW_Reqs` (BA approves?)

### Decide — BA approves? (`GW_Reqs`)

- The BA's answer to the requirements and impact.
- Call `workflow_complete` with `node: "GW_Reqs"` and `outcome` set to the label that holds:
  - «revise» → `A_DefineReqs` (Phases 3–4: Define requirements + impact)
  - «yes» → `End_Process_CRDM_Requirements` (Phase complete)

## Done — Phase complete (`End_Process_CRDM_Requirements`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from fhir-harness/processes/content/questionnaire-wireframe-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Questionnaire wireframe review

> **Generated, and not the authority.** This is `fhir-harness/processes/content/questionnaire-wireframe-review.bpmn` (process `Process_QuestionnaireWireframeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A built FHIR Questionnaire shown the way a person will meet it — a mid-fidelity wireframe at web and mobile width, and a live LHC-Forms form view — checked field for field against the L2 wireframe it was derived from, reviewed as a design, staged with deep links, and changed through requests that sa

## Begin — Questionnaire built (`Start_Built`)

- Begin here: Reached after SUSHI has compiled the Questionnaire to JSON (l3-fhir-pipeline, Task_Sushi), or when a published Questionnaire is reviewed as-is.
- Call `workflow_start` with `process: "Process_QuestionnaireWireframeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Read` (Read the built Questionnaire JSON)

### 1. Read the built Questionnaire JSON (`Task_Read`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `fhir-questionnaire-wireframe`.
- What: fsh-generated/resources/Questionnaire-<id>.json, or the IG's published Questionnaire-<id>.json — never FSH.
- Record it: `workflow_complete` with `node: "Task_Read"`.
- next: → `Task_Render` (Render the wireframe and the LHC-Forms view)

### 2. Render the wireframe and the LHC-Forms view (`Task_Render`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `fhir-questionnaire-wireframe`.
- What: A mid-fidelity wireframe with one field per answerable item, each carrying data-element and sitting in a data-layout web or mobile subtree; and the form view, the same JSON in the vendored <lhc-forms> web component on the IG site's form page.
- Record it: `workflow_complete` with `node: "Task_Render"`.
- next: → `Task_Screens` (Screenshots, web and mobile)

### 3. Screenshots, web and mobile (`Task_Screens`)

- Who: the `Build pipeline — rendering, screenshots, fidelity` lane (role `build-pipeline`).
- Skill: `wireframe-design-review`.
- What: cat-harness Tool wireframe-check: 1280×800 and 390×844; renders, no-overflow and no-placeholder, each a script entry.
- Record it: `workflow_complete` with `node: "Task_Screens"`.
- next: → `GW_L2` (L2 wireframe exists?)

### Decide — L2 wireframe exists? (`GW_L2`)

- Answered by the input: was this Questionnaire derived from an L2 wireframe (a chosen wireframe-design-review candidate)?
- Call `workflow_complete` with `node: "GW_L2"` and `outcome` set to the label that holds:
  - «yes» → `Task_Fidelity` (Check field for field)
  - «no» → `Call_Review` (Design review)

### 4. Check field for field (`Task_Fidelity`)

- Who: the `Build pipeline — rendering, screenshots, fidelity` lane (role `build-pipeline`).
- Skill: `fhir-questionnaire-wireframe`.
- What: fhir-harness/scripts/check-wireframe-questionnaire.ts <wireframe.html> <Questionnaire.json>, per layout.
- Record it: `workflow_complete` with `node: "Task_Fidelity"`.
- next: → `Call_Review` (Design review)

### 5. Design review (`Call_Review`)

- Who: the `Business analyst — design review` lane (role `business-analyst`).
- Skill: `wireframe-design-review`.
- What: cat-harness Process_WireframeDesignReview: as-is use for a form that exists, design use for one being designed.
- A subprocess (`Process_WireframeDesignReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_Stage` (Stage the renderings)

### 6. Stage the renderings (`Task_Stage`)

- Who: the `Build pipeline — rendering, screenshots, fidelity` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: The branch's wireframes and form pages published under branches/<slug>/ by feature-staging.
- Record it: `workflow_complete` with `node: "Task_Stage"`.
- next: → `Task_AskReview` (Ask for review with deep links)

### 7. Ask for review with deep links (`Task_AskReview`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `staging-review`.
- What: One deep link per rendered Questionnaire and wireframe, before and after.
- Record it: `workflow_complete` with `node: "Task_AskReview"`.
- next: → `Task_ReviewStaged` (Review the staged form and wireframe)

### 8. Review the staged form and wireframe (`Task_ReviewStaged`)

- Who: the `Clinical reviewer — the staged form` lane (role `clinical-sme`).
- Skill: `fhir-questionnaire-wireframe`.
- What: At the deep links.
- Record it: `workflow_complete` with `node: "Task_ReviewStaged"`.
- next: → `GW_Change` (Change requested?)

### Decide — Change requested? (`GW_Change`)

- Answered by whether a change request (an issue) was opened against this Questionnaire during the review.
- Call `workflow_complete` with `node: "GW_Change"` and `outcome` set to the label that holds:
  - «no» → `End_Accepted` (Form accepted)
  - «yes» → `Task_Triage` (Triage the change request)

## Done — Form accepted (`End_Accepted`)

- The instance completes here: The Questionnaire and its wireframe agree and the reviewers raised no change. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 9. Triage the change request (`Task_Triage`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `content-feedback`.
- What: content-feedback triages the issue; when a review round is open it joins a change-set through public-comment instead.
- Record it: `workflow_complete` with `node: "Task_Triage"`.
- next: → `Task_Apply` (Apply it to the other side)

### 10. Apply it to the other side (`Task_Apply`)

- Who: the `FHIR modeller` lane (role `fhir-modeller`).
- Skill: `l3-fhir-authoring`.
- What: The side the request edited is the source of the change.
- Record it: `workflow_complete` with `node: "Task_Apply"`.
- next: → `Task_Read` (Read the built Questionnaire JSON)

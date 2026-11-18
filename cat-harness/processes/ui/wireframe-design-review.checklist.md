<!-- GENERATED from cat-harness/processes/ui/wireframe-design-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Wireframe design review

> **Generated, and not the authority.** This is `cat-harness/processes/ui/wireframe-design-review.bpmn` (process `Process_WireframeDesignReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

WireGen (methodologies/wiregen) made executable: a written design intent, at least two mid-fidelity candidates each with a web AND a mobile layout, mechanical checks, a blind per-criterion review, adjudication where reviewers disagree, and a recorded choice.

## Begin — A UI needs designing (`Start_WDR`)

- Begin here.
- Call `workflow_start` with `process: "Process_WireframeDesignReview"` and the subject this run is about; keep the instance id it returns.
- next: → `D_Intent` (Write the design intent)

### 1. Write the design intent (`D_Intent`)

- Who: the `Designer` lane (role `authoring-agent`).
- Skill: `wireframe-design-review`.
- What: A short statement of who the screen is for, what they need to do, and what it must show.
- Record it: `workflow_complete` with `node: "D_Intent"`.
- next: → `D_Candidates` (Produce >= 2 candidates, web + mobile)

### 2. Produce >= 2 candidates, web + mobile (`D_Candidates`)

- Who: the `Designer` lane (role `authoring-agent`).
- Skill: `wireframe-design-review`.
- What: Mid-fidelity HTML: monochrome, real folio content, semantic icons, no placeholder text.
- Record it: `workflow_complete` with `node: "D_Candidates"`.
- next: → `D_Check` (Mechanical checks, both viewports)

### 3. Mechanical checks, both viewports (`D_Check`)

- Who: the `Designer` lane (role `authoring-agent`).
- Skill: `wireframe-design-review`.
- What: Tool wireframe-check renders every candidate at a web and a mobile viewport.
- Record it: `workflow_complete` with `node: "D_Check"`.
- next: → `GW_Checks` (Checks pass?)

### Decide — Checks pass? (`GW_Checks`)

- Answered by the mechanical checks at both viewports.
- Call `workflow_complete` with `node: "GW_Checks"` and `outcome` set to the label that holds:
  - «yes» → `R_Review` (Blind review per criterion)
  - «no» → `D_Candidates` (Produce >= 2 candidates, web + mobile)

### 4. Blind review per criterion (`R_Review`)

- Who: the `Feedback providers` lane (role `feedback-provider`).
- Skill: `wireframe-design-review`.
- What: Criteria: intent-fit, web usability, mobile usability, accessibility, and alternatives considered.
- Record it: `workflow_complete` with `node: "R_Review"`.
- next: → `GW_Agree` (Entries agree?)

### Decide — Entries agree? (`GW_Agree`)

- Do the blind reviewers' entries agree?
- Call `workflow_complete` with `node: "GW_Agree"` and `outcome` set to the label that holds:
  - «no» → `Call_Adjudicate` (Adjudication)
  - «yes» → `Call_Choose` (Choose a candidate)

### 5. Adjudication (`Call_Adjudicate`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- What: folio-assistant's adjudication: the adjudication leads, the checker's entry is kept, and the dispensation carries its reason.
- A subprocess (`Process_CriterionAdjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Call_Choose` (Choose a candidate)

### 6. Choose a candidate (`Call_Choose`)

- Who: the `Adjudicator` lane (role `adjudicator`).
- What: A one-off choice between surviving candidates.
- A subprocess (`Process_OptionsAnalysis`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Iterate` (Revise the intent?)

### Decide — Revise the intent? (`GW_Iterate`)

- Asked after a candidate is chosen: should the design intent be revised?
- Call `workflow_complete` with `node: "GW_Iterate"` and `outcome` set to the label that holds:
  - «yes» → `D_Intent` (Write the design intent)
  - «no» → `End_WDR` (Wireframe accepted)

## Done — Wireframe accepted (`End_WDR`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

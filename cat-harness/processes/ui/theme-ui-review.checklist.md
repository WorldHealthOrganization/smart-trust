<!-- GENERATED from cat-harness/processes/ui/theme-ui-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Theme and UI review — at ingestion

> **Generated, and not the authority.** This is `cat-harness/processes/ui/theme-ui-review.bpmn` (process `Process_ThemeUIReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Reviewing GRAPHICAL ASSETS AS THEY ARE INGESTED — accessibility, branding, languages — in the context of the website or app design they are for, to determine what the graphical assets and the UI are going to be.

## Begin — Graphical assets ingested (`Start_TUR`)

- Begin here.
- Call `workflow_start` with `process: "Process_ThemeUIReview"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Inventory` (Inventory the ingested assets)

### 1. Inventory the ingested assets (`A_Inventory`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: Which graphical assets arrived, for which surfaces of the website or app design, in which locales, and at which VIEWPORTS: every surface at a web width and at a mobile width.
- Record it: `workflow_complete` with `node: "A_Inventory"`.
- next: → `A_Accessibility` (Accessibility: measure, do not assert)

### 2. Accessibility: measure, do not assert (`A_Accessibility`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: Contrast COMPUTED against the real ground, including the worst case a backdrop can present; a non-colour channel wherever colour carries meaning (SC 1.4.1); an accessible name on every region; keyboard and focus order.
- Record it: `workflow_complete` with `node: "A_Accessibility"`.
- next: → `A_Branding` (Branding: does it read as this layer?)

### 3. Branding: does it read as this layer? (`A_Branding`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: Marks, palettes and art against the layer's own declaration rather than a remembered style.
- Record it: `workflow_complete` with `node: "A_Branding"`.
- next: → `A_Locales` (Languages: extracted, rendered, and RTL)

### 4. Languages: extracted, rendered, and RTL (`A_Locales`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: Every user-facing string reaches the .pot; every declared locale renders without clipping or overflow; right-to-left is laid out rather than mirrored by accident.
- Record it: `workflow_complete` with `node: "A_Locales"`.
- next: → `R_Judge` (Judge the assets in their design)

### 5. Judge the assets in their design (`R_Judge`)

- Who: the `Reviewer` lane (role `reviewer`).
- What: A person looks at the ingested assets laid out in the design they are for, at BOTH a web and a mobile width.
- Record it: `workflow_complete` with `node: "R_Judge"`.
- next: → `GW_Findings` (Findings?)

### Decide — Findings? (`GW_Findings`)

- The reviewer's judgement of the ingested assets in their design.
- Call `workflow_complete` with `node: "GW_Findings"` and `outcome` set to the label that holds:
  - «yes» → `A_RaiseFindings` (Raise findings before the assets land)
  - «none» → `End_TUR` (Assets reviewed)

### 6. Raise findings before the assets land (`A_RaiseFindings`)

- Who: the `Agent` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: Findings go back to whoever authored the choice, because the choice was theirs: a theme is picked per note by a human or an agent, and there is no mapping to correct instead.
- Record it: `workflow_complete` with `node: "A_RaiseFindings"`.
- next: → `End_TUR` (Assets reviewed)

## Done — Assets reviewed (`End_TUR`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from cat-harness/processes/process/swot-analysis.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — SWOT situation analysis

> **Generated, and not the authority.** This is `cat-harness/processes/process/swot-analysis.bpmn` (process `Process_SwotAnalysis`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Situation analysis over two axes — internal/external and helpful/harmful — producing the raw material a decision is made from, and NEVER the decision.

## Begin — A situation must be understood (`Start_Process_SwotAnalysis`)

- Begin here.
- Call `workflow_start` with `process: "Process_SwotAnalysis"` and the subject this run is about; keep the instance id it returns.
- next: → `A_FrameSubject` (Name the subject and the level)

### 1. Name the subject and the level (`A_FrameSubject`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `swot-analysis`.
- What: One sentence naming WHAT is being analysed and at WHICH level — individual, organisational, national, international.
- Record it: `workflow_complete` with `node: "A_FrameSubject"`.
- next: → `A_ScanExternal` (Scan the environment opportunities and threats)

### 2. Scan the environment opportunities and threats (`A_ScanExternal`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `swot-analysis`.
- What: The external axis, first, per Weihrich.
- Record it: `workflow_complete` with `node: "A_ScanExternal"`.
- next: → `A_ScanInternal` (Scan the subject strengths and weaknesses)

### 3. Scan the subject strengths and weaknesses (`A_ScanInternal`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `swot-analysis`.
- What: The internal axis.
- Record it: `workflow_complete` with `node: "A_ScanInternal"`.
- next: → `A_GroupReview` (Pool knowledge across participants)

### 4. Pool knowledge across participants (`A_GroupReview`)

- Who: the `Stakeholder` lane (role `stakeholder`).
- Skill: `swot-analysis`.
- What: The four lists are reviewed by more than the person who wrote them.
- Record it: `workflow_complete` with `node: "A_GroupReview"`.
- next: → `A_RecordAmbiguous` (Record what did not classify cleanly)

### 5. Record what did not classify cleanly (`A_RecordAmbiguous`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `swot-analysis`.
- What: Factors that sit in two quadrants, or in none, are written down as such.
- Record it: `workflow_complete` with `node: "A_RecordAmbiguous"`.
- next: → `A_Cross` (Cross the axes into SO, WO, ST, WT)

### 6. Cross the axes into SO, WO, ST, WT (`A_Cross`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `swot-analysis`.
- What: The TOWS matching step, and the only step that produces anything actionable.
- Record it: `workflow_complete` with `node: "A_Cross"`.
- next: → `GW_DecisionFollows` (Does a decision follow?)

### Decide — Does a decision follow? (`GW_DecisionFollows`)

- Is this scan feeding a choice that has to be made now, or is it standing situation analysis?
- Call `workflow_complete` with `node: "GW_DecisionFollows"` and `outcome` set to the label that holds:
  - «yes» → `A_HandOff` (Hand the candidates to a decision methodology)
  - «no» → `End_SituationRecorded` (Situation recorded; no decision in play)

### 7. Hand the candidates to a decision methodology (`A_HandOff`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: The candidate strategies go to `options-analysis`, which selects the decision methodology by context and applies it.
- Record it: `workflow_complete` with `node: "A_HandOff"`.
- next: → `End_HandedToDecision` (Candidates handed to a decision methodology)

## Done — Situation recorded; no decision in play (`End_SituationRecorded`)

- The instance completes here: A SEPARATE end event rather than a short-circuit into the other, because the two are different facts for a reader: "a situation was analysed and nothing was being decided" is not "an analysis fed a decision". `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Candidates handed to a decision methodology (`End_HandedToDecision`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

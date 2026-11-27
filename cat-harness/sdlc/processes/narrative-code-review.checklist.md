<!-- GENERATED from cat-harness/sdlc/processes/narrative-code-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Prose and the code it describes

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/narrative-code-review.bpmn` (process `Process_NarrativeCodeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Judging whether the prose side of a declared prose/code pair still says what the code does, once the machine has done what it can.

## Begin — A declared pair changed (`Start_PairChanged`)

- Begin here.
- Call `workflow_start` with `process: "Process_NarrativeCodeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `A_ReadPairFindings` (Read the pair checks' findings)

### 1. Read the pair checks' findings (`A_ReadPairFindings`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `narrative-asserts-code`.
- What: Open the subject's kg-qa sidecar and list what is open: a failing prose-reviewed-since-code-changed (code moved, prose did not), and every false or undetermined claim from prose-claims-resolve — `bun run cat pairs:claims` prints the full list, including what it did not check.
- Record it: `workflow_complete` with `node: "A_ReadPairFindings"`.
- next: → `GW_Open` (Anything left open?)

### Decide — Anything left open? (`GW_Open`)

- Whether the sidecar holds anything the machine could not settle: a stale pair, or a claim that is false or undetermined.
- Call `workflow_complete` with `node: "GW_Open"` and `outcome` set to the label that holds:
  - «yes» → `A_ReRead` (Re-read the prose against the code)
  - «no» → `End_NothingOpen` (Nothing open — the checks settled it)

### 2. Re-read the prose against the code (`A_ReRead`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `narrative-asserts-code`.
- What: For each open item, read the prose claim beside the code it describes and decide what is true.
- Record it: `workflow_complete` with `node: "A_ReRead"`.
- next: → `GW_Verdict` (What did the re-read find?)

## Done — Nothing open — the checks settled it (`End_NothingOpen`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — What did the re-read find? (`GW_Verdict`)

- The reviewer's reading, one of three: the prose still holds; the prose and the code really disagree; or the reviewer disagrees with a checker's own verdict.
- Call `workflow_complete` with `node: "GW_Verdict"` and `outcome` set to the label that holds:
  - «the prose holds» → `A_Attest` (Attest the pair, with a reason)
  - «they disagree» → `A_RaiseFinding` (Raise a finding against the wrong side)
  - «I disagree with the checker» → `Call_Adjudication` (Adjudicate against the checker)

### 3. Attest the pair, with a reason (`A_Attest`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `narrative-asserts-code`.
- What: The prose holds: record it with `bun run cat pairs:attest -- --sidecar … --by agent|human --reason "…"`, naming what was compared.
- Record it: `workflow_complete` with `node: "A_Attest"`.
- next: → `End_Settled` (Settled, with a record)

### 4. Raise a finding against the wrong side (`A_RaiseFinding`)

- Who: the `Reviewer` lane (role `reviewer`).
- Skill: `content-feedback`.
- What: The prose and the code really disagree: raise a finding that names which side is wrong and why.
- Record it: `workflow_complete` with `node: "A_RaiseFinding"`.
- next: → `End_Settled` (Settled, with a record)

### 5. Adjudicate against the checker (`Call_Adjudication`)

- Who: the `Reviewer` lane (role `reviewer`).
- What: The reviewer and a checker read the same claim differently — a disagreement about ONE kg-qa criterion (prose-claims-resolve).
- A subprocess (`Process_CriterionAdjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Settled` (Settled, with a record)

## Done — Settled, with a record (`End_Settled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

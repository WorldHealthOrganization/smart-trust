<!-- GENERATED from cat-harness/sdlc/processes/upstream-version-adoption.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Adopting an upstream version bump

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/upstream-version-adoption.bpmn` (process `Process_UpstreamAdoption`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A REUSABLE SUBPROCESS, entered once per pinned upstream dependency that has fallen behind a release.

## Begin — Candidate version identified (`Start_Adopt`)

- Begin here.
- Call `workflow_start` with `process: "Process_UpstreamAdoption"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `A_Scope` (Scope the delta pinned → candidate)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Scope the delta pinned → candidate (`A_Scope`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `upstream-version-adoption`.
- What: Restricted to the directories that reach our output — for a Jekyll theme `_sass`, `_includes`, `_layouts`, `assets`.
- Record it: `workflow_complete` with `node: "A_Scope"`.
- next: → `A_Impact` (Impact analysis what of ours binds it)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Impact analysis what of ours binds it (`A_Impact`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `upstream-version-adoption`.
- What: The half a changelog cannot supply, because upstream does not know what you reached into.
- Record it: `workflow_complete` with `node: "A_Impact"`.
- next: → `Task_Mvp` (MVP: build the candidate on a staging branch)

### 4. MVP: build the candidate on a staging branch (`Task_Mvp`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `feature-staging`.
- What: An MVP is a DEPLOYED BUILD, not a description of one.
- Record it: `workflow_complete` with `node: "Task_Mvp"`.
- next: → `Task_Gates` (Run the row's gates tests · e2e · site-links)

### 5. Run the row's gates tests · e2e · site-links (`Task_Gates`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `content-test`.
- What: The `mvp` commands declared for this tenant.
- Record it: `workflow_complete` with `node: "Task_Gates"`.
- next: → `A_Evidence` (Post the MVP evidence staging URL + gate results)

### 6. Post the MVP evidence staging URL + gate results (`A_Evidence`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `delivery-summary`.
- What: Staging URL, gate results and the impact analysis, on the PR.
- Record it: `workflow_complete` with `node: "A_Evidence"`.
- next: → `R_Review` (Review the MVP against what we bind to)

### 7. Review the MVP against what we bind to (`R_Review`)

- Who: the `Reviewer / SME` lane (role `reviewer`).
- Skill: `staging-review`.
- What: A narrower question than "is the new version good": does everything in `binds` still hold, checked against the deployed page.
- Record it: `workflow_complete` with `node: "R_Review"`.
- next: → `GW_Findings` (Findings we can fix?)

### Decide — Findings we can fix? (`GW_Findings`)

- The review of the upstream MVP against what we bind to: are there findings we can fix on our side?
- Call `workflow_complete` with `node: "GW_Findings"` and `outcome` set to the label that holds:
  - «yes» → `A_Impact` (Impact analysis what of ours binds it)
  - «no» → `Call_OptionsAnalysis` (Options analysis adopt · hold · decline)

### 8. Options analysis adopt · hold · decline (`Call_OptionsAnalysis`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: On the single edge into `PM_Decide`, and deliberately not earlier: the MVP build and its gates are HOW the options' costs are measured, so an analysis before `Task_Mvp` would weigh alternatives against no evidence.
- A subprocess (`Process_OptionsAnalysis`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `PM_Decide` (Adopt, hold or decline)

### 9. Adopt, hold or decline (`PM_Decide`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `decision-audit`.
- What: A PERSON decides.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Adopt` (Adopt?)

### Decide — Adopt? (`GW_Adopt`)

- The project manager's decision.
- Call `workflow_complete` with `node: "GW_Adopt"` and `outcome` set to the label that holds:
  - «yes» → `A_ApplyPin` (Move the pin and open the PR)
  - «no» → `A_RecordOutcome` (Record the hold or the decline)

### 10. Move the pin and open the PR (`A_ApplyPin`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `prepare-merge`.
- What: The pin literal moves in the one file `upstream-pins.json` declares, and the PR body says what the version range changed in RENDERED output — the evidence, not just the verdict.
- Record it: `workflow_complete` with `node: "A_ApplyPin"`.
- next: → `Call_BeanClose` (Close the bean)

### 11. Record the hold or the decline (`A_RecordOutcome`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `upstream-version-adoption`.
- What: A HOLD is a block with an expiry and a revisit trigger: a hold with neither cannot be told from abandoned work, and the next watcher run re-raises the same pin with no memory of why it was left.
- Record it: `workflow_complete` with `node: "A_RecordOutcome"`.
- next: → `Call_BeanClose` (Close the bean)

### 12. Close the bean (`Call_BeanClose`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Adopt` (Decision recorded)

## Done — Decision recorded (`End_Adopt`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

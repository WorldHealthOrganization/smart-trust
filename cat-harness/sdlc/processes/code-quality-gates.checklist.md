<!-- GENERATED from cat-harness/sdlc/processes/code-quality-gates.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — The gates a change must pass before it can merge

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/code-quality-gates.bpmn` (process `Process_CodeQualityGates`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The gates a change must pass before it can merge: the jobs of the code-quality workflow, each marked hard, warn-only or not a gate, joined by one question — did every hard one pass.

## Begin — Pull request, push to main, or dispatch (`Start_Change`)

- Begin here.
- Call `workflow_start` with `process: "Process_CodeQualityGates"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_VerdictReuse` (Verdict reuse: tree already green? (NOT A GATE))

### 1. Verdict reuse: tree already green? (NOT A GATE) (`Task_VerdictReuse`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: Bean `qbco`, issue #2456 (owner, 2026-10-07: "1y, 2y, 3y, 4y").
- Record it: `workflow_complete` with `node: "Task_VerdictReuse"`.
- next: → `GW_Fork` (Every job, in parallel)

### Do all of — Every job, in parallel (`GW_Fork`)

- Work every branch; none is optional. Branches: → `Task_Hygiene` (Import hygiene (HARD) and advisories (WARN-ONLY)), → `Task_E2E` (End-to-end + accessibility (HARD)), → `Task_QaWorkingCopy` (QA working copy, built once (NOT A GATE))
- The engine passes through this gateway itself; there is nothing to record here.

### 2. Import hygiene (HARD) and advisories (WARN-ONLY) (`Task_Hygiene`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: FOUR QUESTIONS, ONE RUNNER — bean `7fu5`.
- Record it: `workflow_complete` with `node: "Task_Hygiene"`.
- next: → `GW_Join`

### 3. End-to-end + accessibility (HARD) (`Task_E2E`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: Install Chromium, check the rendered BPMN SVGs are current, then run the Playwright suite, which includes the accessibility checks.
- Record it: `workflow_complete` with `node: "Task_E2E"`.
- next: → `GW_Join`

### 4. QA working copy, built once (NOT A GATE) (`Task_QaWorkingCopy`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: Bean `jtfk`, issue #2456.
- Record it: `workflow_complete` with `node: "Task_QaWorkingCopy"`.
- next: → `GW_Readers` (Every reader of the QA tree)

### Wait for all — `GW_Join`

- Continue only when every one of the 6 incoming branches is done; the engine passes through itself.
- next: → `GW_Hard` (Any HARD gate red?)

### Do all of — Every reader of the QA tree (`GW_Readers`)

- Work every branch; none is optional. Branches: → `Task_TypeScript` (TypeScript: lint, types and tests (HARD)), → `Task_RepositoryGates` (Repository gates (HARD)), → `Task_SkillChain` (Skill-registration chain (UNMASKED)), → `Task_UnrunGates` (Registered gates that never run (HARD))
- The engine passes through this gateway itself; there is nothing to record here.

### Decide — Any HARD gate red? (`GW_Hard`)

- Asked once every parallel gate has joined: did any gate marked HARD fail?
- Call `workflow_complete` with `node: "GW_Hard"` and `outcome` set to the label that holds:
  - «no» → `End_Pass` (Mergeable)
  - «yes» → `End_Fail` (Blocked)

### 5. TypeScript: lint, types and tests (HARD) (`Task_TypeScript`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: Three checks: `bun run cat lint`, `tsc --noEmit` and `bun test`.
- Record it: `workflow_complete` with `node: "Task_TypeScript"`.
- next: → `GW_Join`

### 6. Repository gates (HARD) (`Task_RepositoryGates`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: The 43 repository-gate steps — workflow refs, lane and process documentation, kg:audit:check, detangle, skills, published packages — 150 `bun run` invocations in all.
- Record it: `workflow_complete` with `node: "Task_RepositoryGates"`.
- next: → `Fork_RepositoryGates`

### 7. Skill-registration chain (UNMASKED) (`Task_SkillChain`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: Runs the five `--check` commands that adding a skill stales, each on its own: gen-skill-docs, check:glossary, auto:docs:check, kg:audit:check, kg:detangle:check.
- Record it: `workflow_complete` with `node: "Task_SkillChain"`.
- next: → `GW_Join`

### 8. Registered gates that never run (HARD) (`Task_UnrunGates`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `platform-gates`.
- What: `check:gates-registered`, split out of Task_RepositoryGates by bean `dlqu`: one step of that job measured 1m46s-2m28s across four runs, the longest step in it by a factor of four, and a sequential job is as slow as the sum of its steps.
- Record it: `workflow_complete` with `node: "Task_UnrunGates"`.
- next: → `GW_Join`

## Done — Mergeable (`End_Pass`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Blocked (`End_Fail`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Do all of — `Fork_RepositoryGates`

- Work every branch; none is optional. Branches: → `GW_Join`, → `Task_QaPublish` (Publish QA results (not a gate))
- The engine passes through this gateway itself; there is nothing to record here.

### 9. Publish QA results (not a gate) (`Task_QaPublish`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: Bean `16ei`, arc `3fva`.
- A subprocess (`Process_QaPublish`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Published` (QA results published (or skipped, with a reason))

## Done — QA results published (or skipped, with a reason) (`End_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

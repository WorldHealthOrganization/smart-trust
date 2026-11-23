<!-- GENERATED from smart-base/L2/collab/processes/l2-component-edit-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — L2 component edit and review

> **Generated, and not the authority.** This is `smart-base/L2/collab/processes/l2-component-edit-review.bpmn` (process `Process_L2ComponentEditReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One pass over one L2 DAK component: the agent edits it, runs its checker, renders and stages it with a before/after, and hands it on; review forks off beside the hand-on and never holds it up (adjudication is QA, not a gate).

## Begin — Component pass called (`Start_ComponentPass`)

- Begin here.
- Call `workflow_start` with `process: "Process_L2ComponentEditReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_Rework`

### Merge — `Gateway_Rework`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_Edit` (Edit the component)

### 1. Edit the component (`Task_Edit`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `l2-component-edit-review`.
- What: Create or change the component with the authoring skill the call names, one component per pass.
- Record it: `workflow_complete` with `node: "Task_Edit"`.
- next: → `Task_Check` (Run the component's checker)

### 2. Run the component's checker (`Task_Check`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `content-validate`, `content-test`, `artefact-reachability`.
- What: The mechanical checks for this component, before anyone is asked (skill l2-component-edit-review, column "checker"): BPMN imports in bpmn-js with no warnings and its lanes map to personas (dak-swimlanes.ts); DMN loads, its decisions are reachable (artefact-reachability, audit:reachability) and its t
- Record it: `workflow_complete` with `node: "Task_Check"`.
- next: → `Task_RenderStage` (Render, stage, before/after)

### 3. Render, stage, before/after (`Task_RenderStage`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `before-after-preview`, `feature-staging`.
- What: Render the component the way its reviewer reads it (column "renderer and diff"): the BPMN diagram (render:bpmn) with a visual-diff picture; the DMN decision table (smart-base-transform.py dmn2html) with each rule's L1 citation; the data dictionary's term diff (dak-data-dictionary-diff.ts) and the ch
- Record it: `workflow_complete` with `node: "Task_RenderStage"`.
- next: → `Gateway_HandOnFork` (Hand on and review)

### Do all of — Hand on and review (`Gateway_HandOnFork`)

- Work every branch; none is optional. Branches: → `End_HandedOn` (Handed on, adjudication pending), → `Task_RequestReview` (Ask for review with staging deep links)
- The engine passes through this gateway itself; there is nothing to record here.

## Done — Handed on, adjudication pending (`End_HandedOn`)

- The instance completes here: The calling track continues with this component. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Ask for review with staging deep links (`Task_RequestReview`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `staging-review`, `interaction-modality`.
- What: Ask the person in the reviewing role, following staging-review's deep-link rule: one deep link per changed page and anchor on branches/<slug>/, each beside the same page on main (or "new page"), the pages taken from the change (rendered-impact); say so if there is no preview yet.
- Record it: `workflow_complete` with `node: "Task_RequestReview"`.
- next: → `Call_Review` (Review the staged component)

### 5. Review the staged component (`Call_Review`)

- Who: the `Component reviewer (person)` lane (role `reviewer`).
- Skill: `content-review`, `visual-diff`, `l2-component-edit-review`.
- What: cat-harness's generic review, called: classify what changed, review it, and record a qa-review/v1 QaReview whose subject is the component and whose Decision carries the reviewing role.
- A subprocess (`Process_Review`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_Verdict` (Verdict?)

### Decide — Verdict? (`Gateway_Verdict`)

- approve ends the review; request-changes sends the component back to the edit, which re-stages it and asks again; reject means the component is wrong at the root (wrong source or dependency) and reopens the stage that chose it.
- Call `workflow_complete` with `node: "Gateway_Verdict"` and `outcome` set to the label that holds:
  - «approve» → `End_Approved` (Component approved)
  - «request-changes» → `Gateway_Rework`
  - «reject» → `Task_ReopenUpstream` (Reopen upstream, flag derived assets)

## Done — Component approved (`End_Approved`)

- The instance completes here: adjudication: pending on derived edges becomes the recorded outcome. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Reopen upstream, flag derived assets (`Task_ReopenUpstream`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `todo-manager`, `l2-component-edit-review`.
- What: File a bean against the stage that chose the rejected source or dependency (check for an existing one first), and mark every asset derived from this component adjudication: rejected-upstream on its wasDerivedFrom edge.
- Record it: `workflow_complete` with `node: "Task_ReopenUpstream"`.
- next: → `End_Reopened` (Upstream stage reopened)

## Done — Upstream stage reopened (`End_Reopened`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

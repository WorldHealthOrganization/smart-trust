<!-- GENERATED from smart-base/collab/processes/content/SGAuthoring.DAKLifecycle.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Phase 1: Planning

> **Generated, and not the authority.** This is `smart-base/collab/processes/content/SGAuthoring.DAKLifecycle.bpmn` (process `Process_Planning`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Plans a DAK: scope, team, method, sources, roadmap and consultations, then starts the sprint cycle.

## Begin — DAK Development Initiated (`Start_Planning`)

- Begin here.
- Call `workflow_start` with `process: "Process_Planning"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Scoping` (Define DAK scope, purpose, and target audience)

### 1. Define DAK scope, purpose, and target audience (`Task_Scoping`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `content-plan`.
- Record it: `workflow_complete` with `node: "Task_Scoping"`.
- next: → `Task_FormTeam` (Form DAK development team and define RASCI matrix)

### 2. Form DAK development team and define RASCI matrix (`Task_FormTeam`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `raci`.
- Record it: `workflow_complete` with `node: "Task_FormTeam"`.
- next: → `Task_EstablishProcess` (Establish development process (Agile/Scrum) and tooling)

### 3. Establish development process (Agile/Scrum) and tooling (`Task_EstablishProcess`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- Record it: `workflow_complete` with `node: "Task_EstablishProcess"`.
- next: → `Task_GatherDocs` (Gather source documents (guidelines, registers, policies))

### 4. Gather source documents (guidelines, registers, policies) (`Task_GatherDocs`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `dak-l1-library`.
- Record it: `workflow_complete` with `node: "Task_GatherDocs"`.
- next: → `Task_PlanTimeline` (Draft project roadmap, backlog, and sprint cadence)

### 5. Draft project roadmap, backlog, and sprint cadence (`Task_PlanTimeline`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `release-epic-planning`.
- Record it: `workflow_complete` with `node: "Task_PlanTimeline"`.
- next: → `Task_PlanConsultations` (Plan SME consultation schedule and format)

### 6. Plan SME consultation schedule and format (`Task_PlanConsultations`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `content-plan`.
- Record it: `workflow_complete` with `node: "Task_PlanConsultations"`.
- next: → `Task_AssignWork` (Assign work and begin sprint cycle)

### 7. Assign work and begin sprint cycle (`Task_AssignWork`)

- Who: the `Programme Manager` lane (role `programme-manager`).
- Skill: `todo-manager`.
- Record it: `workflow_complete` with `node: "Task_AssignWork"`.
- next: → `End_Planning` (Planning Complete)

## Done — Planning Complete (`End_Planning`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

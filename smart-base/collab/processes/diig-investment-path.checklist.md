<!-- GENERATED from smart-base/collab/processes/diig-investment-path.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — DIIG — from a health system bottleneck to a costed implementation plan

> **Generated, and not the authority.** This is `smart-base/collab/processes/diig-investment-path.bpmn` (process `Process_DIIG`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The nine-chapter sequence of the WHO/ITU Digital Implementation Investment Guide, as the Guide numbers it.

## Begin — A health programme needs digital support (`Start_Process_DIIG`)

- Begin here: DIIG Chapter 1 — how to use the Guide, its key terms, and WHEN to use it.
- Call `workflow_start` with `process: "Process_DIIG"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `A_FormTeam` (Form the team and establish goals)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Form the team and establish goals (`A_FormTeam`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 2.
- Record it: `workflow_complete` with `node: "A_FormTeam"`.
- next: → `A_MapCurrentState` (Map the current state and confirm bottlenecks)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Map the current state and confirm bottlenecks (`A_MapCurrentState`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 3.1.
- Record it: `workflow_complete` with `node: "A_MapCurrentState"`.
- next: → `A_PrioritizeBottlenecks` (Prioritize, and map to health system challenges)

### 4. Prioritize, and map to health system challenges (`A_PrioritizeBottlenecks`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: DIIG Chapters 3.3 and 3.4.
- Record it: `workflow_complete` with `node: "A_PrioritizeBottlenecks"`.
- next: → `A_DetermineInterventions` (Determine appropriate digital health interventions)

### 5. Determine appropriate digital health interventions (`A_DetermineInterventions`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 4.
- Record it: `workflow_complete` with `node: "A_DetermineInterventions"`.
- next: → `GW_ProgressCheck4` (Progress check 4.5: requirements settled?)

### Decide — Progress check 4.5: requirements settled? (`GW_ProgressCheck4`)

- DIIG's own gate at 4.5, not one added here.
- Call `workflow_complete` with `node: "GW_ProgressCheck4"` and `outcome` set to the label that holds:
  - «no — revisit the bottlenecks» → `A_MapCurrentState` (Map the current state and confirm bottlenecks)
  - «yes» → `A_PlanImplementation` (Plan the implementation)

### 6. Plan the implementation (`A_PlanImplementation`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 5.
- Record it: `workflow_complete` with `node: "A_PlanImplementation"`.
- next: → `A_LinkEnterpriseArchitecture` (Link to the enterprise architecture)

### 7. Link to the enterprise architecture (`A_LinkEnterpriseArchitecture`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 6.
- Record it: `workflow_complete` with `node: "A_LinkEnterpriseArchitecture"`.
- next: → `A_DevelopBudget` (Develop a budget)

### 8. Develop a budget (`A_DevelopBudget`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 7.
- Record it: `workflow_complete` with `node: "A_DevelopBudget"`.
- next: → `A_MonitorAndUseData` (Monitor, and use data effectively)

### 9. Monitor, and use data effectively (`A_MonitorAndUseData`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 8.
- Record it: `workflow_complete` with `node: "A_MonitorAndUseData"`.
- next: → `GW_ProgressCheck8` (Progress check 8.5: implementation on track?)

### Decide — Progress check 8.5: implementation on track? (`GW_ProgressCheck8`)

- DIIG's own gate at 8.5.
- Call `workflow_complete` with `node: "GW_ProgressCheck8"` and `outcome` set to the label that holds:
  - «no — adapt» → `A_MonitorAndUseData` (Monitor, and use data effectively)
  - «yes» → `A_ValueProposition` (Make the value proposition and set next steps)

### 10. Make the value proposition and set next steps (`A_ValueProposition`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `methodology-adoption`.
- What: DIIG Chapter 9.
- Record it: `workflow_complete` with `node: "A_ValueProposition"`.
- next: → `Call_BeanClose` (Close the bean)

### 11. Close the bean (`Call_BeanClose`)

- Who: the `Programme manager` lane (role `programme-manager`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Process_DIIG` (Costed implementation plan, and its case)

## Done — Costed implementation plan, and its case (`End_Process_DIIG`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

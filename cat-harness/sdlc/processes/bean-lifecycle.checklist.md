<!-- GENERATED from cat-harness/sdlc/processes/bean-lifecycle.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Agent bean lifecycle

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/bean-lifecycle.bpmn` (process `Process_BeanLifecycle`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The whole life of a work-plan item, drawn the way every bean-touching process now runs it: OPEN the bean (check before you create, find out whose it is, claim it or leave it alone), do the work keeping the body current, then CLOSE it in a state that says why (complete and archive, scrap with reasons

## Begin — Durable work identified (`Start_DurableWork`)

- Begin here.
- Call `workflow_start` with `process: "Process_BeanLifecycle"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Check before you create (exact-title search), create the bean when none exists, find out whose it is, and claim it — or leave it alone when a sibling holds it.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_Yours` (Bean claimed?)

### Decide — Bean claimed? (`GW_Yours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_Yours"` and `outcome` set to the label that holds:
  - «not yours» → `End_NotYours` (Not yours — left alone)
  - «claimed» → `Task_Work` (Work, keeping the body current (this is 'edit'))

## Done — Not yours — left alone (`End_NotYours`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Work, keeping the body current (this is 'edit') (`Task_Work`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Editing a bean is not a separate ceremony: check off todo items as they happen, append measurements with the command and date that produced them, and record what you now know that the next agent does not.
- Record it: `workflow_complete` with `node: "Task_Work"`.
- next: → `Call_BeanClose` (Close the bean)

### 3. Close the bean (`Call_BeanClose`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: End the bean in a state that says why: done is completed and archived, not wanted is scrapped with its reasons and archived, blocked records what it waits on and goes back to `todo`.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Recorded` (State recorded)

## Done — State recorded (`End_Recorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

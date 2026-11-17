<!-- GENERATED from cat-harness/sdlc/processes/bean-drain.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Drain the beans

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/bean-drain.bpmn` (process `Process_BeanDrain`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Draining open beans with several agents at once, as part of the SDLC: build one queue grouped by owner, then take a bean, open it, work it, close it, and take the next — refilling from the deepest queue when a drainer's list runs dry, until nothing drainable is left.

## Begin — Asked to drain beans (`Drain_Start`)

- Begin here.
- Call `workflow_start` with `process: "Process_BeanDrain"` and the subject this run is about; keep the instance id it returns.
- next: → `Drain_BuildQueue` (Build the queue, grouped by owner)

### 1. Build the queue, grouped by owner (`Drain_BuildQueue`)

- Who: the `Queue keeper` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: Read every bean copy, not only the one this checkout mounts; where copies disagree the newest `updated_at` wins and the disagreement is listed.
- Record it: `workflow_complete` with `node: "Drain_BuildQueue"`.
- next: → `Drain_Next`

### Merge — `Drain_Next`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Drain_More` (A bean left on your list?)

### Decide — A bean left on your list? (`Drain_More`)

- Read off the drainer's own list in the queue file.
- Call `workflow_complete` with `node: "Drain_More"` and `outcome` set to the label that holds:
  - «yes» → `Drain_TakeNext` (Take the next bean)
  - «list empty» → `Drain_Refill` (Refill from the deepest queue)

### 2. Take the next bean (`Drain_TakeNext`)

- Who: the `Drainer` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: The highest-priority bean on this drainer's list that is not marked skip.
- Record it: `workflow_complete` with `node: "Drain_TakeNext"`.
- next: → `Drain_Open` (Open the bean)

### 3. Refill from the deepest queue (`Drain_Refill`)

- Who: the `Queue keeper` lane (role `session-coordinator`).
- Skill: `idle-backlog`.
- What: Refresh the queue file from every bean copy — beans closed, claimed or unblocked since it was built change it — and move beans from the deepest owner's list to the drainer that ran dry.
- Record it: `workflow_complete` with `node: "Drain_Refill"`.
- next: → `Drain_Refilled` (Anything left to drain?)

### 4. Open the bean (`Drain_Open`)

- Who: the `Drainer` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen on the bean just taken: check it, find out whose it is, and claim it — or leave it alone when another agent holds it.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Drain_Claimed` (Bean claimed?)

### Decide — Anything left to drain? (`Drain_Refilled`)

- Answered by the refreshed queue.
- Call `workflow_complete` with `node: "Drain_Refilled"` and `outcome` set to the label that holds:
  - «refilled» → `Drain_TakeNext` (Take the next bean)
  - «queue empty» → `Drain_Drained` (Queue drained)

### Decide — Bean claimed? (`Drain_Claimed`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "Drain_Claimed"` and `outcome` set to the label that holds:
  - «claimed» → `Drain_Work` (Work the bean (PR at the first commit))
  - «not yours» → `Drain_Skip` (Mark it skip on the queue)

## Done — Queue drained (`Drain_Drained`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 5. Work the bean (PR at the first commit) (`Drain_Work`)

- Who: the `Drainer` lane (role `authoring-agent`).
- Skill: `continual-progress`.
- What: Work only the bean OPEN claimed.
- Record it: `workflow_complete` with `node: "Drain_Work"`.
- next: → `Drain_Close` (Close the bean)

### 6. Mark it skip on the queue (`Drain_Skip`)

- Who: the `Drainer` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Record on the queue file that the bean is held elsewhere, and by whom, so no other drainer takes it next.
- Record it: `workflow_complete` with `node: "Drain_Skip"`.
- next: → `Drain_Next`

### 7. Close the bean (`Drain_Close`)

- Who: the `Drainer` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose on the bean just worked: complete and archive it on evidence, scrap it with its reasons, or record its blocker and hand it back to `todo`.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Drain_Next`

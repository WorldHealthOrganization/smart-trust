<!-- GENERATED from cat-harness/sdlc/processes/bean-open.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Open the bean

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/bean-open.bpmn` (process `Process_BeanOpen`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The opening half of every bean's life: check before you create, find out whose it is, and claim it before any work starts — or leave it alone when it is someone else's.

## Begin — Durable work identified (`Open_Start`)

- Begin here.
- Call `workflow_start` with `process: "Process_BeanOpen"` and the subject this run is about; keep the instance id it returns.
- next: → `Open_CheckExists` (Check before you create (exact-title search))

### 1. Check before you create (exact-title search) (`Open_CheckExists`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: STRICT.
- Record it: `workflow_complete` with `node: "Open_CheckExists"`.
- next: → `Open_Exists` (Already exists?)

### Decide — Already exists? (`Open_Exists`)

- Answered by the exact-title check before it (`todo-manager` §'Check before you create'): `beans list --json --search` followed by an exact comparison of titles, since `--search` is fuzzy.
- Call `workflow_complete` with `node: "Open_Exists"` and `outcome` set to the label that holds:
  - «no» → `Open_Create` (Create the bean (agent CLI, not an engine op))
  - «yes» → `Open_Owner` (Whose bean?)

### 2. Create the bean (agent CLI, not an engine op) (`Open_Create`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: `beans create "<title>"`.
- Record it: `workflow_complete` with `node: "Open_Create"`.
- next: → `Open_Claim` (Claim it (status: in-progress))

### Decide — Whose bean? (`Open_Owner`)

- Answered from the existing bean and its surroundings (`bean-coordination`).
- Call `workflow_complete` with `node: "Open_Owner"` and `outcome` set to the label that holds:
  - «someone else's» → `Open_LeaveAlone` (Leave it alone (coordinate instead))
  - «mine / unclaimed» → `Open_Claim` (Claim it (status: in-progress))

### 3. Claim it (status: in-progress) (`Open_Claim`)

- Who: the `Agent (this session)` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Idempotent.
- Record it: `workflow_complete` with `node: "Open_Claim"`.
- next: → `Open_Claimed` (Claimed — caller works it)

### 4. Leave it alone (coordinate instead) (`Open_LeaveAlone`)

- Who: the `Sibling session or human (not yours to close)` lane (role `sibling-session`).
- Skill: `bean-coordination`.
- What: Never resolve, scrap or delete a bean another session or a human owns.
- Record it: `workflow_complete` with `node: "Open_LeaveAlone"`.
- next: → `Open_NotYours` (Not yours — caller stops)

## Done — Claimed — caller works it (`Open_Claimed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Not yours — caller stops (`Open_NotYours`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

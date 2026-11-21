<!-- GENERATED from cat-harness/sdlc/processes/merge-refusal.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — A refused merge-train member

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-refusal.bpmn` (process `Process_MergeRefusal`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

What a merge steward does with a PR it dropped from a merge train: its merge (`merge-base.bpmn`, run with `--no-regen`) refused an authored or undeclared conflict, or the train's combined result failed a gate.

## Begin — Member dropped from a train (`Start_Refused`)

- Begin here.
- Call `workflow_start` with `process: "Process_MergeRefusal"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_BeanOpen` (Open the bean)

### 1. Open the bean (`Call_BeanOpen`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_Record` (Record the refusal on the bean)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Record the refusal on the bean (`Task_Record`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `merge-conflict-patterns`.
- What: The PR, the head sha the train used, the train and its other members, each refused path or failing gate and why.
- Record it: `workflow_complete` with `node: "Task_Record"`.
- next: → `Task_Comment` (Comment on the PR once, linking the bean)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Comment on the PR once, linking the bean (`Task_Comment`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `merge-conflict-patterns`.
- What: One comment per refused PR, edited in place on every later event.
- Record it: `workflow_complete` with `node: "Task_Comment"`.
- next: → `GW_Owner` (Owning session live?)

### Decide — Owning session live? (`GW_Owner`)

- `no` when the session is archived, failed, or unknown to `get_session`, or the PR names none.
- Call `workflow_complete` with `node: "GW_Owner"` and `outcome` set to the label that holds:
  - «yes» → `Task_HandBack` (Hand back, with a fail condition)
  - «no» → `Task_Dispatch` (Dispatch one agent, recorded on the bean)

### 4. Hand back, with a fail condition (`Task_HandBack`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `merge-conflict-patterns`.
- What: The `agent-handoff` format (#1884): Roles, Report to (the PR), Done when, Fails if.
- Record it: `workflow_complete` with `node: "Task_HandBack"`.
- next: → `Task_Fix` (Fix the PR, report on the PR)

### 5. Dispatch one agent, recorded on the bean (`Task_Dispatch`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `dispatch-agent`.
- What: Before the agent starts: the date, why the fail condition fired, the agent's id, its budget.
- Record it: `workflow_complete` with `node: "Task_Dispatch"`.
- next: → `Task_AgentFix` (Merge main in, regenerate, fix mechanical gates)

### 6. Fix the PR, report on the PR (`Task_Fix`)

- Who: the `Owning session` lane (role `sibling-session`).
- Skill: `prepare-merge`.
- What: Claims the refusal bean, brings main in with `merge:main`, settles what it refused, pushes.
- Record it: `workflow_complete` with `node: "Task_Fix"`.
- next: → `GW_FailCond` (Fixed before the fail condition?)

### 7. Merge main in, regenerate, fix mechanical gates (`Task_AgentFix`)

- Who: the `Dispatched agent` lane (role `authoring-agent`).
- Skill: `merge-conflict-patterns`.
- What: Merge commits only; never a force-push.
- Record it: `workflow_complete` with `node: "Task_AgentFix"`.
- next: → `GW_Authored` (Needs an authored choice?)

### Decide — Fixed before the fail condition? (`GW_FailCond`)

- Call `workflow_complete` with `node: "GW_FailCond"` and `outcome` set to the label that holds:
  - «yes» → `Task_Retrain` (Re-enter a train on the new head)
  - «no» → `Task_Dispatch` (Dispatch one agent, recorded on the bean)

### Decide — Needs an authored choice? (`GW_Authored`)

- Two siblings editing one bean, one script changed differently on both sides, a budget exceeded only in combination: each is a choice between authors.
- Call `workflow_complete` with `node: "GW_Authored"` and `outcome` set to the label that holds:
  - «yes» → `Task_AskOwner` (Ask the owner on the PR, both sides quoted)
  - «no» → `Task_Retrain` (Re-enter a train on the new head)

### 8. Re-enter a train on the new head (`Task_Retrain`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `merge-conflict-patterns`.
- What: The next train is the verifier: the executor's own log is evidence, not the close.
- Record it: `workflow_complete` with `node: "Task_Retrain"`.
- next: → `GW_Fate` (The PR's fate?)

### 9. Ask the owner on the PR, both sides quoted (`Task_AskOwner`)

- Who: the `Dispatched agent` lane (role `authoring-agent`).
- Skill: `interaction-modality`.
- Record it: `workflow_complete` with `node: "Task_AskOwner"`.
- next: → `Call_BeanClose_2` (Close the bean)

### Decide — The PR's fate? (`GW_Fate`)

- Call `workflow_complete` with `node: "GW_Fate"` and `outcome` set to the label that holds:
  - «landed» → `Task_Close` (Record the merge commit as evidence)
  - «refused again» → `Task_Record` (Record the refusal on the bean)
  - «closed unmerged» → `Task_Scrap` (Scrap the bean, with the reason)

### 10. Close the bean (`Call_BeanClose_2`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanClosedHow` (How did it end?)

### 11. Record the merge commit as evidence (`Task_Close`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- Record it: `workflow_complete` with `node: "Task_Close"`.
- next: → `Call_BeanClose_2` (Close the bean)

### 12. Scrap the bean, with the reason (`Task_Scrap`)

- Who: the `Merge steward` lane (role `session-coordinator`).
- Skill: `bean-coordination`.
- What: The agent's own `beans update --status scrapped`; never deleted.
- Record it: `workflow_complete` with `node: "Task_Scrap"`.
- next: → `Call_BeanClose_2` (Close the bean)

### Decide — How did it end? (`GW_BeanClosedHow`)

- Which outcome the bean was closed with, so each ends at its own named end event.
- Call `workflow_complete` with `node: "GW_BeanClosedHow"` and `outcome` set to the label that holds:
  - «waiting on the owner» → `End_AwaitOwner` (Waiting on the owner's ruling)
  - «landed» → `End_Closed` (Landed)
  - «closed unmerged» → `End_Scrapped` (PR closed unmerged)

## Done — Waiting on the owner's ruling (`End_AwaitOwner`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Landed (`End_Closed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — PR closed unmerged (`End_Scrapped`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

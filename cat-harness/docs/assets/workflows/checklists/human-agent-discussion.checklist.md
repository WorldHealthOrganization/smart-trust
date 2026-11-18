<!-- GENERATED from bootstrap/processes/human-agent-discussion.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Human–agent discussion

> **Generated, and not the authority.** This is `bootstrap/processes/human-agent-discussion.bpmn` (process `Process_HumanAgentDiscussion`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

A REUSABLE SUB-PROCESS, never an entry point.

## Begin — Something only a person can supply is needed (`Start_HumanAgentDiscussion`)

- Begin here.
- Call `workflow_start` with `process: "Process_HumanAgentDiscussion"` and the subject this run is about; keep the instance id it returns.
- next: → `A_DetermineContext` (Determine the context: what is known, and already decided)

### 1. Determine the context: what is known, and already decided (`A_DetermineContext`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Before composing anything: what is already known, each fact with where it came from; which declaration governs the matter (the layer's `<name>.json`, the diagram the caller is in, the Skill its task names); what state is recorded; and whether the question has ALREADY been decided — by the person ear
- Record it: `workflow_complete` with `node: "A_DetermineContext"`.
- next: → `A_DetermineRoles` (Determine the roles: which you act as, and the person's)

### 2. Determine the roles: which you act as, and the person's (`A_DetermineRoles`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: An Actor performs a task in a Process AS a Role.
- Record it: `workflow_complete` with `node: "A_DetermineRoles"`.
- next: → `A_DetermineProcess` (Determine the process and task, or that you are idle)

### 3. Determine the process and task, or that you are idle (`A_DetermineProcess`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Name the Process, the lane and the task the question belongs to, and say so in the message: "Process: Initialize a harness, at Determine the harness and repositories, as the Bootstrapping Agent".
- Record it: `workflow_complete` with `node: "A_DetermineProcess"`.
- next: → `GW_Determined` (Context, roles and process all determined?)

### Decide — Context, roles and process all determined? (`GW_Determined`)

- Judgement.
- Call `workflow_complete` with `node: "GW_Determined"` and `outcome` set to the label that holds:
  - «yes» → `A_GiveContext` (Say what is being decided, and why it matters now)
  - «no» → `A_AskUndeterminedFirst` (Ask first about what could not be determined)

### 4. Say what is being decided, and why it matters now (`A_GiveContext`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: First, and in the message itself: where you are (the Process and task, as which Role, asking whom — from the three determinations), what the decision is, what depends on it, and what is already known — each fact with where it came from.
- Record it: `workflow_complete` with `node: "A_GiveContext"`.
- next: → `A_LayOutOptions` (Lay out the options, with what each costs)

### 5. Ask first about what could not be determined (`A_AskUndeterminedFirst`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: The caller's question waits, and is counted ("one more question after this").
- Record it: `workflow_complete` with `node: "A_AskUndeterminedFirst"`.
- next: → `A_GiveContext` (Say what is being decided, and why it matters now)

### 6. Lay out the options, with what each costs (`A_LayOutOptions`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Every option the agent could narrow the question to, each with what it costs and what it makes hard to undo.
- Record it: `workflow_complete` with `node: "A_LayOutOptions"`.
- next: → `A_Recommend` (Recommend one, and say what happens with no answer)

### 7. Recommend one, and say what happens with no answer (`A_Recommend`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Mark the option the agent would take and say why.
- Record it: `workflow_complete` with `node: "A_Recommend"`.
- next: → `A_PutQuestion` (Ask ONE question)

### 8. Ask ONE question (`A_PutQuestion`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: One question, answerable by picking.
- Record it: `workflow_complete` with `node: "A_PutQuestion"`.
- next: → `A_Answer` (Answer, decline, or say nothing)

### 9. Answer, decline, or say nothing (`A_Answer`)

- Who: the `Requestor` lane (role `requestor`).
- What: The Requestor's move.
- Record it: `workflow_complete` with `node: "A_Answer"`.
- next: → `GW_WhatCameBack` (What came back?)

### Decide — What came back? (`GW_WhatCameBack`)

- Judgement, exercised by the agent — which is why this gateway carries no computed decision.
- Call `workflow_complete` with `node: "GW_WhatCameBack"` and `outcome` set to the label that holds:
  - «settles it» → `A_RecordAnswer` (Record the answer, and who gave it)
  - «unclear» → `A_FollowUp` (Follow up, narrower)
  - «no answer» → `GW_DefaultAllowed` (Did the caller allow a default?)
  - «declined» → `A_RecordUnsettled` (Record what is still open)

### 10. Record the answer, and who gave it (`A_RecordAnswer`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: In the form the caller asked for — for bootstrap's harness question, a document conforming to discussion.output.schema.json with determinedBy asked.
- Record it: `workflow_complete` with `node: "A_RecordAnswer"`.
- next: → `GW_WhichQuestion` (Was that the caller's question, or a precondition?)

### 11. Follow up, narrower (`A_FollowUp`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: The answer did not settle it: it named a kind rather than an option, or chose two.
- Record it: `workflow_complete` with `node: "A_FollowUp"`.
- next: → `A_Answer` (Answer, decline, or say nothing)

### Decide — Did the caller allow a default? (`GW_DefaultAllowed`)

- Never for a question about the context, the Role or the Process (A_AskUndeterminedFirst): those allow none.
- Call `workflow_complete` with `node: "GW_DefaultAllowed"` and `outcome` set to the label that holds:
  - «yes» → `A_ApplyDefault` (Apply the stated default, and say so)
  - «no» → `A_RecordUnsettled` (Record what is still open)

### 12. Record what is still open (`A_RecordUnsettled`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Declined, or silent where no default is allowed.
- Record it: `workflow_complete` with `node: "A_RecordUnsettled"`.
- next: → `End_Unsettled` (Still open, and said so)

### Decide — Was that the caller's question, or a precondition? (`GW_WhichQuestion`)

- An answer to A_AskUndeterminedFirst settles where the agent is, not what the caller needed: determine the three again with it, then put the caller's question.
- Call `workflow_complete` with `node: "GW_WhichQuestion"` and `outcome` set to the label that holds:
  - «the caller's» → `End_Answered` (Answered)
  - «a precondition: determine again» → `A_DetermineContext` (Determine the context: what is known, and already decided)

### 13. Apply the stated default, and say so (`A_ApplyDefault`)

- Who: the `Agent` lane.
- Skill: `human-agent-discussion`.
- What: Only the default stated in A_Recommend, only where the caller allows one, and recorded as assumed with the default named — never as the person's answer.
- Record it: `workflow_complete` with `node: "A_ApplyDefault"`.
- next: → `End_Defaulted` (Default applied, and said so)

## Done — Still open, and said so (`End_Unsettled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Answered (`End_Answered`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Default applied, and said so (`End_Defaulted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

<!-- GENERATED from cat-harness/processes/process/ask-the-person.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ask the person

> **Generated, and not the authority.** This is `cat-harness/processes/process/ask-the-person.bpmn` (process `Process_AskThePerson`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

The ONE way a question or decision is put to a person.

## Begin — A question is due (`Start_Process_AskThePerson`)

- Begin here.
- Call `workflow_start` with `process: "Process_AskThePerson"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Compose` (Compose the full question)

### 1. Compose the full question (`A_Compose`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `ask-the-person`, `decision-comparison`.
- What: What is being decided, stated as what will differ; every id, path and coined name glossed; every option with its letter, a one-line explanation and its trade-off; the recommendation, first and marked; what will happen if no answer comes.
- Record it: `workflow_complete` with `node: "A_Compose"`.
- next: → `GW_Discussing` (Talking with the person?)

### Decide — Talking with the person? (`GW_Discussing`)

- `yes` when this agent is the one the person is talking with right now.
- Call `workflow_complete` with `node: "GW_Discussing"` and `outcome` set to the label that holds:
  - «yes» → `Call_Discuss` (Discuss it with the person)
  - «no» → `A_HandBack` (Hand back to the discussion)

### 2. Discuss it with the person (`Call_Discuss`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `ask-the-person`, `interaction-modality`, `symbiotic-interaction`.
- What: Bootstrap's human-agent discussion, given the composed question.
- A subprocess (`Process_HumanAgentDiscussion`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Returned` (Answer, default or open question returned)

### 3. Hand back to the discussion (`A_HandBack`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `hand-back-to-discussion`.
- What: The composed question goes, unchanged, to the discussion agent, which asks it through this same process on its `yes` branch and routes the answer back: the sibling's half of `Process_HandBackToDiscussion` (a task here, not a call, because that process calls this one).
- Record it: `workflow_complete` with `node: "A_HandBack"`.
- next: → `End_HandedBack` (Answer returned through the discussion)

## Done — Answer, default or open question returned (`End_Returned`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Answer returned through the discussion (`End_HandedBack`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

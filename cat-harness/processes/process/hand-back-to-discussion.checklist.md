<!-- GENERATED from cat-harness/processes/process/hand-back-to-discussion.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Hand back to the discussion

> **Generated, and not the authority.** This is `cat-harness/processes/process/hand-back-to-discussion.bpmn` (process `Process_HandBackToDiscussion`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a sibling agent gets a card, question, result, blocker or context in front of the person: through the discussion agent that is talking with them, never only in its own thread.

## Begin — The person must see or decide something (`Start_Process_HandBackToDiscussion`)

- Begin here.
- Call `workflow_start` with `process: "Process_HandBackToDiscussion"` and the subject this run is about; keep the instance id it returns.
- next: → `S_Compose` (Compose the hand-back and post it in own thread)

### 1. Compose the hand-back and post it in own thread (`S_Compose`)

- Who: the `Sibling` lane (role `sibling-session`).
- Skill: `hand-back-to-discussion`, `ask-the-person`.
- What: Compose it once, against the input schema: a question is the full ask-the-person input (what will differ, context, lettered options with a one-line trade-off each, the recommendation, what happens with no answer); context, a result or a blocker gets the same stand-alone test.
- Record it: `workflow_complete` with `node: "S_Compose"`.
- next: → `GW_Channel` (Feedback channel in play?)

### Decide — Feedback channel in play? (`GW_Channel`)

- `yes` when the brief or the work names a review sheet, issue or PR where the people concerned read; `no` otherwise.
- Call `workflow_complete` with `node: "GW_Channel"` and `outcome` set to the label that holds:
  - «yes» → `S_Mirror` (Mirror it to the feedback channel)
  - «no» → `GW_ChannelJoin`

### 2. Mirror it to the feedback channel (`S_Mirror`)

- Who: the `Sibling` lane (role `sibling-session`).
- Skill: `hand-back-to-discussion`.
- What: Review sheet: the "Decision needed" block in the row's agent column, Agentic status `Needs you` (the document layer's `review-sheet-script` skill).
- Record it: `workflow_complete` with `node: "S_Mirror"`.
- next: → `GW_ChannelJoin`

### Merge — `GW_ChannelJoin`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `S_HandBack` (Hand it back to the discussion agent)

### 3. Hand it back to the discussion agent (`S_HandBack`)

- Who: the `Sibling` lane (role `sibling-session`).
- Skill: `hand-back-to-discussion`.
- What: By the host's route: `message_coordinator` or `message_thread` in Claude projects; the final report (a json block valid against the input schema) for a subagent; `SendMessage` for a sibling session.
- Record it: `workflow_complete` with `node: "S_HandBack"`.
- next: → `GW_NeedsAnswer` (Needs an answer?)

### Decide — Needs an answer? (`GW_NeedsAnswer`)

- `yes` for kind decision or question; `no` for context, result or blocker.
- Call `workflow_complete` with `node: "GW_NeedsAnswer"` and `outcome` set to the label that holds:
  - «yes» → `D_Ask` (Ask the person)
  - «no» → `D_Inform` (Post it in the discussion)

### 4. Ask the person (`D_Ask`)

- Who: the `Discussion agent` lane (role `session-coordinator`).
- Skill: `ask-the-person`, `hand-back-to-discussion`.
- What: The sibling's ask, unchanged in letters and recommendation, through `Process_AskThePerson`: the full chat text first, naming the sibling and that the answer will be passed on, then the card.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `D_RouteBack` (Route the answer back, quoted)

### 5. Post it in the discussion (`D_Inform`)

- Who: the `Discussion agent` lane (role `session-coordinator`).
- Skill: `hand-back-to-discussion`.
- What: Say it comes from the sibling (title and link) and give the context or result in full.
- Record it: `workflow_complete` with `node: "D_Inform"`.
- next: → `End_Informed` (Person informed)

### 6. Route the answer back, quoted (`D_RouteBack`)

- Who: the `Discussion agent` lane (role `session-coordinator`).
- Skill: `hand-back-to-discussion`.
- What: On `answerRoute`, with the person's own message attached by id where the host allows, so the sibling can treat it as the person's approval.
- Record it: `workflow_complete` with `node: "D_RouteBack"`.
- next: → `D_MarkAnswered` (Mark every copy answered)

## Done — Person informed (`End_Informed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Mark every copy answered (`D_MarkAnswered`)

- Who: the `Discussion agent` lane (role `session-coordinator`).
- Skill: `hand-back-to-discussion`.
- What: Chat copies keep their text: the question struck through and "[Edit: <letter> chosen by <who>, <time>]" added.
- Record it: `workflow_complete` with `node: "D_MarkAnswered"`.
- next: → `S_Act` (Act on the answer)

### 8. Act on the answer (`S_Act`)

- Who: the `Sibling` lane (role `sibling-session`).
- Skill: `hand-back-to-discussion`, `symbiotic-interaction`.
- What: Never ask the person again for what they answered.
- Record it: `workflow_complete` with `node: "S_Act"`.
- next: → `End_Acted` (Answer acted on)

## Done — Answer acted on (`End_Acted`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

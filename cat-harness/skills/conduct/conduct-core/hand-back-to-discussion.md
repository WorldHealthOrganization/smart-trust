---
name: hand-back-to-discussion
description: >
  A sibling agent, spawned during or working beside a live agent-human
  discussion, hands every card, question, decision, result, blocker or piece of
  context back to the discussion agent that is talking with the person, and
  never leaves it only in its own thread. The discussion agent asks the person
  (ask-the-person), marks every copy answered, and routes the answer back. A
  review sheet or issue in play is an extra channel. Use whenever an agent that
  is not the one talking with the person has something the person must see.
input: schemas/skills/hand-back-to-discussion/input.schema.json
output: schemas/skills/hand-back-to-discussion/output.schema.json
---

# Hand back to the discussion

The procedure behind
[`Process_HandBackToDiscussion`](../../../processes/process/hand-back-to-discussion.bpmn).
It joins two rules that already bind: [`ask-the-person`](ask-the-person.md)
(how a question is put) and the relay paragraph of
[`interaction-modality`](interaction-modality.md) §4.1 (a relayed question says
where the answer goes). This skill is the missing step between them: **who**
puts the question, and **how the answer gets back**.

## Why

A card posted only in a sibling's own thread is not seen by the person, who is
talking with the discussion agent elsewhere; the decision stalls, or reaches
the person only by reconstruction. A feedback channel in play (a review sheet,
an issue) is used as well.

## The two roles

| role | who | does |
|---|---|---|
| **Discussion agent** (`session-coordinator`) | the agent the person is talking with right now: a project coordinator, the parent of a subagent, the session that spawned a swarm | shows the hand-back to the person, asks with `ask-the-person`, marks every copy answered, routes the answer back |
| **Sibling** (`sibling-session`) | any agent the discussion agent spawned, or one working beside it on the same goal: a project thread, a subagent, a workflow agent, a cloud session | composes the hand-back once, with the analysis it alone has, and acts on the answer |

You are a **sibling** when your brief names a discussion agent, or when you
were started by another agent while a person was talking with it. A sibling
that is not sure hands back anyway: one extra copy costs a line, and a missed
card costs a stalled decision.

## The brief names the discussion (spawning agent)

An agent that spawns a sibling during a live discussion puts the `discussion`
link in the brief (`definitions.discussion` of the input schema): who the
discussion agent is, how to reach it, the standing card rules, and any
feedback channel in play (a review sheet's id and tab, an issue). See
[`process-state`](../../process/workflow/process-state.md) §"A coordinator that
briefs a thread". A sibling has nothing else that tells it.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/hand-back-to-discussion/input.schema.json)
and [`output.schema.json`](../../../schemas/skills/hand-back-to-discussion/output.schema.json).

- **In (the hand-back):** `from` (title, link, process), `to` (the discussion
  link), `kind` (`decision`, `question`, `context`, `result`, `blocker`), a
  one-sentence `summary`, `ask` (the ask-the-person input, unchanged, for a
  decision or question), `context` (for the others), `links`, `channels`
  (always `discussion`, plus any of `own-thread`, `project-chat`,
  `review-sheet`, `github-issue`, `github-pr`), `answerRoute`, `blocking`, and
  `supersedes` when it replaces an earlier one.
- **Out (the record):** `shown` (every copy, discussion first), `state`
  (`open`, `answered`, `withdrawn`, `superseded`, `informed`), the
  ask-the-person output, `chosen`, `quote`, `answeredIn`, `marked` (the
  strike-through edit per copy) and `deliveredBack` (proof the answer reached
  the sibling, with `citesPerson`).

## Steps — sibling

1. **Compose once.** A question is the full ask-the-person input: what will
   differ, context, every option lettered with a one-line trade-off, the
   recommendation and why, what happens with no answer. The discussion agent
   must be able to show it **without opening your thread**. Context, a result
   or a blocker gets the same test.
2. **Show it where you are.** Post it in your own thread too (chat text, then
   the card), so the tappable card sits beside the work. Your own thread is
   **never the only copy**.
3. **Mirror it to the feedback channel in play.** When a review sheet governs
   the work, write the "Decision needed" block into the row's agent column and
   set Agentic status to `Needs you` (the document layer's `review-sheet-script` skill,
   §"A question to people goes in the sheet"). An issue or PR in play gets a
   comment. These are extra copies, never instead of the discussion.
4. **Hand back** to the discussion agent with the host's route:

   | host | route |
   |---|---|
   | Claude projects thread | `message_coordinator` (or `message_thread` to the discussion thread), the hand-back as plain prose in the schema's order: summary, question, lettered options with trade-offs, recommendation, if silent, link to your thread |
   | subagent (Agent tool, workflow agent) | your final report: the hand-back as a fenced `json` block that validates against the input schema, then a one-line summary. You cannot reach the person; the parent asks |
   | sibling session | `SendMessage` to the discussion session |
   | none of these | a comment on the issue or PR the discussion is about, and say so in your own thread |

5. **Keep working** on the recommended option where it can be undone; stop
   where it cannot (`blocking: true`).
6. **Act on the answer** when it comes back. Only an answer that carries the
   person's own words (a cited message, a card tap, a Blue-column cell) is
   their approval. A paraphrase from another agent is not.

## Steps — discussion agent

1. **Show it in the discussion**, saying it comes from the sibling (title and
   link) and that you will pass the answer on. A question goes through
   `Process_AskThePerson` unchanged: the chat text in full first, then the card
   with the same letters. Never "see the card in thread X".
2. **Context, a result or a blocker** that needs no answer: post it, state
   `informed`, done.
3. **Take the answer from any copy.** A tap on your card, a tap on the
   sibling's card, or a Blue-column answer in the sheet all count. Take the
   first, and treat a later disagreeing answer as a new question.
4. **Route it back** on `answerRoute`, attaching the person's own message by id
   where the host allows (`citesPerson: true`).
5. **Mark every copy answered.** A chat copy keeps its text: strike the
   question through and add `[Edit: <letter> chosen by <who>, <time>]`. A card
   you posted is closed with the chosen option. A sheet's "Decision needed"
   block is replaced by the decision and who made it, and Agentic status moves
   on. A withdrawn or superseded hand-back is marked the same way with the
   reason.
6. **A rule-level answer** goes into the governing skill in the same turn
   ([`symbiotic-interaction`](symbiotic-interaction.md) §2).

## Anti-patterns

- **A card only in the sibling's thread.**
- **A hand-back that says "see my thread".** A pointer is not the question.
- **The discussion agent rewriting the options.** The sibling did the
  analysis; reword for the person if needed, but keep the letters and the
  recommendation, and say so if you change one.
- **The sheet as the only copy.** People on the committee see the sheet; the
  owner in the discussion may not be looking at it.
- **An answer that never reaches the sibling.** The person answered once; the
  sibling must not ask again.

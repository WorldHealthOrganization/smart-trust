---
name: ask-the-person
description: >
  Put one question or decision to a person: the full question, context and
  every option written in the chat FIRST, then the same options as a tappable
  card. Use before every AskUserQuestion, request_decision / Decision card,
  button card, or any ask that hands a choice to the owner. Input is the
  composed question; output is the answer, or the default taken.
input: schemas/skills/ask-the-person/input.schema.json
output: schemas/skills/ask-the-person/output.schema.json
---

# Ask the person

The procedure behind [`Process_AskThePerson`](../../../processes/process/ask-the-person.bpmn).
Every diagram step that puts a choice to a person calls that subprocess, and
the subprocess's tasks name this skill. The rule itself, and why, is the box at
the top of [`interaction-modality`](interaction-modality.md); this skill is how
to carry it out.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/ask-the-person/input.schema.json)
and [`output.schema.json`](../../../schemas/skills/ask-the-person/output.schema.json).

- **In:** `decides` (what will differ), `context` (why now, what it touches,
  what happens next), `glossary`, two to four `options` each with a `letter`,
  `label`, `does`, `pro`, `con`, `downstream` and `reversibility`, the
  `recommends` letter and `because`, `ifSilent`, the `question`,
  `othersPending` and whether the step is `reversible`. The fields match
  `DecisionRequestSchema` in [`decision-request.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/process/decision-request.ts),
  plus the letter and the context. Nothing is optional.
- **Out:** `asked.chat` and `asked.card` (the two copies), `outcome`
  (`answered`, `silent` or `dismissed`), `chosen` (a letter), `quote` (the
  answer verbatim), `defaultTaken`, and `rule` when the answer became a rule.

## Steps

1. **Compose** the input. Can the reader answer without opening anything? If
   not, it is not ready.
2. **Write it in the chat**, whole: context, every option with its letter,
   one-line explanation and trade-off, the recommendation marked, and what
   happens with no answer. This is the copy that lasts, because an answered card
   shows only the choice.
3. **Offer the card** with the same letters and labels, recommended one marked.
   This holds for `request_decision` even though that tool's own text says not
   to repeat the question. No card tool: say so in the chat.
4. **Wait for the tap**; keep working on the recommended option where that can
   be undone. Never ask for a typed reply.
5. **Not the one talking with the person?** If you are a sibling (a project
   thread, a subagent or a session spawned while someone else holds the
   discussion), steps 2 and 3 in your own channel are not enough: hand the
   composed input back with [`hand-back-to-discussion`](hand-back-to-discussion.md),
   so the discussion agent asks it where the person is, and the answer comes
   back to you. Your own thread is never the only copy.
6. **Return the output.** A dismissal is not an answer. A rule-level answer is
   written into the governing skill in the same turn
   ([`symbiotic-interaction`](symbiotic-interaction.md) §2).

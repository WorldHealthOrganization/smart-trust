---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Hand Back To Discussion
parent: Skill schema reference
---

# Hand Back To Discussion

> Skill id: `hand-back-to-discussion`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

One hand-back from a sibling agent (spawned, or working beside the discussion) to the discussion agent: the agent that is talking with the person right now. It carries a card, a question, context, a result or a blocker, complete enough that the discussion agent can put it in front of the person without opening the sibling's thread. A question or decision carries the ask-the-person input unchanged, so the card the person sees is composed once, by the agent that did the analysis.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | object | **yes** | The sibling that hands back. |
| `to` | any | **yes** |  |
| `kind` | `"decision"` \| `"question"` \| `"context"` \| `"result"` \| `"blocker"` | **yes** | decision and question need the person's answer and carry `ask`. context, result and blocker inform; a blocker that needs the person to act is a decision, not a blocker. |
| `summary` | string | **yes** | One sentence that stands alone: what the person needs to know or choose. (minLength: 1, maxLength: 300) |
| `ask` | any | no | The composed question, exactly as ask-the-person takes it. Required for decision and question. |
| `context` | string | no | For context, result and blocker: what happened, what it touches and what happens next, every id glossed. |
| `links` | array<object> | no | PRs, issues, staging pages and files the hand-back is about, each with a title. |
| `channels` | array<any> | **yes** | Every place the hand-back is shown. The discussion is always one of them; a review sheet or an issue is an extra copy, never the only one. |
| `answerRoute` | object | **yes** | How the answer reaches the sibling again. An answer typed at the discussion does not reach the sibling by itself. |
| `blocking` | boolean | **yes** | true when the sibling has stopped and waits on the answer; false when it keeps working on the recommended option. |
| `supersedes` | string | no | The id of an earlier hand-back this one replaces; the discussion agent withdraws that card. |

### `from`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **yes** | The sibling's thread or task title, as the person would recognise it. (minLength: 1) |
| `link` | string | **yes** | A link to the sibling's thread, session or PR, so the person can open it for more. Never the only place the content is. (minLength: 1) |
| `process` | string | no | The process and step the sibling is in (process-state), or "none". |

### `links[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **yes** |  |
| `url` | string | **yes** |  |

### `answerRoute`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `how` | `"thread-message"` \| `"send-message"` \| `"return-value"` \| `"issue-comment"` \| `"sheet"` | **yes** | thread-message: the host's message-to-thread tool, with the person's message attached by id. send-message: a sibling session's inbox. return-value: the sibling is a subagent and the answer goes into its next prompt. issue-comment and sheet: the sibling reads it there. |
| `target` | string | **yes** | The thread id, session id, issue or sheet row the answer goes to. (minLength: 1) |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/hand-back-to-discussion/input.schema.json){: data-fa-link="source" data-src="schemas/skills/hand-back-to-discussion/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/hand-back-to-discussion/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/hand-back-to-discussion/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

The record of one hand-back: where it was shown, its state, the person's answer quoted, how every copy was marked answered, and proof the answer reached the sibling. A dismissed card is not an answer.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shown` | array<object> | **yes** | One entry per copy, the discussion's first. |
| `state` | `"open"` \| `"answered"` \| `"withdrawn"` \| `"superseded"` \| `"informed"` | **yes** | open: waiting. answered: the person chose, in any channel. withdrawn: the question no longer needs an answer. superseded: a later hand-back replaced it. informed: a context, result or blocker that needed no answer was shown. |
| `ask` | any | no | The ask-the-person output, when the hand-back carried a question. |
| `chosen` | string \| null | no | The letter chosen; null unless answered. (pattern: `^[A-D]$`) |
| `quote` | string \| null | no | The person's answer verbatim, with who, when and the message id or sheet cell it came from. |
| `answeredIn` | `"discussion"` \| `"own-thread"` \| `"project-chat"` \| `"review-sheet"` \| `"github-issue"` \| `"github-pr"` \| `null` | no | Which copy the answer came from. |
| `marked` | array<object> | no | How each copy was closed once answered or withdrawn. A chat copy keeps its text: the question is struck through and "[Edit: <letter> chosen by <who>, <time>]" added, so the record still says what was asked. A sheet copy's "Decision needed" block is replaced by the decision and who made it. |
| `deliveredBack` | object \| null | **yes** | Proof the answer reached the sibling; null only while open or for state informed. |
| `stagingLinks` | any | no | When the question asks the person to look at changed pages: the staging preview, one deep link per changed page with the same page on main, shown in the chat copy. When there is no preview, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `shown[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | `"discussion"` \| `"own-thread"` \| `"project-chat"` \| `"review-sheet"` \| `"github-issue"` \| `"github-pr"` | **yes** |  |
| `ref` | string | **yes** | Message id, card id, sheet cell (tab!header/row key) or comment URL. (minLength: 1) |
| `card` | string \| null | no | The card's id when this copy offered one. |

### `marked[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | **yes** |  |
| `edit` | string | **yes** | The text applied, e.g. "~~Which layout?~~ [Edit: A chosen by litlfred, 2026-10-31 15:50Z]". (minLength: 1) |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/hand-back-to-discussion/output.schema.json){: data-fa-link="source" data-src="schemas/skills/hand-back-to-discussion/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/hand-back-to-discussion/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/hand-back-to-discussion/output.schema.json" data-repo="litlfred/cat-harness" }

---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Ask The Person
parent: Skill schema reference
---

# Ask The Person

> Skill id: `ask-the-person`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

One question for a person, complete enough to answer without opening anything. The same fields as DecisionRequestSchema in schemas/process/decision-request.ts, plus a letter per option so the chat text and the card use the same handles. Every field is required: a question with no comparison, no recommendation or no default does not validate.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decides` | string | **yes** | What is being decided, stated as what will DIFFER depending on the answer. Not the name of the decision. (minLength: 1) |
| `context` | string | **yes** | Why it is being asked now and what happens next: the PRs, beans and pages it touches, each named in words. Links are for more, never where terms are defined. (minLength: 1) |
| `glossary` | object | **yes** | Every id, path and coined name used above, glossed. {} means nothing needs a gloss. |
| `options` | array<object> | **yes** |  |
| `recommends` | string | **yes** | The letter of the recommended option; it is shown first and marked. (pattern: `^[A-D]$`) |
| `because` | string | **yes** | minLength: 1 |
| `ifSilent` | string | **yes** | What will be done if no answer comes. Then it is done. (minLength: 1) |
| `question` | string | **yes** | The question itself, last. (minLength: 1) |
| `othersPending` | integer | **yes** | How many other decisions wait; given as a count, never as a list of option names. (min: 0) |
| `reversible` | boolean | **yes** | false when acting on the answer cannot be undone. Then the default is never taken on silence: the step waits. |

### `options[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `letter` | string | **yes** | The handle shown in BOTH the chat text and the card. (pattern: `^[A-D]$`) |
| `label` | string | **yes** | Short noun phrase the person taps. (minLength: 1) |
| `does` | string | **yes** | minLength: 1 |
| `pro` | string | **yes** | minLength: 1 |
| `con` | string | **yes** | What it costs to do. (minLength: 1) |
| `downstream` | string | **yes** | What it changes for everything else, afterwards. (minLength: 1) |
| `reversibility` | string | **yes** | minLength: 1 |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/ask-the-person/input.schema.json){: data-fa-link="source" data-src="schemas/skills/ask-the-person/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/ask-the-person/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/ask-the-person/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

What the calling step gets back: proof the question went out twice, and the person's answer or the default taken. A dismissed card is not an answer.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `asked` | object | **yes** | Where the two copies went. The chat copy is posted first. |
| `outcome` | `"answered"` \| `"silent"` \| `"dismissed"` | **yes** | answered: the person chose. silent: no answer came. dismissed: the card was closed without a choice; the question stays open in the chat. |
| `chosen` | string \| null | **yes** | The letter chosen; null unless outcome is answered. (pattern: `^[A-D]$`) |
| `quote` | string \| null | **yes** | The person's answer, verbatim, with who and when; null unless answered. |
| `defaultTaken` | boolean | **yes** | true when the work went ahead on ifSilent. Never true for an irreversible step. |
| `rule` | string | no | When the answer settles how a kind of thing is decided: the skill it was written into, in the same turn. |
| `stagingLinks` | any | no | When the question asks the person to look at changed pages: the staging preview, one deep link per changed page with the same page on main, shown in the chat copy. When there is no preview, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `asked`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chat` | string | **yes** | Id or link of the chat message holding the full question. (minLength: 1) |
| `card` | string \| null | **yes** | Id of the card offered after it; null only when the host has no card tool, which the chat text then says. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/ask-the-person/output.schema.json){: data-fa-link="source" data-src="schemas/skills/ask-the-person/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/ask-the-person/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/ask-the-person/output.schema.json" data-repo="litlfred/cat-harness" }

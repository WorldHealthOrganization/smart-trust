---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Skill schema reference
nav_order: 7
has_children: true
---

# Skill schema reference

Every folio-assistant skill declares a typed **input** and **output** contract as
JSON Schema (draft-07). These pages are generated from those schemas so the
published reference can never drift from what the framework actually validates.

| Skill | Id | Description |
|-------|----|-------------|
| [Ask The Person](ask-the-person.html) | `ask-the-person` | One question for a person, complete enough to answer without opening anything. The same fields as DecisionRequestSchema in schemas/process/decision-request.ts, plus a letter per option so the chat text and the card use the same handles. Every field is required: a question with no comparison, no recommendation or no default does not validate. |
| [Bean Drain](bean-drain.html) | `bean-drain` | What a drain starts from: every bean copy to read, the agents that may hold a bean and how each is recognised, what each owner already holds, the activity window, and where the queue is written. Skill work-plan/skills/work-plan/bean-drain.md, bean n7x7. |
| [BPMN Authoring](bpmn-authoring.html) | `bpmn-authoring` | Input schema for BPMN 2.0 business process authoring. |
| [Content Feedback](content-feedback.html) | `content-feedback` | Input schema for feedback collection and triage. |
| [Content Review](content-review.html) | `content-review` | Input schema for formal content review and approval workflow. |
| [Content Test](content-test.html) | `content-test` | Input schema for end-to-end content testing. |
| [Content Validate](content-validate.html) | `content-validate` | Input schema for content validation. |
| [CRDM Detect](crdm-detect.html) | `crdm-detect` | One user request to classify: is it a feature request (a platform capability change, which enters the CRDM requirements workflow) or a content request? |
| [DMN Authoring](dmn-authoring.html) | `dmn-authoring` | Input schema for DMN (Decision Model and Notation) decision table authoring. |
| [Hand Back To Discussion](hand-back-to-discussion.html) | `hand-back-to-discussion` | One hand-back from a sibling agent (spawned, or working beside the discussion) to the discussion agent: the agent that is talking with the person right now. It carries a card, a question, context, a result or a blocker, complete enough that the discussion agent can put it in front of the person without opening the sibling's thread. A question or decision carries the ask-the-person input unchanged, so the card the person sees is composed once, by the agent that did the analysis. |
| [Staging Review](staging-review.html) | `staging-review` | What the reader wants to look at, in their own words (kept verbatim; it narrows, never adds), and the branch or pull request whose preview to list. |
| [Wireframe Design Review](wireframe-design-review.html) | `wireframe-design-review` | What is to be wireframed and why: the use (design of a new or changed surface, or as-is drawing of an existing visualiser), the surface, and where the drawings are kept. Called from Process_CRDM_Requirements (Call_Wireframe) for Design use, when a requirement changes a rendered surface. |
| [Wireframe Viewport Check](wireframe-viewport-check.html) | `wireframe-viewport-check` | The wireframe candidates to render, and where the screenshots and report go. Called from wireframe-design-review step 3, once per round of candidates. |

See also the [Skill instructions](../skill-instructions/) (the prose how-to
bodies the LLM loads) and the [TypeScript API reference](../../api/) for the
content-object model (`Block`, `Chapter`, `Paper`, builders, and Zod constraints).

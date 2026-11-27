---
name: guideline-use-case
description: >
  Stage 0 of smart-guideline-end-to-end: turn a request for a SMART Guideline
  into a use case — population, setting, jurisdiction and interventions in
  scope, new or an adaptation — in the requester's own words. The agent asks
  numbered questions for what the request did not say, and never invents the
  answer. Read when a guideline request arrives, before any L1 source is
  looked for.
input: schemas/skills/guideline-use-case/input.schema.json
output: schemas/skills/guideline-use-case/output.schema.json
---

# guideline-use-case

> Skill id: `guideline-use-case` · Package: `authoring-who-smart-guidelines` ·
> Stage 0 of [`smart-guideline-end-to-end`](smart-guideline-end-to-end.md),
> task `Task_DescribeUseCase` of
> `smart-guideline-end-to-end.bpmn` (opt-in `smart-base.collab`),
> in the requester's (`user`) lane.

**The use case is the requester's, not the agent's.** Every later stage
(which L1 sources count, which DAKs and IGs are candidates, which application
is built) is chosen against it.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/guideline-use-case/input.schema.json) and [`output.schema.json`](../../../schemas/skills/guideline-use-case/output.schema.json).

- **In:** the `request`, verbatim, and the `jurisdiction` and the guideline it `adapts` when the request names them.
- **Out:** the `useCase` (`population`, `setting`, `jurisdiction`, `interventions`, `kind` new or adaptation, the requester's `words`), which stage 1 ([`dak-l1-library`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/dak-l1-library.md)) takes as its `useCase`; and the numbered `questions` asked to get it.

## Steps

1. Read the four required fields off the request. Use the requester's words
   where they gave any, and keep them verbatim in `words`.
2. For each one the request does not say, ask a numbered question
   ([`interaction-modality`](https://github.com/litlfred/cat-harness/blob/main/skills/conduct/conduct-core/interaction-modality.md)),
   with options drawn from what is already known, a recommended one marked,
   and **Tell me more** last:

   > Which jurisdiction is this guideline for?
   >
   > 1. **WHO (global)**: a new guideline, or a WHO DAK extended.
   > 2. **A country's adaptation** of an existing WHO DAK *(recommended when the request names a country)*.
   > 3. **Tell me more.**

3. An adaptation names what it adapts in `adapts`. Stages 3 and 5 then
   return `adapt` rows for it, and stages 4 and 6 show diffs.

## Adjudication

None: the requester is the source. A later stage that finds the use case
wrong says so to the requester, and stage 0 is redone with their answer.

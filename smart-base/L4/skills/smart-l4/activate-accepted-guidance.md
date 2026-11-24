---
name: activate-accepted-guidance
description: >
  The point-of-care system carries out the health worker's decisions on
  decision-support guidance: each accepted action's request becomes active
  (intent plan or order) and joins the client's CarePlan; a declined action
  is not written. Input is the guidance and the decisions; output is the
  transaction Bundle saved.
input: L4/schemas/skills/activate-accepted-guidance/input.schema.json
output: L4/schemas/skills/activate-accepted-guidance/output.schema.json
---

# Activate accepted guidance

> Skill id: `activate-accepted-guidance` · Package: `authoring-who-smart-guidelines` · Task
> `Task_Activate` of
> [`act-on-decision-support.bpmn`](../../processes/act-on-decision-support.bpmn)
> (`Process_ActOnDecisionSupport`), lane `point-of-care-system`.

**Performed by a system.** It decides nothing: it writes what the health
worker accepted, exactly as accepted.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/activate-accepted-guidance/input.schema.json)
and [`output.schema.json`](../../schemas/skills/activate-accepted-guidance/output.schema.json).

- **In:** the `guidance` ([`apply-decision-support`](apply-decision-support.md))
  and the `decisions` ([`review-decision-support-guidance`](review-decision-support-guidance.md)).
- **Out:** the transaction `bundle` that was saved.

## What it writes

| decision | written |
|---|---|
| `accepted` | the action's request, `status: active`, `intent` `plan` (or `order` where the health worker may order it), referenced from the client's [CarePlan](https://hl7.org/fhir/R4/careplan.html) `activity` |
| `modified` | the changed request, as for `accepted` |
| `declined` | nothing: the proposal stays a `draft` with the RequestGroup and is never activated |

## Success criteria

- Only accepted and modified actions reach the record, in one transaction
  (queued whole when offline).
- It does not wait for, read or require a rationale
  ([`record-decision-rationale`](record-decision-rationale.md)).

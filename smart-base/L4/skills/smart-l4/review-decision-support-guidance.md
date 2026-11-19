---
name: review-decision-support-guidance
description: >
  A health worker sees the decision-support guidance for one client on their
  device (the proposed actions of a RequestGroup or CDS Hooks cards) and
  accepts or declines each action; modifies one only where the device offers
  it. Input is the guidance as rendered; output is the decision per action.
  At most one tap per action; nothing else is asked.
input: L4/schemas/skills/review-decision-support-guidance/input.schema.json
output: L4/schemas/skills/review-decision-support-guidance/output.schema.json
---

# Review decision-support guidance

> Skill id: `review-decision-support-guidance` · Package: `authoring-who-smart-guidelines` ·
> Task `Task_Review` of
> [`act-on-decision-support.bpmn`](../../processes/act-on-decision-support.bpmn)
> (`Process_ActOnDecisionSupport`), lane `health-worker`.

**Performed by a person**: the health worker, who stays accountable for the
care given. Guidance is advice, never an order; declining it is a normal
answer, not an exception.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/review-decision-support-guidance/input.schema.json)
and [`output.schema.json`](../../schemas/skills/review-decision-support-guidance/output.schema.json).

- **In:** the `guidance`, as [`apply-decision-support`](apply-decision-support.md)
  returned it (a RequestGroup or RequestOrchestration, or CDS Hooks
  `cards`), the `subject`, and how it is `renderedOn`.
- **Out:** one `decisions` entry per action: `accepted`, `declined`, or
  `modified` with the changed resource. An action the health worker did not
  touch is `declined`: nothing is carried out on silence. `addReason` is true
  only if the health worker tapped "add a reason" (false by default).

## The burden is the point

Health workers are overburdened, and this step sits inside their visit.

- **One tap per action**: accept or decline. "Accept all" is one tap for the
  whole proposal.
- **Nothing else is required.** A reason is never asked for here; the health
  worker MAY add one with [`record-decision-rationale`](record-decision-rationale.md),
  which runs beside this step and never holds it up.
- **Modify only where the device supports it** (a CDS Hooks suggestion, an
  editable request). It is optional, and a device that cannot offer it
  offers accept or decline.

## Success criteria

- Every action in the guidance has exactly one decision.
- The decisions are recorded by who made them and when; nothing in the
  client's record has changed yet (the system's
  [`activate-accepted-guidance`](activate-accepted-guidance.md) does that).

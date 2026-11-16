---
name: record-decision-rationale
description: >
  OPTIONAL and never blocking: a health worker who chooses to may note why
  they accepted or declined decision-support guidance, in one tap plus an
  optional coded or free-text reason. Input is the decision; output is one
  FHIR Provenance (or nothing, when skipped, which is the default). The care
  plan is updated whether or not this is ever done.
input: L4/schemas/skills/record-decision-rationale/input.schema.json
output: L4/schemas/skills/record-decision-rationale/output.schema.json
---

# Record a decision rationale (optional)

> Skill id: `record-decision-rationale` · Package: `authoring-who-smart-guidelines` · Task
> `Task_Rationale` of
> [`act-on-decision-support.bpmn`](../../processes/act-on-decision-support.bpmn)
> (`Process_ActOnDecisionSupport`), lane `health-worker`, reached only
> through `Event_AddReason`, a non-interrupting boundary event on the review
> that happens when the health worker taps "add a reason".

**Opt-in, skippable, and skipped by default.** It is never required to
finish the review, the visit or the process: the diagram starts it from a
non-interrupting boundary event on the review, which takes nothing from the
review, so the care plan is updated without waiting for it. A DAK must not make it
mandatory; a programme that needs a reason recorded every time is asking
for a different, blocking step, and should draw one.

**Performed by a person**: the health worker who made the decision.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/record-decision-rationale/input.schema.json)
and [`output.schema.json`](../../schemas/skills/record-decision-rationale/output.schema.json).

- **In:** the `decision` (one action's outcome, from
  [`review-decision-support-guidance`](review-decision-support-guidance.md)),
  the `practitioner`, and the `planDefinition` the guidance came from.
- **Out:** `recorded` (false when skipped) and, when true, one
  `provenance`.

## The burden

- **At most one extra tap**: "add a reason". Choosing a coded reason is the
  same tap; free text is optional on top.
- No field is required beyond the tap. A rationale with neither code nor
  text records only that the health worker chose to mark the decision.

## Why a Provenance

FHIR R4 [Provenance](https://hl7.org/fhir/R4/provenance.html) is the lightest
standard artefact that says *who* decided *what*, *about which guidance*, and
*why*: `target` the request the decision is about (or the RequestGroup, on a
decline), `agent` the practitioner, `entity` (role `source`) the
PlanDefinition, `reason` the coded or free-text reason (a CodeableConcept,
whose `text` carries free text), `recorded` the time. It adds no workflow
state, unlike a Task; it is not a clinical finding, unlike a DetectedIssue;
and it needs no recipient, unlike a Communication.

When the guidance came as [CDS Hooks](https://cds-hooks.hl7.org/2.0/) cards,
the system also sends the service the
[feedback](https://cds-hooks.hl7.org/2.0/#feedback) its card asks for
(`accepted` or `overridden`, with the `overrideReason` when one was given):
that is the CDS service's copy, the Provenance is the record's.

## Success criteria

- Skipping it changes nothing anywhere, and the process never waits for it.
- When recorded, the Provenance validates and names the decision's target,
  the practitioner and the PlanDefinition.

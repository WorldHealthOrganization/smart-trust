---
name: apply-decision-support
description: >
  The point-of-care system applies a DAK decision table's PlanDefinition to
  one client ($apply) and gets the proposed actions back as a RequestGroup
  (R4; RequestOrchestration in R5), or as CDS Hooks cards when the guidance
  comes from a CDS service. Input is the PlanDefinition and the client;
  output is the proposal, every request in it still a proposal.
input: L4/schemas/skills/apply-decision-support/input.schema.json
output: L4/schemas/skills/apply-decision-support/output.schema.json
---

# Apply decision support

> Skill id: `apply-decision-support` · Package: `authoring-who-smart-guidelines` · Task
> `Task_Apply` of
> [`act-on-decision-support.bpmn`](../../processes/act-on-decision-support.bpmn)
> (`Process_ActOnDecisionSupport`), lane `point-of-care-system`.

**Performed by a system.** It computes guidance; it never acts on it. Only
the health worker's decision, carried out by
[`activate-accepted-guidance`](activate-accepted-guidance.md), changes the
client's record.

The operation is FHIR
[`PlanDefinition/$apply`](https://hl7.org/fhir/R4/plandefinition-operation-apply.html)
as HL7 [CPG-on-FHIR](https://hl7.org/fhir/uv/cpg/) profiles it: a DAK's
decision tables (L2 DMN) are published at L3 as PlanDefinitions with CQL
libraries, and `$apply` evaluates one for one subject. A CDS service
reached through [CDS Hooks 2.0](https://cds-hooks.hl7.org/2.0/) returns
the same proposal as cards whose suggestions carry the resources.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/apply-decision-support/input.schema.json)
and [`output.schema.json`](../../schemas/skills/apply-decision-support/output.schema.json).

- **In:** the `planDefinition` canonical, the `subject`, and optionally the
  `encounter`, the `practitioner` and the `data` (a Bundle) to evaluate
  against when the record is not on the server.
- **Out:** the `requestGroup` (RequestGroup or RequestOrchestration), each
  action's resource with `status: draft` and `intent: proposal`, and the
  `cards` when the guidance came through CDS Hooks.

## Success criteria

- Nothing is written to the client's record: every created request is a
  `draft` `proposal`, held with the RequestGroup.
- Every action carries the PlanDefinition action it came from, and its
  `documentation` or card `detail` says why, so the health worker can judge
  it without opening anything else.
- No applicable action is an empty RequestGroup, not an error, and the
  process ends without asking the health worker anything.

---
name: l2-dak-authoring
description: >
  Author the L2 layer of a WHO SMART Guideline — the Digital Adaptation Kit
  between the narrative L1 guideline and the L3 FHIR artefacts — one DAK
  component per pass (personas, user scenarios, business processes, data
  dictionary, decision and scheduling logic, indicators, requirements), each
  edited and then reviewed alongside through l2-component-edit-review. Stage 4
  of smart-guideline-end-to-end and the authoring steps of
  l2-dak-authoring.bpmn. Read before authoring or adapting any DAK component.
input: L2/schemas/skills/l2-dak-authoring/input.schema.json
output: L2/schemas/skills/l2-dak-authoring/output.schema.json
---

# l2-dak-authoring

> Skill id: `l2-dak-authoring` · Package: `authoring-who-smart-guidelines` ·
> Named by `l2-dak-authoring.bpmn` steps **Personas and scenarios**,
> **Data dictionary and core data elements**, **Indicators and requirements**,
> all in the `Business analyst` lane and each a call into
> `l2-component-edit-review.bpmn` (opt-in `smart-base.L2-collab`),
> and by `dak-l3-ig.bpmn` step **Map L2 → L3**, beside `l3-fhir-authoring`.

Author the **L2** layer of a WHO SMART Guideline: the human-readable,
machine-*processable* Digital Adaptation Kit between a narrative guideline
(L1) and FHIR artefacts (L3).

> **Sourcing.** The DAK component set and the L1–L4 layers are WHO's, defined
> in the SMART Guidelines documentation and realised in
> `WorldHealthOrganization/smart-base`. This skill says how to work them here
> (lane, inputs, tooling); what a component must contain is WHO's, and where
> they disagree WHO wins.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/l2-dak-authoring/input.schema.json) and [`output.schema.json`](../../schemas/skills/l2-dak-authoring/output.schema.json).

- **In:** `dakComponent` (required), `sourceGuideline` (required), `existingContent`, `sprintNumber`; as stage 4 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md), also stage 2's `l1Kg` and stage 3's `l2Dependencies` ([`l2-dependency-choice`](l2-dependency-choice.md)'s output).
- **Out:** `artifacts` (each an `l2Artifact`: `path`, `type`, `description`), `status`, `validationIssues`, `stagingLinks`. Stage 5 ([`l3-dependency-choice`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/l3-dependency-choice.md)) takes the artifacts of every pass as its `l2Assets`.

`dakComponent` is the unit of work: author one component per pass, and finish
it before starting the next.

## What L2 is for, and the mistake to avoid

L2 is **structured but not yet FHIR**: reviewable by a clinical SME who does
not read FHIR, and regular enough that L3 is derived from it.

Do not author L2 as if it were L3 (profiles, slicing, invariants). A decision
that can only be expressed in FHIR belongs in `l3-fhir-authoring`; one that
can be stated as a data element, decision rule or indicator belongs here.

## The three activities the process names

| step | produces | note |
|---|---|---|
| Personas and scenarios | the actors and the user journeys they appear in | The DAK's own personas, **not** this harness's `scenarios/roles.json`. |
| Data dictionary and core data elements | the data dictionary | Data-dictionary authoring is part of this skill (`dakComponent: data-dictionary`). |
| Indicators and requirements | indicators, functional and non-functional requirements | The DAK's requirements, not the harness's `skills/requirements/*.json`. Indicators a source prints come in through [`indicator-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/indicator-extraction.md): L1 nodes, then L2 program-indicator drafts that point back. |

Business processes and decision logic are the sibling skills `bpmn-authoring`
and `dmn-authoring`; terminology binding is `terminology-management`.

## Every track is edited, then reviewed alongside

Each of the six tracks (the three above, BPMN, DMN and terminology) is a
call activity into `Process_L2ComponentEditReview`
([`l2-component-edit-review`](l2-component-edit-review.md)). In that
subprocess the agent:

1. edits the component with the track's skill;
2. runs the component's checker;
3. renders and stages it with a before/after;
4. hands it on with `adjudication: pending`.

A person in the component's reviewing role reviews the staged preview at the
same time, through cat-harness's `Process_Review`; review never blocks the
hand-on. Each component's renderer, checker, diff and reviewer are in that
skill's table. The clinical SME's **Clinical validation** after the join reads
the whole DAK across components, without repeating the per-component reviews.

## Tooling

`smart-base` carries the extractors that read authored L2 artefacts —
`dd_extractor`, `dt_extractor`, `req_extractor`, `extractpr`. Load a checkout,
do not vendor it (see `smart-base-tools`). With `SMART_BASE_HOME` unset the
skill reports `skip`, **never** a clean run.

## Where this sits

`l2-dak-authoring.bpmn` carries `<cat-harness.processes:policy enforcement="advisory"/>`:
the sequence may be adapted, but the gate may not be skipped, and the base
processes it feeds (`editing-hci-validation`, `content-lifecycle`) stay strict.

As stage 4 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md),
clinical validation is the stage's adjudication and does not hold up the next
stage: the agent chooses L3 dependencies while the L2 assets are reviewed.

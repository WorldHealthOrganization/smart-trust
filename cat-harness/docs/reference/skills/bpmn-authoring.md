---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: BPMN Authoring
parent: Skill schema reference
---

# BPMN Authoring

> Skill id: `bpmn-authoring`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

Input schema for BPMN 2.0 business process authoring.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `processName` | string | **yes** | Name of the business process to model. |
| `sourceWorkflow` | string | no | Textual description or reference to the workflow to model. |
| `existingBpmn` | string | no | Path to existing BPMN file to update. |
| `participants` | array<string> | no | Actor/participant IDs involved in the process. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/bpmn-authoring/input.schema.json){: data-fa-link="source" data-src="schemas/skills/bpmn-authoring/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/bpmn-authoring/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/bpmn-authoring/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Output schema for BPMN 2.0 business process authoring.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bpmnFile` | string | **yes** | Path to the generated/updated BPMN file. |
| `diagramFile` | string | no | Path to the rendered diagram (SVG/PNG). |
| `taskCount` | integer | no |  |
| `gatewayCount` | integer | no |  |
| `participantCount` | integer | no |  |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/bpmn-authoring/output.schema.json){: data-fa-link="source" data-src="schemas/skills/bpmn-authoring/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/bpmn-authoring/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/bpmn-authoring/output.schema.json" data-repo="litlfred/cat-harness" }

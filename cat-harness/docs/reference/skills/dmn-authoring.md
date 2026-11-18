---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: DMN Authoring
parent: Skill schema reference
---

# DMN Authoring

> Skill id: `dmn-authoring`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

Input schema for DMN (Decision Model and Notation) decision table authoring.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decisionName` | string | **yes** | Name of the decision to model. |
| `inputVariables` | array<object> | **yes** |  |
| `sourceLogic` | string | no | Reference to the clinical decision logic being modeled. |

### `inputVariables[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** |  |
| `type` | `"string"` \| `"integer"` \| `"boolean"` \| `"date"` \| `"codeable-concept"` | **yes** |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/dmn-authoring/input.schema.json){: data-fa-link="source" data-src="schemas/skills/dmn-authoring/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/dmn-authoring/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/dmn-authoring/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Output schema for DMN decision table authoring.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dmnFile` | string | **yes** |  |
| `decisionTableCount` | integer | no |  |
| `ruleCount` | integer | no |  |
| `hitPolicy` | `"UNIQUE"` \| `"FIRST"` \| `"PRIORITY"` \| `"ANY"` \| `"COLLECT"` \| `"RULE ORDER"` | no |  |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/dmn-authoring/output.schema.json){: data-fa-link="source" data-src="schemas/skills/dmn-authoring/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/dmn-authoring/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/dmn-authoring/output.schema.json" data-repo="litlfred/cat-harness" }

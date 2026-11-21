---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Content Validate
parent: Skill schema reference
---

# Content Validate

> Skill id: `content-validate`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

Input schema for content validation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetPath` | string | **yes** | Path to content to validate. |
| `validationRules` | array<string> | no | Specific validation rule IDs to run (empty = all applicable). |
| `schemaRefs` | array<string> | no | Schema files to validate against. |
| `stagingLinks` | any | no | The staging preview of the work under review, as the request for feedback carried it, so the reviewer opens the changed pages rather than rebuilding links. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-validate/input.schema.json){: data-fa-link="source" data-src="schemas/skills/content-validate/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-validate/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-validate/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Output schema for content validation results.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `overallStatus` | `"pass"` \| `"warnings"` \| `"errors"` | **yes** |  |
| `results` | array<object> | **yes** |  |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `results[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rule` | string | **yes** |  |
| `status` | `"pass"` \| `"fail"` \| `"warning"` \| `"skipped"` | **yes** |  |
| `message` | string | no |  |
| `location` | string | no |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-validate/output.schema.json){: data-fa-link="source" data-src="schemas/skills/content-validate/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-validate/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-validate/output.schema.json" data-repo="litlfred/cat-harness" }

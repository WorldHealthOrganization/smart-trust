---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Content Test
parent: Skill schema reference
---

# Content Test

> Skill id: `content-test`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

Input schema for end-to-end content testing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetPath` | string | **yes** |  |
| `testPlan` | string | no | Path to test plan file. |
| `testData` | string | no | Path to test data directory. |
| `regressionBaseline` | string | no | Git ref for regression baseline. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-test/input.schema.json){: data-fa-link="source" data-src="schemas/skills/content-test/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-test/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-test/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Output schema for content testing results.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `overallStatus` | `"pass"` \| `"fail"` | **yes** |  |
| `testResults` | array<object> | **yes** |  |
| `coverage` | object | no |  |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `testResults[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `testId` | string | **yes** |  |
| `status` | `"pass"` \| `"fail"` \| `"skipped"` | **yes** |  |
| `message` | string | no |  |
| `duration` | number | no |  |

### `coverage`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `total` | integer | no |  |
| `passed` | integer | no |  |
| `failed` | integer | no |  |
| `skipped` | integer | no |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-test/output.schema.json){: data-fa-link="source" data-src="schemas/skills/content-test/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-test/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-test/output.schema.json" data-repo="litlfred/cat-harness" }

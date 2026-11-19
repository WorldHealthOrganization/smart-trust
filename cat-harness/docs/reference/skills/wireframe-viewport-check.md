---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Wireframe Viewport Check
parent: Skill schema reference
---

# Wireframe Viewport Check

> Skill id: `wireframe-viewport-check`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

The wireframe candidates to render, and where the screenshots and report go. Called from wireframe-design-review step 3, once per round of candidates.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `candidates` | array<string> | **yes** | Wireframe HTML files. Each must carry both a web and a mobile layout (responsive CSS or two layouts). |
| `out` | string | no | Where the screenshots and report.json go: the asset directory's checks/ (wireframe-design-review, 'Where wireframes live'). Absent: .build/wireframes. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/wireframe-viewport-check/input.schema.json){: data-fa-link="source" data-src="schemas/skills/wireframe-viewport-check/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/wireframe-viewport-check/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/wireframe-viewport-check/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Per candidate, per viewport (web 1280x800, mobile 390x844), a pass or fail entry for each mechanical criterion (renders, no-overflow, no-placeholder) with a note, and a screenshot per viewport. Pass/fail entries only, never a score (the wiregen methodology).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `report` | string | **yes** | The report.json path; the screenshots are beside it. |
| `candidates` | array<object> | **yes** |  |
| `stagingLinks` | any | no |  |

### `candidates[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | **yes** | The candidate's HTML path. |
| `screenshots` | object | **yes** |  |
| `entries` | array<any> | **yes** |  |

#### `candidates[].screenshots`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `web` | string | **yes** |  |
| `mobile` | string | **yes** |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/wireframe-viewport-check/output.schema.json){: data-fa-link="source" data-src="schemas/skills/wireframe-viewport-check/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/wireframe-viewport-check/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/wireframe-viewport-check/output.schema.json" data-repo="litlfred/cat-harness" }

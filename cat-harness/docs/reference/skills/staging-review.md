---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Staging Review
parent: Skill schema reference
---

# Staging Review

> Skill id: `staging-review`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

What the reader wants to look at, in their own words (kept verbatim; it narrows, never adds), and the branch or pull request whose preview to list.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ask` | string | no | What the reader wants to look at, verbatim. Absent: the whole preview, every page the branch changed. |
| `branch` | string | no |  |
| `pr` | integer | no | min: 1 |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/staging-review/input.schema.json){: data-fa-link="source" data-src="schemas/skills/staging-review/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/staging-review/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/staging-review/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

The reviewable list: a narrative of what changed, where to start, and the staging links, one deep link per changed page with its before. Every other skill that asks for feedback carries this same `stagingLinks` shape.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `narrative` | string | **yes** | What a reader of the site will now see or do differently, and why, before any link. |
| `startHere` | string (uri) | no | The one page to open first. |
| `stagingLinks` | any | **yes** |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/staging-review/output.schema.json){: data-fa-link="source" data-src="schemas/skills/staging-review/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/staging-review/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/staging-review/output.schema.json" data-repo="litlfred/cat-harness" }

---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Content Feedback
parent: Skill schema reference
---

# Content Feedback

> Skill id: `content-feedback`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

Input schema for feedback collection and triage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | `"github-issues"` \| `"survey"` \| `"implementation-report"` \| `"clinical-review"` | **yes** | Source of feedback. |
| `publishedVersion` | string | no | Version the feedback relates to. |
| `feedbackItems` | array<object> | no |  |
| `stagingLinks` | any | no | The staging preview of the work under review, as the request for feedback carried it, so the reviewer opens the changed pages rather than rebuilding links. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `feedbackItems[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | **yes** |  |
| `severity` | `"critical"` \| `"major"` \| `"minor"` \| `"enhancement"` | no |  |
| `component` | string | no |  |
| `reporter` | string | no |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-feedback/input.schema.json){: data-fa-link="source" data-src="schemas/skills/content-feedback/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-feedback/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-feedback/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

Output schema for triaged feedback.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `triagedItems` | array<object> | **yes** |  |
| `summary` | object | no |  |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `triagedItems[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **yes** |  |
| `priority` | `"P0"` \| `"P1"` \| `"P2"` \| `"P3"` | **yes** |  |
| `disposition` | `"backlog"` \| `"next-sprint"` \| `"wont-fix"` \| `"duplicate"` \| `"needs-info"` | **yes** |  |
| `assignee` | string | no |  |
| `linkedIssue` | string | no |  |

### `summary`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `total` | integer | no |  |
| `critical` | integer | no |  |
| `major` | integer | no |  |
| `minor` | integer | no |  |
| `enhancement` | integer | no |  |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/content-feedback/output.schema.json){: data-fa-link="source" data-src="schemas/skills/content-feedback/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/content-feedback/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/content-feedback/output.schema.json" data-repo="litlfred/cat-harness" }

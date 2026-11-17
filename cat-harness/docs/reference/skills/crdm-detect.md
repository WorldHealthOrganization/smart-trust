---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: CRDM Detect
parent: Skill schema reference
---

# CRDM Detect

> Skill id: `crdm-detect`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

One user request to classify: is it a feature request (a platform capability change, which enters the CRDM requirements workflow) or a content request?

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | **yes** | The request as the user wrote it — an issue title and body, or a chat turn. (minLength: 1) |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/crdm-detect/input.schema.json){: data-fa-link="source" data-src="schemas/skills/crdm-detect/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/crdm-detect/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/crdm-detect/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

The verdict on one request. `fires` is the decision; `categories` and `excluded` are the evidence for it, so a reviewer can see why it fired or why it did not.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fires` | boolean | **yes** | True when the request is flagged as a feature request: at least one detection category matched and no exclusion applied. |
| `categories` | array<`"direct-capability"` \| `"workflow-gap"` \| `"platform-change"` \| `"cross-cutting"` \| `"review-surfaced"` \| `"self-declared-genre"`> | **yes** | The detection categories whose signals matched — the skill's `### ` sections. Empty when none did. Two or more from different categories is high confidence. |
| `excluded` | boolean | **yes** | True when an exclusion applied (the request matched a signal but is not a feature request, e.g. a content edit). An excluded request does not fire. |
| `stagingLinks` | any | no | The staging preview of the work this output asks a person to look at: one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/crdm-detect/output.schema.json){: data-fa-link="source" data-src="schemas/skills/crdm-detect/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/crdm-detect/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/crdm-detect/output.schema.json" data-repo="litlfred/cat-harness" }

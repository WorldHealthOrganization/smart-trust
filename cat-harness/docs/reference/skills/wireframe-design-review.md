---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Wireframe Design Review
parent: Skill schema reference
---

# Wireframe Design Review

> Skill id: `wireframe-design-review`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

What is to be wireframed and why: the use (design of a new or changed surface, or as-is drawing of an existing visualiser), the surface, and where the drawings are kept. Called from Process_CRDM_Requirements (Call_Wireframe) for Design use, when a requirement changes a rendered surface.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `use` | `"design"` \| `"as-is"` | **yes** | `design`: a new or changed UI, at least two candidates compared blind. `as-is`: an existing visualiser drawn as it renders on main, exactly one candidate. |
| `topic` | string | **yes** | Kebab-case name of what is drawn. For Design use from CRDM it is the proposal slug, so the drawings sit beside docs/proposals/<topic>.md; for as-is use it is the docs/wireframes/<topic>/ directory name. (pattern: `^[a-z0-9][a-z0-9-]*$`) |
| `surface` | string | **yes** | The rendered surface: a page, a visualiser ref, the navbar, a form, an app screen. |
| `intent` | string | no | Who the screen is for, what they need to do, and what it must show. Absent: written in step 1 (from the requirements for Design use; read off the visualiser's declaration for as-is use). |
| `requirements` | array<string> | no | Design use from CRDM: the requirement keys or sentences that change this surface, verbatim. |
| `proposal` | string | no | Design use from CRDM: repository-relative path of the request's proposal (docs/proposals/<slug>.md), whose assets the candidates become. |
| `humanReviewer` | string | no | Who chooses between candidates. From CRDM: the requester or the BA, by GitHub handle. |
| `channels` | array<object> | no | Where the candidates are shown: where the requester will look, chosen from context, and more than one may be right (feedback-deep-links, point 5). Each carries the same staging deep links and screenshots. |
| `branch` | string | no | The feature branch the candidates are committed on, so feature-staging publishes them. |

### `channels[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `"conversation"` \| `"issue"` \| `"pull-request"` | **yes** | The Tool the request for feedback goes through. |
| `url` | string (uri) | no | The issue or pull request; absent for the conversation. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/wireframe-design-review/input.schema.json){: data-fa-link="source" data-src="schemas/skills/wireframe-design-review/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/wireframe-design-review/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/wireframe-design-review/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

The wireframe renderings and the choice: each candidate's source HTML and its web and mobile screenshots, its check and review entries, the chosen candidate and who chose it, the same files as changed assets of the branch, and the staging deep links the requester or BA reviewed them at.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `use` | `"design"` \| `"as-is"` | **yes** |  |
| `topic` | string | **yes** |  |
| `assetDir` | string | **yes** | Repository-relative directory holding the drawings: docs/proposals/<slug>/wireframes/ for Design use from CRDM (assets of the proposal), docs/wireframes/<topic>/ for as-is use. |
| `intent` | string | no | Repository-relative path of intent.md. |
| `candidates` | array<object> | **yes** | At least two for Design use, exactly one (marked as-is) for as-is use. |
| `chosen` | object | no | Design use: the candidate the human reviewer chose. Absent until they choose; an agent never records a choice on a person's behalf. |
| `changedAssets` | array<any> | **yes** | Every wireframe file the branch adds, changes or removes — candidate HTML, screenshots, intent, reviews — in the changed-assets record shape a staging preview's graph carries, so the review lists them the same way. |
| `stagingLinks` | any | **yes** |  |

### `candidates[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **yes** | Candidate id, shown to reviewers in place of its author. |
| `title` | string | no |  |
| `source` | string | **yes** | Repository-relative path of the candidate's mid-fidelity HTML. |
| `screenshots` | object | **yes** | Written by wireframe-check: one per viewport. A candidate with only one does not enter review. |
| `staging` | object | no | The candidate and its screenshots on the staging preview, as deep links. |
| `entries` | array<any> | no | Script and review entries, per criterion. No scores, no averages. |
| `outcome` | `"chosen"` \| `"rejected"` \| `"pending"` \| `"as-is"` | **yes** |  |
| `reason` | string | no | Why it was chosen or why it lost. Rejected candidates stay, each with its reason. |

#### `candidates[].screenshots`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `web` | string | **yes** | Repository-relative path of the 1280×800 screenshot. |
| `mobile` | string | **yes** | Repository-relative path of the 390×844 screenshot. |

#### `candidates[].staging`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string (uri) | no |  |
| `web` | string (uri) | no |  |
| `mobile` | string (uri) | no |  |

### `chosen`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `candidate` | string | **yes** | The chosen candidate's id. |
| `chosenBy` | string | **yes** | The requester or BA who chose it. |
| `recordedAt` | string (uri) | no | Where the choice is recorded: the issue or pull request comment, or, when it was made in the conversation, the proposal section that records it. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/wireframe-design-review/output.schema.json){: data-fa-link="source" data-src="schemas/skills/wireframe-design-review/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/wireframe-design-review/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/wireframe-design-review/output.schema.json" data-repo="litlfred/cat-harness" }

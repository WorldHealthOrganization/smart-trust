---
layout: default
generated: scripts/gen-schema-docs.ts — do not hand-edit; edit the schema
title: Bean Drain
parent: Skill schema reference
---

# Bean Drain

> Skill id: `bean-drain`

_Generated from JSON Schema — do not edit by hand. Run `bun run cat-harness-tools/scripts/gen-schema-docs.ts`._

## Input

What a drain starts from: every bean copy to read, the agents that may hold a bean and how each is recognised, what each owner already holds, the activity window, and where the queue is written. Skill work-plan/skills/work-plan/bean-drain.md, bean n7x7.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `copies` | array<object> | **yes** | EVERY copy of the bean store, not only the one this checkout mounts. While there is more than one, a claim is a plain commit on each. |
| `agents` | array<object> | **yes** | Who may be draining, told apart by commit author on the bean branch. An author matching none of these is treated as another agent. |
| `holdings` | object | **yes** | Owner (thread or agent name) to the bean ids it already holds, used to group new beans with the owner already working in that area. {} on a first run. |
| `windowHours` | integer | **yes** | A commit to a bean by another agent within this window means skip it. (default: `24`, min: 1) |
| `queueFile` | string | **yes** | Where the queue is written for every drainer to read, e.g. drain-queue/open-beans-<date>.md in the shared project files. (minLength: 1) |
| `repos` | array<string> | no | Repositories whose open PRs are searched for a bean id before a claim. Defaults to the repos of `copies`, plus every repo the drained beans' PRs land in. |

### `copies[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repo` | string | **yes** | owner/name, e.g. litlfred/folio-assistant. (pattern: `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`) |
| `ref` | string | **yes** | The branch holding the store, e.g. cat/cat-harness/beans, or main. (minLength: 1) |
| `defs` | string | **yes** | Directory of bean files on that ref, e.g. beans/defs. (minLength: 1) |

### `agents[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | e.g. cloud, agy. (minLength: 1) |
| `authors` | array<string> | **yes** | Commit author strings, 'Name <email>', e.g. 'Carl Leitner <litlfred@fenugreek.home>'. |
| `self` | boolean | **yes** | true for the agent running this drain; its own recent commits do not block it. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/bean-drain/input.schema.json){: data-fa-link="source" data-src="schemas/skills/bean-drain/input.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/bean-drain/input.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/bean-drain/input.schema.json" data-repo="litlfred/cat-harness" }

## Output

What a drain produces: the queue, one claim check per bean taken, and what each bean ended as. The three definitions are also the outputs of the drain-queue, bean-claim-check and open-work-lookup Tools. Skill work-plan/skills/work-plan/bean-drain.md, bean n7x7.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queue` | any | **yes** |  |
| `checks` | array<any> | **yes** | One per bean a drainer tried to take, skips included. |
| `results` | array<object> | **yes** | What each claimed bean ended as. |
| `stagingLinks` | any | no | The staging preview behind any request the drain puts to the owner (an asked-owner question, a PR left for review): one deep link per changed page, with the same page on main. Required whenever a preview exists; when it does not, say so in `missing`. Rule: cat-harness skills/authoring/content-lifecycle/feedback-deep-links.md. |

### `results[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bean` | any | **yes** |  |
| `outcome` | `"completed"` \| `"scrapped"` \| `"asked-owner"` \| `"returned-to-todo"` \| `"blocked"` | **yes** | asked-owner: an ask-the-person question is open and its link is in the bean. |
| `prs` | array<string (uri)> | no |  |
| `question` | string (uri) | no | asked-owner only: the chat message holding the full question. |


[Raw schema](https://github.com/litlfred/cat-harness/blob/main/schemas/skills/bean-drain/output.schema.json){: data-fa-link="source" data-src="schemas/skills/bean-drain/output.schema.json" data-repo="litlfred/cat-harness" } · [✎ Edit](https://github.com/litlfred/cat-harness/edit/main/schemas/skills/bean-drain/output.schema.json){: .fa-edit-source data-fa-link="edit" data-src="schemas/skills/bean-drain/output.schema.json" data-repo="litlfred/cat-harness" }

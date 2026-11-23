This page is a map. The discipline is in the Skills, and where a Skill and this
page disagree, **the Skill wins and this page is wrong**.

| question | where it is answered |
|---|---|
| How a layer declares its directories, and every graph typology | [`directory-conventions`]({{ site.baseurl }}/reference/skill-instructions/directory-conventions.html) |
| What `content`, `context`, `state` and `derived` each promise a consumer | [`content-context-and-state-graphs`]({{ site.baseurl }}/reference/skill-instructions/content-context-and-state-graphs.html) |
| Actors, Roles, Permissions, and why a Role is a swimlane | [`role-model`]({{ site.baseurl }}/reference/skill-instructions/role-model.html) |
| Authoring a Workflow activity, and what a bean-marked step performs | [`bpmn-processes`]({{ site.baseurl }}/reference/skill-instructions/bpmn-processes.html) |
| Which store answers which question about a running Workflow | [`workflow-state`]({{ site.baseurl }}/reference/skill-instructions/workflow-state.html) |
| Why a Skill states a capability and a Tool the mechanism | [`skills-and-tools`]({{ site.baseurl }}/reference/skill-instructions/skills-and-tools.html) |
| Context Overlays, and the several ways context is generated | [Managing agent context](../guides/managing-agent-context.html) |
| What a visualiser owes a declared directory | [Subgraph viewers](subgraph-viewers.html) |

The schema behind every declaration on this page is
[`schemas/cat-harness.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/cat-harness.ts);
the Role and Actor shapes are in
[`scenarios/roles.json`](https://github.com/litlfred/cat-harness/blob/main/scenarios/roles.json)
and [`scenarios/actors/`](https://github.com/litlfred/cat-harness/tree/main/scenarios/actors/); the Tool shape is
[`schemas/tool.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/tool.ts).

The audit that checks these joins actually resolve is `bun run cat kg:audit`, one
criterion per join, written as committed QA sidecars so that "unbound since it
was drawn" and "broken in the commit under review" stay distinguishable.

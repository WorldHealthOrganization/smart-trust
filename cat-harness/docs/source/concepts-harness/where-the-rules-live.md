As with every page here: the discipline is in the Skills, and where a Skill and
this page disagree, **the Skill wins and this page is wrong**.

| question | where it is answered |
|---|---|
| What the Knowledge Graph is, and which way its references run | [The Knowledge Graph](knowledge-graph.html) |
| How a layer declares its directories, and every graph typology | [`directory-conventions`]({{ site.baseurl }}/reference/skill-instructions/directory-conventions.html) |
| What a visualiser owes a declared directory | [Subgraph viewers](subgraph-viewers.html) |
| What a Skill states and what a Tool supplies | [`skills-and-tools`]({{ site.baseurl }}/reference/skill-instructions/skills-and-tools.html) |
| Why a tile belongs to the Harness rather than to a node | [`harness-tiles`]({{ site.baseurl }}/reference/skill-instructions/harness-tiles.html) |
| Context Overlays, and how an Agent's conditions are set | [Managing agent context](../guides/managing-agent-context.html) |

The declaration schema, including `needs`, `remoteGraphs`, `renderExemption`
and `coverage`, is
[`schemas/cat-harness.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/cat-harness.ts);
the config schema, including `dependencies`, is
[`schemas/harness-config.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/harness-config.ts).

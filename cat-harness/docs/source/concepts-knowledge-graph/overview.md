Everything this harness knows about itself is one graph: the Schemas that
describe its content, the Skills an agent reads, the Workflows those Skills are
invoked from, the Roles that own a lane, the Tools and Tests that exercise a
Skill, and the running record of what is being worked on. That graph is the
**Knowledge Graph**, bootstrap's own term for it.

Two sentences fix the whole model, and the rest of this page elaborates them.

> **An Agent utilizes Skills to execute one or more Tasks in a Workflow, with
> an associated Knowledge Graph of Static Context (Skills, User Stories) and Dynamic
> Context. Zero or more Tools may be associated with a Skill, for Test
> execution on an agentic-to-deterministic spectrum.**

> **Knowledge Graphs are managed in git repositories, comprised of self-documenting
> JSON-LD. Content is rendered into various formats for consumption by
> downstream knowledge products, and by public-health, clinical-health and
> personal-health applications.**

Three definitions come straight out of the first sentence and are used
unchanged throughout:

- A **Role** is a swimlane, played by a human, agentic or mechanical Actor.
- A **Task** is a step in a Workflow — a node in the BPMN.
- A **Skill** is a **Capability with defined inputs and outputs**.

The Knowledge Graph is not one directory, and not one repository. A layer declares
the directories it scans and the **kind** of graph each holds, in its
`<name>.json` root declaration; a dependent layer inherits those and may add
its own. So the Knowledge Graph of a checkout is the union of what every layer in it
declares — which is why "where is the Knowledge Graph" has no filesystem answer, and why
a consumer asks for a kind rather than opening a path.

This page says what the subgraphs are, which way the references between them
run, how repositories divide the work, and how much of it is declared today. It
does not restate the declaration mechanism: that is
[`directory-conventions`]({{ '/reference/skill-instructions/directory-conventions.html' | relative_url }}),
and the schema is
[`schemas/cat-harness.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/cat-harness.ts).

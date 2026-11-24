Two independent questions get asked about every subgraph, and neither answer
implies the other.

**What is it about?** Schemas, Skills, Workflows, Roles, Tools, Tests, Context,
running state. This is the *topical* axis, and it is what the next section
describes.

**Does it change while a Workflow runs?** This is the **Static Context /
Dynamic Context** split from the anchor sentence above, and the declaration
already answers it mechanically in the `holds` field of each kind: a graph is
`content` (a process produces it), `context` (a process reads it and never
writes it), `state` (a process writes it as it runs), or `derived` (something
else computes it).

| | `holds` | examples |
|---|---|---|
| **Static Context** | `content`, `context`, `derived` | Skills, User Stories, Schemas, Workflows, methodologies, memories |
| **Dynamic Context** | `state` | work items, todos, Workflow instances, QA sidecars |

A step that writes to a `context` graph is a defect rather than an update,
which is the whole reason the field is REQUIRED — a kind that has not decided
does not compile.

The two axes are orthogonal. Skills and Schemas are both Static and are nothing
like each other topically; memories and methodologies are both Static for
entirely different reasons. Asking "is this a Skill?" tells you nothing about
whether a Workflow may write to it, and asking "may a Workflow write to it?"
tells you nothing about what it is for.

***Subgraph* has a second meaning.** [Subgraph viewers](subgraph-viewers.html) uses it for
one declared directory — the thing a visualiser draws and a Skill governs. This
page uses it for a branch of the topical taxonomy. One topical subgraph is
usually several declared directories across several layers, so the two
readings are related but do not count the same things. Where the number
matters, this page says *declared directory* or *graph typology* and leaves
*subgraph* for the taxonomy.

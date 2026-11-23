A **Harness** is what makes a [Knowledge Graph](knowledge-graph.html) usable: it
renders the graph, serves an interface over it, and supplies the Skills,
Workflows and Tools an Agent works the graph with. The Knowledge Graph says what is
true; the Harness is how anybody reaches it.

Four words carry this page, and each means one thing only (cat-harness#1138):

| word | means | never means |
|---|---|---|
| **instance** | a node of some node kind: a workflow instance, a work item, a document-kind record | a repository |
| **Harness** | one node kind: something that renders a graph and supplies Skills, Workflows and Tools for it | a repository as such |
| **layer** | a repository in the stack, declared by its `<name>.json` and ordered by `needs` | an instance |
| **instantiated harness** | a Harness that a layer's `index.config.json` names as instantiated there | a layer that is merely mounted |

In WHO SMART content, L1 to L5 are **knowledge layers**, layers of guideline
knowledge. A layer on this page is always a repository, never a knowledge layer.

A checkout holds several layers. They stack, bottom to top — `bootstrap`, then
`cat-harness`, then the content core, then `folio-assistant` — and each
inherits what the ones below it declare. Some layers define a Harness
(`cat-harness` is one); others hold content and instantiate a Harness defined
by a layer below them, such as an implementation guide instantiating the
Harness of the guide base it builds on. That
stacking is the subject of this page, along with the two things a Harness owes
anything it takes charge of.

**The key words MUST, MUST NOT, SHOULD and MAY are used here as
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) defines them**, and only in
upper case, per [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). Where a
requirement below is **not yet enforced by a gate**, this page says so at the
requirement, because a conformance statement a reader cannot tell from a
description of existing behaviour misleads either way.

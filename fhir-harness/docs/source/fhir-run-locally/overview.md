This page says how to render an implementation guide **through the harness**
from a terminal, on your own machine or in an agent's container. The output
is the same just-the-docs site the publish workflow deploys.

A harnessed render has two halves:

1. **Build the IG's AST once.** This is the only step that runs the IG
   Publisher. It writes `output-ast/`, one JSON dump per resource.
2. **Render the site from that AST.** The harness never reads the
   Publisher's `output/` HTML. The AST is the one input to the site build.

The steps below are listed in that order. To deploy the result, see
[Publishing an IG](publishing.html).

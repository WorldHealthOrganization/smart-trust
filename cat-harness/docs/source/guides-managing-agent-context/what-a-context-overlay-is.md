Context is generated in several different ways, and the point of the Term is
that they compose. A Context Overlay MAY be assembled from any of them:

- **Agent directives** — the instruction files an agent reads on arrival.
- **Memory** — durable facts an agent carries between sessions.
- **Interaction preferences** — how this person wants to be asked.
- **Waivers** — confirmations granted in advance, each naming one gate.
- **Methodologies** — an adopted way of reaching a judgement.

What makes them one kind of thing is not their format. It is their relation to
a running process:

> **Context is READ during a process and never written by one.**

The graph layer checks it. A step that writes to a Context graph is a defect, not an
update — which is exactly what makes an overlay reproducible: if a run could
modify its own context, the second run would not be the same experiment.

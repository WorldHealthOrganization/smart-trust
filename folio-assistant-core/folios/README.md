# folios/

**What an author creates *using* the graph** — a note, a visualization, a paper.

The distinction that decides what belongs here, from the owner, 2026-09-20:

| the thing | where it goes |
|---|---|
| the WHO IRIS catalogue itself | `library/`, or referenced remotely |
| a **note about** that catalogue | **`folios/`** |
| the page explaining **how ingestion works** | `docs/`, in cat-harness |

So the axis is the **subject**, not the format. All three are markdown rendered
to a website; only the middle one is content the author is creating *with* the
tools, and only the last is documentation *about* the tools.

## Why this declares `folio` and not a new kind

`folio` already exists — *"authored content, rendered to a website by the
just-the-docs pipeline"* — registered by core in
[`schemas/folio-graph-typology.ts`](../../cat-harness/schemas/folio-graph-typology.ts)
because only core can render it. A second kind for the same thing would be two
spellings of one concept, which is the drift this repository keeps paying for.

What is new is `docs`, in cat-harness, for the other subject. See
[`schemas/docs-graph-typology.ts`](../../cat-harness/schemas/docs-graph-typology.ts).

## Empty on purpose, and declared anyway

There is nothing here yet. That is a deliberate exception to the `dh4f` rule
("declare only what exists"): the directory is created **with** its declaration
in the same commit, so the declared path resolves. A declaration pointing at an
absent directory is the defect; a declaration pointing at an empty one is an
empty answer, which is a determined answer.

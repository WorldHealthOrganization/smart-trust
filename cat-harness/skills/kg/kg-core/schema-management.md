---
name: schema-management
description: >
  Manage a schema over its life — add one, change one, read the schema graph
  and its viewer, and act on what the reader could not determine. The layout
  rule lives in `directory-conventions`; the entity question lives in
  `data-modelling`; this is the work in between.
consulted: true
graph-typologies:
  - external-schema
  - schemas
---

# Managing a schema — the graph, the viewer, and the three answers that are not "fine"

**This skill does not restate where schemas live or how they are laid out.**
[`directory-conventions`](directory-conventions.md) §"What lives in the
`schemas` graph" owns that — the Zod `.ts` is authoritative, every other form
is generated, and a rendering is never where a fix lands. A rule stated twice
is free to drift, so it is not restated here.

Nor does it restate how to *model*. [`data-modelling`](data-modelling.md) owns
the question that matters before any of this — **what are the things, and what
is true of each of them exactly once?**

What is here is the work between those two: reading the graph the schemas
form, and keeping it readable.

## The schema graph is a graph, and it is published

`scripts/schema-graph.ts` reads every **declared** `schemas` directory and
returns declarations plus the edges between them.
`scripts/gen-schema-viz.ts` publishes that as a projection and a viewer.
`bun run cat schema:graph` prints the counts; `schema:viz` writes; `schema:viz:check`
is the gate.

**It reads every declared directory, not one.** `directoryForGraph` throws
when several directories declare a graph, because returning the first
silently resolves to the wrong directory on a run that exits 0. Several
layers declare a `schemas` graph, so **the fix is never to pick one**: a
view of one of several reports a corpus that does not exist.

Resolution is scoped **per directory** for the same reason one level down: two
layers may each have a `foo.ts`, and a global index by module stem would
resolve one layer's import to another layer's export — the same failure,
silently, with every edge still computing.

## Why the AST, and not the two things that look easier

Both obvious alternatives **erase the edges a schema graph is made of**:

- **The published JSON Schema.** `harness-schema-export` renders with
  `$refStrategy: "none"`, which is correct for a dereferenceable document — a
  consumer following an `$id` gets something self-contained. The cost is that
  a referenced type is not a named thing in the output at all; it is an
  anonymous object repeated at each use site. A diagram drawn from it is
  disconnected boxes.
- **The TypeScript type checker.** `z.infer<typeof FooSchema>` resolves to a
  deeply expanded structural type, so asking what `Foo.bar` is returns the
  whole of `Bar` inlined rather than a reference to it.

So the **syntactic** form is not the compromise. It is the only one of the
three that still holds `bar: BarSchema` as a reference to a named thing.

## The three answers that are not "fine", and what each one means

The reader reports three things that are easy to read as noise and are not.
**Check them when you add or change a schema** — the viewer surfaces all three.

| answer | what it means | what to do |
|---|---|---|
| **`undetermined`** | the walker saw an expression it does not model, and says what it saw | usually correct and nothing to do — a bare object literal is not a Zod call. If it is a shape you expect to be modelled, the walker is missing a case. |
| **`unresolved`** | a name the module BINDS, imported from a module inside this graph, that resolves to no declaration | a real finding. Usually a `const` array of literals imported as a vocabulary. Ask whether it wants to be a schema. |
| **`external`** | a name bound to a non-relative import, or to something in this module that is not a declaration | resolved correctly, outside this graph. Nothing to do. |

**`undetermined` is never rendered as an empty type**, and that is the whole
reason it exists as a state: a declaration with no fields and a declaration
whose expression could not be read are different answers, and rendering them
alike reports a clean run over something never looked at.

**The fix for noise is never a deny-list**, which would be a second, drifting
statement of this graph's vocabulary. Ask what the module BINDS instead: `z`
is bound, to `zod`, which is not a relative import and therefore not part of
this graph.

## What the graph structurally CANNOT see — measured, not guessed

The reader sees a reference when one schema names another. It sees nothing when
a reference is carried as a **string id**, because `actorId: z.string()` holds
no syntactic link to the schema it names. Neither would JSON Schema, and
neither would the type checker: the information is not in the types at all.

**Measured against `schemas/assistant-schema.puml`**, 266 lines of UML a person
drew by hand, used as a control:

| relation the diagram draws | reproduced by the reader |
|---|---|
| composition (`*--`) — a nested schema | **14 of 15** |
| association (`-->`) — a foreign key by id | **0 of 9** |

So the viewer states the limit — permanently in the header, and again on any
type carrying id-style fields. An undrawn association is **invisible, not
absent**.

### `@ref` — declaring the edge the reader cannot find

Those edges are drawable, and the mechanism is a **JSDoc tag on the field**:

```ts
/**
 * Skills available to an actor in this role, before inheritance.
 *
 * @ref SkillDefinitionSchema
 */
skills: z.array(z.string()).default([]),
```

Zero runtime cost — no helper, no wrapper, nothing changes about what the
schema validates. `firstProse` already skips every `@`-line, so the prose
summary and the machine-readable tag do not swallow each other.

**It cannot resolve the way everything else does.** `resolve()` requires the
name to be BOUND in the module, and the entire point of a string id is that
the target is not imported. So an `@ref` resolves **by name, nearest first** —
same module, then same directory, then graph-wide — **and only when the
narrowing leaves exactly one**. Two equally-near targets is an *ambiguous tag*,
not a winner: picking the first gives an answer that looks resolved and may
be the wrong schema.

A tag naming nothing, and an ambiguous one, both land in `refProblems` and are
**reported**. Silence would make a typo indistinguishable from a field with no
tag — the same rule `undetermined` states.

`id-ref` is its own edge kind and is never folded into `field`, so a consumer
can tell a reference **the source proves** from one **an author asserted**. The
diagram draws it dashed for that reason.

**What to tag is still a modelling question** —
[`data-modelling`](data-modelling.md). A tag is an assertion about the domain,
and a wrong one is worse than none: it draws an edge that does not exist.

### The control works in both directions

**The `.puml` is kept rather than retired**: a hand-drawn model is a cheap
control for a generated one, and comparing them finds blind spots in the
reader *and* stale relations in the drawing.

## Adding or changing a schema — the loop

1. **Model first** — [`data-modelling`](data-modelling.md). A field on the
   wrong entity is the error no schema check can catch.
2. Write the Zod schema in `.ts`. The type is `z.infer<typeof Schema>`, never
   declared alongside it.
3. **Tag the module** — `@graphNode schema`, or `@graphNode none — <reason>`
   with a reason. `check:schema-nodes` fails an untagged module, because an
   untagged one is silently absent from the published graph and absence is the
   one failure a consumer cannot tell apart from "this layer has none".
4. `bun run cat schema:viz` and look at your declaration in the viewer. Its kind,
   its fields, its generalisation, and what it references — and the three
   answers above.
5. Run `check:schema-nodes`, `typecheck` and `bun test`.

`schema:viz:check` is worth running locally and is deliberately **not** a CI
gate. The projection derives from the WHOLE repository, so
on a fast-moving repo the check reddens when somebody else merges rather than
when you forget — which is not an omission, and not what a gate is for. The
site build runs the writer at deploy, so nothing PUBLISHED goes stale; what can
lag is the committed copy, which exists to be browsable.

## Keeping the projection's gate honest

The projection is committed. **A staleness gate is only worth having if its
red means an omission.** A red meaning "somebody added a blank line" teaches
contributors to regenerate reflexively rather than to read the finding.

**A line number is an editor coordinate, not a property of a declaration**:
carried in the projection, it makes any edit above a declaration read as
stale. It is kept on the reader and dropped from the projection. The general rule, for
any generated artefact you gate:

> If a red can be caused by a change that alters nothing the artefact
> describes, the artefact is carrying something it should not.

For the same reason there is no per-module declaration list: a declaration
already names its module.

## Where a viewer publishes — TWO rules, not three

| rule | form | what it is |
|---|---|---|
| **1 — a handler renders a kind's assets** | `<base>/<handler>/<kind>/<optional subject>` | cat-harness's machinery over some graph. `<base>/cat-harness/library/<iris-replica>/` |
| **2 — a layer presents itself** | `<base>/<instance>/` | the IRIS replica mocking the IRIS website |

The handler is the layer doing the rendering, the kind names what it
renders, and the **subject is optional** — a page with no subject is the view
over every subject.

### Rule 1 is the canonical address; a bare `<base>/<visualizer>/` is an opt-in alias

`<base>/<harness>/<visualizer>/` always works; `<base>/<visualizer>/` is an
opt-in, for prettiness:

- **Canonical:** every visualiser is reachable at
  `<base>/<harness>/<visualizer>/`, which is rule 1 with the handler as the
  harness. A generated link uses that form unless an alias is declared.
- **Alias:** `<base>/<visualizer>/` exists only where a declaration opts in.
  It must not collide with another alias, a harness route, or a reserved
  site-wide route (`skills/`, `tools/`, `docs/`, `assets/`, …), and a
  collision names both claimants.

A visualiser is declared by its harness in `visualisers` (`renderedBy`), and
its `alias` is the opt-in. `compose-docs.ts` writes the alias as a redirect
for every page under the canonical route, and refuses one that would replace a
page; `bun run cat check:visualiser-routes` refuses, before any build, an
alias that names another alias, a harness, or anything the site already
publishes at its top level — naming both claimants. The reserved set is READ
from the site tree and the layer names rather than kept as a literal, so a
new site-wide route is reserved the day it exists. Link to the canonical form;
an alias is for a person typing a URL. The disk side — a remote mount landing
at `<name>/` — is in [`remote-mount`](remote-mount.md).

### When the two collide — the handler wins

A layer that is **both** — this one renders every graph here AND has a site
of its own — makes rules 1 and 2 name the same path, `<base>/<instance>/`, and
nothing above chooses between them. **The harness handler wins.**

So `/cat-harness/` is the handler namespace and nothing else. The layer's
own authored page is `docs/platform.md`, and `gen-handler-index.ts` generates
the route's index from `harnessTiles`.

**The rule is not "the generated page wins"** — it is that rule 1 is the one
with a *kind* in it, so it is the rule that can still address everything it
needs to once it owns the root. Rule 2 has nowhere else to go only if the
layer has no other name to present itself under, and a layer that is
doing both has exactly that: `docs/platform.md` is reachable, linked from the
generated index, and no route was lost.

**A subject page must NEVER be published at `<base>/<subject>/<kind>/`.** That
is rule 2's namespace, and a viewer parked there squats on the layer's own
site.

`viewerPlacement` in `gen-schema-viz.ts` is the single implementation, shared
with the library viewer — two statements of one placement rule are two answers
the moment either moves. It also computes the page's link back to its
projection from the page's own depth, because a literal `../assets/…` keeps
parsing and fetches nothing once a page gains a level.

**One projection serves every page.** A scoped page filters client-side on a
`SCOPE` constant; a second JSON per subject would be the same facts written
N+1 times, free to disagree the moment one is regenerated. Counts are scoped
too: a page never reports the graph-wide edge total.

### `docs/` is the same shape, and its subject means something specific

`<base>/cat-harness/docs/` is where all harness user documentation is, so
documentation at `<base>/cat-harness/docs/<instance>/` is documentation ABOUT
that layer — how it is ingested and so on — **not the layer's
content**, whose source is the layer's own `docs/`.

So a subject page under a handler is **about** its subject, rendered by the
handler — never the subject's own content relocated. The content stays in the
subject's own `docs/`, and the handler's job includes looking for those
directories.

`docs` is a `perInstance` kind, so every layer inheriting it gets its own,
and each existing `<instance>/docs/` is a member of the one declared subgraph.

## The relationship diagram — what is defined here, and HOW it is linked

A collapsible panel at the top of the viewer draws the declarations the page is
scoped to as **UML class boxes wired by their edges, each edge labelled with
the field it goes through**. That label is the point: *"Role is linked to
Skill"* is half an answer; *"via `skills`, many"* is the whole one.

### It is scoped, and refusing is an answer

The diagram draws what is defined in the page's scope, narrowed by the
**module filter** — not the whole graph. Above `DIA_MAX` (40) declarations it
**refuses and says how to get a picture** — pick a module — rather than draw
the hairball [`kg-viewer`](../../ui/ui-core/kg-viewer.md) warns against.

### One hop of context, because counting an edge is not showing it

A strict module filter cuts the edge most worth seeing: an edge such as
`RoleDefSchema --skills--> SkillDefinitionSchema` spans two files.

So a declaration just outside the filter that a drawn one touches **is drawn**,
faded and dashed, marked as context rather than as part of the set.
Context-to-context edges are not drawn — that would be a graph the page is not
about.

**The fade is load-bearing**: without it the diagram quietly widens its own
scope. The render test counts `.dia-ctx`.

### Three edge kinds, and `id-ref` is drawn differently on purpose

| kind | drawn | means |
|---|---|---|
| `extends` | solid, hollow triangle | generalisation |
| `field` | solid, open arrow | a reference **in the source** |
| `id-ref` | **dashed** | an association **declared** with `@ref` over a plain string |

A field reference is something the reader *found*. An id-ref is something an
author *asserted*, because the target is a string id the reader structurally
cannot see. Drawing them alike would claim the reader saw something it did
not — the same honesty the three `undetermined`/`unresolved`/`external` states
already enforce one level down.

### Layout

Longest-path layering so a generalisation reads downward, then one barycentre
pass to reduce crossings, ties broken by name. The walk is **depth-capped
rather than assuming a DAG**: mutually recursive types are real here, and a
cycle must settle rather than hang.

Static, in the strict sense — computed once, no simulation, nothing to settle.

Edge labels stagger by index, because two edges whose midpoints land in the
same band overplot. The stagger only has to separate neighbours, not be
optimal.

### Clicking a box opens its definition

That makes the diagram browsable navigation rather than a poster.

## Orphan pages — a generator that writes must also prune

A `--check` twin catches a page that is **wrong**. It cannot catch one that
**should not exist**, and the difference is structural: `--check` inspects the
files it is about to WRITE, so a file the generator no longer writes is outside
what it looks at.

When an entry is renamed, subject slugs derive from the entry's path, so
regeneration writes the new page and leaves the old one standing, serving a
subject no declaration describes, at a URL nothing links to.

### Ownership comes from the FILE, never from the directory

This is the load-bearing rule, and it is
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md) applied
to the tool most tempted to break it. *"Everything under this directory is
mine"* is an assumption; *"this file says it was generated by me"* is a check.

`orphanSubjectPages` in `gen-schema-viz.ts` — shared by `gen-library-viz.ts`
and `gen-auto-docs.ts` — makes that check the narrowest one available: a
directory is prunable only when its `index.html` declares itself the subject
page **for that very directory**, `var SCOPE = "<dirname>";`. A page naming a
different subject is a page this generator did not write *for this location*,
so it is `foreign`. So is a directory with no `index.html`. The directory
scopes the SEARCH; the file decides the DELETE, and everything else is
reported and left.

**Prefer the self-naming test to a "generated by me" marker where one is
available.** A marker answers *did I write this*; naming the directory answers
*did I write this HERE*, which is strictly stronger and needs no new bytes in
the page. Reach for a marker only when the pages carry no such identity — the
`state-visualizer` case, where dashboards publish at the site root among
directories nothing here owns.

### Do not write another one

There are already four selectors for one question — `prunableStickies`
(`ensure-landing-sticky.ts`), `OWNED` (the IRIS replica's
`scripts/gen-iris-pages.ts`), `orphanSubjectPages`, and `prunableDashboards`
(`state-visualizer.ts`). The multiplicity is a defect. A new generator imports
`orphanSubjectPages` rather than minting a fifth.

The ratchet lives in `scripts/tests/viewer-orphans.test.ts` and asserts against
the **committed tree** rather than a fixture — every published subject page
declares itself — because a fixture passes on the day somebody re-keys a real
subject.

## Editing a viewer — no backticks

Both viewers are a whole HTML document inside one TypeScript template literal.
A backtick **anywhere** inside it — including in a JavaScript comment in the
embedded script — terminates the string, and the failure surfaces as a parse
error a couple of hundred lines from the mistake.

`schemas/viz-generators.test.ts` imports both generators, so a stray backtick
reddens the suite rather than only the next person's generator run. Run it
before assuming a generator change is fine.

## Where the boundaries are

- **`schemas/` holds content.** `BASE_GRAPH_TYPOLOGIES.schemas` carries
  `holds: "content"` — a shape is the subject matter of the schema graph, and
  it is true before anything is validated against it. See
  [`content-context-and-state-graphs`](content-context-and-state-graphs.md).
- **Adding a graph TYPOLOGY is a different job** —
  [`directory-conventions`](directory-conventions.md) §"Adding a graph typology",
  and decide which layer owns it first: a layer owns the kinds it can render
  ([`instance-kinds`](instance-kinds.md)).
- **Publishing a schema at a dereferenceable `$id`** is
  `harness-schema-export`, a separate rendering with a separate consumer.
  Generate as many renderings as have a consumer, and no more.
- **An unwired generator is worse than none**: nothing asks whether its
  output still matches its input, and it rots. A new rendering ships with a
  `--check` twin in the gate set or it does not ship.

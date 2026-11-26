---
name: instance-kinds
description: >
  How to make a new KIND of harness layer — choosing the prefix family, the
  keep-the-kind's-name default and the owner's right to decline it, which
  inherited files the new owner may repoint, and what a new GRAPH typology must
  declare. Read before naming a new layer, before adding a value to the
  graph-typology registry, and before building a visualiser. Carries the test that
  usually says "this is not a new kind".
consulted: true
allowed-tools: Read Grep Glob Bash
---

# Layer kinds — naming one, and what a new kind must declare

Two different things are called a "kind" here:

| | what it is | where it is declared |
|---|---|---|
| **layer kind** | what a repository *is* — `cat-harness`, `bootstrap`, the IRIS replica. It has a name, a prefix family, a `<name>.json`, and files it inherits from whatever it was bootstrapped off | a `<name>.json` at the layer root |
| **graph typology** | what a declared DIRECTORY holds — `tools`, `docs`, `beans`, `library`. A value in the graph-typology registry, with `renderable`, `holds` and a summary | `defaultGraphTypologies` in `schemas/kg/cat-harness.ts`, or a registration from a layer that owns it |

A layer kind gets a **name**. A graph typology gets a **declaration**.

---

## Most new things are not a new graph typology

**Before adding a value to the registry, answer this:**

> Is there a NODE SHAPE here that no existing kind describes — or is there a
> new thing you want to DO with nodes that already have a kind?

A new verb is not a new kind. Only a new noun is.

### Example: a visualiser is not a kind

- **`coverage.visualiser` is a rendered PATH, not a kind.** Its values have
  the shape `cat-harness/docs/cat-harness/<graph>/<instance>/index.html`; it
  names an artefact.
- **A visualiser lives as a tool in the harness that DEFINES the schema**,
  declared in `skills`/`tools` — not beside the data, and not in whichever
  layer happens to render it.

So a visualiser is a **Tool node** in the existing `tools` graph that emits a
**page** in the existing `docs` or `folio` graph. Nothing to register.

A registry value is cheap to add and expensive to remove: every consumer that
switches on a kind gains a case, `check:graph-typology-work` gains a row, and
the JSON-LD vocabulary gains a term that downstream layers inherit. A kind
that describes an activity rather than a shape cannot tell a consumer what it
will find in the directory.

### When it genuinely IS a new kind

All three, not a majority:

1. **A directory will hold it.** A kind is what a declared directory holds. If
   nothing gets declared, there is no kind — you have a file format.
2. **A consumer must branch on it.** Something reads the directory and would
   behave wrongly if it treated the contents as an existing kind.
3. **You can answer `renderable` and `holds` without hedging.** See below. If
   either answer is *"it depends what it is used for"*, the shape is not
   settled and the kind is premature.

---

## Naming a layer — the prefix families

A prefix names the **layer** or the **owner** a layer belongs to.

| prefix | what it marks | layers here |
|---|---|---|
| `cat-` | the agentic-harness layer | `cat-harness`, `bootstrap` |
| `folio-assistant-` | the content/core layer | the content core, the science layer |
| `who-` | WHO material | the IRIS replica |
| `litlfred-` | the owner's own | — none yet |

Some layers carry no prefix (`agent-skills`, `detangle`, `kg-navigation`,
`large-datasets`). An unprefixed name is undecided, not wrong, and is not a
finding. Do not sweep them into a family to make the table tidy: a rename
changes what every artefact written into the layer inherits.

**The `cat-` prefix reaches the harness layer and stops there.** It does not
extend to `folio-assistant-*`.

### The default is to keep the kind's name

A new layer of a kind **inherits that kind's name** unless somebody chooses
otherwise. That is the default, not the rule.

### And the owner may decline the convention

`qou` would be `litlfred-qou` or `folio-assistant-qou` by the table above, and
it is neither, by the owner's decision.

> **Do not "fix" `qou`** or `folio-assist-sci`. A name that does not match the
> table is a decision until somebody says otherwise, and renaming a layer
> changes what every artefact written into it inherits, which cannot be fixed
> later (`bootstrap/README.md`, §2).

The prefix convention is a default with a documented override, not a rule.

---

## What a new graph typology must declare

The shape is `GraphTypologyDef` in `schemas/kg/cat-harness.ts`; read it there
for the authoritative field list. What an author has to *decide*:

| field | required | the question |
|---|---|---|
| `type` | yes | the `@type` IRI it projects to — `termIri("SomethingGraph")` |
| `renderable` | yes | does a graph of this kind become a website? |
| `holds` | yes | what does a running process do with it? |
| `recordsWork` | for `state` kinds | is this something somebody is partway through, that an arriving agent could pick up? |
| `summary` | yes | one paragraph a consumer can act on |
| `skill` | optional, and absent means absent | which skill says how to READ it |

### `holds` has FOUR values, not three

`content` · `context` · `state` · `derived`.

| value | a running process… | example |
|---|---|---|
| `content` | PRODUCES it; it is the subject | `schemas`, `docs`, `cat-harness` |
| `context` | READS it and never writes it — a step that writes is a **defect** | `memory`, `interaction` |
| `state` | WRITES it as it runs | `beans`, `workflow-state` |
| `derived` | produces it **from a source**, and would regenerate rather than re-author it | `library` |

`derived` is the one most often missed. `library/` is not `context`, because
`document-ingestion.bpmn` writes it; and not `content`, because a QA finding
against a derived section is a finding against its **generator**.

**There is no "could not determine" on this axis.** A third state is right
when a check looked and could not tell, and wrong when an author is
registering a kind they are defining: whoever adds a kind knows what a process
does with it. The classification of every existing kind, with
its reason, and the two supporting questions for a hard case, are in
[`content-context-and-state-graphs`](content-context-and-state-graphs.md).

### `recordsWork` is narrower than `holds: "state"`

It asks whether the graph records **work somebody is partway through**, not
merely whether something writes to it. An ingestion queue such as `uploads`
is live state that nobody is partway through; an agent told *"this KG is
active"* on that basis arrives looking for something to prioritise and finds
unprocessed files.

`check:graph-typology-work` requires it for every `state` kind, so a new state
kind cannot ship undecided.

---

## Where a kind may live — a layer owns the kinds it can render

| kind | declared where | why |
|---|---|---|
| `folio` | **registered by core**, on import (`schemas/kg/folio-graph-typology.ts`) | the harness cannot serve it — block viewers, LaTeX, QA badges, translation overlays |
| `docs` | **in the harness's own table** (`defaultGraphTypologies`) | the harness ships a plain just-the-docs renderer and can serve it |

The rule is **a layer owns the kinds it can render**.

**Registration on import is for a kind that may legitimately be ABSENT.**
`folio` is contributed by a dependency and may not be there; `docs` ships with
the harness and can never be absent, so registering it on import would make
every consumer import a kind that is always present. Ask of your own new kind:
*can this kind be absent?* If no, it belongs in the table.

**The boundary `docs` must not cross** is the SUBJECT, not the feature list.
The moment a `docs` page needs a block viewer, a LaTeX pass, a QA badge or a
translation overlay, it is describing authored CONTENT and is a `folio`.

---

## What a new layer inherits, and which of it is yours to edit

A new layer kind is bootstrapped from an existing one and arrives carrying
that layer's files. Some of them are **yours**.

### `bootstrap/README.md` is the first one

It is the page a Bootstrapping Agent reads before it knows anything, and it is
written for **this** repository: its links into `../cat-harness/` (the schemas
for DAK blocks, roles, the harness declaration, skill packages and tools, and
`processes`) are all **term definitions**. In a new layer kind not built on
`cat-harness`, those definitions point into a harness its reader is not using.

**So repointing it is expected, not a modification of platform code.** Point
the links at whatever layer defines *your* vocabulary, or at your own
layer kind's schemas. Keep the user-scenario structure — persona, user
scenario, business process, functional requirement — because that is the
formalism the page is written in and the bootstrap process reads it; change
only where the terms resolve.

> **The general rule.** Any inherited file whose content is a POINTER — a
> README, an `AGENTS.md` stub, a `.mcp.json`, a builder shim — belongs to the
> new owner. Any inherited file that is a MECHANISM belongs to the layer that
> ships it, and changing it there is a platform change with all the gates that
> implies.

---

## Before you push

| what you changed | run |
|---|---|
| added a graph typology | `bun run cat check:graph-typology-work`, `bun run cat check:harness-dirs` |
| added or renamed a layer | `bun run cat check:instance-config`, `bun run cat check:subgraph-coverage` |
| edited this or any skill | `bun run cat check:skills` |
| anything | `bun run cat gates` |

`bun run cat gates` is the one to run:

1. **Its gate list is derived** from `.github/workflows/code-quality-gates.yml`,
   so it cannot drift from that workflow.
2. **Every OTHER workflow is scanned too**, and any `bun` step CI runs that the
   local set does not is reported on every run — unless it carries a declared
   exemption with a **reason** (`covered-by`, `ci-only`, `no-folio`). *"It is
   slow"* and *"it usually passes"* are not reasons.

The second half is what makes the first safe to rely on: a gate the local
runner passes can still go red in CI. A hand-picked subset of the gate set is
not the gate set.

## Related

- [`harness-requirements`](harness-requirements.md) — what a layer OWES for
  every directory it declares.
- [`content-context-and-state-graphs`](content-context-and-state-graphs.md) —
  the `holds` axis in full, with every existing kind classified and its reason.
- [`directory-conventions`](directory-conventions.md) — the declaration schema,
  path resolution, and the dot-prefix guard.

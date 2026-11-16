---
# folio-assistant-xgd8
$schema: bean/1.0.0
title: 'SCHEMA VISUALISER: schemas/ is a content kind with no renderer — options, and three generators that were never wired'
status: completed
type: task
priority: normal
created_at: 2026-09-20T18:21:04Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-yj32
---

Owner, 2026-09-20, verbatim — quoted because it sets both the requirement and
the URL shape, and a paraphrase of a URL shape is a second answer:

> cat-harness rendeding pipeline should include a schema visualization
> https://github.com/litlfred/folio-assistant/tree/main/cat-harness/schemas
> should be content kind w/ skills on shcema mangment, data modeling, ingesting
> shecmas into KG library, etc.  check.
>
> what are options given our .ts upstream. i want rpetty UML like diagrams that
> once the rendering (under at-harness/schemas/visualizers or so ) that are
> brwosable, so i can give overview like brosing to
> `<baseURL>/schema/visualizers/bootstrap/`
> `<baseURL>/schema/visualizers/<path to KG contaitn schemas>`
> or so... what options/pros/cons

## "check" — what is already true, measured 2026-09-20 on `d4eef090`

The owner asked for a check before a build, so this is the check. Three of the
four things asked for already exist in some form, and the fourth does not exist
at all.

| asked for | state |
|---|---|
| `schemas/` is a **content kind** | **already true** — `BASE_GRAPH_KINDS.schemas` in `schemas/cat-harness.ts` carries `holds: "content"` ("a shape is the subject matter of the schema graph"). It is `renderable: false`, which is the half that is missing. |
| **skills** on schema management / data modelling | **partly** — `skills/kg/kg-core/data-modelling.md` exists (113 lines, entities-before-fields, invoked by the `crdm-data-model` phase). There is **no** schema-management skill and **no** schema-ingestion skill. |
| ingesting schemas into the KG **library** | **does not exist.** `library/` is the L1 bibliographic corpus; nothing ingests a schema into it, and whether a schema even belongs there is undecided (see the open question below). |
| a **visualiser** | **does not exist** for `schemas/`. |

And the numbers behind those rows:

| | count |
|---|---|
| modules in `cat-harness/schemas/` | 100 |
| carrying a `@graphNode` tag (so: exported as KG nodes) | 72 |
| modules exporting at least one `export const *Schema = z.…` | 34 |
| exported `*Schema` consts (`3lbz`, re-measured on `c7b5d9a6`) | 199 |
| Zod schemas **published as JSON Schema** by `harness-schema-export` | **3** + 44 skill I/O contracts |
| Zod schemas with a **rendered diagram** | **0** |

## The three prior attempts, and why each stopped short

**1. `schemas/assistant-schema.puml` — 266 lines of hand-authored PlantUML.**
This is the thing the owner is asking for, already written, as a class diagram
with packages and cardinalities. It is referenced by **nothing**: no script, no
workflow, no docs page, no `package.json` entry. Nothing renders it and nothing
gates it against the `.ts`. It is the worked example of why the authored form
must be the `.ts` — `directory-conventions` §"What lives in the `schemas`
graph" already says *"the Zod schema in `.ts` is authoritative, and every other
form is generated from it"*, and this file is the counter-example sitting in
the same directory.

**2. `scripts/generate-schemas.ts` — Zod → JSON Schema into `schemas/generated/`.**
Invoked by nothing (`grep` over `package.json`, `.github/workflows/`: zero
hits), covers only the 18 schemas re-exported from `constraints.ts`, still
carries a `ts-node` shebang, and **its output directory does not exist**. Bean
`3lbz` found the same thing from the other end: `SkillDefinition.schemas` has
exactly one referencing code path and it is `scripts/generate-docs.ts`, *"which
nothing invokes"*.

**3. `scripts/generate-schema-manifest.ts` — types → a viewer manifest.**
Also invoked by nothing, and its two input paths are **stale**:
`folio-assistant/schemas/types.ts` under a `ROOT` of `cat-harness/`, i.e.
`cat-harness/folio-assistant/schemas/types.ts`, which does not exist. It is
listed in `docs-generation.md` as a live generator, so the skill documents a
pipeline stage that cannot run.

So the honest statement of the gap is not "we have no tooling". It is: **three
generators were written, none was wired, and one of them was superseded by a
hand-authored diagram that then rotted.** Any option below that does not end in
a `--check` gate reproduces this outcome.

## The finding that constrains the options — the published schemas have no edges

`harness-schema-export.ts` calls `zodToJsonSchema` with `$refStrategy: "none"`,
for a reason that is correct on its own terms (a consumer dereferencing an
`$id` gets a self-contained document). Measured on the output:

| document | bytes | `$ref` occurrences | definitions |
|---|---|---|---|
| `folio-assistant.schema.json` | 5179 | 1 | 1 |
| `tool.schema.json` | 3648 | 1 | 1 |

**Inlining erases exactly the relation a class diagram draws.** A UML diagram
of `CatHarnessDeclaration` wants an edge to `ContentDirectory`, and in the
published document `ContentDirectory` is not a named thing at all — it is an
anonymous object literal repeated at each use site. So **the currently
published JSON Schema cannot drive the diagram**, and an option that reads it
would render 100 disconnected boxes. This is the single most decisive fact for
choosing between the options, and it was not obvious before measuring.

## What the rendering pipeline already does, that this should reuse

- **`scripts/kg-viewer.ts`** — the established viewer shape here: ONE generated
  HTML file, **no CDN, no framework, no build step**, fetching its data
  relative to its own location so the same bytes work at the canonical base and
  at a staging slug. It explicitly rejects a force-directed hairball for 1111
  nodes in favour of a faceted index + detail panel + **one-hop neighbourhood
  diagram**. A schema visualiser should be the same animal, and the same
  argument applies with more force: a class diagram of 100 types is a hairball,
  a one-hop neighbourhood of one type is a diagram.
- **PR #581 (`km90`)** — the pattern for a declared subgraph reaching the
  pipeline, landed the same day: one reader module (`scripts/beans.ts`), a
  published projection (`docs/assets/beans/index.json`) emitted through the
  existing `emit(..., "data")` `--check` contract, and a board over it. This
  bean is the same three pieces pointed at `schemas/`.
- **TypeDoc already runs at deploy** into `_site/api/`, over **8** of the 100
  schema modules, named as literals in `docs-site.yml`.
- **`typescript` is a direct dependency**, so a compiler-API walk over the
  `.ts` needs **no new dependency** — which is what lets a generated diagram
  obey the kg-viewer's no-third-party rule.

## Options, with the pros and cons the owner asked for

Five, ordered by how much they add. Each is judged on: does it read the
authoritative `.ts`, does it keep the edges, does it need a new dependency,
and can it be `--check` gated.

**A. TypeDoc over all of `schemas/`, published at `<base>/api/`.**
Already installed and already running; widening it is editing one literal list
in `docs-site.yml`. *Pros:* zero new machinery, real cross-links, handles
generics. *Cons:* it is **API reference, not UML** — no class diagram, no
cardinalities; it documents `z.infer`'d types as opaque aliases, so the Zod
shape (which is the authoritative one) is largely invisible; not browsable at
the requested `schemas/visualizers/<path>` shape; nothing gates it.

**B. Fix `generate-schemas.ts`, publish per-module JSON Schema with
`$refStrategy: "root"`, render each with a generated viewer.**
*Pros:* JSON Schema is a real interchange format with existing consumers
(editors, validators); `harness-schema-export`'s `$id` trick already gives each
document a dereferenceable address; **keeps the edges** if and only if the ref
strategy changes. *Cons:* changing `$refStrategy` on the *published* documents
changes a shipped contract — so this needs a second rendering rather than an
edit, which is the "generate as many renderings as have a consumer" rule
deciding against a free change; Zod → JSON Schema is lossy for refinements,
transforms and branded types, so the diagram would silently omit constraints.

**C. A TypeScript compiler-API reader over `schemas/*.ts` → one projection →
one generated zero-dependency viewer.** The `km90` shape.
*Pros:* reads the **authoritative** form directly, so nothing is lost in a
prior conversion; `typescript` is already a dependency so no third party enters
the trust boundary of a page rendering this repository's own data; **keeps
every edge**, including the `z.infer` link and the `@graphNode` declaration
already on 72 modules; one projection can drive several views (class diagram,
faceted index, dependency graph) without re-reading; naturally `--check`
gateable through the existing `emit(..., "data")` contract. *Cons:* the most
code to write, and a Zod AST walk has real edge cases (`z.lazy`, `z.union` of
16 members, the registry pattern in `cat-harness.ts`) where "could not
determine" must be a rendered third state rather than a silent omission.

**D. PlantUML / Mermaid source generated from the `.ts`, rendered at deploy.**
*Pros:* a genuinely pretty, conventional UML class diagram, which is literally
what was asked for; Mermaid needs no server; the BPMN pipeline already proves
headless-Chromium rendering works here (`render:bpmn`). *Cons:* a 100-type
class diagram is unreadable at any zoom — this is the hairball argument the
kg-viewer already made and won; PlantUML needs Java or a remote server (a third
party in the trust boundary, or a new toolchain); a rendered SVG is not
browsable — no search, no deep link to a type, no filter. Best as a *per-type*
or *per-package* output **inside** option C rather than as the whole answer.

**E. Do nothing new; delete the three dead generators and the orphan `.puml`.**
*Pros:* removes three artefacts that document a pipeline that does not run,
which is its own defect (`docs-generation.md` currently names a generator with
stale paths). *Cons:* does not give the owner what was asked for. Note this
option **cannot be taken by an agent on its own** —
`deletion-requires-confirmation` — and the `.puml` is 266 lines of real
modelling work that option C could use as its **validation target**: if the
generated diagram does not reproduce what a human drew by hand, one of the two
is wrong and that is worth knowing.

**Recommendation: C, with D's per-type diagram as a view inside it, and A
widened as a cheap independent win.** C is the only option that reads the
authoritative form and keeps the edges, and it is the shape this repository
landed for `beans/` the same day. A is a one-literal change that stands alone
and does not conflict.

## The URL shape asked for, and the one thing to settle

The owner wrote `<baseURL>/schema/visualizers/bootstrap/` and
`<baseURL>/schema/visualizers/<path to KG containing schemas>` — i.e. **keyed
by the declaring instance**, so that `bootstrap`, `cat-harness` and a
downstream folio each get their own tree. That is consistent with how the site
already separates instances by `stub` (`kg-export`, `kg-viewer`: *"the stub is
what separates one instance's renderings from another's in a tree that overlays
several"*).

Undecided, and it should be decided before a path is written down: **`schema/`
or `schemas/`?** Every declaration, every graph kind and every directory in
this repository says `schemas`, and the owner's URL says `schema`. A URL that
disagrees with the graph kind it renders is a second name for one thing.

## Open questions for the owner

1. **Which option** (above).
2. **"ingesting schemas into KG library"** — `library/` is the L1
   *bibliographic* corpus, where every reference resolves through a
   `<bib-slug>/`. A schema is not a bibliographic source. Does this mean (a)
   schemas become library entries, (b) *external* schemas (FHIR
   StructureDefinitions, JSON Schema from upstream) get ingested into
   `library/` as sources, or (c) "library" is being used loosely for the KG?
   These are three different builds.
3. **`schema/` vs `schemas/` in the URL** (above).

## Done when

*Revised 2026-09-20 further down this bean, and promoted here 2026-09-21 under
bean `sfhr`. The verdicts are the author's and unchanged; what moved is which
list a reader finds first. The original wording is kept below the revision.*

- [x] The option is chosen by the owner and recorded here (C + D-as-a-view + widen A)
- [x] `schemas/` has a visualiser at a declared, instance-keyed path, built from
      the authoritative `.ts`
- [x] A `--check` gate fails on a stale rendering — falsified both directions
- [x] The schema-management skill exists
- [ ] The ingestion skill — deferred to `slw1` with the reason recorded there
- [ ] `assistant-schema.puml` is retired or made the validation target — owner's call

---

Tracked on [issue #582](https://github.com/litlfred/folio-assistant/issues/582).


---

## ANSWERED by the owner, 2026-09-20 — all three questions

### 1. Which option — **C, with D as a view inside it, and A widened alongside**

So the build is the compiler-API reader over the authoritative `.ts`, feeding
one projection, feeding a zero-dependency browsable viewer, **and** per-type
UML diagrams rendered as a view within that viewer rather than as a wall-sized
class diagram. Widening the existing TypeDoc run is taken as a separate,
independent win and must not be entangled with the rest.

**What this decides, and why it matters more than "pick one":** the diagram is
a VIEW over a projection, not an output format. That is what keeps D's
hairball problem from returning — the projection carries every type and every
edge, and each rendered diagram is a neighbourhood of one type, the same
argument `kg-viewer.ts` already made and won for 1111 KG nodes.

### 2. Ingesting schemas into the KG library — **BOTH (1) and (3)**

The owner picked two of the three readings together:

- **(1) External schemas become library sources.** Upstream FHIR
  StructureDefinitions, JSON Schema from other projects and the like are
  ingested into `library/` as real bibliographic sources, so a KG node can
  CITE them.
- **(3) Our own `schemas/*.ts` also become library entries**, with bib-slugs,
  like any other source.

**Taken together these are stronger than either alone, and the combination is
the point.** If only external schemas were sources, "cite the schema you
conform to" would work for someone else's schema and not for ours, and the
asymmetry would show up as a dangling reference the first time one of our own
schemas needed citing. Both in, and `library/` is then uniformly the place a
schema reference resolves through — which is the property `jbx2` is about
demonstrating rather than asserting.

**What it does NOT decide, and must not be guessed:** what a schema's
`sections/`, `structure.json` and OCR-state mean for an entry that was never a
scanned document. `library/<slug>/` has a shape built for a scanned source, and
a schema has no pages. The three-state ingestion display `jbx2` requires will
report *something* for a schema entry, and inventing what that is here would be
the third answer to a question `slw1` owns. **Raise it against `slw1` before
building the ingestion half.**

### 3. The URL — **NOT a new `schema/` top-level segment.** Owner, verbatim:

> rendered assets should be available at toplevel like `<baseULR>/` for main
> jsut the docs pipleline, or `<baseurl>/<page>` where is registered rendered
> page from a harness that was instantiated and enabled (by default enabled)
> realtivg to their url, so `<baseurl>cat-harness/docs` or so...
> `<baseurl>/<insantiated harness>/<path_to_rendered_conentent>`, bootstrap
> jsonld/json is example

**This is a general rule about the rendering pipeline, not an answer about
schemas**, and it is bigger than this bean — it says how EVERY instance's
rendered content is addressed, with the bootstrap `.jsonld`/`.json` as the
worked example. It is beaned separately rather than buried here, because a
rule that governs every rendered artefact should not live in the bean of the
first artefact to need it. Both options offered — `schema/` and `schemas/` —
were the wrong question: neither is a top-level segment at all.

**What it settles for THIS bean:** the visualisers are published under the
instance's own rendered-content root, **resolved** from the declaration and
never composed as a literal. `siteDir` already returns `docs` relative to the
instance root and `artefactStub` already names the instance, so both halves of
`<instance>/<path>` exist as resolvers today. Nothing here writes a
`schema/` or `schemas/` path segment at the top level.

## Scope, now that the answers are in

| piece | option | state |
|---|---|---|
| widen TypeDoc over all of `schemas/` | A | independent, first |
| compiler-API reader over `schemas/*.ts` | C | the core |
| published projection, gated | C | follows the reader |
| browsable viewer over the projection | C | follows the projection |
| per-type UML as a VIEW in that viewer | D-in-C | last |
| schemas into `library/`, both directions | — | blocked on `slw1`, see above |


---

## DELIVERED — 2026-09-20, PR #583

All three of `2krx`'s requirements, for `schemas/`:

| requirement | what landed |
|---|---|
| **visualiser** | `scripts/schema-graph.ts` (reader) + `scripts/gen-schema-viz.ts` (projection + viewer). Faceted index, detail panel, per-type UML neighbourhood. |
| **documentation entry** | `docs/subgraph-viewers.md`, covering both this and `library/`. |
| **governing skill** | `skills/kg/kg-core/schema-management.md`, registered in `folio-core`. |

And option A separately, as the owner asked: TypeDoc reads the schemas
DIRECTORY rather than a list of eight literals — **8 → 95** module pages, 0
errors, and a file added to `schemas/` now publishes its reference with no
second edit.

### Measured on the merged tree

| | |
|---|---|
| declared `schemas` directories read | **4** (`schemas/`, `folio-assistant-core/`, `large-datasets/`, `detangle/`) |
| modules | 108 |
| declarations | 799 |
| edges | 505 |
| undetermined | 6 |
| unresolved (distinct names) | 6 |
| projection | 880 KB raw, ~87 KB gzipped |

### Three defects found by measuring rather than by reading the code

1. **`.extend()` classified `undetermined`** — 31 of 713 declarations, nearly
   all `BaseSchema.extend({…})`, which is THE inheritance relation of this
   corpus. The walker was discarding the generalisation arrow a class diagram
   exists to draw. Now 6, all genuinely non-Zod object literals.
2. **`z` was the graph's most-referenced "missing declaration"**, 175 times.
   Fixed without a deny-list — a name is a candidate reference only if the
   module BINDS it, and `z` is bound to `zod`, a non-relative import.
   Distinct unresolved names 150 → 6.
3. **The singular `directoryForGraph` call threw on merged main**, because
   four instances declare the graph. The `wggr` guard was right and the reader
   was wrong; the fix is never to pick one.

### The gate defect, which is the part worth carrying forward

`schema:viz:check` went red on CI while passing locally. The entire difference
in 895 KB was two integers: main added 36 lines to `cat-harness.ts` and shifted
two declarations.

**A line number is an editor coordinate, not a property of a declaration.** A
red meaning "somebody added a blank line" teaches contributors to regenerate
reflexively rather than to read the finding. `line` is dropped from the
projection and kept on the reader. Generalised in the skill as:

> If a red can be caused by a change that alters nothing the artefact
> describes, the artefact is carrying something it should not.

### Still open, and not guessed at

- **Schemas into `library/`, both directions** (the owner picked 1 AND 3).
  Blocked on `slw1`: `library/<slug>/` has a shape built for a SCANNED source
  and a schema has no pages, so what `sections/`, `structure.json` and the
  OCR three-state mean for a schema entry is `slw1`'s to answer, not this
  bean's to invent.
- `assistant-schema.puml` — 266 lines of hand-authored UML, still referenced
  by nothing. Left in place: `deletion-requires-confirmation`. It would make a
  good validation target for the generated diagram, which is a cheaper use for
  it than deletion.

## Done when — the revision, now PROMOTED above

*Kept so the wording it replaced stays readable. The canonical section carries
these same verdicts, so the two agree rather than contradict.*

- [x] The option is chosen by the owner and recorded here (C + D-as-a-view + widen A)
- [x] `schemas/` has a visualiser at a declared, instance-keyed path, built from the authoritative `.ts`
- [x] A `--check` gate fails on a stale rendering — falsified both directions
- [x] The schema-management skill exists
- [ ] The ingestion skill — deferred to `slw1` with the reason above
- [ ] `assistant-schema.puml` is retired or made the validation target — owner's call


---

## THE `.puml` IS A WORKING CONTROL — measured 2026-09-20, and it found a blind spot

This bean proposed `schemas/assistant-schema.puml` as a validation target
rather than a deletion. **It was used as one, and it earned its keep in a
single run — in both directions.**

### Direction 1: it found what the reader structurally cannot see

Every relation the hand-drawn diagram draws, checked against the generated
edges:

| relation | reproduced |
|---|---|
| composition (`*--`) — a nested schema | **14 of 15** |
| association (`-->`) — a foreign key by string id | **0 of 9** |

A clean split, and it names the limit exactly. `RoleAssignmentSchema` declares
`actorId: z.string()` — a plain string, holding **no syntactic link** to
`ActorDefinitionSchema`. Nothing syntactic can recover that edge, and neither
can JSON Schema nor the type checker: **the information is not in the types at
all.**

All 21 types the diagram names are present in the generated graph, so this is
not a coverage gap. It is one class of relation, invisible for a stateable
reason.

**What was done about it.** The viewer now says so — permanently in the header,
and again on any type carrying id-style fields:

> A reference carried as a string id is not drawn — it is invisible to a
> syntactic reader, not absent from the model.

That matters because a diagram that omitted a whole class of relation
*silently* would be exactly the "rendered as nothing" failure this repository
works against. An undrawn association is **invisible, not absent**, and the two
are different answers.

Drawing them would need the id field to **declare what it points at**. That is
a modelling change, not a reader change, and it belongs to `data-modelling`.

### Direction 2: the reader found the diagram wrong

The one composition it did not reproduce is
`SkillDefinition *-- SkillSchemaRef : schemas` — and `SkillDefinitionSchema`
has **no `schemas` field at all**. Verified directly in the source.

That corroborates bean `3lbz` from a completely different angle: `3lbz` found
`SkillDefinition.schemas` had no readers and its only referencing code was
`scripts/generate-docs.ts`, which nothing invokes. The hand-drawn diagram
records a relation the code does not have.

### So the recommendation is now evidenced rather than proposed

**Keep it.** A hand-drawn model is a cheap control for a generated one, and one
run of it found a blind spot in the reader *and* a stale relation in itself.
Deleting it would have destroyed the only independent statement of this
model that exists.

It is still referenced by no script and still not gated — turning this
comparison into a repeatable check is worth doing, and is NOT done here
because a gate over a hand-maintained artefact needs the owner to decide
whether the artefact is maintained. Recorded, not assumed.

## Also, twice-paid: no backticks in a viewer

Both viewers are a whole HTML document inside one TypeScript template literal.
A backtick anywhere inside it — **including in a JavaScript comment** —
terminates the string, and the parse error surfaces a couple of hundred lines
from the mistake. It happened twice in one session: once in a comment reading
*"the intake's own files[]"*, once in one quoting a field declaration.

Both generators now carry an explicit `NO BACKTICKS BELOW THIS LINE` marker at
the top of the template, and `viz-generators.test.ts` imports both modules so a
stray one reddens the suite rather than only the next person's generator run.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #581 (km90: beans reach the rendering pipeline — one reader, a visualiser per state graph at its own URL).

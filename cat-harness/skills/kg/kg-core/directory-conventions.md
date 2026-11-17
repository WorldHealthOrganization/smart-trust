---
consulted: true
---

# Directory conventions — what a layer declares it scans

Every layer carries a **declaration** at its repository root — a `*.json` whose `name` field equals its own filename stem, found with `findDeclarationFile` and never composed from a path. It declares the directories the layer scans for content,
and what **kind of graph** each one holds.

Schema and resolution: `schemas/kg/cat-harness.ts`.

**It is the *harness's* schema, not folio-assistant's.** `agentic-harness` is
the layer that defines Roles, Skills, Tools and these conventions, and every
other layer inherits from it — so a layer need not be a folio-assistant
to carry one. A Tool repo or a Test repo carries the same declaration.

## Why directories rather than a content type

The obvious reading of "an instance holds zero or more content instances" is a
list of instances under one `contentType`. That shape does not survive a
multi-repository split:

**The things `agentic-harness` holds are not folios.** They are Tool
definitions, a knowledge graph of skills and workflows, and a schema graph.
None renders as a document and none has a `contentType` in the
`document | paper` sense. A model that gives every layer a content type
forces the harness to claim one it does not have.

So the general object is **a layer with directories, each holding a
graph**. `folio` is one graph typology among several.

## Node Kinds are declared: `nodeSchemas`

A layer lists every `$schema` value its files carry, and the published
schema that defines it, in its declaration's **`nodeSchemas`** — a path
relative to the declaration, or an IRI for a published standard. It is
bootstrap's field (`KnowledgeGraphDeclarationSchema` in `graph.ts`), so a
reader with nothing installed can go from a file's `$schema` to its Node
Schema without knowing any harness. The graph-typology registry's `nodeSchemas`
is a different, harness-side table: it maps a tag to a TypeScript `validator`
or `shape`, which only a harness can run. `graph.test.ts` fails on a bootstrap
file whose `$schema` is not declared, and on a declared local schema that does
not fix that very tag.

## The graph typologies

The vocabulary is **open**, and split across two layers.

**A kind answers two questions, and only one of them is here.** `renderable`
— does this become a website — is below. The other is what a running process
does with the graph: produces it, reads it, or writes it, and
[`content-context-and-state-graphs`](content-context-and-state-graphs.md) owns
it. **Read it before adding a kind** — `holds` is required, so a kind that has
not decided does not compile.

> ### An old kind spelling still reads
>
> The `cat-harness` kind was once spelled `kg`. Renaming a kind is a
> CROSS-INSTANCE breaking change: a downstream layer declaring
> `graphs: ["kg"]` would resolve nothing **silently** — scanning, finding
> nothing, reporting a clean run. So `GRAPH_TYPOLOGY_ALIASES` in
> `schemas/kg/cat-harness.ts` maps `kg` → `cat-harness`, resolved once at the
> registry boundary and nowhere else. `resolveGraphTypology` reports WHICH
> spelling was used, so a caller can warn — an alias that resolves silently is
> an alias nobody ever removes.
>
> **A directory `id` survives a rename of anything else.** An id is the
> layer's own handle. A Subgraph id is its name inside its Harness, and the
> Harness name qualifies it (`cat-harness.skills`). `RENAMED_DIRECTORY_IDS`
> reads an old id as the new one, so an older declaration still overrides the
> entry it meant.
>
> **The JSON-LD projection canonicalises.** `toJsonLd` emits the type IRI, not
> the spelling, so reading a projection back yields `cat-harness` whatever was
> written.
>
> `kg:audit`, `kg-export`, `kg-qa` sidecars and the `kg` QA family keep their
> names: those are command and file-format names, not the graph typology, and
> renaming them would touch hundreds of references for no change in what a
> declaration means.

**The layer is not a column here.** `holds` is the FIELD on
`GraphTypologyDef` that carries the content/context/state layer; the live
answer is `graphTypologiesOfLayer()` in
[`content-context-and-state-graphs`](content-context-and-state-graphs.md), and a
hand-maintained copy would drift from the registry.

**The table of every kind is a published page, not this skill.** Each row is a
kind's `description`, and the rows span every layer in the checkout. The
table is built at publish, by `bun run cat kind:table`, at
`<base>/cat-harness/kind-table/` (`docs/cat-harness/kind-table.md`, declared in
cat-harness's `builtAtPublish`), because a table kept in this skill goes stale
at every re-pin that brings a layer's new kind. To change a row, edit the
kind.

> ### `test/` is the one test tree
>
> This layer declares `qa` at **`test/results/`** and `health` at
> **`test/health/results/`**, and everything a test runner reads is under
> `test/`: the Playwright `*.e2e.ts` specs, their `support/` fixtures, and the
> health sweep's own `*.test.ts`.
>
> **When two trees compete, move the cheap side.** An id in a declaration is
> the expensive thing to move; a path reached by one line of one config file is
> cheap. Change a directory's `path` and keep its **`id`**, so an inheriting
> layer's override still matches: `resolveDirectories` matches on id, never
> on path. Move a declared directory in a change of its own: relocating one as
> a side effect of adding a graph typology is how a directory quietly goes
> missing.
>
> **Verify a move like this positively, never on a green test run.** A consumer
> that now scans nothing reports clean, which looks identical to success.
> Constants that compose a path from segments (`join("tests", "health",
> "results")`) are invisible to a grep for the moved path. Ask each tool to
> name its subjects: `bun run cat harness:dirs:check`, `bun run cat
> health:list`, and Playwright's spec count.

> **A rendered translation is not its own graph typology — the FILE declares its
> language.** `docs/fr/index.md` carries `lang: fr` and
> `translation_source: index.md` in its own front matter, so it is the same
> kind of thing as the page it translates: renderable content, differing by a
> field. `pipeline/translation-index.ts` discovers the locale subtrees
> by reading those fields and **never** matches a directory name against a
> list of language subtags — that inference is wrong in both directions,
> silently hiding a `no/` chapter (Norwegian, or the English word) and
> silently showing a `pt-BR/` or `translated-fr/` one.
>
> Translatability is a property of a **format within a content type**, which
> the owning layer declares under `contentTranslations` (collected by
> `schemas/library/translation-tools.ts`) and `isTranslatable` answers — not a
> property of a directory. A kind per locale subtree would restate what every
> file already says and grow as O(locales x subtrees).
>
> `.po` catalogues are the genuine exception, and that is what
> `translation-sources` is for: they are not content in any language, so no
> file inside them can declare one.

> **`uploads` and `library` are two kinds, not one, and the split is
> load-bearing.** They are the two stages of the document-ingestion pipeline,
> and the corpus-grep checklist searches `library/` **only** — so a source
> still sitting in `uploads/` does not merely go unread, it makes a clean grep
> read as *"nobody has done this"* while the file is on disk. An un-ingested
> source is worse than an absent one, because it produces false confidence
> rather than a gap. One `sources` kind covering both would erase exactly the
> distinction the pair exists to state.
>
> **They are also the reason `materialiseDirectories` exists.** Declare only
> what exists: absent and empty are indistinguishable to a consumer, so
> declaring a directory without creating it converts a real gap into a false
> pass. `bun run cat harness:dirs` creates every directory a layer declares
> or inherits; the session-start sweep and `init-folio` both call it, so a
> declaration is never left without the directory it names.

> **`todos` is not a second work plan, and the distinction is the one
> `AGENTS.md` already draws.** `beans/` is the AGENT work plan and no second
> store may be stood up beside it. `todos/` is the other thing that document
> carves out — *"the content-review feedback workflow … a separate domain
> feature, not the agent work-plan"* — and it is **content**: a todo records
> that a **person** has something outstanding, and it is owned and authored by
> the folio.
>
> **A todo carries the four coordinates of the role model**, because they are
> already declared and inventing a fifth vocabulary for them would be the drift
> this file exists to prevent. `AGENTS.md`: *an actor performs a task in a
> process as a role.* A todo is that sentence left unfinished, so it is tagged
> by `roles`, `processes`, `tasks` and `identities` (`schemas/sdlc/todo.ts`).
>
> Two things about those tags are load-bearing rather than incidental:
>
> - **A task reference carries its process.** A BPMN activity id is unique only
>   *within* its process, so a task tag is the pair `{ process, task }` and never
>   a bare string. Same lesson as the subprocess interpreter: a step id without
>   its phase is not an address.
> - **An identity is provider-qualified, and its link to an actor is optional.**
>   `litlfred` is not an identity; `github:litlfred` is. The link to a declared
>   actor is absent whenever the person is not in `scenarios/actors/` — and
>   somebody who comments on a pull request is a real person with a real
>   outstanding item whether or not the registry has heard of them. Absent means
>   **not linked**, a third state; never anonymous, and never defaulted.
>
> `resolveTodoTags` reports each tag as `resolved`, `dangling` or
> **`not-checked`**, and the third is the one that matters: a checkout with no
> `skills/` must report every role tag as unchecked, never as dangling. A wall
> of false findings is how a check gets switched off.
>
> **`todos/` is not a machine-queue directory.** Bulk machine-generated JSON
> (audit output) goes under `build/`, and
> `scripts/tests/audit-output-paths.test.ts` pins that none lands in `todos/`.
> That guard forbids machine output there; it does not forbid the declared
> content graph described here.

> **`bean-defs` and `workflow-state` are two nodes of one `beans` graph.** WHAT
> IS BEING WORKED ON carries judgement and is edited by hand; WHERE A RUNNING
> PROCESS GOT TO is a token the interpreter owns. A consumer asking for the work
> plan must not be handed BPMN instance state.

**Why the work plan is the harness's and not core's.** The test is whether the
harness *has* one, and it does: a layer has work whether or not it has
content, and `agentic-harness` carries a `beans/` store for its own. A Tool repo
and a Test repo have work plans too. That is a different test from the one that
sent `folio` to core, which is about capability — only core can render.

**One `beans` kind, with the distinction carried by its nodes.** `beans/` is a
graph with named nodes, declared by `beans/beans.json` (schema:
`schemas/sdlc/bean-graph.ts`): `defs` holds the work plan, `workflows` holds
running-instance state. Two sibling directory entries for a parent and its
child would misrepresent a containment relation and tell the two apart only by
file extension. So the harness says which directories exist and what kind of
graph each holds, and the work item graph says what its own nodes are. **One fact,
one place, at each level** — and a consumer asks for a node by name instead of
inferring it from a file extension.

> **Nesting is not inheritance.** A consumer scanning a declared directory must
> not assume it owns everything beneath it — check whether a deeper path is
> declared, here or in a graph's own node list.
## An unavoidable duplicate is fine; an unchecked one is not

The declaration is meant to be the single statement of the layout, and mostly it
is — fields that restated it elsewhere were removed rather than kept in sync.

Two copies survive because neither can be removed, and **both are checked**:

- a **third-party tool's own config**, which will never read this schema;
- a **constant on a hot path**, where re-reading a JSON file to learn one's own
  directory would cost more than the duplication saves.

The rule is not "never duplicate". It is: **an unavoidable duplicate is fine; an
unchecked one is not.** In this layer `bun run cat check:harness-dirs` is what
makes the difference.

### The dot-prefix guard tests every segment, not just the first

A node path resolving under a dot-prefixed directory is **rejected**, and the
guard checks **every segment** of the resolved path. A node declared `.defs`
under a visible root resolves to a hidden directory and is exactly as invisible
as the stores this convention exists to surface — so checking only the head
would have made the guard unfireable.

**Why invisibility is worth a guard at all:** a dot-prefixed directory is absent
from a plain `ls`, from most file browsers, and from a forge's web tree, which
hides the artefacts a person looks for first.

## The conventional layout

```
cat-harness/              <content-core>/
  cat-harness.json          <content-core>.json
  tools/     → tools        folio/     → folio
  skills/    → skills       (inherits tools/, skills/, schemas/, …)
  schemas/   → schemas
```

`cat-harness` declares `tools/`, `skills/` and `schemas/` among its
directories. The content core declares **only** `folio/` and inherits the
rest.

### Where a NEW layer puts its code: `<stub>/src`

**A new layer puts its source under `<stub>/src/` and declares it as
`code`.** One directory, one declaration. (Stated here as well as in the `code`
kind, because somebody starting a layer reads the layout, not the kind
table.)

**The existing layers are the exception.** `schemas/` is already a declared
graph of its own kind, and adding `code` to it would give one directory two
kinds; `pipeline/` is core's subject, not the harness's; and `scripts/` hold
entry points named **by path** from `package.json` and the CI workflows, which
`check:ci-invocations` and `check:command-paths` guard, so moving them is a
large invocation surface for nothing the declaration does not already buy.
They are declared **where they are**. `<stub>/src` binds what has no history yet.

**Being declared is not being reached.** Those are two questions and
`bun run cat check:code-accounting` reports them apart — never averaged,
because a rise in one can hide a fall in the other.

### A sub-sub-graph — one RESERVED name inside a declared directory

A vendor-specific override of a voice goes in a nested family, `voices/vendors/`,
not a sibling graph `voices-vendors/`: a second declared graph for one concept
is a declaration inside a declaration. So:

> **A family within a graph is a RESERVED SUBDIRECTORY NAME inside the one
> declared directory — never a second declaration, and never a rule about
> arbitrary nesting.**

Three properties, each load-bearing:

1. **One declaration.** Every consumer that already asks for the graph gets the
   family with no change, and there is one answer to "where does this live".
2. **One level, under a name the reader states.** *"Any directory, any depth"*
   is a rule nobody can check, and it would silently make an unrelated nested
   directory — a `notes/`, a scratch draft — part of the graph.
3. **The directory is where a PERSON looks; the file is still the contract.**
   A vendor voice declares what it overrides in its own `extends` field
   (`extends`, not `overrides` — the obvious name is the wrong one),
   exactly as one sitting flat would. Nothing downstream may infer a relation
   from a path — the same rule as everywhere else here: extension and location
   are coincidences, a declaration inside the file is the contract.

**Adding the name to the convention is not enough; the READER has to descend.**
`vendors/` holds no `voice.json` of its own — its children do — so a reader
that scans one level would skip every override in silence and report a clean
read over real content. `voices-viz.test.ts` asserts both directions: a voice
under `vendors/` loads, a voice under any other nested directory does not.

`VOICE_VENDORS_DIR` in `schemas/content/voices.ts` is the one spelling of the name.

## Assets sit at `<stub>/<asset>` — no declaration reaches down (ENFORCED)

**A declared directory never sits inside another declared directory.** An
layer's assets hang directly off its stub — `cat-harness/skills/`,
the IRIS replica's `library/`, the DAK layer's `methodologies/` — and a package inside one of
those is a package, not a second graph.

Read this with §"Nesting is declared FROM WITHIN" below, which governs:
nesting is permitted when **described by a node in the first subdirectory**.
What is forbidden either way — and what `check:layout-norms` measures — is a
ROOT DECLARATION enumerating a path it cannot verify. When a from-within node
describes a nesting, `check:layout-norms` must not report it.

**Depth is not the test, and reaching for it produces false findings.** A
library two segments from the repository root is
right, and `test/results/` is right because `test/` is not a graph. What is
wrong is *containment*: a declared directory inside another declared
directory, which forces a consumer scanning the outer one to decide whether
the inner one's nodes are also its own.

### The part that is easy to get wrong

When you relocate a buried asset, **remove its declaration rather than
repointing it.** A package subdirectory of an already-declared graph needs no
entry of its own, and adding one declares the same directory twice — the same
defect, one level down from where it was.

Repointing a buried package's entry while keeping it makes discovery find the
one directory twice (for skills, `gen-skill-docs` then demands a category under
both the basename and the declaration id).

### How it is enforced

`bun run cat check:layout-norms`, a **ratchet** rather than a corpus-wide gate. The
nestings that exist today are baselined in
`scripts/layout-norms-baseline.json`; **a pair not in the baseline fails.**
A layer with no baseline entry cannot regress, while the layers with
outstanding work do not turn CI red.

Removing a nesting prints as `FIXED` and never fails: a guard must not punish
the fix it exists to encourage. `--update` shrinks the baseline, so the diff a
reviewer sees is the progress. **Ask the baseline for the list, never this
page.**

## Inheritance

A layer inherits its dependencies' directories, walked depth-first through
`dependencies.folioAssistant` — the same order `schemas/kg/harness-config.ts` uses
for skills and translations. Deepest dependency first, root last, so the root
wins.

**Overrides match on the directory's `id`, never on its `path`.** A layer
that wants a graph somewhere else redeclares its id with a different path:

```jsonc
{ "id": "kg", "path": "graph/knowledge/", "graphs": ["kg"] }
```

Matching on path instead would make two knowledge graphs out of one
relocation, and every consumer would scan a directory that is not there. An
override also **keeps the inherited position** in the scan order rather than
moving to the end — a relocation should not reshuffle what is scanned first.

### A subgraph is declared ONCE; every layer that has it is a MEMBER

If a layer depends on one where `docs/` is a declared subgraph and has a
`docs/` of its own, the viewer detects it: that layer is a named member of
the `docs` graph, with no per-entry field to set.

So inheritance is **automatic**. `resolveDirectories` returns, for every
instance-scoped entry, one **member** per layer in the chain whose
`<root>/<path>` exists — `ResolvedDirectory.member` names it. The declarer's
member comes first, so a consumer looking a subgraph up by id is handed the
same directory as before; the rest follow in chain order. Existence-filtered
(declare only what exists); a `repository`-scoped entry has one location by
definition and gets no members.

**Whether an inherited directory is CREATED is a fact about its graph typology**,
`GraphTypologyDef.perInstance`, stated once in the registry rather than per entry:

- **`perInstance: true`** — part of the SHAPE a folio has: `uploads`,
  `library`, `docs`, `qa`, `beans`, `todos`, `voices`, `folio`, `glossary`,
  `translation-sources`, `external-schema`. `materialiseDirectories` creates
  the dependent's own, empty, with a keep marker.
- **absent** — merely where a layer's content lives: `schemas`, `tools`,
  `code`, `processes`, `methodology`. A dependent that HAS one is a member of
  the subgraph; one that does not gets nothing created.

Creation is a property of the kind, stated once, because a per-entry field
disagrees with itself across entries. **A layer always materialises what
it declared itself**, whatever its kind. A legacy `dependents` key still parses and is dropped. A nested entry
that is a subgraph of the LAYER (`skills.json`'s `voices`, as opposed to
`beans.json`'s `defs`, which is part of its parent's graph) says so with
`"subgraph": true`.

### The checkout aggregates — no layer declares another's directory (STRICT)

A platform that named its dependents' directories (so a corpus-wide tool could
ask it for "every library") would be naming its users, and those entries drift
from the owners' own ids.

The rule now:

- **The checkout's root layer aggregates.** `folio-assistant.json` `needs`
  every layer the checkout stages, and declares the checkout-level state
  it physically holds (`beans`, `todos`, `memory`, `interaction`,
  `issue-marks`, `fsh-guts`, `root-docs`).
- **Only that layer declares at the checkout's scope.** A
  `scope: "repository"` entry anywhere else is a MIRROR, and
  `check:instance-graph` refuses it (`repository-mirror`), as it refuses an
  layer the root does not reach (`unstaged`).
- **A corpus-wide question is asked of the checkout, not the platform.**
  `checkoutDirectories` / `checkoutDirectoriesForGraph` in
  `schemas/kg/harness-config.ts` resolve every staged layer through its OWN
  chain and union the members — per layer, because one long chain would
  override sibling ids (the DAK layer's `processes` would replace the
  harness's). A tool shipped BY a layer asks
  `corpusDirectoriesForGraph(instance, kind)`: that layer plus everything
  stacked on it, never its own dependencies (those are its overlay).
  Known-skills callers say which question they ask: `CorpusScope`
  (`"instance"` | `"checkout"`), and `corpusScopeFor(root)` gives the rule —
  the platform's own run is corpus-wide, `--instance <x>` is that layer
  alone.
- **Falsifier, kept as a test:** the platform resolved ALONE sees nothing
  above it. A split checkout running against one folio sees that folio and
  its dependencies — what it contains, not what the platform remembers having
  been next to.

## Nesting is declared FROM WITHIN, by a node in the first subdirectory (STRICT)

Nesting is allowed only one way: a (Sub)KGraph node within the first
subdirectory labels the other subdirectories within it, and that structure is
inherited.
**A declaration never reaches down a path.** A layer declares a directory;
that directory's own contents are described by **a node inside its first
subdirectory**, which names the sibling subdirectories present there. Depth is
carried one level at a time, by the level that can see itself.

What this forbids, and it is the shape everything currently reaches for:

```jsonc
// WRONG — the root declaration enumerating a path it cannot verify
{ "id": "docs", "path": "cat-harness/content/docs/", "graphs": ["folio"] }
```

The root cannot tell you what is under `docs/`; it can only assert it. A node
that lives there can be wrong in a way somebody notices, because it sits beside
the thing it describes.

**And the structure is INHERITED.** A dependent layer gets the nesting the
same way it gets the directory — through the overlay, resolved by id, in scan
order. It does not re-describe a dependency's interior, and it does not have to:
the describing node came with the directory.

### A from-within entry can be a LAYER directory

A kind's `declarationFile` names the node. What an entry in it IS depends on
one field: **an entry marked `"subgraph": true` is a layer directory**, and
`resolveDirectories` lists it exactly as if `<instance>.json` had declared it.
It carries `within` (the id of the directory that declared it), and
`check:layout-norms` treats that pair as the sanctioned shape. An entry without
the marker (`beans.json`'s `defs`, `docs.json`'s `proposals`, `voices.json`'s
`vendors`) is a part of one graph and stays out of the layer list.

`skills/skills.json` is the worked case. It is one node with two lists:
`topics` (subdirectories that hold skill packages) and `directories` (layer
directories inside `skills/`, such as `voices/`, and `lean/` in the science
layer).

Three rules the resolver holds:

- **Never through a mirror.** A `scope: "repository"` entry points at ANOTHER
  layer's directory; following its declaration file would resolve that
  layer's subgraph as one's own. The guard stays for a downstream folio
  that still carries a mirror.
- **A declaration beats a default.** `skills/voices` is also a built-in
  default; a from-within declaration replaces that convention, while an
  instance-level declaration with the same id still wins over both.
- **A MEMBER's own declaration file is read, not only the declarer's.** A
  member's from-within entries are members of the chain too, named
  `member: "<instance>"`, `within: "<subgraph id>"`.

### Concern groups — a sub-subgraph in every grouping kind

Eight groups — `sdlc`, `process`, `tools`, `kg`, `library`, `content`, `ui`,
`conduct` — are built into location, split across schemas, skills, uml,
processes, library and tests. The same from-within rule, one more use of it:

- **Which kinds group** is a fact about the kind: `GraphTypologyDef.concernGroups`,
  with the kind's `declarationFile` as where groups are named —
  `skills/skills.json` (`topics`), `processes/processes.json`,
  `schemas/schemas.json`, `library/corpus/library.json`, `uml/uml.json`, a test
  directory's `code.json` (`groups`, `"$schema": "concern-groups/v1"`).
- **A group is a CODE** of `code-lists/concern-group.json`, which carries its
  title and definition once; its directory is the code (`sdlc/processes/`).
  A ninth code is a ruling, not an edit.
- **Declared once, inherited as members** — option A one level down. The
  harness declares a group; each higher layer's same-named
  `<dir>/<group>/` is a member (core's `skills/library/` of the harness's
  `library`). A higher layer adds no group of its own; content-type work
  goes in as PACKAGES under `content/`.
- **Declare only what exists.** A group is declared in the PR that first
  fills it; a declared-but-absent group throws.
- **One walker:** `scripts/concern-groups.ts` (`groupedChildrenIn`,
  `resolveGroups`); `packageDirsIn` delegates to it. `check:concern-groups`
  holds the four rules and prints each group with its members.

### Applied: `docs/source/`

The documentation source lives at `docs/source/`, inside the docs graph it
renders, and is declared FROM WITHIN by the docs graph's own node,
`docs/docs.json` (entry `docs-source`, carrying the existing `docs` kind).
Readers ask `docsSourceDirFor(root)` rather than spelling the path. Adding it
to the root declaration instead would be a root declaration reaching down.

A directory that holds live content and is **declared nowhere** is the worse
twin of declared-but-absent: present-but-undeclared, with a clean run over
content that is really there.

### What is ruled, and what is open

Do not settle an open naming question in the corpus to proceed
([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md),
[`surprise-to-corpus`](surprise-to-corpus.md)).

| | |
|---|---|
| **ruled** | nesting is described from within, by a node in the first subdirectory, naming the others present there; and that structure is inherited |
| **ruled** | a root declaration reaching down a multi-level path is not allowed |
| **open** | the node's kind and name in general — `SubKGraph`, a reused kind, or something else. One case is ruled: `docs/docs.json`'s `docs-source` reuses the `docs` kind |
| **open** | whether existing multi-level declarations are grandfathered or must migrate |

## Making a field REQUIRED is a change other branches pay for

A required field with no default is right when its wrong value is invisible
either way, but the **cost lands on other branches**: entries added on `main`
while the field is in review do not carry it, and on the merged tree every
`readDeclaration` throws. So when you add a required field to a declaration
several sessions are editing at once:

1. **Write the error before the field.** `readDeclaration` names the offending
   entries and gives the valid values with a one-line test for choosing
   between them — not a raw Zod dump.
2. **Expect to pay it more than once**, and land quickly. Every day the branch
   sits open, another entry arrives without the field.
3. **A conflict-free merge is not a passing merge.** Git has nothing to
   reconcile when main adds entries and a branch adds a field, and the result
   can still be unparseable. Verify the merged tree, never the merge.

## Where a subgraph gets its content — `source`

A subgraph declares where it gets its content: mounting a directory, mounting a
branch, and later perhaps a graph database. The harness layer config can
override it. A "directory subgraph" and a "branch subgraph" are **one thing
with two sources**, so there is one field and one resolver, never a branch
concept beside a directory concept. Schema `schemas/kg/subgraph-source.ts`.

- **`source`** on a `directories[]` entry is a discriminated union on `kind`.
  `{ "kind": "directory" }` — the default, so absent means it — says the
  content IS the checkout at `path`. `{ "kind": "branch", "branch":
  "cat/cat-harness/todos", "keyedBy": "tip" }` says the content lives on a
  declared repository branch and `path` is where a mount of it lands. A later
  kind (a graph database) is a new member of the union: additive, and a
  compile error at every consumer that has not decided what to do with it.
- **The branch NAME is declared once**, on the directory entry that owns it:
  its `storage` (or `source`). There is no central table. A script that
  resolves a family's branch reads the folio's declaration first and keeps its
  built-in names only as a fallback (`cache-family-fallbacks.test.ts` keeps
  those in step). A branch no declaration names is a finding
  (`subgraph-source.test.ts`), never a guess at what to fetch.
- **The layer config overrides it, by id.** `"subgraphSources":
  { "<dir-id>": <source> }` inline on the instance's `index.config.json`
  entry ([`index-config`](index-config.md); a legacy `<instance>.config.json`
  is still read).
  `subgraphSources` moves a declared directory's content. Bringing in a whole
  layer from another repository is the entry's `source.remote`, which is a
  different field. The declaration says what the
  subgraph IS; the config says how THIS instantiation is set up, and where
  content is mounted from is that kind of fact. Matched on `id`, never `path`
  — §"Inheritance". The checkout root's config has the last word.
- **One resolver, and every consumer asks it**: `declaredSubgraph(start, id)`
  in `schemas/kg/harness-config.ts`, through `resolveSubgraphSource`. Precedence:
  config override → `source` → a legacy `storage` → `directory`. The answer
  carries `declaredIn`, so an override is never silent. Never read `source`
  off the declaration yourself — that skips the override.
- **`storage` maps exactly**: `storage: { branch,
  keyedBy }` is `source: { kind: "branch", branch, keyedBy }`. The resolver
  reads either and refuses an entry carrying both — two answers to one
  question. A `qa` subgraph keyed by `tip` is refused whichever field says it.
  `storage` is the LEGACY spelling: write `source` in a new entry. The
  presence checks (`materialiseDirectories`, `check:declared-dirs`,
  `audit:coverage`) ask `contentIsOffCheckout`, which honours both.
- **Mounting dispatches on the kind**, and the process is
  `processes/kg/mount-subgraph.bpmn`: `directory` is the checkout path in place
  (a write is a commit); `branch` + `tip` is mounted from the tip and spliced
  back without force (`branch-store mount`/`push`); `remote` is another
  repository's tree at a full 40-character pin, laid down and locked by
  `mount:remote` and never written back (the [`remote-mount`](remote-mount.md)
  skill); a kind with no flow is refused with its own exit code
  rather than read as an empty directory. A remote mount's effective path must
  not collide with downstream declared directories, reserved root/route names
  (`RESERVED_ROOT_AND_ROUTE_NAMES`), or sibling mounts
  (`checkMountPathCollisions`).
- **The KG export publishes the resolved source** on the Subgraph node, as
  `contentSource` — `dcterms:source`, with `kind` (`dcterms:type`), `branch`
  (`dcterms:identifier`), `keyedBy` and `declaredIn` scoped inside it. A
  GitHub-hosted branch gets an `@id` that is its tree URL.

**Which layer a kind is in does not follow from its source.** `todos` is
`state` on `main` and still `state` on `cat/cat-harness/todos`; a `context`
graph could be mounted from a branch and stays read-only. See
[`content-context-and-state-graphs`](content-context-and-state-graphs.md).

### Where a NEW layer's state lives — on its own branch, by default

**This subsection owns the rule.** The scaffold skills
([`getting-started`](../../conduct/conduct-core/getting-started.md), `folio_init`)
point here and do not restate it. A scaffold that writes `beans/` and `todos/`
on `main` without declaring them leaves nothing able to say where its work
plan lives, so the scaffold asks the `source` resolver.

- **The default is a property of the KIND, read once at scaffold time.** A
  graph typology may carry `newInstanceSource: { kind: "branch", keyedBy:
  "tip" }`, beside `perInstance`. `beans`, `todos` and `fsh-guts` carry it
  (`fsh-guts` so a new layer's first cutover has somewhere to deposit —
  see the main half below). It is a storage fact and says nothing about
  `holds`: `fsh-guts` stays `context`. It has no `branch`, because a kind has
  no branch name to give. `folio_init` composes the name and writes a
  **complete** `source` into the new layer's own `<instance>.json`. After
  that the declaration is the one answer. The resolver never reads
  `newInstanceSource`, so it is not a second place answering where the content
  lives. It also cannot move an existing layer whose entry declares no
  source.
- **The branch name is `cat/<instance>/<directory-id>`**, built by
  `instanceStateBranch` in `schemas/kg/subgraph-source.ts`. For example, the
  `dpi-h-ra` layer's branches are `cat/dpi-h-ra/beans` and
  `cat/dpi-h-ra/todos` (the `cat/<harness>/<name>` convention applied to a
  folio). One name does three jobs:
  - it names the declaration (`<instance>.json`);
  - it prefixes the work item ids (`.beans.yml` → `<instance>-`);
  - it names the state branches.

  The last segment is the directory **id**, the key that `branch-store
  mount --id` and `state:seed --id` use.
- **`folio_init` resolves each state graph through the one resolver** (after
  writing the declaration and config, so a `subgraphSources` override is
  honoured), and acts on the resolved source:

  | resolved | what `folio_init` does |
  |---|---|
  | `branch` | Declares the graph. Does **not** write it into the checkout. Adds `/<path>/**` to `.gitignore` so a mount is never committed. Prints the seed command. |
  | `directory` | Writes the graph **and** declares it. |

- **Seeding is printed, not performed.** No platform command creates a new
  state branch:
  - `branch-store` refuses to ("seeding … is a steward act");
  - `state:seed` only refreshes an existing seed.

  So `folio_init` prints a self-contained shell block. Run it once from the
  new repository. It pushes an orphan tip branch holding:
  - a `state-manifest/v1` manifest marked `authoritative: true`, because a
    new layer has no `main` copy;
  - a README;
  - the graph's starting files. For `beans`, those are `beans/beans.json`
    and `beans/defs/`, and the seed must carry them: `beans:claim` reads
    `beans.json` from the branch and refuses to guess where `defs` is.

  Then `state:mount` puts each branch at its declared path.
- **Cutting an EXISTING layer over is two halves, and both have a command.**
  Run both from the layer's own repository. Every default is the cwd's git
  toplevel, and `--repo-root <dir>` overrides it.

  1. **The branch half:** `state:seed --id <id> --authoritative`. The branch
     becomes the store.
  2. **The main half:** `state:seed --id <id> --cutover`. It is a dry run
     that reports files and bytes and the deposit it would make. Add
     `--commit` to deposit, then stage `git rm -r <path>` and a
     `/<path>/**` ignore line as **one** commit naming the branch, the tree
     id and the deposit. It never pushes `main`. It refuses unless all of
     these hold:
     - the manifest says `authoritative: true`;
     - the manifest says `keyedBy: "tip"`, or the mount would be `corrupt`;
     - a declaration keeps the path on that branch;
     - nothing under the path is uncommitted;
     - `HEAD:<path>` and the branch's `<path>` are the same tree id, so the
       two copies are byte-identical;
     - the directory's **own** layer declares a `fsh-guts` graph kept at a
       branch tip, and the deposit into it lands and re-reads verified.

  **What a cutover removes goes to `fsh-guts` first — the one rule for it.**
  Before any
  `git rm`, `--commit` packs `<path>/` at `HEAD` with `git archive`, checks
  the pack extracts to **the same tree id** it is about to remove, and
  splices the existing `retired/` pair onto the trashcan's tip through
  `branch-store` (never a force push, `expect: null` so it never
  overwrites): `retired/cutover-<instance>-<dir>-<tree12>.tar.gz` plus a
  same-basename `.md` declaring `folio-fsh-guts/v1`, `kind:
  cutover-snapshot`, `movedFrom`, `movedOn`, `reason: cutover`, the
  layer, `sourceCommit`, `tree` and `authoritativeBranch`. It re-reads
  the tip, and only if both blobs are there does it make the removal
  commit. No trashcan declared, a trashcan not on a tip, a branch that is
  not there, or a push that did not land: **refused, `main` untouched**,
  with the fix named. This is not a second disposal of work items — the branch
  is still the live store; the deposit is the copy `main` last held.
  `deletion-requires-confirmation` still governs: the dry run is the
  report, and `--commit` is only run on the owner's explicit go.

  Then run `state:mount`.
- **A state directory nobody declared is a finding**: `undeclared-state` in
  `check:declared-dirs`. Every other check there compares declarations to
  disk. This one runs the other way, for the conventional state paths only
  (`DEFAULT_DIRECTORIES` entries whose kinds all `holds: "state"`). It
  reports and never removes anything. Whether to move the content off `main`
  is the owner's call ([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)).

## What a derived subgraph is computed FROM — `derivedFrom`

`source` and `storage` say where a directory's content is **kept**. `derivedFrom` says
what it is **computed from**: the declared directory ids of the graphs whose change can
invalidate it.

```jsonc
{ "id": "smart-trust-docs", "path": "docs/", "graphTypologies": ["docs"],
  "derivedFrom": ["smart-trust-artifact-index"] }
```

Three rules:

1. **The edge sits on the DERIVED side.** The writer of a derived graph is what knows its
   inputs, so the edge points down the stack: an IG's pages name its artefact index, and
   the index never lists the pages. A source-side edge would make upstream graphs name
   graphs above them.
2. **Generated pages and ingested indexes are in the `derived` layer**, as `library/` is,
   so a QA finding against them goes to their generator.
3. **An edge across a missing `needs` path is a RATCHET, not an error.** Example: an IG's
   pages are styled by the DAK layer's chrome, but the IG does not `need` the DAK layer. The
   gate holds such an edge as a baselined layering gap with a reason. The dependency
   stays declared and the gap stays visible.

**Data graphs only.** A generator is code. The staging cone reaches it through its
import closure, so code is not declared a second time here.

**Rendering order** is a topological order over `derivedFrom`. Until the gate computes
it, the order in which directories are declared is the rendering order, and a consumer
declared before its source is flagged.

**Absent means "not declared", not "derived from nothing".** A directory in the `derived`
layer either names its sources or says why not: a `library/` is derived from an
*external* publication, which is not a declared graph. Silence is not an answer. The
gate is `check:derived-from`.

### The storage clock — a derived artefact is kept no closer to main than its inputs (STRICT)

**A derived artefact can be current in a commit only if every input it is
computed from is kept in the commit.** Follow `derivedFrom` upstream; if any
input is kept on a BRANCH (a `source` that is not a directory, or a
`storage`), that input moves without a commit, and a committed copy of the
artefact is stale on main and on every open PR the moment somebody writes
there. No `:check` gate can hold it current, because the check and the input
are on different clocks.

**A visualisation is a derived artefact of the directory it shows.** The
edge is implicit: a viewer of X is computed from X by definition. So the rule
covers viewer pages as well as derived directories (caches, auto-docs, IG
pages).

| inputs, transitively | where the artefact is kept | what holds it current |
|---|---|---|
| all in the checkout | committed | its `:check` gate, at every commit |
| any on a branch | **built at publish, never committed** — gitignored | `derive:publish`, which runs its declared `writer` after `state:mount` |

What is declared:

- the visualisation (or derived directory) names its `writer` — the script
  `derive:publish` runs. A visualisation built at publish with no writer is
  refused (`publish-without-writer`): nothing would build it;
- nothing else. Which artefacts are built at publish is DERIVED from the edges
  and the inputs' storage, never listed — not in a workflow, not here. The
  next graph moved onto a branch (work items, todos) carries its viewers with it
  by declaring their writers.

What is checked, by `check:derived-from`:

- a **tracked** artefact with a branch-kept input is refused
  (`committed-from-branch`), naming the chain to the input;
- `--list` on `derive:publish` prints what will be built and why.

What the readers do: a visualisation built at publish **resolves by its
writer**, not by the disk (`visualisationResolves` in `schemas/kg/cat-harness.ts`).
Subgraph coverage, harness tiles and viewer declarations all ask that one
function, so the generated `docs/_data/harness.json` is the same whether or not a checkout
happens to hold a locally built copy. Asking the disk would emit one answer
locally and another in CI.

**The failure it prevents.** A viewer committed on main while its input is kept
on a branch goes red on main and on every open PR at once the moment somebody
pushes to that branch, and each PR has to regenerate and commit the page. A
take-base merge pattern only makes the collision cheap; building at publish
removes it.

### Publishing a subgraph's contents — the declared Subgraph node is the container (STRICT)

A declared subgraph is a Subgraph node plus its content nodes. A generator
that publishes the contents of a declared subgraph (a `todos.jsonld`, a work items
graph, a library index) does NOT mint its own collection node for them. It:

1. uses the **declared Subgraph node's IRI** as the container `@id` —
   `<doc dir>/directory/<id>`, from `declaredSubgraphNode` in
   `kg-export.ts`, which is the same function the node itself is minted by
   — typed `Subgraph`, with `hasPart` to each member ([`kg-export`](kg-export.md)
   §"Subject IRIs — a path, not a `#fragment`"). Take the IRI from
   `declaredSubgraphNode`, never by composing it;
2. gives **every member `inSubgraph`** → that IRI (`dcterms:isPartOf`, the
   same term the KG export uses for the same edge);
3. carries the subgraph's resolved **`contentSource`**, so a branch-sourced
   subgraph names its branch;
4. **mints nothing parallel** — no `schema:Collection`, no `<Kind>Graph`.

The helpers are `subgraphContainer` and `memberOf` in `scripts/subgraph-node.ts`,
and `subgraphPublicationFindings` is the check: `subgraph-node.test.ts` runs it
over every adopting publisher. **Converting a publisher adds its row there.**
The declaring layer's document must be published for the `@id` to
dereference. Which documents are published, and where:
[`instance-publication`](instance-publication.md) §"What each layer
publishes".

Do not restate the subgraph's `name` on a container written to
`<dir>/<id>.json`. A file whose `name` equals its stem is what
`findDeclarationFile` reads as a LAYER declaration, and the site directory
becomes a layer root that hides the checkout from every resolver.

### A consumer never spells a declared directory's path (ENFORCED)

Because a subgraph's source can move — from a directory to a branch, and then
somewhere else, overridable per layer — a literal `"fsh-guts/…"` or
`join(root, "beans", "defs")` breaks on the move, or goes vacuous and reads
nothing. So read the location through its resolver (`directoryForGraph`,
`fshGutsDirectory`, `beanDefsDir`, `declaredSubgraph`, …). Two ratchets
enforce this, and neither fails just because a count goes down:

| gate | what it scans | baseline |
|---|---|---|
| `check:declared-paths` | a layer's literals into its OWN declared directories | `cat-harness-tools/scripts/declared-path-baseline.json` |
| `check:foreign-paths` | a layer's literals into ANOTHER layer's directories, across the whole checkout | `cat-harness-tools/scripts/foreign-path-baseline.json` — **empty** |

- **Classify a hit by what it READS, not by how it is spelled.** A name counts
  as foreign only if the scanning layer does not declare the same name. A
  `docs/` joined onto a STAGED layer's root, or matched inside that
  layer's own declaration, belongs to that layer even though the name
  coincides.
- **A site that cannot read a declaration says why**, on the line above:
  `// declared-path-literal: <reason>`. The reason is required. A marked site
  is still reported, just not counted. Legitimate cases: the convention
  fallback for a layer that declares nothing, an ignore file, and a path
  inside another layer's declaration.
- **A file that exists today is not a stable path.** The move is the expected
  case, so literals naming an existing file are a one-way baseline: a NEW
  literal naming an existing file fails the gate, and `--update` may drop a
  witness but refuses to add one, so the list only shrinks. Accepting a
  literal because its file exists would fire only once the file moves.
- **The known blind spot:** only the first literal of a path call is read, so
  `resolve(opt("todos") ?? "todos")` hides its default. Review such a default
  by hand.

## Three states, as everywhere else here

- **No declaration** → `readDeclaration` returns `undefined`. An
  layer not yet migrated is ordinary, and callers fall back to today's
  conventions. Not an error.
- **Present but unreadable** → **throws.** A declaration nobody can parse
  leaves every consumer scanning the wrong directories, which is strictly worse
  than not having one.
- **An unknown graph typology** → rejected, not accepted and ignored.

## Declare what exists

A directory that is declared but absent is worse than one that is missing:
every consumer scans nothing and reports a clean run over it.

This repository's own declaration is the worked example, and **no count is
given here on purpose**: `<name>.json` is the list; a number in prose is a
claim nothing checks. **Ids are stable across a relocation, paths are not**,
and it declares nothing it does not have.

## `storage` — a directory kept on a branch

A `ContentDirectory` may declare where its contents are KEPT when that is not
the checkout (schema `DirectoryStorageSchema` in `schemas/kg/cat-harness.ts`, or
its modern `source: { kind: "branch", ... }` spelling in
`schemas/kg/subgraph-source.ts`):

```jsonc
// Derived / QA: commit-keyed
{ "id": "qa", "path": "test/results", "graphTypologies": ["qa"],
  "storage": { "branch": "qa-reports", "keyedBy": "commit" } }

// State / work-plan: tip-keyed
{ "id": "beans", "path": "beans/", "graphTypologies": ["beans"],
  "storage": { "branch": "cat/cat-harness/beans", "keyedBy": "tip" } }
```

**A graph on another ref is still a declared directory, mounted at the declared path.**
Declaring `storage` or a branch `source` does not make it a separate concept
from a directory. The layer still accesses the graph at its declared path
(`beans/`, `todos/`, `test/results/`), whether via a working mount (e.g. worktree
mounted by `state:mount` at session start) or an in-memory branch store.

- **`keyedBy: "commit"` (derived/QA)**: Writers write the declared working copy
  path, and `bun run cat qa:publish` carries it to the branch under
  `main/<sha>/` or `pr/<n>/<sha>/`. Readers go through `qa-store` (`readQa`,
  `bun run cat qa:fetch`), which answers hit / miss / corrupt / unknown.
- **`keyedBy: "tip"` (state graphs: work items, workflow instances, todos)**:
  Represents a single living tree where the branch tip IS the state. Writers
  write to the mounted path and push via `BranchStore` (`branch-store.ts push`
  or `bun run cat state:push`), which splices changes onto the remote tip and
  pushes without force (`-f`), retrying if the tip moved. Claims and updates are
  immediately visible globally.
- **Presence checks stop expecting unmounted files on `main`**: a stored directory
  absent from the checkout tree on `main` is not "declared but absent", and
  `harness:dirs` does not create it empty. `audit:coverage` reads its kind as
  `stored` via `contentIsOffCheckout`.

**Every `qa` directory declares `storage`.** Each stored working copy is
ignored by version control, one line per declared directory, kept equal to the
declarations by `directory-storage.test.ts`. A directory whose every kind may
leave `main` (`qa`, `health` — `mayLeaveMain` in `scripts/qa-results.ts`) may
be absent from a checkout without that being a finding. **Judgements never
move**: they are the `attestations` kind at `test/attestations/`, on `main`,
because a regenerated file cannot reproduce them.

Flip a directory to `storage` only after every reader has migrated; flipping
it earlier tells the presence checks to stop looking while readers still read
the checkout.

### A branch's README is rendered, not written

Every special branch says what it is at its root, and a reader cannot recover
three of those facts from its files: its **status** (the store, a seed, or
retired), its **provenance** (the commit it was seeded from, and when) and how
it is **written**. A branch without them cannot be told from an abandoned one.

They are KG already, in two places, and the README is rendered from both by
`bun run cat branch:readme` (cat-harness-tools):

- the **declarations** — every `directories[]` entry whose `storage` or branch
  `source` names the branch, read where each layer declares it. Never a
  central table of branches: each harness (and each layer) declares its
  own;
- the branch's root **`manifest.json`**, `state-manifest/v1`, whose field set
  is `schemas/kg/state-manifest.ts`: one shape for a tip-keyed branch (seed
  commit, `graphs`) and one for a route-keyed branch (`writer`, `gate`).

`branch:readme:check` reports each declared branch `current`, `stale`
(absent, hand-written, or behind its sources) or `unknown` (the branch or its
manifest could not be read, or the manifest does not parse); `--push <branch>`
replaces the README with a describing write, the one write that may touch it.
The commit-keyed QA branch carries no manifest and is described as derived
from its declarations alone. A **family** (`branchPrefix`) has one README per
member, rendered from the family's declaration and the member's manifest, and
a branch a declared **Tool** publishes (`gh-pages`) is that Tool's to describe.

## Authoring an entry — the checklist

The rules are argued elsewhere in this skill and its neighbours; this is the
list to run down when you add or edit a `directories[]` entry, with where each
one is argued.

1. **`id`, `path`, `graphTypologies`** — required. Refer to the entry by `id`
   everywhere else; **ids are stable, paths are not** (§"Declare what exists",
   §"Inheritance"). Pick each kind by what a process does with it
   ([`content-context-and-state-graphs`](content-context-and-state-graphs.md)).
2. **`title`** — a short noun phrase a reader would put on a tab. It is the
   directory README's heading; absent, the heading falls back to the id and
   `subgraph-readmes` records a `no-title` finding.
3. **`description`** — one or two sentences **for a reader**: what the
   directory holds and what it is for, **60 words at most**
   (`DESCRIPTION_WORDS`, finding `long-description`). It is printed under the
   README heading. History, rulings, measurements and argument go in a
   `_description_comment` on the same entry (the `_<field>_comment` convention
   the entries already use) — `_` keys are annotations every loader drops
   (§"Node schemas, one per `$schema` family").
4. **Declare only what exists**, or say why not with `absent: { reason }`.
   **Where its content comes from** is `source` — omit it for the checkout
   directory; a branch source names its branch on the entry itself
   (§"Where a subgraph gets its content").
5. **`coverage`** — the `skill` that governs it and the `docs` that say what it
   is for; an opt-out carries its reason (`SubgraphCoverageSchema`). Without a
   skill the directory is unreachable by an agent even where a person can read
   it. **The visualiser is NOT declared here**: the harness declares it, at its
   own level, in `visualisers` — `covers` this directory's id (or
   `coversKinds` its kind), `renderedBy` a Tool — and it is published at
   `<base>/<harness>/<visualiser>/[<sub-graph>/]`, computed by
   `visualiserRoute` (`harness-tiles` §"Where a tile goes").
   A directory never names its page, and a page never claims a directory; two
   declarations on one route fail `check:visualiser-routes`. The visualiser is
   where a node's RENDERING IRIs are derived from; the node never names them —
   `kg-viewer` §"The asset and its rendering are two resources with two IRIs".
6. **The files inside declare what they are** — front matter, a `$schema`, a
   leading comment — never an extension or a location
   (§"A sub-sub-graph", §"Every other marker"). The README's "what it is"
   column reads exactly that, so a file that says nothing shows as a gap.
7. **Generated or authored — say which, in the file.** A generated file
   carries the markers of the region it owns
   ([`readme-sections`](../../ui/ui-core/readme-sections.md)) or a header naming the command
   that wrote it, is never hand-edited, and has a `--check` twin in CI.
8. **A missing fact is a QA finding, never a blank or a guess** — the three
   states of §"Three states, as everywhere else here". Record it as a QA
   result under `test/results/` (the working copy `qa-publish` stores on the
   `qa-reports` branch); do not fill it with a plausible default.
9. **Then regenerate**: `bun run cat readme:subgraphs` renders the directory's
   README from this entry ([`liquid-templates`](../../ui/ui-core/liquid-templates.md)), and
   `bun run cat kg:export` publishes the entry as a Directory node
   ([`kg-export`](kg-export.md)).

## Naming — a self-identifying declaration, stub-named artefacts (STRICT)

The declaration carries three publication fields beside `name`:

| field | meaning |
|---|---|
| `stub` | filename stem of every artefact this layer publishes. Defaults to `name`. |
| `canonicalUrl` | where those artefacts live — the base every `@id`/`$id` is minted against |
| `previewUrl` | where CI previews are served, when that differs |

Modelled on WHO's SMART Base repository's `dak.json` (ours is the `dak`
section of `index.config.json`'s `contentTypes`), which carries `canonicalUrl`,
`publicationUrl` and `previewUrl` and derives its stub by stripping the
repository's prefix (`smart-<stub>` → `<stub>` → `https://smart.who.int/<stub>`),
so stub, directory and published path are one word.

**The rule, and it is enforced by test:**

- **Every published artefact is named `<stub>.*`** — `<stub>.jsonld`,
  `<stub>.schema.json`. Never a generic `kg.json`. Compute it with
  `artefactStub()`, never by re-deriving it, so two exporters cannot disagree
  about what this layer is called.
- **The declaration file is `<name>.json` — named for the layer's `name`,
  NOT its stub.** It is the one file here not computed with `artefactStub()`:
  `instanceDeclarationFilename()` spells it, and `instanceConfigFilename()`
  spells the `<name>.config.json` beside it. `artefactStub()` is
  `stub ?? name`, so the two coincide for every layer declaring no
  `stub`. **A coincidence in the data is not the rule**: a layer declaring
  a differing `stub` publishes `<stub>.jsonld` beside a `<name>.json`, and
  composing either from the other resolves to nothing.
- **The renderable site lives at `docs/<stub>/`.** Compute it with
  `siteDir(d)` or `siteDirFor(root)`, never by writing the path out.

Where each `<stub>.jsonld` is served, which base its `@id`s are minted
against, and what is stripped from it are not naming rules:
[`instance-publication`](instance-publication.md) §"What each layer
publishes — graph, address, schema, and what is stripped".

### Identity: `repository` and `livesAt`

`name` is what `needs` edges and filenames resolve against, but it is not an
identity outside the layer: it names no forge or owner, and two owners may
each publish a layer of the same name. So the declaration also says which repository the
layer **is**:

| field | meaning |
|---|---|
| `repository` | `owner/name`: the **planned** home, e.g. `litlfred/cat-harness` |
| `livesAt` | `{ repository, path }`: where it sits **today**, when not at the root of `repository` |

It is **planned** rather than current because IRIs are keyed by it and must
survive a split. Where the layer sits before the split lives in `livesAt`
(for example, a directory of a monorepo). Leaving `livesAt` out asserts that
the layer already sits at its own repository's root.

**Never keep an `owner/repo` table by hand.**
`instanceRepositories(checkoutRoot, folioRoot?)` in
`schemas/kg/instance-repositories.ts` derives the `owner/repo ↔ name ↔ root`
map. It reads the declarations in the checkout and in the folio's dependency
overlay, and it throws when two layers claim one repository.
`instance-repositories.test.ts` is the gate. It checks three things:
- every layer declares `repository`;
- every `livesAt.path` is where the layer actually sits;
- every `livesAt` names one host.

**A reference to another layer names its `repository`, never its
`name`.** The `instance` field of a voice rule's source, a voice's
`sources[]`, a `RoleRef`, a `ThemeRef` and an `AssetSource` is typed
`RepoFullName`, so a bare name does not parse. Every resolver matches the
reference through `declaresInstance`, which accepts either form, because
`needs` edges and internal callers still speak in names.
`instance-repositories.test.ts` checks that every committed reference
resolves.

**The `owner/repo → IRI` map is derived too.** `repositoryNamespaces()` gives
each repository's vocabulary namespace. One rule, `instanceNamespace`,
produces it, and the glossary uses the same rule:
- a layer that declares `iriBase` mints under its own release's major,
  `<iriBase>v<major>/ns#`;
- one that declares none mints under the platform site, `<stem><stub>/ns#`.

`code-lists/own-namespaces.json` still lists these namespaces, because code
reads them by code. The gate fails when the list spells one differently from
what the declaration derives. So moving a layer's IRIs is one edit, to
its declaration's `iriBase`, and the list follows.

`cat-harness` and the content core declare an `iriBase` on their planned
repositories' hosts, versioned as bootstrap's is:
- `https://litlfred.github.io/cat-harness/v0/ns/`
- `https://litlfred.github.io/folio-assistant-core/v0/ns/`

Their namespace documents are published beside the site, as bootstrap's are.

### Every other marker: THE TYPE DECLARES ITS OWN FILENAME (STRICT)

The rule above covers the root declaration and published artefacts. For every
**other** marker — the files by which a repository asserts what it is — there
is no uniform spelling and there cannot be one:

| marker | who owns the name |
|---|---|
| `sushi-config.yaml` | SUSHI reads that exact name, and it is YAML |
| `index.config.json` `contentTypes.dak` | **ours**. It is a SECTION, not a file: the content type declares `{ indexSection: "dak" }` (`IndexSectionMarker`). WHO's SMART Base still writes and reads `dak.json`; an IG's build reads that file into the index for one build, with a warning, until the IG moves it |
| `index.config.json` `contentTypes.ig` | **The FHIR layer's**. A repository declares itself the source of a FHIR IG with this section, registered as `{ indexSection: "ig" }` by https://github.com/litlfred/fhir-harness/blob/main/schemas/ig-content-type.ts. Carrying `sushi-config.yaml` alone does not declare an IG. The section's `include` lists the paths the harness reads. See "A marker declares what is read", below |
| `<name>.json`, `<name>.config.json` | ours |
| `beans.json`, `todos.json` | ours, and named after the graph TYPOLOGY |

One of those is not ours to rename — `sushi-config.yaml`, whose name SUSHI
owns — so any rule claiming to cover the set would be false. **So the type
declares its filename, and the convention is that rule rather than a
spelling.** What a new type copies is *say what your marker is called*, not a
pattern to imitate. `<slug>.config.json` everywhere would rename what WHO
owns.

**The declaration file identifies itself.** `findDeclarationFile` admits a
`*.json` only when its `name` field EQUALS its own filename stem, and
`findInstanceRoot` calls it rather than testing a word agreed in advance. So
`beans/beans.json`, which shares the `{name, directories}` shape but declares
`"name": "folio-assistant"` against the stem `beans`, is not a layer root
— refused by what the file says it is, not by a path exception. Discovery
still works, because a consumer matches on the file agreeing with itself.

**At the graph-typology level this is `GraphTypologyDef.declarationFile`.** A
nested declaration's filename is named by its kind, not computed as
`${basename(path)}.json`: a relocation (`beans/` to `work/`) must not make the
walk look for `work/work.json` while the file is still `work/beans.json`.
`BEAN_GRAPH_FILE` and `TODO_GRAPH_FILE` derive from the kind, and the
directory-name convention remains only as a fallback for a kind that declares
none.

#### A marker declares what is read, and nothing else is

A harness can point to a repository without taking in all of its content: the
harness declares what it pays attention to.

A content-type section is the harness's explicit statement of which parts of
the repository it reads. It is not a flag that brings in the whole repository.
`contentTypes.ig` is the first section to carry such a statement: its
`include` is a list of repository-relative POSIX paths, where an entry ending
in `/` covers a directory. The rules:

- The FHIR layer's `assertIgDeclares` refuses any path that is not on the list.
- A section with no `include`, or an empty one, declares nothing. It is never
  read as "everything".
- The list bounds this harness only. SUSHI and the IG Publisher still read
  their own inputs.
- A repository that declares no `contentTypes.ig` is a legacy IG: the FHIR
  layer reads it whole, as before, and warns once per repository per run that the
  section is missing. The warning is the prompt to declare it, not noise to
  silence.
- Every IG reader in the FHIR layer asks its `scripts/ig-read-scope.ts` before
  it reads a path. To make one see a path it skips, add the path to `include`;
  that layer's `ig-build-pipeline` skill, §"What this layer reads", says how:
  https://github.com/litlfred/fhir-harness/blob/main/skills/fhir-ig-base/ig-build-pipeline.md

A new section-shaped type should follow the same pattern: declare the paths
it reads beside the marker, and read nothing else.

### `docs/<stub>/` — the site is packaged for the split (STRICT)

The stub that names `<stub>.jsonld` also names the directory holding this
layer's renderable site: `docs/<stub>/`, not `docs/`. Each layer is its own
repository, so under its own stub a split is a directory move rather than a
file-by-file sift, and two layers can be checked out side by side.

**No published URL changes**, because Jekyll is pointed at the stub directory
as its **source root** (`source: ./docs/<stub>`), leaving the site's internal
layout untouched.

**It is not the `folio` graph-typology declaration.** Declaring `docs/` with
the `folio` kind in the harness makes readers that do not load core's
registration throw `unknown graph typology "folio"`, because `folio` is
contributed by **core**.

**`siteDirFor` throws rather than defaulting** when a layer declares
neither `stub` nor `name` — a guessed site root writes the whole site where
nothing serves it, and "could not determine" is not an answer.

**`scripts/tests/site-dir-single-answer.test.ts` fails on any new `docs/…`
literal in a path-resolving position** (prose is left alone), including in a
clean merge from a branch cut before a move.

## The declaration is itself a graph

`toJsonLd()` projects a declaration into the folio namespace: each directory is
a node with an `@id` and an `@type`. The set of directories a layer scans
is then queryable by the same machinery as anything else in the knowledge
graph, rather than being configuration only one module understands.

The authored form is the stored one and the graph form is derived — one truth,
not two. `readDeclaration` accepts **either**, and a round-trip test pins that:
the projection emits `@type` *instead of* `graph`, so reading the published
form back without the reverse lookup silently loses the one field that says
what a directory holds.

## Skills are KG content

The `skills` graph is where skills live, and that is why they are addressed
through the declaration rather than by path. An agent asks `skill_list` /
`skill_fetch` for a skill; it does not open `skills/<something>.md` from
memory. A layer may site its skills anywhere — this repo's `skills` id
points at `skills/` — and a downstream layer inherits its dependencies'
skills through the same inheritance rules above. A hardcoded path breaks on
the first relocation, which is the whole reason overrides match on `id`.

### Roles, processes and decisions are KG content too

The knowledge graph is not only skills. It holds the whole
actor → role → skill → task model:

```
scenarios/roles.json            the ROLE GRAPH — a role is a BPMN swimlane
skills/                         ← this instance's `skills` graph
  requirements/*.json           conformance obligations pointing at the rest
  permissions/permissions.json  the actions an actor may be permitted (the ODRL profile; who holds them is policies/)
  <group>/<pkg>/*.md            skills
  <group>/<pkg>/package-manifest.json   which skills a package publishes
```

and the processes those roles act in — `processes/**/*.bpmn` and
`processes/**/decisions/*.dmn` — are reached **through the skill that
describes them**, not as standalone artefacts. A BPMN activity names the skill
that implements it (`<bootstrap.processes:skill ref>`); a lane names the role its tasks are performed in
(`partitionElementRef` → a `<bpmn:resource>` whose id is the role id); a role carries
the skills its lane's activities need. `bun run cat kg:audit` checks every one of
those joins and writes a sidecar per node. Model and resolution rules:
[`role-model.md`](../../process/process-core/role-model.md); schema: `schemas/process/role-graph.ts`.

## Layering — a harness module must not import the content vocabulary

The declaration schema needs the platform's IRI namespace to mint `@type`
values. It lives in `schemas/kg/namespaces.ts`, a leaf that imports nothing,
classified to the harness — not in `schemas/kg/jsonld.ts`, which is the content
core's **content** vocabulary (block kinds, DoCO structural types, SPAR
citation terms), because importing that would make the harness depend on the
content model for its own type IRIs: a `harness → core` edge. The direction only works one way round — **core may import
the harness; the harness may not import core** — so a constant both layers
need lives at or below the harness.

Do not duplicate the constant with a test asserting the copies stay equal: **a
drift guard is an admission that there are two definitions.** Extract instead,
and re-export from the old home so existing importers are untouched.

`cat-harness.test.ts` pins the property structurally — it asserts the module
does not import `./jsonld` or `./block-kinds`. Reach for that test when adding
anything else at the harness layer.

## What lives in the `schemas` graph — one authored form, many renderings

The `schemas` directory holds schema definitions, and the convention for every
one of them is the same: **the Zod schema in `.ts` is authoritative, and every
other form is generated from it.**

```
schemas/<thing>.ts  (tools layer)     ← AUTHORED.  Zod + the inferred type.
  ├─→ schemas/kinds/<kind>.schema.json    JSON Schema  (validators, editors)
  └─→ a JSON-LD projection                KG node      (queryable)
```

The TypeScript type is `z.infer<typeof Schema>`, never declared alongside the
schema — two declarations of one shape drift, and the drift is invisible until
something reads the stale one.

Both renderings have their mechanism, so adding a schema introduces no new
machinery: `bun run cat kind:json-schemas` generates the JSON Schemas through
Zod 4's native `z.toJSONSchema` ([`schemas/README.md`](../../../schemas/README.md)),
and `toJsonLd()` in `schemas/kg/cat-harness.ts` is the worked example of the
graph projection.

### Why Zod — the grounds, and what kind of ground each is

The choice is a JUDGEMENT on what the tool does — functionality and
pragmatism, not a preference for `.ts` — and stating its grounds is what lets
a later reader tell whether they still hold. **Three are functional and
checkable:**

1. **It produces both renderings the graph needs** — JSON Schema natively and
   the JSON-LD projection from the same definition — so there is one source.
2. **Validation is easy**, at author time (`tsc`, the editor) and at run time
   (`.parse`), with the TypeScript type inferred rather than restated.
3. **A large, active community** — a maintained library, so a converter change
   is a version bump, not a rewrite.

**One is a HOUSE RULE, and is labelled as one.** In trials, agents
hallucinated less authoring schemas in `.ts` than in the alternatives tried.
A guess is that `.ts` is easier to digest, or costs fewer tokens. That is an
observation, **not a measurement**, and it must not be quoted as
evidence that `.ts` is better. It is a tie-breaker between options that pass
the three functional grounds, never a reason on its own.

**What would reopen the decision:** another carrier that meets all three
functional grounds and measurably beats this one on something that matters
here. "`.ts` is what we use" is not a ground, and nor is the house rule by
itself. Keep the two kinds of ground apart when you argue it either way —
running a preference and a measurement together is how a judgement comes to
look like a fact.

**Generate as many renderings as have a consumer, and no more.** JSON Schema
because validators and editors speak it; JSON-LD because the KG query path
does. A third — SHACL, an OpenAPI fragment, Turtle — is added when something
needs it, not in anticipation: each is another file to regenerate and another
chance for a stale artefact to be read as current.

**A rendering is never where a fix lands.** If a generated `.schema.json` is
wrong, the `.ts` is wrong; edit that and regenerate. A `--check` mode in CI —
the pattern `gen-skill-docs.ts --check` already uses — is what makes that
enforceable rather than merely asserted.

### Why not author the rendering and validate backwards

The tempting inversion is to hand-author the JSON-LD node, because it is the
form the KG consumes, and validate it against Zod in CI. That is the same two
artefacts with the authority pointing the wrong way, and it is worse for one
reason: **a hand-authored node is unchecked until CI runs.** With Zod
authoritative the schema *is* the type, so a malformed definition fails at
`tsc`, in the editor, before it is committed. Validation-after-the-fact catches
the same error strictly later and only if CI runs the suite.

This holds for the Tools schema and for everything else in the `schemas`
graph. Worked through in `docs/concepts/architecture/cat-harness-minimum.md`
§"Carrying it".

## Adding a graph typology

Decide which layer owns it first — **if it renders, it is not the harness's.**

- A harness kind: one entry in `BASE_GRAPH_TYPOLOGIES` (`schemas/kg/cat-harness.ts`).
- A kind belonging to a layer above: a module like
  `schemas/kg/folio-graph-typology.ts` that calls `registry.register(name, def)` at
  import, so the harness never learns the name until that layer is loaded.

Either way the definition is `@type` IRI + `renderable` + `holds` + summary,
and the JSON-LD projection and the reverse lookup both derive from it. A kind
added without deciding **either** axis will not compile.

`holds` is the content/context/state one, and
[`content-context-and-state-graphs`](content-context-and-state-graphs.md) is
where you answer it — including the bar for adding a value at all, why there is
no "could not determine", and why it is compared by `sameKind` so two layers
cannot register one name on different layers and have the first silently win.

Note the declaration's `graphs` field is validated **against the registry at
read time**, not by a closed Zod enum. An enum would be built at module load —
before core has registered `folio` — so it would reject the one kind the entire
rendering pipeline depends on.

### Node schemas, one per `$schema` family

A kind says what shape its nodes have in up to three fields on `GraphTypologyDef`,
and they answer different questions:

| field | answers | form |
|---|---|---|
| `schema` | where is the shape written down? | a module path, or an external-schema record |
| `validator` | what can I RUN against a node? | one Zod `module#Export` |
| `nodeSchemas` | which shape does THIS node have? | `$schema` tag → `{ validator }` \| `{ shape }` \| `{ writtenBy }` |

`nodeSchemas` exists because one directory can hold several families, and a
single `validator` then names one of them and says nothing true about the rest.
`qa` holds seven. A node already says which family it is (its `$schema` tag), so
the tag is the key. The three reference forms record three different facts:

- **`validator`**: a Zod schema. Runnable.
- **`shape`**: a TypeScript interface, `module#Name`. Its fields can be read from
  source (`readShape` in `schemas/kg/kind-validator.ts`), but nothing can check a
  node against it.
- **`writtenBy`**: nothing types the family. Name the module that writes it
  (or, for an authored file, the one that consumes it), so the gap is recorded
  as data rather than left out.
- **`external`**: the node conforms to a specification nobody here types, such
  as a JSON Schema document (`https://json-schema.org/draft/2020-12/schema`).
  This is named rather than restated, and it is not a gap.

**A reference may name the harness that owns the module**:
`folio-assistant-core:schemas/catalogue.ts#CatalogueSchema`. It resolves through
the layer that declares that name, never through `../`. An escaping path is
still refused, because it resolves into whatever checkout sits next door. This
is how a harness kind whose node shapes live in core (`catalogue`, `uploads`,
`external-schema`) says so honestly.

**Top-level `_` keys are annotations** (`_comment`, `_note`). The sweep drops
them before parsing, as every loader here already does.

**The kinds without a node schema, and why** — recorded so they are not
re-opened:

- `code`: its nodes are TypeScript source, so the language is the schema.
- `methodology`: its nodes are Markdown prose.
- `folio`: core's renderable kind. Its block manifests are typed by the
  content adapters, not by the registry.
- `bean-defs`: Markdown in the third-party `beans` CLI's layout. That CLI's own
  GraphQL `type Bean` is drawn in `uml/harness-object-model.puml`.
- `cat-harness`: on a directory beside another kind it is the umbrella, not a
  node kind.

**Declaring `nodeSchemas` claims the map is COMPLETE.** `check:kind-validators`
routes every JSON node in the kind's declared directories by its tag. It fails
on a tag the map does not name, on a reference that does not resolve, and on a
node that fails its family's Zod schema. `kg:validate` routes the same way.
`gen-uml-overview.ts` draws one class per family.

## Pinning a reference — a SHA may stage, only a version may publish

Downstream must align to FHIR and SUSHI — a **hard constraint**. A SHA is for
staging; a published reference is a semver. A preview is staging, not
published.

**Two tiers, and the tier is decided by whether a consumer may DEPEND on the
artefact — not by whether they can reach it.** That is why an externally
reachable PR preview is staging: it is provisional, and nothing should pin to
it.

| tier | a reference may be |
|---|---|
| **staging** — working checkout, PR preview, branch under review | a submodule SHA, a git `ref`, a pre-release, or a version |
| **published** — anything an external consumer may depend on | **semver only** |

**A SHA is an excellent pin and a useless published reference.** It names a
commit in a repository the downstream consumer may not have and may not be
able to fetch — and in FHIR's vocabulary cannot be stated at all:
`dependsOn` carries `packageId` and `version`, and there is no field a SHA
belongs in. A published artefact carrying one is not a stricter pin, it is an
unresolvable one.

**Exact versions, never ranges.** This is the FHIR rule, not the npm one, and
it follows directly from the alignment constraint: a downstream that must
resolve like SUSHI cannot be handed a range.

**No ref at all is the same defect, reached by default.** An unpinned
reference is `current` by omission — the pre-release choice made by nobody.
`current` and `dev` are FHIR's real pseudo-versions and belong in the staging
tier with a SHA, deliberately chosen and written down.

### A REFERENCE is not PROVENANCE

The distinction is what makes this checkable, and both look identical in a
published document — a hex string.

| | what it is | example |
|---|---|---|
| **reference** | a consumer must RESOLVE it to obtain another artefact | a dependency's `ref`/`version`, an asset's `source` |
| **provenance** | a record of where THIS artefact came from | the build stamp's `sha`, `sourceCommitSha` |

A stamp saying "produced from commit `abc123`" asks nobody to fetch
`abc123`. **So classification is by KEY, declared in `PROVENANCE_KEYS`, never
by the look of the value** — a regex over the published JSON fails on the
build stamp, which is the exported graph's only 40-hex string.

`bun run cat check:published-refs` enforces this; advisory, `--strict` to fail.
It reports each carrier's count **even when that count is nought**, because a
gate that silently covers nothing and exits 0 is the most expensive recurring
defect.

Full scheme, including what a layer's version means and what makes it go
up: `docs/proposals/instance-versioning.md` (opt-in `cat-harness.proposals`).

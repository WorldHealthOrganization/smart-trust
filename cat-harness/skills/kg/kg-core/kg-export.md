---
name: kg-export
description: >
  Serialize a layer's knowledge graph to one JSON document, for
  publication and inspection. Read when asked to visualize, audit or share the
  KG, before adding a node type to the export, and before minting or
  authoring any subject IRI — subjects are `<doc dir>/<kind>/<id>`,
  never `#fragments`.
---

# KG export — publishing the graph as linked data, not as a page

**The export is data, not a page.** One JSON document describes the graph;
drawing it is somebody else's job — a static viewer, an external tool, or
nothing at all. The export makes the harness *inspectable*.

Per [`skills-and-tools`](../../tools/folio-core/skills-and-tools.md):

| | |
|---|---|
| **this skill** | produce the serialization — generic, no host named |
| **the Tool** | publish it somewhere — today `pages-publish` (GitHub Pages) |

A GitLab Pages or object-store Tool would satisfy the same skill. Nothing in
this skill names a host.

## It is JSON-LD, and the `@type: @id` coercion is the whole point

Modelled on WHO's SMART Base repository's
`input/scripts/generate_jsonld_vocabularies.py`. Five rules carry the weight;
the first is cheap to lose and invisible when you do:

**1. Every edge term is declared `{"@type": "@id"}`.** Without that coercion,
`requires`, `performedBy` and `partOf` are **string literals** to any
JSON-LD processor, and the document is a list of records that merely *looks*
linked to a human reading the JSON. The coercion is the difference between a
list of records and a traversable graph, and a test asserts it.

**2. The document's `@id` is the URL it is served from**, with
`@type: prov:Entity` and a `generatedAt` typed `xsd:dateTime`. Fetch the `@id`,
get the document. WHO SMART Base's type-usage note is explicit about this and it is
what makes the graph mergeable with anyone else's.

**3. A subject's IRI is a path under its layer, never a `#fragment` of
the document** — `<doc dir>/<kind>/<id>`, each served as its own file. This is the rule for every
IRI an agent mints or authors; the reasons and the exceptions are in
§"Subject IRIs — a path, not a `#fragment`" below.

**4. No `@vocab`, and `id`/`type` are aliased.** Every term carries its full
namespace IRI, so an undeclared key stays undeclared instead of silently
minting an IRI nobody chose. The aliases keep the published JSON readable as
ordinary records for someone who does not know JSON-LD.

**5. Every property name in `@graph` is declared in `@context`, and the export
FAILS if one is not.** A name that is neither declared nor an absolute IRI is
not a property: a processor drops it, although it stays visible when the file
is read as plain JSON — which is why it goes unnoticed until the document has
a consumer.

## Subject IRIs — a path, not a `#fragment`

**This section owns the rule.** Every other skill that names a subject's IRI
points here rather than restating it.

### The rule

A knowledge-graph **subject** (a skill, a process, a global task, a role, an
actor, a decision, a directory, a package, a capability, an asset) is named

    <doc dir>/<kind>/<id>

where **`<doc dir>`** is the directory the layer's own document is served
from. That is the URL-space rule:
`<baseurl>/<instantiated harness>/<path to rendered content>`.
§"Which base an `@id` is minted against" in
[`instance-publication`](instance-publication.md) says which base applies to
a layer on this site and to a layer with its own `canonicalUrl`.
It is the form Tools use, `<doc dir>/tools/<id>.jsonld`.

**The host has no special case: one rule for every layer, with subjects
beside their document.** So `<doc dir>` is
`<site>/<instance>/` for every layer this site publishes, the host
included:

| | IRI |
|---|---|
| the host's document | `https://litlfred.github.io/folio-assistant/cat-harness/cat-harness.jsonld` |
| a host subject | `https://litlfred.github.io/folio-assistant/cat-harness/skill/kg-export` |
| a host Tool | `https://litlfred.github.io/folio-assistant/cat-harness/tools/beans-cli.jsonld` |
| ❌ never | `https://litlfred.github.io/folio-assistant/cat-harness.jsonld`, `…/folio-assistant/tools/<id>.jsonld`: the host at the site root |

Do not mint, link or write anything at a root-level host path; nothing answers
there ([`instance-publication`](instance-publication.md) §"An `@id` that moved
is not forwarded").

| | IRI |
|---|---|
| ✅ right | `https://litlfred.github.io/folio-assistant/<instance>/globalTask/GT_SeedWorkPlan` |
| ❌ fragment | `https://litlfred.github.io/folio-assistant/<instance>/<instance>.jsonld#globalTask/GT_SeedWorkPlan` |
| ❌ unservable | `…/<instance>/<instance>.jsonld/globalTask/GT_SeedWorkPlan`: a static host cannot hold a file and a directory under one name |

**A process's parts.** Steps and lanes get pages; flows stay fragments of the
process page, because only their diagram cites them:

| part | IRI | |
|---|---|---|
| a step (any flow node) | `<doc dir>/process/P/node/T` | a subject: its own page and `.jsonld` |
| a lane | `<doc dir>/process/P/lane/L` | a subject: its own page and `.jsonld` |
| a sequence flow | `<doc dir>/process/P#flow/F` | a fragment of the process's page |

**A flow is the one `#` this rule allows for instance data**; the other is the
vocabulary exception below. It is allowed because nothing cites an arrow on
its own. Any other part of a subject that people cite is itself a subject and
takes a path.

### Why

- **A `#fragment` never reaches the server.** Dereferencing the subject
  fetches the whole layer graph, and the subject cannot have a page or a
  document of its own.
- **A subject is a real resource**: its own page, its own JSON-LD, its own
  history and cache, linkable on its own.
- **`#` already means "a place on this HTML page".** Using it for identity
  mixes identity with navigation.
- **Slash paths nest** (`…/process/P/node/T`); fragments do not.
- **It is the FHIR convention**: `<base>/<Type>/<id>`.

### The other exception: vocabulary terms keep `#`

`#` stays right for **vocabulary and namespace terms** (`…/ns#Term`): one
small document holds every term, and fetching it is what a consumer wants.
That covers classes, properties, graph-typology individuals, and the SKOS
glossary's concepts, which live in the layer's namespace. If a thing has instances, a page or a history of its own, it is a
subject and takes a path.

### Every `@id` still has to load

*An `@id` that looks dereferenceable and is not is worse than one that is
obviously local.* GitHub
Pages has no redirects, no 303 and no content negotiation. So a path IRI is
served by **a file of its own**: a small page at `<doc dir>/<kind>/<id>`
carrying the node as JSON-LD, plus `<id>.jsonld` beside it, as Tools are
served. Whoever mints the path also publishes the file, in the same change.

**Every rendered link to a subject uses its subject IRI**, meaning its page,
and never a fragment of the layer document. That covers the ⓘ panel and
the icons on a rendered BPMN diagram, step tables and role links.

bootstrap states the same rule for its own graph, in its own terms, in
[`bootstrap-graph-publication`](../../../../bootstrap/skills/bootstrap-graph-publication.md)
§"Each subject's own address".

### Today, and what is still a fragment

**The tools layer mints paths.** `makeIri` in `scripts/kg-export.ts` calls
`subjectIri`
(`scripts/lib/subject-iri.ts`), which mints `<doc dir>/<kind>/<id>`, and a
process flow as `<doc dir>/process/P#flow/F`. The glossary export and the
directory-container `@id` (`subgraphIri`) go through the same function.

Two things still mint fragments:

- **bootstrap's own graph.** bootstrap-tools `scripts/export-graph.ts`
  publishes it, so `subjectIri` keeps `bootstrap.jsonld#<kind>/<id>` for a link
  into that document (`FRAGMENT_DOCUMENT_STUBS`). The entry goes in the PR that
  moves that publisher to paths.
- **own-canonical layers** (the SMART IGs and others), whose subject IRIs do
  not load yet.

So:

- **mint through `subjectIri`** (or `makeIri`, which calls it), never by hand.
- **do not add a new hash-IRI minter for subjects**, and do not hand-write a
  `….jsonld#<kind>/<id>` IRI in new content.
- **remove this subsection** when bootstrap's publisher mints paths and
  own-canonical subject IRIs load.

## Declaring a term is a decision, not a line of context

Five questions, in this order. The worked call for each term is in
`buildContext()`, beside the term it justifies.

1. **Does the fact belong in the graph at all?** A denormalised copy of a link
   already present (a name beside the link that reaches it) is a second answer
   that can go stale: remove it rather than declare it, once the link resolves
   for every node. A consumer must never have to recover a fact by splitting
   an IRI.
2. **Is it a LINK or a literal?** Wrong here is worse than undeclared —
   confidently wrong rather than absent. Under `{"@type": "@id"}` the value
   must already BE an IRI: a bare `git-push` resolves against the document base
   to `<base>/git-push`, which nobody minted and nothing serves. So
   `hasCapability` mints its values with `makeIri`, and a repo-relative path
   (`instructionsPath`, `sourcePath`, `maintainsFrom`) stays a literal for the
   reverse reason.
3. **Does the referent exist in this graph?** `roleName`, `permissionName` and
   `decisionRef` stayed names: the role registry, the permission vocabulary and
   the DMN tables are not collected, so coerced IRIs would resolve to nothing.
   Each becomes a link the day its referent becomes a node.
4. **Is one name carrying two relations?** Then it is two terms: `source` was a
   `.bpmn` path on a Process and a kind marker elsewhere, so it is
   `sourcePath` and `sourceKind`. Heterogeneous SHAPE under one relation is a
   different case — `install` is a command string from a Capability and a
   dispatch object from a Tool, and stays one term typed `@json`, because
   declaring a container term alone keeps the outer key and drops every inner
   one.
5. **Does a published standard already say it?** Then the term IS the
   standard's property, and nothing is minted. `title` and
   `description` are Dublin Core's; `partOf`/`inSubgraph` are
   `dcterms:isPartOf`, `holdsGraph` is `dcterms:type`, `conformsTo` is
   `dcterms:conformsTo`; a sequence flow's `from`/`to` are BPMN's own
   `sourceRef`/`targetRef` and a node's `incoming`/`outgoing` BPMN's
   attributes of those names; a task's skill is `requires`, which is
   `dcterms:requires` (the task, the dependent node, requires the skill), and
   a lane's role (`bindsRole`) is BPMN's own `partitionElementRef`.
   bootstrap's own graph (bootstrap-tools' `export-graph.ts`)
   uses the same IRIs, so the two graphs agree.

   **How, so it cannot drift:** a term that restated a standard keeps its
   gloss in `schemas/content/vocabulary.ts` and gains `replacedBy`, a CURIE.
   `buildContext()` maps each such key through `propertyIri()`
   (`schemas/kg/namespaces.ts`), which reads that field, so the exporter cannot
   name one IRI while the vocabulary names another. The published vocabulary
   keeps the old term, `owl:deprecated` and `dcterms:isReplacedBy` the
   standard property: data already holding the old IRI still dereferences to
   a definition that says where to go. The JSON keys are unchanged, so a
   reader of plain JSON sees no difference.

   What stays minted is what no standard says: `performedBy`, `inLane`,
   `hasSkill`, `startNode`, and the rest. BPMN spells a lane's members as
   `flowNodeRef` on the LANE; `inLane` is the inverse, on the node, and no
   standard names that direction.

**No `canonicalUrl` and no `--base-url` → no absolute IRIs**, reported in
`problems[]` rather than papered over. A fabricated absolute base is the same
failure as a fabricated link.

## Every key is a declared term — in content documents too

Rule 5 above, applied to CONTENT: in every document on the published content
context, a plain key must be a declared term, or a JSON-LD processor drops it
without a word. `bun run cat check:content-keys` fails on one
(it judges documents on the content context and on a layer's own context).

It does **not** descend into a value typed `@json`. Such a value is a JSON
literal by declaration: its inner keys are data, not properties. That is the
right home for a nested structure that is ours rather than linked data, and
**the only way its nulls survive** — the three-state rule lives in them.

**A path is a literal, never an `@id`.** A document-relative path coerced to
`@id` resolves against the context's `@base`, not against the document, and so
names a location the file is not at (`../sections/x.md` becomes a well-formed
link to nowhere). So `text`, `leanSource` and `file` are literals, and
`check:content-keys` fails if a file path sits under any `@id` term.

**The upgrade rule:** a path
term becomes a link — `@type: @id` with ABSOLUTE IRIs minted by the one
function that mints block IRIs — when, and only when, the files it names are
SERVED at a URL a layer declares. Until then a link is a promise nothing
keeps, and a literal is the honest record: one reading, resolved by our tools
against the file that carries it.

## A prefix is the stub — and a prefix that is spoken must be bound

Each of our namespaces is `<canonical>/<stub>/ns#`, so the prefix bound to it
is **that same word** as the stub:

| namespace | prefix |
|---|---|
| `https://litlfred.github.io/bootstrap/v0/ns/` | `bootstrap` |
| `…/folio-assistant/cat-harness/ns#` | `cat-harness` |
| `…/folio-assistant/<content-core>/ns#` | the content core |

bootstrap's row is the exception to the `<canonical>/<stub>/` shape, and says
so: its namespace sits under bootstrap's own `iriBase` and carries the
release's MAJOR, because bootstrap is published from its own repository; the
exact
release an agent reads is its pin's. The prefix is still the
stub. The address is written once, in `cat-harness/code-lists/own-namespaces.json` (read as
`CAT_BOOTSTRAP_NS`), and `iri:sync` keeps every literal copy — this table's
included — at bootstrap's declared major.

One word in three places — path segment, stub, prefix — instead of three
words that must agree.

### Naming a namespace document — `ns`, and why

**A namespace document is published where its identifiers point**, so its file
name IS its address: `bootstrap/ns.jsonld` is what makes
`…/bootstrap/v0/ns#Node` resolve, and `check:node-iris` fails the day they
differ. Renaming the file renames every term.

Keep `ns`; do not rename it to something friendlier (`vocabulary.jsonld`,
`schemas/terms.jsonld`):

- **It is the house rule and the common practice.** This project's namespaces
  end in `/ns#`, and `<canonical>/<stub>/ns#` is what "the prefix is the stub"
  rests on. W3C publishes PROV, DCAT, ORG and SHACL under `w3.org/ns/`.
- **Renaming is not local.** Changing the pattern means renaming published
  namespaces (a MAJOR version each under `instance-versioning`) and every BPMN
  file binding the process namespaces.
- **`schemas/` would misclassify it.** Here a schema is what a Node is
  *checked against*; a vocabulary *defines words*.
- **Findability is solved without renaming**: the file's own `label` ("bootstrap
  vocabulary") is what the generated README file table shows beside it.

### One source per layer — and no all-layers union

Each layer's vocabulary is ONE document, and every term's `rdfs:isDefinedBy`
names that document. bootstrap's is `bootstrap/ns.jsonld`, written by
bootstrap-tools from bootstrap's own terms and committed; the site copies it,
and the harness's full build reads it rather than rebuilding it, so nothing
can say a thing about a bootstrap term that bootstrap's file does not
(`ns-export-skos.test.ts` holds them equal, node for node).

There is no all-layers union document. A program follows a term's IRI to its
layer document; a person looking for terms goes to the Glossary, which lists
every term and publishes SKOS for every scheme. `NS_PREFIXES` in
`schemas/kg/namespaces.ts` is the one list; `stubOfNamespace()` reads the stub
back off an IRI. Do not bind abbreviated prefixes (`bs`, `cat`, `fac`).

**Why an abbreviation is a defect waiting to happen.** **An unbound prefix is
not an error to a JSON-LD processor**: if a context binds `fac` while terms
are still written `folio:…`, the processor reads `folio` as a URI SCHEME, and
`folio:Definition` expands to an absolute IRI that is well-formed, means
nothing, and joins with nothing. A `--check` drift gate does not catch it,
because the source is wrong the same way — **a drift gate proves agreement,
never correctness**.

**The two rules, and what enforces them.** Every emitted document names its
own layer's generated context, `<iriBase>ns/context/v1.jsonld`.
`jsonld:contexts --check` (cat-harness-tools `scripts/gen-instance-contexts.ts`)
enforces rule 1 over every `.jsonld` in the checkout, failing on a prefix used
in an IRI position that nothing binds; a context generated from use binds
nothing unused. Rule 2 is upheld by construction — own prefixes are spelt
from the declarations:

1. **Spoken ⇒ bound.** A compact IRI used as a KEY or an `@type` value must
   have its prefix bound in that document's context — inline, or the
   published one by URL, or an array of both. The published context's own
   term targets are checked too, whether or not a document uses them. Plain
   string VALUES are not read as CURIEs: `label: "def:foo"` is an authored
   label, which is exactly the hazard `schemas/kg/jsonld.ts` opens with.
2. **Own namespace ⇒ stub spelling.** A binding onto a `…/<stub>/ns#`
   namespace of ours must be spelt `<stub>`, and `<stub>` must be declared by
   a layer (`<stub>/<stub>.json`).

A context URL the check cannot resolve is **"could not determine"**, counted
and listed — never read as clean.

**Checking a fix: expand, don't read.** A compact IRI looks right to a human
whether or not it is bound. The evidence that closes a prefix defect is a
document run through a JSON-LD processor, with **zero** expanded IRIs outside
`http(s):`.

**Where a prefix cannot be bound at all, a different spelling is never the
answer.** CSVW metadata allows only `@language` and `@base` in its local
context, so prefixed keys there dangle under ANY prefix. The two real answers
are absolute IRIs, or not being JSON-LD at all; `tabular-metadata` takes the
second: the record is plain JSON and the CSVW document is derived from it. **A file whose extension says `.jsonld`
is making a claim** — a processor will read every colon-key in it as an IRI.

## `fsh-guts` NEVER reaches a published graph

`fsh-guts`, and every reference to it, is stripped from the KG before
publication.

**Keeping the CONTENT out of the render pipeline is a different property from
keeping the REFERENCE out of the graph.** A layer's declared directories
become nodes in `<stub>.jsonld`, and `fsh-guts/` must be declared (or no tool
can find it and the never-delete rule has no destination), so its id, path and
description must be stripped from the published document.

`UNPUBLISHED_GRAPH_TYPOLOGIES` in `schemas/kg/cat-harness.ts` is the one list, read by
every emitter, so two filters cannot disagree about what is excluded.

**Three emitters are filtered:**

| emitter | what would leak |
|---|---|
| graph typologies | the `fsh-guts` GraphTypology node |
| declared directories | the Directory node — id, path, description — and its `holdsGraph` edge |
| **skills** | `skill/fsh-guts`, plus the `declaresSkill` edge from `package/folio-core` |

The skill is excluded on the merits as well as the letter: its subject IS
where SDLC churn goes, so publishing it advertises the trashcan to every
consumer of the graph. **An edge to a stripped node is not a compromise —
it is a dangling reference that still spells the name it was meant to
remove.**

**A directory is excluded when ANY graph it holds is excluded**, not when all
of them are. `graphs` is an array and `schemas/` already holds two; an "all"
test would publish a directory holding both `cat-harness` and `fsh-guts`,
naming the path on the way past.

### This is not a contradiction of `<base>/fsh-guts.jsonld`

Different documents. That one IS the trashcan's graph and is fetched by name;
every other published artefact must carry no path to it. A consumer may go
there deliberately and must never arrive by following an edge.

### Strip where the document is built

Not at upload. A strip on the happy path only leaves a graph that **looks**
clean and is not, and the test must read the built artefact rather than the
inputs. `scripts/tests/fsh-guts-unpublished.test.ts` serialises the whole
export and asserts the substring is absent — a structural check would have to
know every field that could carry it, and the one it forgets is the one that
leaks. It also asserts the node list is non-empty before filtering it, so a
wrong key cannot make it pass vacuously.

## Staging must not claim to be canonical

CI passes `--base-url` for a branch preview. Without it every staged export
mints `@id`s pointing at `main`'s published document, and two different graphs
assert the same IRIs — the preview would claim to **be** the canonical graph.
That is not cosmetic: an `@id` is an assertion of identity, and duplicating one
is how a merged graph acquires contradictory statements about the same node.

## The graph carries its own vocabulary

Graph typologies are **nodes**, not just TypeScript. Follow `holdsGraph` from a
directory and you arrive at a node saying what that kind holds and whether it
renders. Without them the vocabulary needed to interpret the document lives
only in code the consumer cannot fetch — which is the difference between a
self-describing graph and a graph with documentation.

The schema half is `scripts/harness-schema-export.ts`: the declaration's JSON
Schema, published at the URL its own `$id` names, so a consumer holding an
a declaration it does not understand has somewhere to go. It is a third
rendering of `CatHarnessDeclarationSchema` beside the JSON-LD — **not a
second authority**; the Zod is authoritative, per
[`directory-conventions`](directory-conventions.md).

## A preview says what it is, and links back — explicitly

Passing `--base-url` gives a preview's nodes preview IRIs, so the two graphs
cannot contradict each other. To keep them **relatable** ("this PR changes
skill X"), three things are stated in the artefact rather than left to a
convention:

| | |
|---|---|
| `@type` | `[prov:Entity, folio:PreviewGraph]` — "am I the real one?" is answerable from the document's own type |
| `canonicalDocument` | the canonical document's IRI, at document level |
| `alternateOf` | **per node**, `prov:alternateOf` → that node's canonical IRI |

**`prov:alternateOf`, never `owl:sameAs`.** `sameAs` entails identity, so a
reasoner merges every statement about both nodes — and if the preview changed a
skill's description, the merged graph would assert two conflicting descriptions
of one thing. That is exactly the contradiction distinct IRIs were introduced to
avoid. `alternateOf` says "same underlying thing, different presentation" and
merges nothing.

**The per-node links are derivable, and are emitted anyway**, because **a
downstream consumer must never have to string-manipulate or infer a rule to
follow a link**: a rule a consumer has to know is a rule a consumer can get
wrong. See
`crdm-requirements-workflow` (opt-in `cat-harness.sdlc`) §"Consumer burden
is a requirement".

**Vocabulary nodes get no `alternateOf`.** Graph typologies are minted under the
namespace, not the document, so they are byte-identical in both graphs; an
`alternateOf` on them would point at a node that does not exist. A test pins
it.

## Naming — artefacts take the repository's name, the config does not

The **stub** (`<name>.json` → `stub`, defaulting to `name`) is the
filename stem of everything this layer publishes: `<stub>.jsonld`,
`<stub>.schema.json`. One helper, `artefactStub()`, computes it, so the two
exporters cannot disagree about what this layer is called.

WHO SMART Base does the same and derives its stub by stripping a prefix
(`smart-<stub>` → `<stub>` → `https://smart.who.int/<stub>`), so stub, directory and
published path are one word.

**The declaration file is named for the layer's `name`, not its `stub`:**
`<name>.json`. A consumer finds it without being told its filename:
`findDeclarationFile()` scans a directory for a `*.json` carrying a `name`
whose stem EQUALS that name — the file agrees with **itself** — and two such
files in one directory **throw** rather than one being picked silently. It
never derives the name from the DIRECTORY, which would find nothing in a
repository cloned under a different name.

Everything the declaration *describes* is free to be named: by the time you
fetch those you have read the declaration naming them.

## The edges are the reason to publish

What makes the export worth having is the relations that already exist on
disk and that **no other tool surfaces**:

- **activity → skill.** Every BPMN activity may carry
  `<bootstrap.processes:skill ref="…"/>`, so the export can say which process step is
  implemented by which skill.
- **activity → role.** A BPMN lane is the role that performs the step.
- **skill → package**, and a skill's **two facets**: its instruction body
  (`<name>.md`) and the I/O contract it names in its front matter
  (`input:`/`output:`, usually `schemas/skills/<name>/`).

That last one is the one to understand before editing the exporter. **A name
may have an instruction body, an I/O contract, or both — they are facets of one
skill, not two kinds of skill.** So the graph is keyed by *name*, which is also
what a BPMN ref uses. Keying by file instead produces two disconnected node
sets and loses the relation entirely.

It is also what makes "declared somewhere, written nowhere" visible: which
skills have prose only, an I/O contract only, or both.

## A partial graph must never pass for a whole one

A consumer of the JSON cannot distinguish a skill that is absent from one that
was never collected: both are simply not in `@graph`, counts look plausible,
and nothing fails — a clean run over a corpus the tool could not read. So:

1. **A source that cannot be read goes in `problems[]` and the export exits
   non-zero.** Publishing is blocked, rather than a truncated file being
   deployed.
2. **`counts` by type ships with the graph**, so a consumer can see at a glance
   that a corpus it expected is missing, without re-deriving it.
3. **The invariant is asserted against something outside the exporter's own
   view.** `scripts/tests/kg-export.test.ts` requires every skill a *diagram*
   names to appear — and `check:workflow-refs` independently guarantees those
   refs resolve against the real skill locations. So if the exporter's notion
   of where skills live narrows, the test fails. An invariant checked only
   against the exporter's own collection would not catch it.

## Whose nodes — a layer publishes its own

**The policy is [`instance-publication`](instance-publication.md) §"What each
layer publishes — graph, address, schema, and what is stripped"**: which
layer publishes which document where. This section is the exporter's side
of it.

`buildExport` takes `scope`, and the CLI `--scope <instance|checkout>`:

| scope | reads | for |
|---|---|---|
| `instance` (default) | this layer's declaration alone | the published document, its locale variants, its QA sidecar |
| `checkout` | this layer plus every layer stacked on it | a corpus-wide consumer that says so — the `kg` search slice |

An `@id` the checkout-scope document mints and the instance-scope one does
not is held by its owner's own document, and this one says nothing about it:
no forwarding node. A link to a node that left reads as dangling until it is
re-homed.

## Named subgraphs — one IRI, two files, framed from one graph

A *named subgraph* is a directory of a declared graph, read as a set of KG
nodes: `skills/` is one, and so is `sdlc/skills/`. Asking for "every node of
`cat-harness/sdlc/skills`" takes one fetch.

### Identity

- **The subgraph IRI is a directory IRI in its own namespace:**
  `<BASE_URL>/subgraph/<HARNESS>/<PATH>/`, for example
  `…/subgraph/cat-harness/sdlc/skills/`.
- It is kept apart from content-node IRIs on purpose. A subgraph is a *view* of
  nodes, not one of them, so renaming a file never renames the subgraph, and
  re-homing a node never re-mints the subgraph.
- Not `/hydrated-graph/`: the pointer-only file would then live under a path
  that says "hydrated".
- **The repository's level is `<BASE_URL>/subgraph/`**. It has
  `index.jsonld` only, and its `hasSubgraph` are the harness roots this build
  frames. It is the one file a consumer needs to find every root. The workflow
  page starts there.

### Two files under the IRI

Both files have root `@id` = the directory IRI.

| file | what is in it | who it is for |
|---|---|---|
| `index.jsonld` | **referenced**: each direct member as a pointer (`@id`, `@type`, label), and each child subgraph by its IRI | search, navigation, skeleton loading |
| `index.hydrated.jsonld` | **dereferenced**: every node in the subgraph's *transitive* membership, inline and fully hydrated | "give me all of `sdlc/skills`" in one fetch |

Rules for the pair:

- **The hydrated file carries KG metadata, never heavy content.** Markdown
  bodies, images and binaries are payloads, reached by a `payload` link
  (§"Payloads — heavy content by content address", below).
- **The root has `index.jsonld` only.** A harness layer is itself a named
  subgraph of the repo KG, and the repo KG is the level above it. A *deep*
  hydrated file at the root would be the whole graph in one document — a
  monolith. Hydration is deep, but not at the root.
- **The GitHub Pages caveat.** Pages does no content negotiation, so the
  directory IRI is documented as resolving to `index.jsonld` by explicit path.
  A consumer that dereferences the bare IRI gets whatever Pages serves for the
  directory; `index.jsonld` and `index.hydrated.jsonld` are always addressable
  by name.

### Building the files

- **One source, two frames.** Both files come out of one build step, from the
  same in-memory graph, by JSON-LD **framing**: a pointer frame
  (`@embed: @never`) and an embed frame (`@embed: @always`).
- **Never two hand-synced properties.** No `authorUri` beside `author`. Two
  properties carrying one fact is the drift `data-modelling` §3 exists to stop.
- **`@context` is never inlined.** Every file declares the one shared, cached
  context URL, the way content documents already use
  `ns/content/v1.jsonld`.
- **Where it is built.** `bun run cat subgraph:jsonld`
  (`scripts/gen-subgraph-jsonld.ts`) frames kg-export's in-memory graphs —
  one per framed layer, each from its OWN export, never a stacked
  layer's node under this document's name — and
  writes `docs/subgraph/<HARNESS>/<PATH>/index[.hydrated].jsonld`, which Pages
  serves at the subgraph IRI, plus the context at `ns/subgraph/v1.jsonld`.
  `subgraph:jsonld:check` is the gate. The file shape is
  `schemas/kg/subgraph-manifest.ts`.

### Published per pin, in a package

The files are built at publish (`builtAtPublish`: `docs/subgraph/`), so no
commit holds them. For a consumer that reads them at a PIN rather than from the Pages site,
**each pin's index files are published in a package**: an npm package,
`<harness>-subgraph-index@0.0.0-pin.<sha>`, holding every `index.jsonld` and
`index.hydrated.jsonld` under `<docs>/subgraph/<HARNESS>/` at the paths above
and a `subgraph-index.json` manifest (`folio-subgraph-index/v1`: repository,
pin, harness, each file's sha256). It is attached, with its
`folio-binary-release/v1` record, to the GitHub release `subgraph-index-<sha>`.

- **Not committed:** a committed copy of a build over other layers is
  stale on the next re-pin.
- **Not generated at mount:** reading one file of metadata must not need the
  build toolchain, and one pin must have one set of files.
- **Every name is computed** from repository, pin and harness
  (`subgraphIndexPackage`, `schemas/kg/subgraph-manifest.ts`), so a consumer never
  lists releases.
- **Who builds it:** `layer-publish-subgraph-index.yml` (the tools layer),
  on each push to `main`: `subgraph:jsonld`, then the `subgraph-index-package`
  Tool. A release that already exists for a pin is never replaced.
- **Who reads it:** a hydrated mount (`remote-mount`), when the pin's tree
  holds no file. [`remote-mount`](remote-mount.md) §"Hydrated: the index files
  are published per pin, in a package" has the checks.

### Membership is declared, not inferred

- A subgraph's members are what its **declared membership rule** selects.
- For a directory of a declared graph, the rule is *containment*: a node is in
  the deepest subgraph directory that contains its source path, and in every
  ancestor of that one, transitively.
- **An overlaid layer heads its own tree.** kg-export reads the corpus of
  every layer stacked on this one, so the content core's processes and
  skills are nodes of this graph. A directory belongs to the layer that
  declares it, so those nodes sit under `<BASE_URL>/subgraph/<that
  layer>/…`, framed by this build because this graph publishes them. Their
  `@id`s do not change.
- **Bootstrap gets no tree here.** `bootstrap` and `bootstrap-tools` sit
  *below* this layer, and their processes are kept out of its graph; they
  publish their own subgraphs, and a tree framed for them here would re-carry
  what was excluded.
- A harness's own rule, saying which directories are its graph, is its
  `<instance>.json` declaration. `Harness` and `Subgraph` therefore share
  one base, `GraphNodeDirectoryShape`. They do not get two parallel
  "directory with members" types.
- A node whose subgraph cannot be determined goes in `problems[]`. It is never
  silently left out (§"A partial graph must never pass for a whole one").

### Consumers

- **Remote materialization reads these same files.**
  `bun run cat kg:materialize --nodes <subscription> <subgraph-path>` fetches one
  subgraph's `index.hydrated.jsonld` at the subscription's pin. It never does
  a sparse checkout of the subgraph's directory. The file is validated against
  `SubgraphHydratedSchema`, its root `@id` must be the subgraph asked for, and
  it is held with a sha256 record. A request for the root is refused, with a
  pointer to `index.jsonld`. This is a metadata mode. The byte copy
  (`kg:materialize <subscription> <subgraph>`) keeps its five gates. See
  [`kg-subscription`](../../../library/skills/large-datasets/kg-subscription.md)
  §"metadata mode".
- A subgraph manifest that lists a child IRI but whose child file is missing is
  a dangling link. It is reported, never skipped.

## Payloads — heavy content by content address

The subgraph files are the **skeleton**: topology and the metadata a search needs. Heavy content is the
**muscle**, and it lives outside the graph, one file per distinct body. No
generator emits a monolithic graph file that inlines bodies.

### Addressing

- **A payload's IRI is `<BASE_URL>/payload/sha256/<hex>`**, where `<hex>` is the
  lower-case hex SHA-256 of its bytes. Nothing else names it: no extension, no
  source path, no node id.
- **It is immutable.** The bytes at an IRI never change, because a change to
  the bytes is a change to the name. A consumer may cache a payload forever.
- Immutable is not "kept forever". A payload no node links to is an **orphan**:
  the gate fails on it and the generator removes it on write. An old IRI may
  therefore stop resolving once nothing references it; while it resolves, it
  resolves to the same bytes.
- **Identical bodies are one file**, linked from every node that has them.
- **The bytes are the source file verbatim.** A Markdown body keeps its front
  matter, and its relative links resolve against the node's own source path
  (`instructionsPath`), not against the payload IRI.

### The link

Every node with a payload carries one `payload` link, in **both** subgraph
files. In the index it sits on the pointer; in the hydrated file it sits on the
whole node, in place of the body:

```json
"payload": { "@id": "<BASE_URL>/payload/sha256/<hex>", "sha256": "<hex>", "bytes": 12653 }
```

`sha256` and `bytes` let a consumer verify a fetch, and decide whether to make
it, without a second request. `sha256` is the IRI's last segment by
construction, and the schema checks it.

### The media type is in a sidecar

`<hex>.json` beside `<hex>` carries `$schema: cat-harness-payload/v1`,
`sha256`, `bytes` and `mediaType`. It is a sidecar rather than an extension for
two reasons:

- the ruled IRI has no extension, and `<hex>.md` would be a second address for
  one payload;
- GitHub Pages types a file by its extension, so an extensionless payload is
  served as `application/octet-stream` whatever it holds.

A consumer holding only the IRI appends `.json`. The media type is not also on
the link, because one fact gets one place. It comes from the source file's
extension through a declared table; an undeclared extension is a problem, never
a guess.

### What is heavy

The graph inlines no body, so "heavy" means what its pointers name:

| node | field | heavy? |
|---|---|---|
| Skill | `instructionsPath` (.md) | **yes** — the instruction body |
| Asset | `path` (.md; an image would be too) | **yes** |
| Process / Decision | `sourcePath` (.bpmn / .dmn) | not yet — the topology is already graph nodes, and the XML is its own graph's source |
| Schema | `module` (.ts) | no — code, not content |

The table that decides
this is `HEAVY_POINTERS` in `schemas/kg/subgraph-manifest.ts`, and adding a row
there is the whole change to make a field heavy.

### Building and checking

- `bun run cat subgraph:jsonld` writes the payloads to `docs/payload/sha256/` in
  the same run as the subgraph files, from the same graph.
- The docs workflows copy that directory into the site **verbatim**. It is
  excluded from Jekyll, which would render a body's front matter and Liquid,
  and then the served bytes would not hash to their name.
- `subgraph:jsonld:check` is the gate. It fails on any of these:
  - a stale or stray file;
  - a payload no node references;
  - a node whose payload is missing;
  - bytes that do not hash to their name;
  - a payload without its sidecar, or a sidecar without its payload.
- The schema is `PayloadLinkSchema` and `PayloadSidecarSchema` in
  `schemas/kg/subgraph-manifest.ts`.

## Per-slice SQLite — a named subgraph as one file a browser mounts

A large graph needs search on the client, and a static host cannot run a query. So CI flattens one slice into
a relational schema and publishes it as `<slice>.<sha256>.sqlite3`, and the
browser opens it with the official SQLite WASM build and an OPFS VFS. There is
nothing to parse, because SQLite reads its B-tree pages on demand. This is the
**skeleton** in a second encoding. It never replaces the JSON-LD files above; it sits beside them for
the consumer that has to search.

**One builder, one definition per slice.** `scripts/gen-slice-sqlite.ts` is the
`slice-sqlite` Tool; its procedure is the `slice-sqlite-publish` process. Each
slice is one `SliceDef` in its `SLICES` table: the DDL, each stored table's
columns and row order, the one FTS5 index and the rows it covers, where the
payloads live, the `search` block the page reads, and a `load` that turns the
source into rows. The engine (build, `VACUUM INTO`, digest, manifest,
`--check`) names no slice. Adding a slice is adding a definition, **never a
copy of the builder**.

### The four slices

| slice | source | payloads |
|---|---|---|
| `beans` | `beans/defs/` | work item files, at deploy |
| `todos` | `assets/todos/index.json` | todo files, at deploy |
| `library` | `assets/library/index.json` + `entries/<id>.json` | entry files, at deploy |
| `kg` | the whole-repo KG export | already committed |

Run `bun run cat slice:sqlite -- --out <scratch>` for current sizes. The
whole-repo slice is the **no-body variant**: nodes, edges, and an FTS5 over
names, titles, summaries and descriptions, with bodies as payload pointers. It
stores IRIs relative to the document (`skill/todo-manager`, with the base in
`meta.base`) to stay small. The ~5 MB budget is `SIZE_BUDGET_BYTES`,
**reported** in the manifest as `overBudget` and not gated (the work items slice
grows every session, and a gate would turn every open PR red for a change
nobody made). Over budget means stop and report (the process's budget
gateway), not ship.

### What a slice file holds

- **One table per node type, one row per node.** Columns are the fields a
  search filters or sorts on. Each has a B-tree index where a query needs one.
  A JSON-valued field stays a JSON column and is read through JSON1
  (`json_each`), rather than becoming another stored table.
- **One stored table per relation, never two.** When a relation can be
  declared from either side, as a work item's `blocking:` and `blocked_by:` can, the
  table has a `declared_on` column saying which side declared each edge, and
  the two directions are **views** over it. Two tables for one relation are two
  answers that can disagree. When a relation is declared on one side only, a
  `declared_on` column could hold one value, so it is left out (`todos`,
  `library`). When the relations are many and share one shape, they share ONE
  table keyed by `rel`: the `kg` slice's 36 `@id`-typed terms are rows of
  `edges (src, rel, dst)`, with `incoming` and `dangling` as views, because 36
  tables of one shape would be 36 places to change it.
- **An FTS5 index over the searchable text.** It is CONTENTLESS
  (`content=''`), so it indexes text without storing it. It keeps **full
  detail**, because positions are what make a phrase query work. Both the
  official WASM build and `bun:sqlite` compile with `ENABLE_FTS5`.
- **No heavy content.** A row carries `payload_sha256`, a pointer to the
  payload at `<BASE_URL>/payload/sha256/<hex>` (§"Payloads"). The client fetches
  the payload when a result is opened. **What the payload is, is a per-slice
  decision**:
  a work item's or a todo's source file verbatim; for the library, the PUBLISHED
  `entries/<id>.json`, one payload per entry that every one of its blocks
  points at, never the section files under `library/`, because a withheld
  entry publishes no verbatim text and the published entry is
  what already applied that rule; for `kg`, the KG's own committed payloads,
  from the same `planPayloads` call the subgraph files use. A row with nothing
  heavy has a `NULL` pointer, never an invented one.
- **A `meta` table and `PRAGMA user_version`** carry the schema version. No
  timestamp and no commit go in the file.

### The manifest beside it

`<slice>.sqlite3.json`, `$schema: folio-slice-sqlite/v1`, carries:

- `file`, the database's content-addressed name (§"Content-addressed file,
  fixed-name manifest");
- `sha256` and `bytes` of the file;
- `contentDigest`, a sha256 over the canonical row dump;
- the row count of each table;
- `schemaVersion`, `sqliteVersion` and `pageSize`;
- `fts5`: the index's table, the table whose rows it covers, and its columns;
- `payloadPath`, and `payloads`: whether they are written at deploy or
  already published, how many, how many bytes;
- any `duplicateIds` the source holds, and any other source `findings` in
  words (a todo with no source file, an entry file the index does not list),
  so a gap is reported rather than silently dropped;
- `overBudget`;
- `search`: the query, the alias, the column a typed query degrades to, and
  what a payload is, which the one search page reads (§"The search page").

`assets/slices/index.json` (`folio-slice-index/v1`) lists every slice built
into a directory.

There are two digests because there are two questions. `sha256` asks whether
these are the bytes that were promised; it is what the client verifies a
download against and keys its cache by. `contentDigest` asks whether this is
the same data, and it stays equal across a SQLite upgrade that changes the
file's bytes. The header records the writing library's version at offset 96.

### Content-addressed file, fixed-name manifest

The database is published at **`assets/slices/<slice>.<sha256>.sqlite3`**,
the full lower-case hex of its bytes, and the manifest's `file` names it. At
one fixed path, a client behind a CDN could fetch a fresh manifest and a stale
database, fail the sha256 check and fall back: safe for correctness, unsafe
for availability. A fresh manifest names a file no
cache has seen. A stale manifest names an older file whose bytes still hash to
what that manifest promises, so the worst case is an older but
self-consistent database, or a 404 the page reports.

**Why not `payload/sha256/<hex>`.** §"Payloads" is the muscle: a node's body,
the source file verbatim, linked from a node's `payload` and kept only while
something links to it. A slice file is the skeleton in a second encoding. It
is derived and SQLite-version dependent, and no node links to it, so under the
payload tree's own orphan rule it would be an orphan. It would also need a
`<hex>.json` sidecar for a media type that its extension already gives. What
the scheme does take from §"Payloads" is the property that matters,
**immutable, not kept forever**. It also takes the full hex rather than a
prefix, so the name's hash segment is `sha256` by construction and can be
checked against it. Beside its manifest, `file` stays a sibling name that the
client resolves against the manifest's URL.

**The manifest stays at the fixed `<slice>.sqlite3.json`** because it is the
one file that says which build is current, and the page finds it by slice
name. It needs a **short TTL**. The client's `no-store` bypasses only the
browser cache; a CDN keeps the manifest for the host's TTL, and GitHub Pages
sends `max-age=600`, which a repository cannot change. With content addressing
that TTL bounds availability, not correctness.

**Rotation.** A build writes only the current file and removes any other
`<slice>.<hex>.sqlite3` of the same slice from `--out`, along with the legacy
`<slice>.sqlite3` (`rotateSliceFiles`). Nothing else in the directory is
touched. On `gh-pages` nothing piles up. `docs-site.yml` publishes as a full
replace and restores each `branches/` preview as it was. `feature-staging.yml`
empties `branches/<slug>/` before copying the build in, and
`staging-rotate.ts` caps the number of previews. **What a CDN can still
hold:**

- for one TTL, a stale manifest together with the older file it names;
- an older file that nothing now names, until it expires;
- a stale manifest whose file the origin no longer serves. The client reports
  this case as a 404 with "reload", never as an empty result.

The branch's git history keeps old blobs, as it always did when one path
changed bytes.

### Deterministic, proved

Rows go in sorted by key, the page size is fixed, and the published file is
`VACUUM INTO` a fresh path, so no free page or insertion history leaks in. The
gate builds twice and requires one sha256 on every run.

### Built at deploy, not committed — when the source moves on most merges

A slice of a corpus that every session writes, which `beans/` is, is **not
committed**. A committed binary would be stale against every merge ref, so a
content gate would be red on every open PR. It would also grow the clone on
every edit. This is the same reasoning that checks `assets/beans/index.json`
only for existence. The deploy builds each slice from the tree it publishes,
one line per slice in `docs-site.yml` and `feature-staging.yml`, straight into
`_site/assets/slices/`, and writes the deploy payloads into
`_site/payload/sha256/`.

**The other three are built at deploy too**, although their sources are
committed generated files that a session does not write by hand. The todo
index, the library index and entries, and the KG export are regenerated on
most merges, so the same staleness applies one step removed. And a committed
binary's sha256 is stable for one SQLite version only, so a content gate over
it would go red on a Bun upgrade that changed no data. A slice whose source
truly does not move may still be committed and gated like any generated file;
none of the four pilots is that slice.

Deploy payloads never go into the committed `docs/payload/`. Its orphan audit
admits KG nodes only, and work items, todos and library entries are not KG nodes
(§"Adding a node type").

The gate (`bun run cat slice:sqlite:check`, or `--check --slice <name>` for one)
therefore checks, for every slice:

- the builder runs, and a source it cannot read is could-not-determine, red;
- two builds give one sha256;
- the row digest read back **from the file** equals the one computed
  independently from the source, so a dropped or truncated row fails;
- an FTS5 phrase query finds a known row, and a slice with no row to probe is
  red rather than an empty green;
- the payloads pass `auditPayloadTree`; for `kg`, every pointer names a
  payload the committed tree holds;
- the manifest's `file` is the content-addressed name of the file the build
  wrote.

### The client — download, OPFS, mount, with a fallback

`docs/assets/js/slice-sqlite.js` gives `openSlice(manifestUrl)` →
`{ mode, info, query(sql, params) }`:

1. Fetch the manifest with `no-store`.
2. Look in OPFS for `/<slice>-<sha256>.sqlite3`. A hit opens with **no
   download**. A new build has a new name, which is the whole invalidation
   story.
3. On a miss, download the file **by the manifest's `file`** as an
   ArrayBuffer. **Refuse** it if its sha256 is not the manifest's. That is a
   `SliceIntegrityError`, which no fallback retries: the same URL would give
   the same answer. The page shows it ("the manifest and the database
   disagree … Refused") and marks `data-slice-error="integrity"`. Import it
   into the pool and unlink older builds of that slice.
4. Open it. `info.contentAddressed` is false only for a legacy manifest that
   names a fixed path.

**The VFS is `opfs-sahpool`, in a Worker** (`slice-sqlite-worker.js`), not the
`opfs` VFS. That one needs SharedArrayBuffer, which needs COOP/COEP headers,
and GitHub Pages cannot send them. When there is no Worker or no OPFS, the
verified bytes are opened **in memory** with `sqlite3_deserialize`. That is no
parse either, but nothing is persisted. The mode actually used is reported,
never assumed.

The WASM build is **vendored** from the pinned `@sqlite.org/sqlite-wasm`
devDependency, at 1.51 MB (`bun run cat slice:sqlite:vendor`, gated by
`:vendor:check`), because jsDelivr is unreachable from some builders and a
reader's search should depend on no host but the site's own.

### The search page — one page, the slice is a parameter

`docs/slices/search.html?slice=<name>`; with no `slice`, it lists what
`assets/slices/index.json` says was built. **One page rather than one per
slice**, because every per-slice fact the page needs is already in the
manifest's `search` block, which the builder writes from the same definition
that built the tables. A page per slice would be a second copy of those facts
for each slice, free to drift from the schema it queries; this page has no
slice-specific code that could. A payload is shown by what the manifest says
it is: `markdown` (front matter stripped), or `library-entry` (the block of
the published entry whose id the row names). The parameter is checked against
a name pattern before it becomes part of a path.

`beans/search.html` forwards to `?slice=beans`.

### Adding a slice

Follow the `slice-sqlite-publish` process. In short:

- Add one `SliceDef` to `SLICES` in `scripts/gen-slice-sqlite.ts`. Never copy
  the builder.
- Choose its heavy fields by the table in §"What is heavy". A heavy field is a
  `payload_sha256` column, never a stored column. Choose what the payload IS by
  what the site already publishes, and never publish through a payload what a
  withheld or private source keeps back.
- **Measure before wiring.** Build it to a scratch directory and read `bytes`.
  Over the ~5 MB budget, try the no-body variant first, then stop and report the
  measurement rather than ship it.
- Decide **committed or built at deploy** by the question above.
- Wire it: one deploy line per workflow, a unit test over a fixture and over
  the real source, and a search in `slice-sqlite.e2e.ts`. The manifest, the
  gate and the page come from the definition. A slice whose rows do not match
  its source must fail. It must never pass as whole (§"A partial graph must
  never pass for a whole one").

## Adding a node type

1. **Decide it is in this graph.** The `kg` graph holds skills, processes,
   roles, capabilities and the directory declaration. **Work items are not in it** —
   `beans/` is its own graph typology with its own nodes (`defs`, `workflows`),
   and folding the work plan into the KG re-merges what was separated.
2. **Mint its `@id` with `makeIri`, and give it an `@type`.** Both are asserted
   by test. Never hand-build an IRI: `makeIri` is the one place every node's
   IRI is decided (§"Subject IRIs — a path, not a `#fragment`"), so a change
   to the IRI scheme changes them all at once.
3. **Report what you could not read**, in `problems[]`. Never `continue`
   silently past a parse failure.
4. **Say which edges it carries, and declare each one in the context** with
   `{"@type": "@id"}`. A node type that relates to nothing is a list and
   belongs in a list; an edge that is not declared is a string and might as
   well be one.
5. **Emit the nodes your edges point at.** An edge type without its target
   node type (`performedBy` without Role nodes, `incoming`/`outgoing` without
   SequenceFlow nodes) leaves every edge dangling. The export reports
   `danglingLinks` for exactly this.

## Running it

```sh
bun run cat kg:export                        # → _kg/<stub>.jsonld   (gitignored)
bun run cat kg:schema                        # → _kg/<stub>.schema.json
bun run cat kg:export -- --base-url https://… --out path.jsonld
```

`--base-url` (or `KG_BASE_URL`) overrides the declaration's `canonicalUrl`.
`--scope instance|checkout` picks whose directories are read (see "Whose
nodes" above); the deploy says `instance` aloud.

The output is a **build artifact**, deliberately not committed: it is a
snapshot of a tree that changes every commit, so a committed copy is stale by
construction. CI regenerates it on every publish.

> **Do not read `.claude/skills/registry.json` for this.** It is a runtime
> manifest, not the graph: it reads only `.claude/skills/local/*.json`.
> Package skills appear in it as bare name lists with no instruction body, and
> processes, the graph-typology registry and the declaration are absent entirely.
> It is also uncommitted and published nowhere. The two coexist; only one is
> the graph.

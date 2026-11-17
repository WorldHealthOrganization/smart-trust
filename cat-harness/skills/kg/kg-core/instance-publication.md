---
name: instance-publication
description: >
  Every asset carries an id and a version and sits in DRAFT. Publication is a
  state, not a boolean, and `published` is refused by the schema because the
  formal process does not exist yet. Carries the id namespace rule, why a
  mirror never takes its subject's identity, and what a consumer may assume of
  a draft. Also the one home for which graph each layer publishes, where,
  under which IRI and schema, and what is stripped from it.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# instance-publication — draft is a state, not an absence of one

> Skill id: `instance-publication` · Package: `folio-core` · Layer:
> `cat-harness`

All assets get a version and are in `draft` publication; the formal
publication process is not yet defined, needs tools, and depends on the
layer. Three rules follow.

## 1. Every asset carries a `version` — and the `id` is HELD

`version` is **universal**. Not only the publishable ones.

**It is enforced by `check:publishable`, not by the schema**: requiring it in
the type would break every test fixture that builds a declaration without it,
and a sweep that size hides real regressions in the noise. A new layer
without a version fails the gate **by name**, rather than as a parse error in
a test fixture.

A version is not a *publication* claim. It distinguishes snapshots of a
thing; whether anyone outside may depend on those snapshots is the separate
question below.

**`id` is not written into declarations.** Bootstrapping a different harness
must change ONE place — one reference in `bootstrap/README.md` — and a
namespace written into every declaration is many places. So an id must be
**derived** from that single reference, which does not exist yet
(`bootstrap/README.md` carries no outward references, and its tests enforce
that). Do not mint ids before then: an id is *stable forever, never reused*.
The namespace rule below stands; only its application waits.

## 2. Publication is a STATE, and the state is `draft`

`publication` is not a boolean. `draft` is the state **everything is already
in** — not an undecided-ness, not an absence. `check:publishable` does not
report a draft layer as undecided.

Absence still means `draft`. Declaring `publication: "draft"` is legal and
says nothing extra; the field exists to reserve the axis and to make rule 3
testable rather than merely intended.

## 3. `published` is REFUSED by the schema, not merely reported

Because the process does not exist, a flag nothing can verify is refused
rather than reported — a gate that only grumbles is a gate somebody switches
off: a declaration setting `publication: "published"` **fails to parse**, with
the error naming what is missing.

> **Falsifier for this whole skill:** if `published` becomes settable by hand
> before any tool backs it, this is wrong and should be read again.

`depends on instance` is the part not yet designed. When the process arrives it
will be **per-instance** — what publishing means for `cat-harness` is not what
it means for a WHO IG mirror — so expect `publication` to gain a companion
naming that process, rather than to become a second boolean.

## The id namespace — one rule, no per-instance invention

Every layer's id is **`io.github.litlfred.folio-assistant.<name>`**. The
rule underneath it is mechanical: **reverse the host, append the path.**

| host + path | id |
|---|---|
| `litlfred.github.io/folio-assistant` | `io.github.litlfred.folio-assistant` |
| `smart.who.int/base` | `smart.who.int.base` |

The second row is FHIR's actual published package id for that IG, produced by
the same rule: a convention that already yields the right answer for a case
we can check is worth more than a scheme chosen for elegance.

An id is **stable forever and never reused**.

## A MIRROR NEVER TAKES ITS SUBJECT'S IDENTITY

The trust-IG mirror here is **not** the WHO SMART Trust IG. It is this repository's
reconstructed index *about* that IG. The two are different objects, and the
real upstream ids are already held — as **data**, in the right place:

```json
// <dak-layer>/fhir-artifact-index/chrome.json, ingested at commit 26635f7b
{ "id": "smart.who.int.trust", "canonical": "http://smart.who.int/trust" }
```

Giving our layer `smart.who.int.trust` would claim our mirror **is** the
thing it mirrors. Anything resolving that id would then find two different
artefacts answering to it.

**The same reading governs `canonicalUrl`.** In a mirror's declaration the URL
is READ from upstream, so it is a fact about the upstream IG and not a
decision about where that staging directory publishes. For a **true mirror**, `canonicalUrl` records the **subject**. It must not
drive **our** identity. A mirror's declaration that carries an upstream
canonical is describing what it mirrors, not asserting where it lives.

### Three questions that must not be merged — publication, staging, mirroring

Three different questions answer to "what is this layer's address", and
each has its own field:

| question | answered by | example |
|---|---|---|
| **Publication identity** — where the artefact lives once formally published | the `@id` its document mints; for a layer staged here for publication elsewhere, its declared `canonicalUrl` | `smart-base` → `http://smart.who.int/base/smart-base.jsonld` |
| **Staging location** — where this repository's site serves a draft copy now | the root index's `url`, never the `@id` | a DAK layer → `<site>/<name>/<name>.jsonld` |
| **True mirror** — this repository's index *about* someone else's artefact | its own identity on this site; the subject's ids are held as **data** | the trust-IG mirror is not the WHO SMART Trust IG |

**A layer staged here for publication at its `canonicalUrl` is not a
mirror.** It IS the thing that will be published there, so its `@id` is the
publication identity and this site is only where it is staged. The mirror rule
above applies to the third row and to nothing else. Never read this site's
address as a layer's identity: it would mint ids that change the day the
artefact is published.

## Release IRIs — one address, the major, derived from the version

Every address a layer mints carries its **major version only** —
`<iriBase>v<major>/…` — whoever reads it. A namespace, a schema `$id`, a BPMN `xmlns` and
`bpmn:import`, a JSON-LD `@id`, a code-list value, and a page a person reads
all take the one form:

| reader | form | example (bootstrap `0.1.1`) |
|---|---|---|
| a program or agent — a namespace, a schema `$id`, a BPMN `xmlns`, a JSON-LD `@id` | `<iriBase>v<major>/…` | `https://litlfred.github.io/bootstrap/v0/ns/` |
| a person — a page to read | `<iriBase>v<major>/…` | `https://litlfred.github.io/bootstrap/v0/` |

**The exact release comes from the pin, not the address.** A reader is handed
a commit by `index.lock.json` and the `needs` pins, which already name it
exactly; an address that also named the patch would make every patch release
rewrite every literal copy of the layer's addresses. Within one major a minor or patch adds and never breaks — the promise a
`$schema` tag already makes, where a reader accepts any tag of the same major
(`tagCompatible`, below) — so **only a breaking change, a new major, changes an
address.**

**`iriBase` and `version` are written ONCE, in the declaration** — the one
place a fork edits. `iriBase` is not
`canonicalUrl`: `canonicalUrl` says where documents are *published* and
`kg-export` mints a document `@id` from it; `iriBase` says what the
*identifiers* are, and those carry the release's major.

**Never type an address or a version.** Ask for it:

- in TypeScript, `releaseIris(decl)` / `releaseIri(r, path, "agent" | "human")`
  in `bootstrap-tools/schemas/release-iri.ts` — `gen-bootstrap-schemas` mints every `$id` this way;
- in a README template, the `release` variable ([`liquid-templates`](../../ui/ui-core/liquid-templates.md));
- on the site, `site.data.harness.releases.<instance>` (`version`, `major`,
  `agent`, `human`), written by `sync-docs-harness`.

**The copies that cannot ask are synced, and the sync is a gate.** An `xmlns`
attribute, a code-list value and a fixture string are literal by nature.
`bun run iri:sync` rewrites every legacy full-version `<iriBase><semver>/`,
whatever the semver, and every `<iriBase>v<N>/` of another major, to
`<iriBase>v<major>/`;
`iri:sync:check` fails CI and the pre-commit hook on any that is not. A minor
or patch release therefore leaves every copy as it is, and the sync has work to
do only on a new major or a move. Moving the base itself (a fork, or a move
to a new host) is `bun run iri:sync -- --from <old base>`, once. `beans/` is
never rewritten: a work item records what was true when it was written.

**Transition tolerance — remove when every layer has migrated.** Until every
layer carries `<iriBase>v<major>/`, the CHECKS — `check:node-iris`,
`iri:sync:check`, `vocabulary:check` — accept a legacy `<iriBase><semver>/`
copy whose MAJOR is the declared major as **deprecated**: a warning naming the
file, not a failure, so a layer's CI, which composes the others at `main`, can
go green before they move. The WRITER, `iri:sync`, still moves every such copy
to `v<major>/`; a full version of another major, or an id at the wrong path,
still fails. The tolerance lives in `legacyExactSemver` / `withLegacyMoved` in
`bootstrap-tools/schemas/release-iri.ts`.

**A `$schema` tag carries its SCHEMA's semver**, not the layer's:
`model-registry/1.0.0`. A reader accepts any tag of the same major
(`tagCompatible`); a tag change that breaks a reader is a new major. An old
tag is accepted until that schema's next major, and a published schema never
names it.

**Not yet moved, on purpose:** the exported document's own `@id`
(`bootstrap.jsonld`). `kg-export` mints it from where the document is actually
served, and today that is this site; pointing it at a base that serves nothing
would make it dangle. It moves when the bootstrap repository publishes.

## The release site — what is served where

The IRI rule above says what an identifier IS; this says what the layer's
own site must serve so that every identifier dereferences.

| path | holds | changes |
|---|---|---|
| `<iriBase>v<major>/` | every file of the latest release of that major exactly where it sits in the repository — schemas, JSON-LD, BPMN, the declaration — plus an extension-less alias for a vocabulary document (`processes/ns` beside `processes/ns.jsonld`), and the person-facing pages beside them: READMEs rendered as HTML, the drawn schema page, the diagrams | moves forward with each minor or patch release of that major; a release of a NEW major is a new directory beside it, and the old major's stays |
| `<iriBase>` | an index naming the current release of each major, and the versions available | with every release |

One directory serves both audiences, as one address does. A reader that needs
the exact bytes of an older patch reads them from the commit its pin names,
never from the site. Full-version directories (`<iriBase>0.1.0/`) are not
published; any copy still served there is a leftover, not a release.

Three rules follow from the table:

- **Publish files where they sit.** A published node's own identifier must be
  its file's path under the release address, so copying the release's tree is
  enough to serve every identifier. `check:node-iris` enforces it.
- **No two artefacts may publish to one path.** A generated alias that lands on
  an authored file's path hides the authored file — the exported graph's
  `.json` copy at `bootstrap/bootstrap.json` does exactly that to bootstrap's
  own declaration on this site today (the workflow keeps the graph at that
  address and says so). On bootstrap's own site the collision cannot occur,
  because the exported graph is not published there (next rule).
- **A layer's own site serves only what its tools generate.** For bootstrap that is bootstrap's files as
  they sit, the schemas and diagram vocabulary among them, the `bs:` term
  vocabulary, and the person-facing pages — all produced by bootstrap-tools.
  **Output a harness computes ABOUT the layer stays on the harness's site,
  under the harness's addresses, naming the layer as its subject**: the
  exported graph `bootstrap.jsonld`, the swimlane glossary, the QA verdicts,
  the translation templates. So a new toolset over the same content never has
  to reproduce a harness's output to publish the content, and a harness's
  output never takes the layer's identity
  ([`kg-separation`](../graph-management/kg-separation.md) §"The pair").

### The JSON-LD context: `<iriBase>ns/context/v1.jsonld`, published by the layer

One path sits outside the versioned tree: the layer's `@context`, generated
from the prefixes its own documents use (`gen-instance-contexts.ts`). It is
`@protected`, so a change that rebinds a term is a new `v2` beside it, never an
edit under a cached URL. Each repository publishes its own context, through
ONE reusable workflow, and **the initiation process sets that up**.

**Where its `ns` is a document, the context goes beside it.** A layer
holding its vocabulary as `ns.jsonld` at its
root (bootstrap) has `ns` staged as a FILE (the extensionless `ns`, and
`v<major>/ns`), so `ns/` cannot also be the directory `ns/context/v1.jsonld`
needs, and a static host cannot serve both. Its context is
`<iriBase>ns.context.v1.jsonld`, same `v1` rule. The generator decides by what
the layer holds (`contextPathFor` in `gen-instance-contexts.ts`), the
layer's `builtAtPublish` and `.gitignore` name that path, and the workflow
publishes at the path the build reports.

- **The workflow** is the tools layer's
  `.github/workflows/layer-publish-context.yml`. A repository calls it from a
  `publish-context.yml` of one `uses:` line, on push to `main`, with
  `contents: write` (`path-in-repo:` when the layer is a sub-directory, as
  the DAK layer's is). It builds only the caller's context, judges only the
  caller's findings, and writes that one path to the caller's `gh-pages`. It
  skips with a notice when the layer declares no `iriBase` or has no
  `.jsonld` documents, and it creates `gh-pages` when it is absent.
- **A site that rebuilds `gh-pages` must keep `ns/`.** An IG deploy or a
  folio site that cleans the branch lists `ns` in its `clean-exclude`, or the
  next deploy deletes the context.
- **Initiation.** `init-folio --instance` writes the caller and declares
  `iriBase` as `https://<owner>.github.io/<repo>/` from a github.com `origin`
  (`--iri-base` to choose another). With no such remote it invents none: the
  workflow skips until one is declared.
- **The one step that stays the owner's.** `GITHUB_TOKEN` cannot switch Pages
  on. After the first run: Settings → Pages → *Deploy from a branch:
  `gh-pages`, `/ (root)`*. Then `curl -sI <iriBase>ns/context/v1.jsonld`
  answers 200 with `content-type: application/ld+json`.

`publish-instance-files.ts` is the step that copies a layer's files into a
site today — each file as it sits, `.md` also as `.html`, `README.md` as
`index.html`. It serves bootstrap under this site until bootstrap's own
repository publishes itself, at which point the job is bootstrap-tools'.

### Tags

A standalone repository — one layer, declared at its root — tags a release
plainly, `v<major>.<minor>.<patch>`; a repository of several layers tags
`<name>-v<major>.<minor>.<patch>`, because a plain tag could not say which
layer it released. `check:version-bump` reads both
accordingly. The tag is what a site deploy writes `/v<major>/` from, so an
untagged commit is never an agent-facing release; the tag, like the pin, names
the exact version that the address no longer does.

## What each layer publishes — graph, address, schema, and what is stripped

**This section is where the publication policy is stated.** The files that
carry the mechanics point here for the policy.

### One document per declared layer, of its own directories

**Every directory carrying a declaration publishes ONE JSON-LD document, and
it holds only the directories that declaration names.** A dependency is
referenced by IRI, never inlined. The set is read from the declarations
(`instanceRootsIn`), never listed in a workflow, where it would go stale.

| layer | document on this site | built by |
|---|---|---|
| the host, `cat-harness` | `<site>/<stub>/<stub>.jsonld` | `kg-export.ts --scope instance`, its own line in `docs-site.yml` |
| the checkout root, `folio-assistant` | `<site>/<stub>/<stub>.jsonld` | `kg-export.ts --instance .` |
| `bootstrap` | `<site>/bootstrap/bootstrap.jsonld` | `bootstrap-tools/scripts/export-graph.ts` |
| every other declared layer | `<site>/<stub>/<stub>.jsonld` | [`cat-harness-tools/scripts/instance-exports.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/scripts/instance-exports.ts) |

- **Each document has a `.json` copy beside it**, the same bytes. Pages serves
  `.jsonld` as octet-stream, and `.json` is the only way to get a correct
  `Content-Type` out of it. The `.jsonld` stays canonical, since it is what
  every `@id` names.
- **The host is in the same place as every other layer.** Its document, its
  Tools, its subjects and its glossary are under `<site>/<name>/`: **one rule
  for every layer, with subjects beside their document**. A separate line in
  the deploy is the only thing different about it.
- **The first three rows are the only exemptions**, and they are
  `PUBLISHED_ELSEWHERE` in `instance-exports.ts`, each with its reason. No
  other list exists.
- **The host is built in layer scope**, so its document carries only its
  own nodes. `--scope checkout` remains for a corpus-wide consumer that says
  so (the `kg` search slice). It is never published under the host's name:
  `PUBLISHED_ELSEWHERE`'s pattern for the host refuses it.

The exporter's contract (the two scopes, what each collector reads) is
[`kg-export`](kg-export.md) §"Whose nodes — a layer publishes its own".

### An `@id` that moved is not forwarded

An `@id` that moved — to its owner's document, from a `….jsonld#<kind>/<id>`
fragment to a `<doc dir>/<kind>/<id>` path, or with its document under
`<site>/<name>/` — keeps NO forwarding node and NO document at the old
address. A consumer holding an old `@id` must re-resolve it. What stays is `placedOut`, so a
deploy step still naming an old `--out` path writes the document where its
`@id` says it is.

### Which base an `@id` is minted against

`exportIdentity` in `kg-export.ts` decides. The base is `--base-url` if
given; else the layer's own `canonicalUrl`; else, for a layer this
repository publishes, the host's. With no base at all the `@id` is
document-relative and a problem is reported, never a guessed absolute one.
**Every layer this site publishes, the host included, sits at
`<base>/<name>/<stub>.jsonld`**, so `<doc dir>` for the host's subjects and
Tools is `<base>/cat-harness/`, never the site root. **The one exception is an
layer declaring its own `canonicalUrl`**: it is the host of its own base,
so its `@id` is `<canonicalUrl>/<stub>.jsonld`, and the deploy passes it no
`--base-url` (`declaresOwnCanonical` in `instance-exports.ts`) — the tools
layer, `cat-openapi`, the FHIR IG layer and the DAK layer, for example.
**This site serves their bytes at `<site>/<stub>/<stub>.jsonld`,
and that is their branches/ location, not their identity** (§"Three questions
that must not be merged" above). The root index records both: `@id` is the
publication identity, `url` is where this site stages it. Anything that names a
node in another layer's document mints with `publishedIdentity`, or it
names a document nobody writes. `iriBase` is a different field, for
identifiers that carry the release (§"Release IRIs" above).

**What goes after the base** is a path, not a `#fragment`: a subject is
`<doc dir>/<kind>/<id>`, served as its own file. The rule, its reasons and
the `ns#Term` exception are in
[`kg-export`](kg-export.md) §"Subject IRIs — a path, not a `#fragment`".

### The schema

`harness-schema-export.ts` writes `<site>/<name>/<stub>.schema.json` for the
host. That is the JSON Schema of the declaration itself, which every
`<instance>.json` is validated against. It also writes `tool.schema.json`,
`tool-types.schema.json`, `tool-types/<Name>.schema.json` and each skill's I/O
contract (`skills/<skill>/<io>.schema.json`) in the same directory, each at the
URL its `$id` names. They sit under the host's own directory, beside its
document, like everything else it publishes. `bootstrap`'s schemas are
published as they sit, by `publish-instance-files.ts`.

**Every layer `instance-exports.ts` publishes also publishes
`<site>/<stub>/schema/`.** It holds:

- **the layer's own skill I/O contracts**, at
  `schema/skills/<skill>/<io>.schema.json`. They are read from
  `<instance>/schemas/skills/`, the directory its skills' `input:` and
  `output:` refs name. The declared `schemas` graph is not the answer:
  the science layer declares `sources/` as its `schemas` graph and keeps
  its contracts under `schemas/skills/`.
- **its public Zod schemas**, at `schema/zod/<module>/<Export>.schema.json`
  (§"Which Zod schemas are public" below).
- **an index, `schema/<stub>.schema.json`.** It `$ref`s the shared declaration
  schema (the host's `<stub>.schema.json`, by the `$id` the same build gives
  it) and lists every contract and every Zod rendering in `$defs` by `$id`.

**Every `$id` is the layer's publication identity, not this site's
address.** The schema base is `schema/` beside the document `publishedIdentity`
mints: `<site>/<stub>/schema/` for a layer with no `canonicalUrl`, and
`<canonicalUrl>/schema/` for one that declares its own. So the DAK layer's
contracts are `http://smart.who.int/base/schema/skills/…`, and this site stages
the bytes at `<site>/<dak-layer>/schema/` (§"Three questions that must not be
merged"). `publishedInstanceSchemas` in `kg-export.ts` is the one place
identity and builder meet, and the deploy and the gate both call it. A stored
`$id` in a source contract is never published: with a base the computed one
replaces it, and with no base the contract has none.

**The document links its index** with `conformsTo` (`dcterms:conformsTo`).
It does so exactly when `instance-exports.ts` writes one, which is when
`publishesInstanceSchema` finds the layer in the plan. The other two
exemptions carry no such link. **The host links its own
`<stub>.schema.json`**, the shared declaration schema, by the `$id`
`buildDeclarationSchema` mints with the same base. With no base there is no
`$id`, so there is no link: never a relative one.

**A skill links the contract its own layer publishes.** A skill held by a
planned layer gets `inputSchema` / `outputSchema` set to its contract's
`$id` as `publishedInstanceSchemas` mints it, which is the function the deploy
writes the file with. That holds in the layer's own document and in a
checkout-scope build that stacks it. A skill whose layer is not in the
plan, or whose contract gets no absolute `$id`, has no link: a guessed address
is worse than none. The host's own skills are unchanged.

#### Which Zod schemas are public

A layer's public schemas are **every exported const whose name ends in
`Schema` and whose value is a Zod schema**,
in the `.ts` modules (not `*.test.ts`) directly inside its schemas directory.
That directory is the layer's declared `schemas` graph if it declares one,
else `<root>/schemas/` by convention. The science layer and the IRIS replica
declare `sources/`, which holds JSON descriptors, so they publish none.

The rule is the suffix, literally. A Zod value named otherwise is not public,
and an export named `notASchema` matches if its value is Zod. A `*Schema`
export whose value is not Zod is not public either; the scan lists it as
`notZod` and it is not a failure. Publishing a schema says it is reachable,
not that it is stable; internal schemas may be exposed.

Each one is rendered with `namedJsonSchema` (`to-json-schema.ts`), as the
host's own schema documents are, and gets an `$id` under the same schema base
as the contracts. `scanInstanceZodSchemas` and `renderZodSchemas` in
`harness-schema-export.ts` do the work, and `scannedInstanceSchemas` in
`kg-export.ts` is what the deploy and the gate both call. Once the scan has
run, the index drops `"omitted": ["schemas"]`, so an index with no `zod/`
entries means the scan ran and found none. If the directory could not be
resolved, `omitted` stays.

**A failure fails the publish.** A module that will not import, an export the
converter cannot represent (`z.date()`, `z.custom()`), a value with
`safeParse` that is not a zod-4 schema, and two modules that collide on one
path are each reported. They go into the index as `unrendered`, so "not
rendered" never reads as "not there". `instance-exports.ts` still writes what
did render, then exits 1, which is how it treats a failed `kg-export`.
Logging the failure and exiting 0 would publish a partial `zod/` that reads as
complete.

**The host is left out.** Its schema documents sit directly in its own
directory, `<site>/<name>/`, not in a per-instance `<name>/schema/`, so it
gets no `zod/`.

**The JSON-LD document drops `schemas` from its own `omitted` once it links
the index.** Its module-level
`Schema` collector is still instance-bound and does not run for a foreign
layer. But "not looked for" is false when the schemas are published and
the document says where. Two cases keep `schemas` listed. One is a document
with no `conformsTo`: an exemption, or no base. The other is a layer whose
schemas directory cannot be resolved (`zodSchemaScanDetermined`, the scan's
own first step), because its index then says `omitted: ["schemas"]` too, and
the two must not disagree. The gate fails the day a layer's export lists a
`Schema` node, because nothing yet maps a module node to its per-export
renderings.

**Re-exports are public too.** The publisher imports each module and reads
every key, so `export { FooSchema } from "./x"` and `export { X as YSchema }`
are rendered. The gate's text half reads them as well
(`declaredExportNames`): `export const`, `export { … }` lists with or without
`from`, the name after `as`, and `export * as N`. A `type`-only export is not
a value and is skipped. A bare `export * from` is a **finding**. Its names
live in another module's text, so whether they are published cannot be
determined from this one, and could-not-determine is never green. List the
names in an `export { … }` instead.

### Named subgraphs, and the root index above them

- **Named subgraphs**: `<site>/subgraph/<HARNESS>/<PATH>/`, with
  `index.jsonld` (direct members as pointers) and `index.hydrated.jsonld`
  (every member inline, deep). **The harness root has `index.jsonld` only**,
  because a deep hydrated file there would be a monolith.
  `gen-subgraph-jsonld.ts` frames each layer from its OWN export, so no
  subgraph names a `cat-harness.jsonld#<foreign>` fragment. The tree is
  committed under `cat-harness/docs/subgraph/`, its `@context` is
  `<site>/ns/subgraph/v1.jsonld`, and heavy bodies are content-addressed
  payloads under `cat-harness/docs/payload/sha256/`, copied verbatim to
  `<site>/payload/`. `bootstrap` and `bootstrap-tools` publish their own
  subgraphs, and the repository index links them with `rdfs:seeAlso`. The
  contract: [`kg-export`](kg-export.md) §"Named
  subgraphs" and §"Payloads".
- **The root index**: `<site>/index.jsonld` and `index.json`, built at
  publish time by `root-index.ts` and never committed: a committed copy
  conflicts whenever two PRs change the set of harnesses. It names every declared layer at depth 1, with no node of
  any graph inlined. It exits 1, having written nothing, when a layer's
  export is not where its identity says, rather than publish a shorter map.

### What is never in a published graph

- **`fsh-guts`**, and every reference to it, is stripped from the KG before
  publication. The one list is
  `UNPUBLISHED_GRAPH_TYPOLOGIES` in `schemas/kg/cat-harness.ts`. Every emitter filters
  on it where the document is built, not at upload: `isPublishedGraphTypology`,
  `isPublishedDirectory` (a directory holding ANY unpublished kind),
  `isPublishedSkill` and `isPublishedSchemaModule`, plus a diagram's
  documentation prose (`publishableDocumentation`). The trashcan has its own
  document, `<site>/fsh-guts.jsonld`, from `fsh-guts-export.ts`. That is
  deliberate: a consumer may fetch it by name and must never arrive by
  following an edge. Mechanics: [`kg-export`](kg-export.md) §"`fsh-guts`
  NEVER reaches a published graph"; what belongs in it:
  [`fsh-guts`](fsh-guts.md).
- **A skill that declares `published: false`** in its front matter
  (`unpublishedSkills` in `known-skills.ts`). The name match and the
  declaration are two inputs on purpose: one asks whether a skill is NAMED
  after the trashcan, the other whether it SAID not to publish it.
- **The nodes of a `state` graph.** The export carries the declared Directory
  node and its `holdsGraph`. No collector in `kg-export.ts` reads a state
  graph's files. Where such contents are published, it
  is as their declared Subgraph node's own document (`todos.jsonld`,
  [`directory-conventions`](directory-conventions.md) §"Publishing a
  subgraph's contents"), as a SQLite slice built at deploy, or
  on a branch rather than the site (QA verdicts, on `qa-reports`).

### The gates

| gate | fails when |
|---|---|
| `check:published-instance-exports` | the deploy does not run `instance-exports.ts`, a workflow running it drops an exempt layer's own publisher, an exemption names no declared layer, or a published export fails or mints a relative `@id`; or, for a planned layer, a contract its skills name is not written to `<stub>/schema/`, the index is missing, the document's `conformsTo` is not the index's `$id`, or the document lists a `Schema` node the publisher does not render; or an exported Zod `*Schema` (read from the module text, re-exports included, confirmed Zod by import) is not written to `<stub>/schema/zod/` and listed in the index, a module has a bare `export * from` (undetermined), the publisher did not scan, or it reports an import or render failure |
| `root-index.ts` at deploy | a layer's export is missing; the deploy fails rather than publish a shorter map |
| `subgraph:jsonld:check` | the committed subgraph tree or its payloads are stale |
| `check:process-index` | a declared BPMN has no `Process` node in the published subgraphs |
| `kg-export.test.ts` | the published graph holds a forwarding node, or a published `@id` dangles |
| `fsh-guts-unpublished.test.ts` | the string `fsh-guts` appears anywhere in the built export |
| `check:node-iris` | a node's identifier is not its file's path under the release address (§"The release site") |

## What a consumer may assume of a draft

- **That the id is stable.** It is the one thing that does not move.
- **That the version distinguishes snapshots** — and nothing more. It carries
  no promise that a snapshot remains fetchable, or that anyone announced it.
- **Nothing about availability.** No registry, no tarball, no announcement.
  Draft is not "published somewhere quiet"; it is "the process that would make
  this depend-on-able has not been built".

A layer that wants to be depended upon from outside does not declare its
way there. It waits for the process, which is somebody's work and not a field.

## Do not

- **Do not infer a publication state from evidence.** A `canonicalUrl`, a
  GitHub Release, a Pages deployment or a `dependsOn` naming this layer are
  all things that exist for drafts too. Inferring from them erases the
  difference between "decided" and "nobody looked".
- **Do not mint an id for something that already has one upstream.** Record
  theirs as data, mint ours under the namespace above, and keep them apart.
- **Do not restate this skill in a work item, a proposal or `AGENTS.md`.** A
  restatement drifts from its source. Point here instead.

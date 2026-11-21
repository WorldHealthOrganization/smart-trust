---
name: kg-separation
description: >-
  Separate a Knowledge Graph into its own repository — as a CONTENT repository
  (files to read, no code) and a TOOLS repository (the code that writes and
  checks it) — once it is too large, or its consumers or cadence differ. The
  end-to-end method: the signals that trigger it, the preconditions, eleven
  stages each with the command that gates it, the owner's decision points, how
  identifiers, QA and publication move, how the parent consumes the result,
  rollback, and the post-move sweep that a move between the pair owes before
  the parent re-pins. graph-detanglement owns stages 1–3; this skill owns the rest.
  Bootstrap + bootstrap-tools and cat-harness + the tools layer are the worked
  examples.
---

# Knowledge Graph separation — the method

> Skill id: `kg-separation` · Package: `graph-management`
> Process: [`kg-separation.bpmn`](../../../processes/kg/kg-separation.bpmn)

This is the replicable method for separating a Knowledge Graph that is too
large to handle, or whose consumers differ, written from what the bootstrap
separation did.

[`graph-detanglement`](graph-detanglement.md) is the practice for **stages
1–3** (declare in place, detangle, isolate). Read it for those; this skill
points to it and does not restate it. Everything from "split the tools out" to
"the parent's copy is deleted" is here.

## When — the signals, and none of them alone

Separate when the graph is **too large to handle**, or when a **business
reason** separates it: *"split only where consumers or cadences differ"*. Size
is often not the reason — bootstrap is 33 files and left because its readers
and its release cadence differ from cat-harness's. Record the signals in the
work item before deciding:

| signal | how it is measured |
|---|---|
| files and bytes per layer | `git ls-files \| cut -d/ -f1 \| sort \| uniq -c` |
| clone cost | `bun run cat health` → `repository-size` |
| gate time a content change pays | `bun run cat gates` (the gate count and wall time) |
| merge contention | commits per day on `main`; PRs re-conflicted before merge |
| cohesion and cut of the candidate | `bun run cat kg:detangle` |
| wrong-direction edges **within one layer** — modules bucketed into the proposed repos by path rule | `check:partition` (its root is ONE layer; read the scope it prints) |
| wrong-direction edges **between layers** — checked against each one's declared `needs` | `bun run cat kg:detangle:direction`, blocking in CI |
| wrong-direction **references** — the prose axis, not the import axis | `check:reference-direction` |
| what the tools would drag along | the import cone of the would-be tools package (`check:tools-closure` once it exists) |

## An example pointing up is a mention, not a dependency

`check:reference-direction` holds that nothing names a layer that depends
on it. One kind of pointer does not break that rule: a lower layer citing a
source **as an example**, where the one copy of that source lives in a layer
above it. For example, a base IG layer's document kind and voice quote a draft
reference architecture whose library entry belongs to a folio above it; two
copies of one key break the bibliography build, so:

- **One copy.** The source's library entry lives only in the layer that owns
  it. The lower layer deletes its copy and never re-ingests it.
- **The lower layer keeps a pointer.** A document-kind source's `ref` is a URL
  to the owner's published library page (`DocumentKindSourceSchema` allows "a
  library entry id or a URL"). A voice source names the owning repository in
  `instance` and adds its `url`. A quote keeps its `libraryId` and
  `sectionId`.
- **It is checked where the copy is.** The lower layer cannot read the
  sections, so its quote check reports such a quote as "an example held by
  <repository>, not checked here". That is not a pass and not a failure
  (https://github.com/litlfred/smart-base/blob/main/scripts/gen-dth-term-findings.ts, `EXAMPLE_POINTERS`).
- **It is a mention.** The lower layer's build does not need the higher layer,
  and nothing it runs reads through the pointer. The URL form is already an
  address under `check:reference-direction`'s URL exemption ("a location is
  where a thing is, not a dependency on it"). A pointer that something would
  need to resolve in order to build is a dependency, and the content moves up
  instead.

## Preconditions

1. **Names agree before the cut** — directory, declared `name`, package name.
   A rename after the cut is a cross-repository change.
2. **One directory per layer**, so extraction is one move, not a sift.
3. **Every gate that guards the boundary has been watched failing** — plant a
   violation, see it red, remove it. A boundary gate can pass while guarding
   nothing: unable to fail, blind to side-effect imports, or blind across
   layers.
4. **The owner's decisions are recorded in the work item** (the list below).
5. **"Generated output is the contract" is written down**: what crosses the
   boundary is the generated file, and any tool may produce it.

## The pair: a content repository and a tools repository

A separated Knowledge Graph is two repositories, not one.

| | content (`<name>`) | tools (`<name>-tools`) |
|---|---|---|
| holds | files to read — `.md`, `.json`, `.bpmn`, generated schemas, READMEs, diagrams | the code that writes and checks the content — Zod sources, generators, README/diagram writers, content checks |
| code | **none** (FR-7 — a reader needs nothing installed) | yes, with a declared, minimal dependency set |
| depends on | nothing | the content, and nothing above it — `check:tools-closure` |
| is used by | the parent harness, pinned | the content's own checks, and the parent (a package) |

The rules of the pattern:

- **The Zod source moves DOWN into the tools repository** — not up into the
  harness. Zod in the harness makes a content release wait on the harness,
  which itself needs the content: a cycle.
- **The tools repository owns the content checks AND the README and diagram
  writers** — one copy, which the parent harness also calls. It is **not** a
  second harness: a content Knowledge Graph declares no visualisers. It is one
  toolset over swappable content, so a different visualiser is a different
  toolset.
- **Every tool is a script an agent runs as the actor in a process step.**
  Agentic first. A GitHub Actions workflow may be **described, but ships
  disabled**, and nothing that costs money runs unless the owner asks.
- **Harness output ABOUT the content stays with the harness** (hosted): its
  QA verdicts (`kgQaHomeFor`), translation templates (`translationsHomeFor`),
  exported graph and glossary ledger. The content repository carries only
  what its own checks need.

### Staged content with no tools repository yet — the finding, not the silence

A layer can be planned as a content repository before its `-tools` pair
is authorised. Declare it — `separation: "content"` in `<name>.json`; the
content half of an existing pair is read from the tools layer's `supports`
and needs nothing — and kg:audit's `content-instance-holds-code` records a
finding naming every code file still inside it. It is a `minor` QA
**warning**, not a failure, because the tolerated set is small; a warning still
names each file, so the violation is never silent. The remedy splits by what
the code is: **generic** code (it works for any instance of its kind — any
DSpace catalogue, any PDF) moves into the platform and takes the layer root
as an argument; **layer-specific** code waits for `<name>-tools`.

## The stages

Each stage names its lane (a role in `scenarios/roles.json`) and
the command that gates it. A stage is done when its gate is green, never when
the work looks finished.

| # | stage | lane | gate |
|---|---|---|---|
| 0 | Brief, measure the signals, claim | `authoring-agent` | signals in the work item; `bun run cat beans:claim <id>` |
| 1–3 | Declare in place, detangle, isolate | `authoring-agent` | [`graph-detanglement`](graph-detanglement.md) — all its gates |
| 4 | **Identity**: `name`, `version`, `iriBase`, `needs`, `nodeSchemas` in the declaration; move the base once | `platform-authoring-agent` | `iri:sync -- --from <old base>` then `iri:sync:check`; `check:node-iris` |
| 5 | **Hosted outputs out** of the content | `platform-authoring-agent` | the content leak test's pending list is empty |
| 6 | **Split content from tools**: create `<name>-tools/` as a sibling, move the code, cut its import cone | `platform-authoring-agent` | FR-7 (content holds no code); `check:tools-closure`; generated files byte-identical before and after |
| 7 | **Publication plan**: every identifier the content mints is a file some step publishes, at `/v<major>/` | `publication-manager` | `check:node-iris`; the site layout in [`instance-publication`](../kg-core/instance-publication.md) §"The release site" |
| 8 | **Rehearse standalone**: copy content + tools alone into a temporary directory and run the tools' checks there | `build-pipeline` | green with nothing else on the path; an empty tree exits non-zero |
| 9 | **Authorise** — report what moves, sizes, what breaks, and wait | `administrator` | the owner's answer ([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)) |
| 10 | **Seed**: the owner creates the repositories; once the source has settled, seed `main`, then the content and tools as reviewed PRs, with history | `administrator`, then `authoring-agent` | `bun run cat seed:ready --layer <name> --rehearse` answers `settled` for each layer, at seed time; then the seeding PRs reviewed and green |
| 11 | **Parent consumes, additively**: pin (a SHA while staging, a version once released), repoint imports, keep the parent's copy. After any move of files between the pair, run the post-move sweep first ([below](#after-a-move-lands--the-post-move-sweep)) | `platform-authoring-agent` | the parent green with the dependency declared; `check:published-refs`; every gate in the sweep table |
| 12 | **First release**: tag, publish `/v<major>/` | `publication-manager` | `check:version-bump`; every identifier dereferences (`publish-verification` (opt-in `cat-harness.sdlc`)) |
| 13 | **Cutover**: the one commit retiring the parent's copy into [`fsh-guts`](../kg-core/fsh-guts.md) as a verified archive (the deposit `state:seed --cutover` makes: it must extract to the exact tree removed, with a provenance note), deposited into the PARENT's fsh-guts before the removal, frozen, never refreshed or rendered: a relocation, not a deletion ([`sub-kg-lifecycle`](sub-kg-lifecycle.md) stage 13 has the steps) | `administrator` | only after 11 and 12 are green; DONE only when `bun run cat separation:cutover:check --site`, run in the separated repository, exits 0 (Tool `separation-cutover-check`: mounts, declarations resolve, no monorepo wiring, layer direction, the site builds from the mounts alone) |
| 14 | **Independent refinement**: each new release adopted by the parent as a reviewed step | `authoring-agent` | `upstream-version-adoption` |

**Nothing is committed to the new repositories before stage 10**, and stage 10
starts only when the owner says so. Until then the pair is staged as sibling
directories in the parent (`bootstrap/`, `bootstrap-tools/`).

### Ready to seed? — asked at seed time, not at rehearsal

A seed is a snapshot: one commit that names the source sha, with no history.
**Every open PR whose diff touches the layer when the snapshot
is taken is orphaned into the monorepo**: after cutover its change is in
neither the seed nor anywhere that reads it. Stage 8 asked whether the layer
stands alone, but the tree has moved since. So `GW_SeedReady` sits between
creating the repositories and seeding them, and asks again:

```sh
bun run cat seed:ready --layer cat-harness --rehearse --text   # exit 0 settled, 1 not yet, 2 unknown
```

| criterion | `not yet` when |
|---|---|
| heavy movers | an open PR labelled `heavy-mover` touches the layer or the next one up |
| next layer | any open PR touches the next layer up, which imports this one |
| layer load | more than five open PRs touch the layer |
| moves | an open PR deletes a file in the layer, or renames one into or out of it. A generator's own names do not count: an `owned-tree` path in `merge-conflict-patterns.ts` (content-hashed payloads, rail data) is renamed by every regen, so moving one changes what no seeded path means |
| standalone | `bun test` is red with only the layer and what it `needs` beside it, as sibling directories |
| upward paths | a path DECLARED in the layer — a Tool module, a QA criterion source, a render target — resolves only in a layer above it, so it breaks the day the layer stands alone |

**A test about the WHOLE CHECKOUT lives at the top.** A test that reads several
sibling layers at once, or the aggregate root itself (`.github/`, `.gitignore`, the root
declaration, `beans/`, `todos/`, `memory/`, `fsh-guts/`), is red in every layer
it is placed in, so it goes in the root layer's DECLARED test home —
`folio-assistant-tests` in `folio-assistant.json`, at `test/` — never in a layer
and never at a path a runner hardcodes. Whatever names every layer belongs at the
top, so each layer below stays standalone-green. Split a file when only some of
its tests read the checkout, keep the fixture tests with their layer, compose
the moved paths from `ORIGIN_DIR` (the directory the test was written in), and
move a corpus describe whole when it carries a vacuity guard: a sibling left
behind passes standalone over nothing.

**A test reading an UPPER layer's files moves to that layer.** It is
red standing alone for the same reason, one level down: the file it reads is
not in its layer's closure. It goes in the upper layer's DECLARED test home,
which may import the lower layer — never the reverse — and it is split, pointed
back to and composed from `ORIGIN_DIR` exactly as above. Check first that the
file it reads really IS the upper layer's: a path written from the checkout root
(`cat-harness/src/…` read relative to the working directory) is red standing
alone over a file the layer does hold, and the fix there is to resolve it from
the test file, not to move it.

**A test that reads the checkout's GIT asks which of two things it is.** A
standalone layer is a fresh clone with no `origin` and one commit, so a test
handed this checkout's remote, `HEAD` or `origin/main` fails there on a missing
input. A test of LOGIC that merely reads git — address derivation, an upload
URL's shape, a commit IRI, resolving a short sha — builds a throwaway repository
whose facts it sets (`gitFixtureRepo` in cat-harness's
`test/support/git-fixture.ts`) and passes that root, with every assertion
exactly as strict; a function that resolves its root internally gains an
optional root parameter defaulting to today's. A check that THIS repository is
configured right — its own Pages address, its committed pages' banners — keeps
its assertion verbatim and moves to the top-level test home above.

**`upward paths` counts what breaks, not what is out of sight.** It counts
declared paths that resolve above the layer, not dependents discovery cannot
find: discovery is checkout-local on purpose, so a count of what it cannot see
never reaches zero, and the risk is paths, not layers.

**A seeding pair is not upward.** A higher layer's Tool nodes may resolve
into their implementer below through `needs`; the two are seeded in the same
step, so none of those paths can break on seeding day. The HIGHER layer
says so, `seedsWith: [<lower>]` in its declaration, because a lower layer
naming one above it is the wrong direction. `seed:ready` states such paths in
its note and does not count them; a path into any other layer above still
counts.

Four things to keep straight:

- **The layer map is read off the declarations**: `livesAt.path` is the
  directory, the longest `needs` chain is the depth, and the next layer is
  every layer one level up that needs this one. Nothing in the tool names
  a directory.
- **Every threshold is in the decision table**,
  `processes/kg/decisions/seed-readiness-gate.dmn`. The script works out each
  criterion's verdict by evaluating the table with the other facts at zero, so
  changing "five" is a one-line edit to the table.
- **`heavy-mover` is a label a person applies.** With none on the layer, the
  criterion passes. If the label cannot be read, the answer is
  `could-not-determine`.
- **The rehearsal runs only on request, with `--rehearse`.** It copies the
  layer and its `needs` into a scratch workspace (~150 MB and ~8,000 tests for
  cat-harness) and refuses to start with less than 3 GB free. Without
  `--rehearse`, the standalone criterion is `could-not-determine`, so
  **`seed:ready` cannot answer `settled` until a rehearsal has run.** That
  consequence is the one constant `SETTLED_REQUIRES_REHEARSAL`.

Could-not-determine is never clean. GitHub lists at most 3,000 files per PR,
so a criterion that the unseen files could change is undetermined, and the
gateway answers `unknown` and stops. An unknown only withholds `settled`, though.
It never hides a finding that is already certain, so the table tests the
`not yet` rows first. `not yet` goes to *Drain*: land, close or re-target the
PRs it named, then ask again. The tool only reports. It never seeds, labels
or comments.

## The owner's decisions

An agent asks these; it does not settle them.

1. Separate at all, and where the boundary is — after the signals are measured.
2. The address base for the extracted graph's identifiers: under the parent, or
   the new repository's own.
3. Where verdicts about it live: hosted in the harness, or in the content.
4. What the tools repository owns, and how its checks run (agent, package,
   described workflow).
5. Authorise the extraction (stage 9).
6. Whether the first release is a draft with a tag, or the first formal
   publication ([`instance-publication`](../kg-core/instance-publication.md)).
7. The cutover (stage 13).

## Identifiers and versions

One `iriBase` and one `version` in the declaration. Identifiers a program reads
and pages a person reads are both `<iriBase>v<major>/…`; the exact release is
the pin's (`bootstrap-tools/schemas/release-iri.ts`). A base move is
`bun run iri:sync -- --from <old base>`, once. A `$schema` tag carries its
schema's own semver. The exported graph's own `@id` moves only when the new
repository actually publishes. A published node's identifier must be its file's
path (`check:node-iris`).

## Versions of the pair — same scheme, same start, then independent

- **At the split, both start at the content's current version**, for
  simplicity — bootstrap
  was `0.1.0`, so bootstrap-tools starts at `0.1.0`.
- **After that each is versioned on its own**, by the same rules: semver, the
  bump computed from the exported surface (`check:version-bump`).
- **Tags are plain `v<major>.<minor>.<patch>` in each new repository**: a
  standalone repository holds one layer, declared at its
  root, so the tag needs no name. `check:version-bump` reads the plain form
  only there; a repository of several layers — the parent while the pair
  is staged — keeps `<name>-v<major>.<minor>.<patch>`, because a plain tag
  could not say which layer it released.
- **A tools release says which content versions it handles** as a list of
  supported MAJOR versions (`bootstrap: [0]`), never a range expression —
  `instance-versioning` rule 2 forbids range syntax, and within one major a
  newer minor or patch only adds (`tagCompatible`). A tool asked to work on a
  content major it does not list refuses rather than guesses.

## How the parent consumes the pair

**No git submodules, ever** (`remote-mount.md`).

| mechanism | when | details |
|---|---|---|
| **Remote mount** (`remoteMounts`) | staging & development | A declared directory fetched at a pinned 40-character SHA with a committed lock (`index.lock.json`) and consent record. Downstream checkout `.gitignore` automatically ignores mounted directory trees. |
| **NPM KG retrieval** (`kg-retrieve-npm`) | packaged distribution | `package.json` declared in `<instance>.json` (`role: "package-manifest"`). Tarball packed via `pack-tarball` with a `folio-binary-release/v1` integrity record, downloadable via npm install or GitHub binary releases (unhydrated source vs hydrated store). |
| **Package import** | published tools | The parent imports the tools' Zod schemas and pipeline writers as an npm package dependency. |
| **Upstream pins** | maintenance | `upstream-pins.json`, maintained by `upstream-version-adoption.bpmn`. |

### Separation lessons

1. **Downstream Gitignore Contract**: When remote mounts populate a layer directory in the consumer repository, the consumer's `.gitignore` must ignore the mounted paths. Otherwise, git treats external files as uncommitted local files. `index.config.json` automatically includes all `remoteMounts` paths in the generated `.gitignore`.
2. **Folded Layer Aliases**: When a layer or subgraph is folded into another (e.g. `cat-openapi` folded into `cat-harness` as named subgraph `openapi`), external forks or dependencies may still carry `needs: ["cat-openapi"]`. `schemas/kg/harness-config.ts` maintains `FOLDED_INSTANCE_ALIASES` to resolve these.
3. **Asset Permission & License Validation**: Pre-separation audits must verify `library/withheld.json` and copyright gates. Materializing or mounting a separated catalogue without verified asset clearance causes 404s and broken links on published documentation.
4. **NPM Manifest in the KG**: `package.json` is an authored pre-packaging asset in the Knowledge Graph (`role: "package-manifest"`), and `.tgz` release tarballs are tracked as `folio-binary-release/v1` state documents with SHA-256 integrity digests.
5. **No Relative Directory Climbing Across Repositories**: Once separated into standalone checkouts, climbing `../..` escapes the repository boundary into `.claude/worktrees/` or the parent filesystem and fails with `Cannot find module`. All cross-repository imports MUST be authored as package imports (e.g. `@litlfred/cat-harness/...` or via package `exports`), or resolved through package specifiers / tsconfig paths, NEVER through escaping filesystem `../..` traversals.
6. **No Fixed-Depth Repository Root Assumptions (`REPO`)**: `const REPO = resolve(import.meta.dir, "..", "..")` points at the checkout root in a monorepo and above it in a standalone repository, so the script cannot find `<instance>.json` or scans sibling worktrees. Resolve the root dynamically — search upward for `<instance>.json`, `index.config.json`, or `.git`.
7. **Clean Standalone Manifest (`package.json`) and Tooling Scaffolding**: When extracting a layer to an upstream repository, `package.json` must be normalized:
   - Operational commands must live under `"scripts"`, not leftover monorepo `"checkoutScripts"`.
   - Script definitions must NOT hardcode monorepo subdirectory paths (e.g. `"bun run cat-harness-tools/scripts/..."` -> `"bun run scripts/..."`).
   - A standalone `tsconfig.json` must be present to prevent `tsc` from walking up to the monorepo root.
   - Explicit `dependencies` and `devDependencies` must be declared.
8. **Fan-Out Recursion Guard in `declaringInstances`**: When a mounted dependency carries its own nested `remoteMounts`, consumer remote fan-out must not mount sub-layers into roots that are already locked mounts of the parent checkout (`!lockedMountPaths(checkout).has(rel)`). Otherwise `remoteFanOut` mutates the child checkout's tree and `treeDigest` verification fails.
9. **Relative Directory Symlink Handling in Staging & Tarball Scripts**: Recursive copies (`cpSync(..., { recursive: true })`) of trees with internal symlinked directories can recurse forever. Staging, site compilation, and packaging scripts must copy symlinks with `{ dereference: false }` or use archive utilities (such as `tar` or `rsync -a`) that preserve symlink references.
10. **Purely Declarative Ontologies vs. Companion Toolsets (FR-7)**: Purely declarative base repositories (such as `litlfred/bootstrap`) contain zero runtime execution code, zero test suites, and zero `package.json` manifests (FR-7). All graph compilation (JSON-LD export, BPMN diagram rendering, site staging, and schema validation) is executed by the companion tooling repository (`bootstrap-tools`). The declarative repository marks its render exemption (`renderExemption: true`) in its root manifest, and tooling scripts accept an explicit target repository argument (`--repo <dir>`).
11. **Toolchain Decentralization (`package.json`, `tsconfig.json`, `bunfig.toml`)**: Tools and harness subgraphs must possess full standalone toolchain autonomy. `package.json` must be a standalone package manifest (e.g. `@litlfred/<tools-layer>`), `bunfig.toml` defines test preloads per layer, and `tsconfig.json` must set `"noEmit": true` and omit `rootDir`/`outDir` to prevent `error TS6059: File is not under rootDir` when cross-subgraph schemas or utilities are imported. See `bun-use`.
12. **Monorepo Coordinator Demotion**: Once tools and code are extracted to their respective packages, the root `package.json` is demoted to a private coordinator (`"private": true`) with narrowed `tsconfig.json` (`test/**/*.ts`). The root platform coordinates development workspaces, mounts, and integration tests, but never directly exports or publishes tool implementations.
13. **Ephemeral File Purging and Root Hygiene**: Ephemeral generated directories (`_kg/`, `build/`, `test-results/`) must NEVER be committed to the root repository or left unignored. Build outputs belong to the tool that produces them.
14. **Layer Memory Preservation**: Root directories `beans/`, `todos/`, and `fsh-guts/` are the layer's own durable working memory (the agent's plan, the user's todo queue, and the archival store). They are never overlaid across layers, never extracted to downstream packages, and stay at root by design.
15. **A cutover is not done until the layer has re-pointed and can publish itself**: `livesAt` is not a comment — `remote-mount.ts` takes `livesAt.path` as the mount path and `seed-ready` reads it as "still staged". A path that was only ever a mount inside the parent's site build serves nothing on its own, and generated pages keep absolute links to the parent's paths, which 404 once the bytes move. Before stage 13: `livesAt` is gone, `iriBase` is declared, and the layer's own site builds from its own repository.
16. **The replayer must never live inside a layer it replays**: if every workflow (and every downstream folio's staging build, through a reusable workflow) bootstraps by running a script inside the directory being retired, the cutover breaks the first step of every job. **Before stage 13**, grep every workflow the parent ships for paths into the directory being retired, and give the parent a bootstrap entry point that lives in the parent and needs nothing mounted (a dependency-free `.github/mount-from-lock.sh` that fetches the pinned replayer).
17. **A downstream's CI is part of "green" for a cutover**: a reusable workflow called `@main` (`uses: litlfred/folio-assistant/.github/workflows/folio-staging.yml@main`) runs the PARENT's current workflow in the DOWNSTREAM's repository. A cutover that is green in the parent can therefore be red in every folio at once, and the red lands on whatever pull request the folio author opens next — it reads as their failure. Stage 12's "green" includes one dispatched staging run of at least one downstream folio after the cutover commit.
18. **A separated checkout must run its own tests and type-check its own subgraphs**: run them in a fresh standalone clone. A test that reads `<checkout>/../package.json` fails with `ENOENT` outside the composed tree (lesson 6 by another route), and a `tsconfig.json` whose `include` omits named subgraphs (`openapi/`, `archimate/`) is green while never reading them. A test or type-check that silently depends on the composition, or silently skips part of the repository, is not evidence the separated repository works.
19. **The kinds a declaration is judged against come from the checkout being read, not from where the harness module sits**: the graph-typology registry reads the checkout under inspection first (`defaultTypologyRoots`; `$REPO_ROOT` still overrides), then its own; a kind both declare is shadowed and reported, never merged.
Otherwise two layouts give two answers about one correct declaration. Every path a declaration names is resolved in one run by `check:declaration-resolution`, and `separation:cutover:check` uses it as its `declarations` condition.

## After a move lands — the post-move sweep

Moving files between the pair is one reviewed commit in each repository;
making the repositories that consume the move work again is most of the work.
Run the sweep after a move lands and before the parent re-pins (stage 11), and
do not call the move done until every gate in this table is green in a composed
checkout at the matched pins.

When another layer links into the moved path, declare the move first, so the
layers can re-pin in any order:
`two-phase-move`.

| what still names the old home | the gate that catches it | the fix |
|---|---|---|
| A Tool node's `invoke.shell` | `kg:audit` criterion `tool-invoke-path-resolves` (CRITICAL) | rewrite the invokes in each `tools/<id>/<id>.json` |
| Prose and commands in skills, guides, READMEs, BPMN documentation, workflows | `check:command-paths` | the rewrite rule below |
| A script's own usage string | `check:usage-paths` | rewrite it in the receiving layer |
| Printed and RUN commands: "Run: …" remedies, generated banners, shell hooks, an e2e global setup | `check:published-instance-exports`, `check:invocation-parity`, `security:gate` (all three match paths by text), and the unit tests | rewrite the strings in the receiving layer |
| A wrapper generator's list of the scripts it wraps | `bat:sync` / `bat:sync:check` (the writer errors on the first missing file) | update the list |
| Partition rules naming moved files | `check:partition` ("exact rule(s) name a file that is not in …") | remove the dead rules |
| A kind-validator node pointing at a moved module | `check:kind-validators:require-all` | open: how a node in one layer names a module in the other |
| A writer's claims in `qa-refresh`: files the writer used to *rewrite* became output it *writes* | `qa:refresh` ("N file(s) no declared writer claims") | update the writer's claims |
| A visualiser route a generator computed by hand | `uml:overview` inside `skill:register` ("no glossary page at …") | use the declared route (`declaredRoute(<core>, "glossary-page")`) |
| A browser bundle importing a node-only module through a package import | `navbar:assets` ("Browser polyfill for module node:url …") | move the constant into a node-free module |
| A directory declared inside another declared directory in the receiving layer | `check:layout-norms` (it stops `qa:refresh`) | move it out of the enclosing declared directory |
| A file left in BOTH layers | `slice:sqlite` / `slice:sqlite:check` (the KG export mints the same IRI twice and the slice dies on a UNIQUE constraint); `node-kinds:check` and `kg:export` do not refuse a duplicate on their own | delete the copy in the layer that no longer owns it, archived to `fsh-guts/retired/` |
| Paired artefacts a move split across repositories | `skills:docs` ("page(s) produced by NO source"), `check:declared-dirs` ("absent — declared and not on disk") | pin the receiving commits WITH the removing one (below) |

### The rewrite rule

Rewrite a path **only where the file exists in the destination and not in the
source**, and **never in a record**. The first half keeps a placeholder or a
typo from turning into a different wrong path; the second keeps a file that
moved and was later re-created from being redirected. Records say what was true
when they were written, so they stay as written: proposals, todos, agent
memory, work items, provenance (library figures, terminologies), upstream pins,
vocab mappings, QA results and test fixtures. Generated files are rewritten by
re-running their generators, never by hand.

The rule is a Tool: **`rewrite-moved-paths`**
(`bun run cat paths:rewrite-moved --from-name <old> --from-root <dir>
--to-name <new> --to-root <dir> --prefix <moved dir> … [--keep <glob>]`). It
reports with file and line by default, applies with `--write`, and with
`--check` is the gate for a sweep that should be finished. Its test proves it
never opens a proposal, a memory or a fixture.

### Pin the pair together, and record each consent first-hand

**A move that removes files from one repository must be pinned together with
the commit that adds them to the receiving one.** A parent that pins the new
source with the OLD pin of a receiving repository has the moved artefacts in
neither, and the gates say so only indirectly. Before a re-pin, list what each
new commit removes and confirm the receiving repository's pin contains it.

**Every pin is a trust decision with its own consent** (rule H8,
`remote-mount`): `trust.consent` names who, when, the exact ref and the
evidence, and `mount:remote` refuses a ref nobody consented to. A consent
relayed by another agent is not the owner's consent, so it is not recorded
from the relay alone; record it when the owner's answer to a question naming
the exact SHAs is relayed verbatim with its time. A standing consent ("pin any
main commit of these repositories that includes a fix merged in this session,
listed in the PR") covers only the repositories and the window it names, and
each pin made under it is listed where the owner will read it. When a
consented ref turns out not to do (a consented `main` with no declaration of
the layer), do not substitute another ref: keep the previous pin and report
it.

### The order that worked, and the rules for several sessions at once

1. **Fix the tools** (the receiving layer): paths, the checks that matched
   paths by text, bundles, layout.
2. **Fix the content** (the source layer): prose, Tool invokes, declarations,
   partition rules.
3. **Regenerate the content at matched pins**, in a composed checkout laid
   down from the parent's lock, to a fixed point (`qa:refresh` COMPLETE, then
   `bun run cat regen`, then every `--check` green on a fresh lay-down).
4. **Re-pin the parent** to those commits.
5. **Run `bun run cat gates`** on a fresh lay-down of the parent.

When several sessions work on one separation at once:

- **Hold pushes on a branch another session is superseding**; hand over what
  is unpushed instead of racing it.
- **Announce which gates each session takes** before starting, and re-check
  the open PRs and recent merges of a repository before opening one there.
- **Verify on the lock of the PR that will land**, in a fresh scratch copy,
  never on another session's checkout.
- **A measurement-only workaround stays local** (for example a baseline entry
  needed to run `qa:refresh` while a decision is pending), is never committed,
  and is deleted once the real fix lands.

## Rollback

Until the parent is green with the extraction declared, the extraction is
additive and the parent keeps its copy; the cutover commit is the one unit
worth reverting, and since the copy is ARCHIVED in the parent's fsh-guts
rather than deleted, the archive restores the exact tree that was removed. After a release, a tagged version is never reused: roll back
with a new patch release and move the parent's pin back.

## Worked examples

### 1. bootstrap + bootstrap-tools
- Stages 1–5: wrong facts, folio-only names and root-relative paths removed;
  graph typologies, `$schema` tags and QA moved out; IRIs under
  `https://litlfred.github.io/bootstrap/` with semver.
- Stage 6: `bootstrap-tools/` created as a sibling; the Zod source moved down;
  the import cone cut to `zod` only; `check:tools-closure` and
  `check:node-iris` added, each watched failing on a planted violation.

### 2. cat-harness + the tools layer
- `cat-harness` (`litlfred/cat-harness`): owns the knowledge graph, declarative
  schemas, content adapters, and BPMN/DMN processes.
- The tools layer: owns the MCP server (`src/server.ts`), concrete tool
  implementations (`src/tools/`), ambient moddle type definitions (`types/`),
  standalone `package.json`, `tsconfig.json`, and `bunfig.toml`.
- Consumed through an `index.config.json` remote mount, locked in
  `index.lock.json`. The move of the harness's remaining code into the tools
  layer is the case the [post-move sweep](#after-a-move-lands--the-post-move-sweep)
  was written from.

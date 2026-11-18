---
name: sub-kg-lifecycle
description: >-
  A sub-KG is a knowledge graph staged as a directory inside a harnessed
  repository, declared as its own layer, that may later leave for a
  repository of its own. The lifecycle: declare it in place, grow it, stage it
  for separation (one import seam, the separation guard, a self-contained
  rehearsal), and then, each behind an explicit owner confirmation, create the
  repository, copy the staged contents in with history, re-point the
  declaration, verify on a fresh clone and delete the in-repo copy. The light
  sibling of kg-separation: use this for a DATA layer that leaves whole, and
  kg-separation when a graph must split into a content repository and a tools
  repository.
---

# Sub-KG lifecycle — staged here, separated later

> Skill id: `sub-kg-lifecycle` · Package: `graph-management`
> Process: [`sub-kg-lifecycle.bpmn`](../../../processes/kg/sub-kg-lifecycle.bpmn)
> Stages 6 to 13 are drawn as the phases it shares with `kg-separation`: [authorise](../../../processes/kg/kg-separation-authorise.bpmn), [move](../../../processes/kg/kg-separation-move.bpmn) and [cut over](../../../processes/kg/kg-separation-cutover.bpmn).

A sub-KG created inside a folio or harnessed repository can move to its own
repository later: once it is staged for separation, a new repository is created
and the staged contents are copied into it.

## Which skill, this one or `kg-separation`?

| the graph | use |
|---|---|
| holds **data** — an artefact index, generated pages, a library, a folio — and leaves **whole** | **this skill** |
| holds data **and the code that writes it**, and the two must become a content repository and a tools repository | [`kg-separation`](kg-separation.md) — its fourteen stages, the pair, FR-7 |
| is not yet a graph at all — tangled into its host | [`graph-detanglement`](graph-detanglement.md) first |

The two share their gates on purpose. `Ready to seed?` here is the same
decision table, `seed-readiness-gate.dmn`, evaluated by the same command, and
the owner's confirmations here are the same rule,
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md).
What this skill adds is the part `kg-separation` does not cover: a sub-KG
**born** in the host, with no tools pair, that leaves in one piece.

## How a sub-KG is born — the intent question

A content type's own creation skill asks whether the new thing goes in a new
repository or inside this one, and routes here for the second answer. For a
folio in general that is [`getting-started`](../../conduct/conduct-core/getting-started.md)'s
`add-folio` branch. A harness above this one may own a creation skill for its
own kind of graph; ask `skill_list` for it rather than improvising.

**In-repository is the cheaper default** whenever the session is already in a
harnessed repository. Every stage up to 6 is reversible with `git revert`, and
nothing outside the repository changes until stage 7. A new repository is the
first irreversible, outward-facing act, and this lifecycle puts it behind a
confirmation rather than at the start.

## The stages

Each stage names its lane (a role in `scenarios/roles.json`) and what decides
that it is done. A stage is done when its check is green, never when the work
looks finished.

| # | stage | lane | done when |
|---|---|---|---|
| 0 | Brief, claim the work item ([`opening-brief`](../../conduct/conduct-core/opening-brief.md)) | `authoring-agent` | work item claimed with `bun run cat beans:claim` |
| 1 | **Declare it in place** | `authoring-agent` | the declaration parses; `instance-repositories.test.ts` green |
| 2 | **Grow it in place** | `authoring-agent` | the content type's own gates |
| 3 | **Push generic down** | `platform-authoring-agent` | `check:import-direction`, `check:reference-direction`, `check:process-bindings` add nothing |
| 4 | **One import seam** | `platform-authoring-agent` | every climb out of the directory goes through `<name>/platform.ts` |
| 5 | **Rehearse self-contained** | `build-pipeline` | `bun run cat seed:ready --layer <name> --rehearse` |
| 6 | **Report what would move** | `authoring-agent` | the report is in the work item (as `kg-separation` stage 9) |
| 7 | **Owner confirms: create the repository** | `administrator` | an answer, recorded in the work item |
| 8 | Create the repository | `administrator` | it exists, empty, and was read before writing |
| — | `Ready to seed?` | `build-pipeline` | `seed-readiness-gate.dmn` answers `settled` |
| 9 | **Copy the staged contents in, with history** | `authoring-agent` | a reviewed PR on a branch of the new repository |
| 10 | **Re-point the declaration** | `platform-authoring-agent` | the host is green consuming the new repository |
| 11 | **Verify on a fresh clone** | `build-pipeline` | the new repository's gates green from `git clone` in an empty directory |
| 12 | **Owner confirms: delete the in-repo copy** | `administrator` | an answer, recorded in the work item |
| 13 | Cutover commit | `administrator` | one commit, revertable (as `kg-separation` stage 13) |

### 1 · Declare it in place

A directory `<name>/` at the host's root, with `<name>/<name>.json`:

```jsonc
{
  "name": "<name>",
  "repository": "<owner>/<name>",            // the PLANNED home; IRIs key on it
  "livesAt": { "repository": "<owner>/<host>", "path": "<name>" },  // where it sits TODAY
  "version": "0.1.0",
  "needs": ["<the harness it instantiates>"],
  "directories": [ /* only directories that exist, each with its graphTypologies */ ]
}
```

- **`repository` differs from `livesAt.repository`** — that difference is
  what makes the directory a *staged* layer, and it is what the separation
  guard and `seed:ready` read. Nothing lists the staged layers by hand.
- **The directory may sit anywhere** — a root sibling is the convention, but
  the tools read `livesAt.path`, so `folio/<name>/` works the same.
- **Scaffold it with `init-folio --staged <path>`**:

  ```sh
  bun run cat init-folio --staged <path> --title "<title>" \
    --repository <owner>/<name> --needs <harness>   # --host-repository when origin cannot say
  ```

  It writes exactly two files, `<path>/<name>.json` and an empty
  `<path>/platform.ts`, and nothing at the host's root;
  `init-folio-staged.test.ts` snapshots the whole host tree to hold that.
  **Never `--instance` inside a host**: it writes a repository's worth of
  scaffolding (`AGENTS.md`, `.mcp.json`, a work items store, a session hook; 15
  files, measured with `--dry-run`). `--instance` is for stage 8's repository.
- **Declare a directory with its files, in one commit**: a declared-but-absent
  directory is scanned as empty and reported clean.

### 3 · Push generic down — before the seam, not after

Move everything generic into the harness below, consolidate what the sub-KG
needs into its own harness, and only then seed. The other order copies generic
code into a repository that has to give it back.

Wrong-direction edges hide in **declarations and data**, not only in imports:
a skill definition naming a package one layer up, a `dependsOn`, a publication
target enumerated in an input schema, prose links, a `needs` edge to an empty
layer. So run all three direction checks, not one.

### 4 · One import seam: `<name>/platform.ts`

Every symbol the sub-KG uses from the platform is re-exported from **one
file**, and nothing else in the directory climbs out of it. On the day it
leaves, re-pointing the platform is a one-file edit instead of a sweep.

`cat-harness-tools/scripts/tests/instance-separation-imports.test.ts` is the
guard. It covers **every** layer whose `repository` differs from its
`livesAt.repository`, not only those that opted in, because an opt-in guard
is silent for exactly the layer that has no seam. Layers other layers
build on are an explicit, checked exemption, and a layer that still climbs
has a ceiling that may only fall.

**Create the seam at stage 1, not here.** It costs one file on day one, and
every later climb is a reroute. A merge from `main` is where new climbs arrive,
so a red guard after one is the expected signal to reroute, not a
regression.

### 5 · Rehearse self-contained — run the gates, do not scan

```sh
bun run cat seed:ready --layer <name> --rehearse --text   # exit 0 settled, 1 not yet, 2 unknown
```

It copies the layer and what it `needs` into a scratch workspace of sibling
directories and runs the tests there. It is a run rather than a reading
because:

- **a static import scan misses files the gates load at run time** — a JSON
  code list read by URL, for one;
- **renaming the directory can change every generated page**, when a URL
  prefix or a chrome lookup keys on the directory name. Take the identity from
  the declaration's `name`, never from the path, and check for that before
  seeding into a different directory name.

### 7 and 12 · The two confirmations

Both are `userTask`s in the administrator lane, marked `relaxable="false"`,
and both follow [`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md):
the agent reports **what** would happen, **how large** it is and **how it is
undone**, then waits. Silence is not a yes. The questions are numbered, four
options at most, the recommended one first, with a stated default:

**Before stage 8:**

> `<name>` is staged and rehearses green: N files, M MB, history of K commits.
> Creating `<owner>/<name>` is visible outside this repository and is not
> undone by a revert. May it be created?
>
> 1. **Yes — you create it, and tell me when it exists** *(recommended)*
> 2. Yes — I create it *(only if this session has that permission)*
> 3. Not yet — keep it staged here
>
> **Default if you do not answer: 3.** Nothing is created.

**Before stage 13:**

> `<owner>/<name>` is green from a fresh clone and the host consumes it. The
> in-repo copy is N files. Deleting it is one commit, revertable.
>
> 1. **Delete the in-repo copy now** *(recommended)*
> 2. Keep it until the new repository's first release
> 3. Show me the file list first
>
> **Default if you do not answer: 2.** Nothing is deleted.

When the repository must be created by someone with credentials this session
lacks, the hand-over is `agent-handoff`:
one work item, one sentence for the person to relay.

### 9 · Copy the staged contents in, with history

The staged directory becomes the new repository's content **with its
history**: `git subtree split --prefix=<name>` in the host, then
`git subtree add` (or a merge of the split branch) in the new repository. It
goes in on a **branch, as a draft PR**, never straight to `main`. The new
repository's own root files — its declaration at the root, its config, its
`README` — are a second commit in the same PR, so the copy itself stays
byte-identical and reviewable.

`Ready to seed?` comes first, at seed time, because the tree has moved since
the rehearsal: every open PR touching the layer when the copy is taken is
orphaned. Its criteria and thresholds are in
[`kg-separation`](kg-separation.md) §"Ready to seed?", and not restated here.

### 10 · Re-point the declaration

| what changes | how |
|---|---|
| `livesAt` | removed in the new repository — absent means "sits at the root of `repository`" |
| the seam | `platform.ts` points at wherever the platform now is: a remote-mounted path, or a sibling checkout |
| the host | **remote mount** if the host imports code from the sub-KG — a `source.remote` layer in the host's root `index.config.json` ([`remote-mount`](../kg-core/remote-mount.md); never a submodule); **subscription** (`kg:subscribe`) if it only reads its content |
| pins | the host pins a commit while staging, a version once released (`upstream-version-adoption`) |
| its site | the new repository publishes and previews itself (`feature-staging`, *Which site*): `"site": { "agentRun": true }` in its `index.config.json` when an agent publishes it, plus whatever workflow its publisher layer's own creation skill requires (an IG's AST-cache refresh, for one) |
| its checks | `.github/workflows/harness-pr-checks.yml` calling the tools layer's `layer-pr-checks.yml`, so its gates run on every pull request |
| its QA record | when it declares a `qa` directory with `storage` (`test/results/`, `cat/cat-harness/qa-reports`, keyed by commit): `.github/workflows/publish-qa.yml` calling the tools layer's `layer-qa-publish.yml`, so every push to `main` and every pull request publishes its results to **its own** qa-reports branch, and `test/results/` in `.gitignore`. A host reads them at the commit it pins. Without the job, the declaration names a store nothing writes |
| `.gitignore` | the mount block, written by the mount tool between its own markers. Never typed: a hand-written marker makes `remote-mount.ts` refuse (*markers unpaired*) |

**Copy these from a sibling repository of the same kind; never type them.** A
repository scaffolded by hand misses them, and its site cannot be built until
each is copied in.

The host keeps its own copy through this stage. The re-point is additive.

### 11 · Verify on a fresh clone

```sh
bun run cat sub-kg:verify-clone --repo <owner>/<name> --ref <seeding branch> --text   # exit 0 green, 1 red, 2 unknown
```

The Tool `sub-kg-verify-clone` clones the new repository into an empty
scratch directory with its submodules (and each `--sibling` beside it),
installs, and runs its own `gates` script, else its `test` script. An empty
tree, a failed clone or a repository with no gate is `unknown`, never green.
Nothing in a seed runs standalone until the seam is re-pointed, so a test that
climbs out (`Cannot find module '../../../<harness>/…'`) fails here. A
rehearsal in the host's scratch space is not this check; it shares the host's
`node_modules` and network.

The new repository's own site is part of this check:
`bun run cat stage:local --repo . --dry-run` from the
fresh clone must build. A refusal names what stage 10 left out.

## Stage 13: the frozen copy

After cutover the host keeps a **frozen** copy in
[`fsh-guts`](../kg-core/fsh-guts.md), not a refreshed mirror and not a
deletion. Step 12 asks (1) move to fsh-guts now, (2) keep in place until the
first release, (3) show the file list first, default (2). Step 13 deposits the
directory into the PARENT's fsh-guts as a verified archive (not plain trees,
which CI would audit as live content), then removes it from `main`. The deposit
is the one `state:seed --cutover` makes for a state graph: an archive that must
extract to the exact tree being removed, plus a provenance note (`movedFrom`,
`movedOn`, `sourceCommit`, `tree`), and the removal commit is made only once it
has landed. A separation targets the parent's fsh-guts rather than the
departing layer's, which `--cutover` does not yet do. The live copy is the
remote mount (`index.config.json` `source.remote`), npm package retrieval
(`kg-retrieve-npm`), or subscription (`kg:subscribe`) from stage 10; the frozen
one is never refreshed and never rendered.

### How checks treat a frozen subtree

**This is the one place the rule is stated; scanners point here.** A frozen
subtree is **one retired item**, and its sibling note is the node that answers
for it. Every reader of `fsh-guts` — the `fsh-guts.jsonld` export, the
fsh-guts page, the render-pipeline and bean-reference tests,
`check:materialized-fixity` — reports the note and does not enter the
directory. The page shows it as one row in the `via sidecar` state.

- **Recognised by declaration, never by path.** A directory is frozen because
  `<name>.md` beside it declares `$schema: folio-fsh-guts/v1` and
  `kind: separated-instance` (`isFrozenSubtree` in `schemas/kg/fsh-guts.ts`). A
  copy dropped in with no note, or under a note of another kind, is walked
  like any directory, so its files fail self-declaration loudly rather than
  vanishing from every check.
- **The note must carry all four stage-13 fields** — `movedFrom`, `movedOn`,
  `repository`, `matchesCommit` — because it is now the only thing any check
  reads about thousands of files. Those beyond the common set are exported
  under the node's `data`.
- **Materialization records inside are not judged.** They claim bytes in the
  repository the graph now lives in, which the copy deliberately does not
  carry.
- **The note's `bean:` resolves against main's work plan, with no pending
  escape.** So the deposit lands on the fsh-guts branch in the same step that
  merges the PR carrying that work item, never before it; a deposit pushed ahead of
  its PR turns every PR's CI red.

## Anti-patterns

1. **Creating the repository first.** It is the one irreversible step;
   everything that can be done in place is done before it.
2. **A seed with no history.** A one-commit seed severs blame for every line,
   and the history is cheap to keep.
3. **Re-pointing by sweep.** If more than one file changes when the platform
   moves, the seam was skipped.
4. **Reading the rehearsal as the fresh-clone check.** They catch different
   things: the rehearsal catches climbs, the fresh clone catches everything the
   host's environment was quietly supplying.
5. **Deleting the in-repo copy because the new repository is green.** Green
   is the precondition for asking, not the answer.
6. **Committing mounted directories to the host repository.** Remote mounts
   populate layer directories locally. If `.gitignore` does not ignore the
   mounted paths, external files pollute downstream git status. `index.config.json`
   must generate gitignore entries for all `remoteMounts`.
7. **Breaking dependents when dependencies fold.** If a dependency layer folds
   into another (e.g. `cat-openapi` into `cat-harness`), downstreams that still
   reference the folded layer fail unless `FOLDED_INSTANCE_ALIASES` maps them.
8. **Separating before resolving withheld asset clearance.** If library items
   are withheld or unpermitted in the separated repository (as with the IRIS replica),
   materialization results in broken links. Clearance must be verified at seed time.

---
name: remote-mount
description: >
  Bring a harness, and every layer it depends on, into a checkout that does
  not hold it, from another repository at a pinned commit, as declared
  directories with a lock: a `source.remote` entry in the downstream's root
  `index.config.json` (legacy: `remoteMounts` on its declaration) and
  `mountDefaults` on the harness. Covers when to mount and when to subscribe instead, why
  there are no submodules and no `.deps/`, the transitive closure through
  `needs` and gitlinks, overrides by id, the lock, and the three states.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Remote-mount a harness

How a downstream folio gets the layers it is built on:

- **no git submodules, ever**;
- **no `.deps/`**, because a dot directory collides with GitHub's conventions
  and with this repository's own dot-prefix guard;
- a remote mount is a **declared directory with a remote source**, pinned to
  a full 40-character SHA;
- the **defaults live in the harness's own declaration**, so a downstream
  never restates the paths;
- a downstream **may override** them **by id**, never by path;
- mounts are resolved **transitively** across the dependency closure;
- code arrives through the mounted code directories.

| | where |
|---|---|
| the process | [`mount-dependency.bpmn`](../../../processes/kg/mount-dependency.bpmn); the per-subgraph view is the `remote` and `npm` flows of [`mount-subgraph.bpmn`](../../../processes/kg/mount-subgraph.bpmn) |
| the schema | `cat-harness/schemas/kg/remote-mount.ts`, plus the `remote`, `npm` and `hydrated` members of `SubgraphSource` (`schemas/kg/subgraph-source.ts`); the per-pin index package is `subgraphIndexPackage` in `schemas/kg/subgraph-manifest.ts` |
| the tool | `bun run cat mount:remote` (`--plan` to resolve without writing), and `bun run cat mount:remote:check` (offline) |
| the entry point | `bun run cat state:mount`, which the session-start hook already runs |

## Mount, subscribe or associate: choose first

| you want | relation | what arrives |
|---|---|---|
| to **build on** a harness: run its scripts, import its schemas, read its skills as your own | **remote mount** (`source.remote` in `index.config.json`) | the harness's declared directories and those of everything it needs, at one pin |
| to **read** another graph and hold chosen parts of it | **subscription** (`subscriptions`): the [`kg-subscription`](../../../library/skills/large-datasets/kg-subscription.md) skill | a snapshot of its declaration, then parts you materialise one at a time through the five gates |
| to **know of** a harness and link to it | **association** (`associatedHarnesses`): the [`associate-harness`](associate-harness.md) skill | nothing |
| to **retrieve or distribute as a package** | **npm distribution** (`kg-retrieve-npm`, `source.npm`): the [`npm-kg-distribution`](npm-kg-distribution.md) skill | an npm `.tgz` tarball (unhydrated source or hydrated view) |

The test is whether **your code imports theirs**. If it does, mount. If you
only read their content, subscribe: a subscription gates every part through
copyright and purpose, and a mount does not, because the code it brings is the
platform you are built on.

## The two halves of the declaration

**The harness side** goes in the harness's own `<name>.json` and is written
once by the harness's owner:

```json
"mountDefaults": { "path": "cat-harness", "directories": ["schemas", "scripts", "skills"] }
```

What arrives is what the declaration NAMES: the declaration itself, the
chosen directories, and the instance-scoped files in its `assets` (its
README and AGENTS.md). A file the declaration does not name, such as a
`platform.ts` beside it, never arrives. Code the mounted graphs import has to
sit in a declared directory.

Both fields are optional, and each absence has a meaning:

- `path` absent means the layer's **home path** (`livesAt.path`, else its
  directory in its own repository).
- `directories` absent means **every declared directory whose content is in the
  checkout**. A `branch`, `family` or `remote` source is somebody's state, not
  part of the harness.

**The downstream side** goes in the checkout's root `index.config.json`, as the
`source.remote` of the layer it brings in. Which layers a checkout
instantiates, where each comes from, and the fallback for a folio with no index
are [`index-config`](index-config.md)'s rule. This skill covers only what a
`remote` source means once it is declared:

```json
{ "name": "<harness>",
  "source": { "remote": {
    "repository": "<owner>/<repo>",
    "ref": "<40-character sha>",
    "overrides": { "cat-harness": { "directories": ["schemas", "skills"] }, "bootstrap": { "skip": true } } } } }
```

The fields are a `remoteMounts` entry without its `harness`, because the
layer's `name` is the harness (`RemoteSourceSchema` in
`schemas/kg/index-config.ts`). A folio with no index still reads `remoteMounts` on
its declaration. **Declaring a mount in both places is an error**:
`readDeclaredMounts` throws and names both files. `bun run cat
index-config:migrate --write` moves the entries across.

**Every tool that writes mounts writes through `writeDeclaredMounts`**, into
`index.config.json`, and none writes `remoteMounts`.

`overrides` is keyed by layer name, then by directory id:

- `path` moves a layer.
- `directories` replaces its default list. An id may be one the layer
  declares in its `<name>.json` **or from within** one of those directories
  (a `"subgraph": true` entry of `skills/skills.json`, such as `voices`);
  both are resolved at the pin through `instanceDirectories`, the resolver
  every on-disk reader uses. A nested id mounts
  its own path alone. An id declared in neither place is refused, not dropped,
  and the refusal says where it looked. The same holds for the harness's own
  `mountDefaults.directories`.
  An id may also be a **concern name**, a code from
  `code-lists/concern-group.json` such as `sdlc`. It expands to every
  kind-first member the layer declares, such as `sdlc/processes/` and
  `sdlc/skills/`, read from each grouping kind's own declaration file at the
  pin. Each member is locked as `<directory id>/<code>`. A code that none of
  the layer's kinds declares is refused like any other unknown id.
- After a review of hydrated metadata, `mount:remote --choose
  <harness>[:<instance>] --directories a,b --tools x,y` writes the choice
  into `overrides.<instance>` (the choice, never the state), so a fresh clone
  replays it. It ends the review: that layer mounts as files, so its
  `hydrated` is dropped. The pin and consent do not move.
- `skip` leaves it unmounted, and the lock records it as an answer.
- `tools` names Tools this layer declares, by id, and mounts each one
  **runnable**: its definition, its implementation and their import closure.
  The next section but one says what that brings.
- `hydrated: true` (here, or on the entry for its harness) mounts each chosen
  directory as one file: its published `index.hydrated.jsonld` at the pin, a
  `hydrated` source. Read what is there, then choose what to
  mount as files. No declaration is laid down, and `needs` is not followed.
  Where that file comes from is the next section. With no `directories`, a
  hydrated mount offers **every** top-level in-checkout subgraph and ignores
  `mountDefaults.directories` on purpose: that list chooses which FILES a
  downstream gets, and a hydrated mount is the step before choosing. Each
  top-level file already carries its
  nested subgraphs inline (`hasSubgraph`), so a nested one is named only when
  you want it on its own.

## Hydrated: the index files are published per pin, in a package

**A pin's subgraph index files (`index.jsonld`, `index.hydrated.jsonld` under
`<docs>/subgraph/<HARNESS>/`) are published per pin in a package**, and a
hydrated mount fetches them through the Tool its source names (the `hydrated`
source's `tool`, which is `remote-mount` unless it says otherwise).

- **Not committed in each repository.** The files are `builtAtPublish`:
  they are computed over the checkout's other layers, so no commit can
  hold them current, and a committed copy turns every re-pin's check red.
- **Not generated at mount time.** The downstream would need the whole
  index, kg-export and the framing toolchain to read one file of metadata,
  which is the cost a hydrated mount exists to avoid, and two downstreams
  could frame two different files for one pin.

What that means in practice:

| | |
|---|---|
| the package | `<harness>-subgraph-index@0.0.0-pin.<sha>`: the index files at their published paths, and `subgraph-index.json` (`folio-subgraph-index/v1`) giving each file's sha256 and the repository, pin and harness |
| where | assets of the GitHub release `subgraph-index-<sha>` in the layer's repository, with the tarball's `folio-binary-release/v1` record beside it. Every name is computed (`subgraphIndexPackage` in `schemas/kg/subgraph-manifest.ts`) |
| who publishes | the `subgraph-index-package` Tool, run on every push to `main` by the reusable workflow `layer-publish-subgraph-index.yml` (the tools layer); a harness opts in with one `uses:` line |
| what a mount checks | the pin's git tree first (a commit that does carry the file still works); otherwise the package: the tarball against its record (size, sha256), the manifest against the repository, pin and harness asked for, each file against its sha256, then the same schema and subgraph-IRI check a tree file gets |
| the lock | a directory that came from the package records the tarball's URL and sha256 and the file's path in it (`package`), so `mount:lock` fetches the same bytes and refuses any others |

No release for the pin is `missing`, and the detail says the package was
looked for. A package that fails a check is `missing`; one that could not be
fetched is `could-not-determine`. Neither is ever an empty mount. The record
travels with the tarball, so its digest proves the transfer, not the
publisher: who may publish is the repository's write access, the same trust
the git tree at the pin already rests on.

## Tools: choose by id, mount runnable

The workflow: load the Tools' metadata, review it, then materialise a chosen
set. The first step is a hydrated mount of the
declaring layer's `tools` directory. Its `index.hydrated.jsonld` holds every
Tool whole, and each Tool is its own `tools/<id>/` subgraph. The last step is
`tools` on that layer's override:

```json
"overrides": { "cat-harness": { "tools": ["bean-query", "bpmn-checklist", "agent-memory"] } }
```

Three rules govern this step:

1. **A Tool brings both halves.** Its **definition** is
   `<tools dir>/<id>/<id>.ts` in the layer that declares it, by the folder
   convention in `schemas/tools/tool-folders.ts`. Its **implementation** is what its
   `invoke` names:
   - `inProcess.module`, found in the declarer or in a layer whose `needs`
     names it (`resolveImplementingPath`'s rule; two holders is refused);
   - the script a `bun run cat <key>` command resolves to through the
     layers' `checkoutScripts`.

   A bare runtime command (`gh`, `beans`) or `manual` brings no code. Both
   halves arrive **with their import closure**. A definition without its code
   is not a Tool you can run, and code without the modules it imports does
   not load: either way the checkout is half-working.
2. **One closure walker.** The closure is bootstrap-tools' `importClosure`
   (`scripts/check-closure.ts`). `check:tools-closure` and the staging cone
   use the same walk. Do not write a second walker: two of them give two
   answers to "what does this code load".
3. **Directory granularity.** The mount brings every **declared** directory
   the closure touches, whole. It takes the most specific declared directory
   (a nested one such as `skills/voices` mounts alone) and never a single
   file, so the lock schema is unchanged. A closure file in no declared
   directory, and an import that resolves to nothing, are refused with the
   file named. Neither is ever dropped.

With `tools` named anywhere in a mount entry, each layer of that entry
mounts the directories the closure touches, plus any its override names in
`directories`. It does **not** mount its default list. A `whole` layer
stays whole. A Tool id the layer does not declare at the pin is refused at
plan time. `tools` together with `hydrated` is refused, because metadata
brings no code.

**What it costs.** A Tool folder is not a declared directory: `tools/` is,
and most definitions import its `lib.ts`. So a definition arrives with the
whole `tools` directory, which holds every Tool's definition. The cost that
matters falls on the implementation side, which brings the directories its
closure touches (in the tools layer, typically `scripts` and `src`). Without
`tools`, the tools layer mounts every in-checkout directory it declares.
The end-to-end check is the `remote-mount` test "load tools metadata, choose
three Tools, materialise them" in the tools layer.

## Why the default path is the home path

At its home path, a mounted layer keeps its position relative to its
siblings. Two things then follow with no extra machinery:

- `instanceRootsIn` scans one level deep, so it finds every mounted sibling and
  `needs` resolves exactly as it does in the monorepo.
- A relative import such as `../../cat-harness/schemas/…` finds the file it
  names.

Moving a layer by override is allowed, and the overlay still finds it
through the lock (`mountedInstanceRoots`, `mountScopeFor`). The override is
then responsible for any import that climbs out of the moved layer.

## The closure

1. The harness's declaration is read **from the pinned tree**, not from this
   checkout.
2. Each `needs` name is looked for in the same tree.
3. If it is not there, the planner looks for a **gitlink** at that tree's root.
   A submodule entry is itself a pin, so a need on `bootstrap` resolves to
   `litlfred/bootstrap` at the gitlink's SHA. The downstream gets the bytes and
   never a submodule.
4. A need the downstream already holds as a local layer is `local`: it is
   supplied by the checkout and never mounted over.
5. A need found nowhere is `missing`. It is never dropped.

## The lock, and the three states

`index.lock.json` sits beside the downstream's `index.config.json` and is
**committed**. It is generated by `mount:remote` and never hand-edited, which
is why it is a separate file rather than part of the index. Readers also
accept the legacy name `<name>.mount-lock.json`, and both present is an error.
It records:

- the pins it was written for;
- for each layer: the repository, the SHA, how the pin was found
  (`declared` / `same-tree` / `gitlink`), the declaration's digest, each
  directory's tree digest, and declared layer assets (such as `package.json`);
- what was **not** mounted, and why.

The mounted bytes are **not** committed. With an index, each mount path is
ignored by a **generated block in the root `.gitignore`**, written from the
index (`check:index-ignores` is the gate). A path that block does not cover is
reported as missing, never patched locally, because a local exclude is
invisible to every other clone. In a folio with no index, a path its rules do
not ignore goes into the worktree's `info/exclude`.

**Mount path and route collisions.** A mount with no `path`
override lands at `<name>/` in the downstream root, beside the downstream's own
directories, and its site routes sit beside the site-wide ones. To prevent collisions on disk
and in route space:

1. **Reserved names:** `RESERVED_ROOT_AND_ROUTE_NAMES` in `schemas/kg/remote-mount.ts` declares
   the one authoritative list of reserved root directories and site route names:
   `["skills", "tools", "docs", "assets", "glossary", "api", "payload", "branches/", "beans", "todos", "fsh-guts", "uploads", "test", "build", "_site", "_docs", "_kg"]`.
2. **Mount path check:** `checkMountPathCollisions` (run during planning in `mount:remote`
   and by `bun run cat check:mount-collisions`) rejects any remote mount whose effective path
   (`path` or `<name>/`) collides with:
   - a directory the downstream declares in its own configuration;
   - a reserved root or site route name;
   - another mount's path.
   When a collision occurs, the error states how to fix it: "set `path`" (on the
   layer's `overrides.<name>.path` in `index.config.json` or `source.remote.overrides`).
3. **Route rules:**
   - **Canonical:** every visualiser is reachable at `<base>/<harness>/<visualizer>/`.
     Every generated link uses that form unless an alias is declared.
   - **Alias:** `<base>/<visualizer>/` exists only when a declaration opts in via `alias: true`
     or `alias: "<alias>"` in its `Visualisation` declaration (`coverage.visualiser`). The site build
     refuses an alias that collides with another alias, a harness route, or a reserved site route,
     and names both claimants.
   - The route rule itself is in [`schema-management`](schema-management.md)
     §"Where a viewer publishes".

Every layer ends in exactly one state:

| state | means | exit |
|---|---|---|
| mounted | on disk, hashing to the lock | 0 |
| unverified-approver | mounted, on consent no `mountApprovers` list checked | 0, reported apart |
| missing | not on disk, edited since mounting, not in the tree, refused, or the lock is for other pins | 1 |
| could-not-determine | the fetch failed, a declaration or lock is unreadable, or a layer is reached at two pins | 2 |

Could-not-determine outranks missing, and missing outranks mounted. **A fetch
that failed is never an empty layer.**

### A fresh clone: the root's `cat` bootstrap

A downstream root's `cat` script is `bun .github/cat.ts`, not the bare
runner. The runner (`scripts/run-script.ts` of the tools layer) is itself a
mount, so on a fresh clone it is not on disk. `.github/cat.ts` checks for it
and, when it is missing, runs `.github/mount-from-lock.sh` (which fetches
`mount-from-lock.ts` at the commit the lock pins for the tools layer and
replays the lock, verifying every tree digest) before it hands over with the
same arguments. So `bun run cat <name>` works from `git clone` with no mount
step. It checks only that the runner is present, so after a re-pin run
`bash .github/mount-from-lock.sh` by hand to replace the stale mounts.

`instantiate-harness.ts` writes both files from
the tools layer's `templates/root-bootstrap/` and sets the `cat` script. A
root set up before that keeps a `cat` script that runs the bare runner until
the two files are copied in.

### Re-pinning: from a checkout mounted from the lock

A re-pin is `mount:remote --seed <name>=<owner/repo>@<sha>` (it writes the
pin and its consent into `index.config.json`), then `mount:remote` (it lays
the bytes down and rewrites the lock). Do it in a checkout whose mounts match
the lock: a fresh one, or one replayed by `.github/mount-from-lock.sh`. A
mount with local edits is left untouched by the next mount, at its old
commit, while the lock's top-level pin moves, so CI would keep testing the
old layer. `--seed` refuses while a mount it moves has such edits, and
`mount:check` reports a layer entry behind its pin as `missing`. After the re-pin, check that
the moved layer's `sha` in `index.lock.json` is the new pin.

**A pin only moves forward** (owner ruling, 2026-11-06, card "Pin target",
A). When layers pin different commits of a shared layer, align them forward,
bottom-up: start at the lowest layer, and move each shared layer to the
newest commit that any layer needs. Stop when every lock names one commit per
layer. Never move a pin back to an older commit so that two layers agree.

**A re-pin is a cross-layer set** (owner ruling, 2026-11-07). Pin together
every layer the change needs, re-pinned to the current mains, and verify on a
fresh mount (`mount:remote --fresh`). A layer can need another layer's newer
commit. For example, cat-harness#1100 removed routes that were listed by hand,
because a content layer above it now derives them (`builtOnHostSite`). So
cat-harness at 6dd3746 or later needs that content layer's change, and the
tools layer's matching one, in the same re-pin. An asset that a layer
commits must also match the tools recipe that generates it, such as
cat-harness's `edit-links.js`.

**A re-pin is its own PR** (owner ruling, 2026-11-07: "keep repins on own
PR so easier to stack dependencies"). A re-pin PR changes the pins and
nothing else: `index.config.json`, `index.lock.json`, the generated `uses:`
pins, and what regenerates from them. It carries no feature change, no
workflow logic and no fix.

- A feature that needs the new pins is stacked on the re-pin PR (below)
  rather than riding inside it.
- A fix that the re-pin needs lands in the layer that owns it, and the
  re-pin then only moves the pin.
- Counter-example: folio-assistant#2985 carried #2999 (the shared ci-setup
  move) and its own `caches:viz` gate line inside the re-pin.
- **The one exception: mutual dependence** (owner ruling, 2026-11-07, card,
  about 08:43Z, "A. Allow the exception"). A re-pin may share a PR with a
  change only when neither can pass on its own. The PR body must say why.
  Example: a content layer re-pinned to cat-harness#1032 failed
  `check:tools` without its own PR's `library` topic, and that PR alone
  declared the `library` topic twice against the old pin. A change that
  merely needs the new pins is not mutual: it stacks.

**A lower layer's new gate must not break the next re-pin.** A gate or
check script added to a lower layer has passed a downstream dry run before
it lands, so a re-pin moves pins and nothing else. When a re-pin
nonetheless fails on a gate a lower layer just added, the fix goes into
that layer, not into the re-pin
(`prepare-merge` (opt-in `cat-harness.sdlc`)
§"A new gate in a lower layer must pass downstream").

**Stacking across layers** (owner ruling, 2026-11-07). Work that needs an
unmerged PR in a lower layer does not wait for it. Develop against that
PR's branch laid over a fresh mount. A draft PR may pin the dependency
PR's full 40-hex head SHA so that its CI sees the change. A branch is never
pinned, as for any pin. That draft is never marked ready or merged while it
pins an unmerged commit: once the dependency lands, re-pin to its merge
commit on main. That move goes forward, so "a pin only moves forward" holds
throughout.

**The re-pin refreshes layer health** (owner ruling, 2026-11-07, card "Layer
health", A). When a re-pin moves the tools layer, it regenerates the
checkout's layer health report at the new pins and publishes it. The health
check fails a re-pin once the report is more than 26 hours old and the checker
has moved. The tools layer implements it.

**The merge manager re-pins for a merge** (owner ruling, 2026-11-13: "send
to you as merge manager to handle merge AND repin so you can handle trains
and CI"). A session whose PR is green except for a re-pin sends it to the
merge manager as `repin+merge:`, and does not re-pin it just in time. The
merge manager makes the re-pin as its own PR and sequences re-pin trains
and CI. The rules below are how it does so.

**The committer re-pins, locally, and CI only verifies.** The person or agent
who moves a pin does the whole re-pin in their own checkout: `--seed`, a
fresh `mount:remote`, the regenerated agent surface (`skill:commands`,
`agent-memory`, `index:render`), and the local checks. That same
`mount:remote` then publishes the new lock's **layers cache ref** (below)
alongside the branch, with whatever credential pushes the branch.
`bun run cat layers:publish` retries it, and `--no-layers-publish` skips it.

CI never builds the ref when it exists: it fetches it and verifies it against
the lock. Two writers are only fallbacks:

- the re-pin train, for layers nobody re-pinned;
- main's post-merge workflow, which rebuilds the ref for every push that
  changes `index.lock.json`.

### The layers cache: one fetch, every byte still verified

Replaying a lock fetches each pinned layer from its own repository. The
**layers cache** is one git commit in the INDEX repository whose tree is the
composed overlay a replay lays down: each locked directory at its mount path,
each declaration and asset, and nothing an install, a state mount or a
publish build wrote.

- **Ref:** `refs/cat/layers/<key>`, where the key is the sha256 of the lock's
  `instances`. `refs/cat/layers/main` moves with main's lock.
- **Reader:** `mount:lock`, and through it `.github/mount-from-lock.sh`, the
  session-start hook and every CI job, first tries ONE shallow fetch of the
  key's ref, then of `main`. A layer whose copy verifies is laid down from
  it. A layer that does not verify, or a ref that is missing, is fetched from
  its own repository as before. `--no-layers-cache` (or `CAT_LAYERS_CACHE=0`)
  skips it, and `CAT_LAYERS_URL` points it at another remote.
- **Writer:** the committer, through `mount:remote` or `layers:publish`.
  It refuses unless every mount reads `current`, then pushes the overlay.
  `--main` also moves `main`. `--prune <n>` keeps the newest n lock refs,
  `main`, and each `--keep <key>`, for example the lock of every open PR.
- **Gate:** on an index-mode pull request that changes `index.lock.json`,
  the job `layers-ref` of the tools layer's `layer-pr-checks.yml` runs
  `layers:check --changed-from <base>`. It only asks (`git ls-remote`) whether
  the new lock's ref is at the repository, and fails when it is not. The
  build and the push stay on the re-pinner's machine, never a runner (owner,
  2026-11-08). A PR that leaves the lock alone owes nothing.
- **Shared fallback:** an IG whose origin carries no `refs/cat/layers/*` can
  name a shared cache in `.github/layers-url` (one URL). The root bootstrap's
  `mount-from-lock.sh` then sets `CAT_LAYERS_URL` to it. Only layers at the
  same pin hit; the rest are fetched as before.

**The lock stays the sole authority.** The cache is untrusted. Every byte
taken from it is checked against the lock: the declaration's and each
asset's sha256, and each directory's `treeDigest`. These are the same checks
a fetched byte passes. So a stale `main` still serves every layer that did
not move, and a tampered ref costs time, never correctness. Trust is
unchanged: consent was checked when the lock was written, and the cache
cannot add a layer the lock does not name.

A replay that fails is reported loudly, not swallowed: a stale mount makes
local checks pass falsely.

## A changed lock re-renders the agent surface

**A mount is not done when the bytes are on disk.** A newly pinned layer can
bring new skills, renamed skills and new agent-memory entries, but an agent
does not read the layer: it reads what is **generated** from it.

| surface | generated by | from |
|---|---|---|
| `.claude/commands/<name>.md` | `skill:commands` | every `user_invocable` skill in the mounted `kg` graphs |
| `.claude/agent-memory/<agent>/MEMORY.md`, `.agents/skills/`, `.agents/rules/` | `agent-memory` | the `memory` directories the mounted layers declare |

So when a `mount:remote` run **changes the lock**, it runs both generators
from the checkout root before it exits, and a generator that fails fails the
run. A re-pin commit then carries the new layers *and* the surface rendered
from them. `--no-agent-surface` opts out; `--check`, `--plan` and `--staging`
never run it, since they change no lock a commit would carry.

The list lives in one place, `AGENT_SURFACE_GENERATORS` in
`cat-harness-tools/scripts/remote-mount.ts`. A new generator of something an
agent reads (a rule file, a settings hook) is added **there**, not to a
checklist: a step a person has to remember is the step that gets skipped.

The process step is `Task_RenderAgentSurface` in
[`mount-dependency.bpmn`](../../../processes/kg/mount-dependency.bpmn),
between writing the lock and checking against it.

## Trust: what lets a mount proceed (H8)

A real mount needs a person's consent for that pin (`trust.consent`); a
`--staging` mount needs none. `schemas/kg/mount-trust.ts` has the rules. Four
things to know:

- **The lock records the basis** for each layer: `staging`, or `consent`
  with who and when. `mount:remote:check` re-runs the trust check against the
  current declaration, so consent withdrawn later reads `refused`.
- **A gitlink needs consent of its own.** A layer reached through a
  gitlink is another repository at another commit. Give its consent on
  `overrides.<name>.trust`, for the gitlink's SHA.
- **Who may consent.** Declare `mountApprovers` and a `consent.by` not on the
  list is refused. Without the list, mounts report `unverified-approver`: exit
  0, but never shown as clean. A checkout whose mounts `index.config.json`
  lists declares the list there, as its top-level `mountApprovers`; declaring
  it on the layer declaration as well is an error.
- **A one-time consent is recorded where it acts** (owner ruling,
  2026-11-13). Quote the owner's card, with its date, in the re-pin PR's
  body and in `trust.consent`'s evidence in `index.config.json`. Example:
  folio-assistant#3119 re-pointed a content layer's pin to that layer's
  main under the card "A. Re-point to main".
- **A refused mount is not current.** Its old bytes stay on disk (an agent
  does not delete them). The lock records them under `unmounted` as
  `leftOnDisk`, and the check reports them as not mounted.

### Standing consent: a site keeps itself on an upstream branch

Pins stay per site. A site may
declare, on one layer's `trust.standing`, that a named person consents
to following a branch — `{follows: "main", consentBy, consentAt, require?:
"green"}`. The repin tool (`cat-harness-tools/scripts/repin-standing.ts`,
run by its `standing-repin.yml` workflow) then moves that pin to the
branch's newest (green) commit and writes `trust.consent` for the new pin,
`by` that person and marked `standing`. The mount accepts it only while the
same rule is still declared: withdraw or edit it and those pins ask again.
A pin moved by hand still asks again, rule or not.

**A standing re-pin never merges itself** (owner ruling, 2026-11-13, card
"C. No auto-merge", which replaces "A. MM dispatches, auto-merge OK"). A
standing re-pin run, however it is triggered, opens or updates its PR,
labels it `needs-repin`, and stops. The merge manager judges it once CI is
green and merges it. The reason was measured: the self-merges landed 3-4
seconds after the PR opened, before any check had run. The tools layer
decides the mechanism. A re-pin commit pushed by a bot gets runs held at
`action_required`, and the merge manager approves them, so the re-pin is
judged on runs that executed (`github-state-inspection`).

**Site repositories** (owner ruling, 2026-11-13, card "A. Give MM access").
The merge manager attaches each site repository and runs its re-pin: it
dispatches the run, approves the held bot runs, and merges when green. A
site's own sessions do not re-pin it.

## Publishing a remote-mounted downstream — provision `gh-pages` first

A mount brings layers into a checkout; it provisions **nothing** on the
downstream's remote. A downstream that publishes a site needs a `gh-pages`
branch before GitHub Pages can be switched on, exactly as a new repository
does.

The step is `Task_ProvisionGhPages` ("Provision gh-pages") in the
getting-started process ([`getting-started`](../../conduct/conduct-core/getting-started.md)
§5), with the semantics of `A_Provision` in bootstrap-tools'
[`render-kg-to-github-pages.bpmn`](../../../../bootstrap-tools/processes/render-kg-to-github-pages.bpmn).
Run `bun run cat-harness-tools/scripts/pages-bootstrap.ts --provision` (idempotent,
never forced; without the flag it only reports `unprovisioned` and the exact
command), then set Pages to **"Deploy from a branch: gh-pages, / (root)"**.
A worked example is in
[`repo-conversion`](../../conduct/conduct-core/repo-conversion.md) §5.

## Never

- **Never add a submodule** to get a dependency, and never clone into `.deps/`.
- **Never pin a branch or an abbreviated SHA.** The schema refuses both.
- **Never move a pin back.** Align layers forward to the newest commit any
  of them needs (§"Re-pinning").
- **Never edit a mounted directory and expect a re-mount to keep the edit, or
  to throw it away.** A re-mount leaves edited bytes untouched and reports them
  as missing. Move the edit upstream, or delete the directory and re-mount.
- **Never mount over tracked files**, or over a directory that no lock says
  this mount made. Both are refused.
- **Never read `missing` or `could-not-determine` as "that layer has nothing
  in it".** A layer that is not mounted is absent from every overlay.

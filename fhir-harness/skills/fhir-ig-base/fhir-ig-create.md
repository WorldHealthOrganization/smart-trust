---
name: fhir-ig-create
description: >
  Somebody asked for a new FHIR Implementation Guide. Decide where it lives,
  in a new repository of its own or as a staged sub-KG inside the harnessed
  repository the session is already in, by reading three facts and, when they
  do not settle it, asking ONE numbered question with a default. Then route:
  a new repository goes to init-folio; an in-repository IG is declared as a
  staged instance and follows sub-kg-lifecycle, so it can move to its own
  repository later. FHIR-generic only; a harness built on this one may
  specialise it. Also holds the two build questions asked whenever an IG
  repository is adopted: whether its automatic gh-pages builds keep running,
  and whether to render it as a just-the-docs site. Use whenever a user asks
  to create, start, set up or stand up an IG, an implementation guide, or a
  FHIR guide, or an agent adopts an IG repository.
---

# fhir-ig-create

> Skill id: `fhir-ig-create` · Package: `fhir-ig-base` · Layer: `fhir-harness`

A request to create a FHIR IG can be met in two ways: in a new repository, or
inside the folio of a repository that is already harnessed. Work out which
the user means and act on it.

This is the IG-shaped half of
[`getting-started`](../../../cat-harness/skills/conduct/conduct-core/getting-started.md),
which triages "create a folio" in general. Read that skill's §1 for how facts
are gathered and §3 for how a question is put. This skill does not restate
them. It adds the one fork getting-started has no branch for: **an IG that
starts inside a repository and may leave it later.**

## When a harness above this one specialises it

An IG built on a harness that `needs` this one (for example one that adds its
own pre- and post-processing, theme and layout rules) may carry its own
creation skill that specialises this one. **If the request names such a
harness's kind of guide, ask `skill_list` for that skill and run it instead.**
It will route back here for every step it does not change. This skill names
no such harness, on purpose: the bare FHIR layer knows nothing above it.

## 1. Read three facts — read-only, before anything is written

| fact | how | values |
|---|---|---|
| `inHarness` | a `<name>.json` layer declaration at the working directory's root (`describeRepository` membership `harness`) | yes / no |
| `hasIg` | an IG source already present: a `sushi-config.yaml` or an `ig.ini` at the root | yes / no |
| `statedWhere` | what the user **said** about where it goes | `new-repo`, `in-repo`, `existing-ig`, `unstated` |

`statedWhere` is `unstated` until the user has said it. "Make me an IG" states
nothing about where. "Start an IG in its own repo" states `new-repo`. Do not
infer it from the repository you happen to be in.

## 2. Decide

| `statedWhere` | `inHarness` | `hasIg` | route |
|---|---|---|---|
| stated | any | any | what they said |
| `unstated` | no | yes | **existing-ig**: hand to [`repo-conversion`](../../../cat-harness/skills/conduct/conduct-core/repo-conversion.md), scan first |
| `unstated` | no | no | **new-repo**: the only route that answers itself |
| `unstated` | yes | any | **ask**, with default `in-repo` |

### The question, when the table says ask

Put it as numbered options, four at most, recommended first, with the default
stated. Load
[`interaction-modality`](../../../cat-harness/skills/conduct/conduct-core/interaction-modality.md)
first; for some users a typed answer is not available at all.

> Where should the new IG live?
>
> 1. **Inside this repository, as a staged sub-KG** *(recommended)*. Cheapest
>    to start and to change your mind about. It can move to its own
>    repository later, and nothing outside this repository changes until you
>    say so.
> 2. **In a new repository of its own.** Creating it is visible outside this
>    repository, so I will ask once more before I create anything.
> 3. **Over an IG repository you already have.** I scan it first and show
>    you what I find before importing anything.
> 4. **Tell me more.**
>
> **Default if you do not answer: 1.** Nothing outside this repository is
> touched.

Why `in-repo` is the default: every step of it is reversible with
`git revert`. A guide is staged in place first, and its repository is
created only once that rehearsal is green: a repository is the first
irreversible act, so it is not the first act.

Then ask the name, as a short slug, offering the one derived from what they
said as option 1.

## 3. Route

### `in-repo` — a staged sub-KG

The lifecycle is [`sub-kg-lifecycle`](../../../cat-harness/skills/kg/graph-management/sub-kg-lifecycle.md)
and its process `sub-kg-lifecycle.bpmn`; this is what its stage 1 means for an
IG.

1. **Scaffold the declaration and the seam**:
   `bun run cat init-folio --staged <name> --title "<title>" --repository <owner>/<name> --needs fhir-harness`.
   It writes `<name>/<name>.json` (`repository` is the planned home, and
   `livesAt` is this repository) and an empty `<name>/platform.ts`, and
   nothing at the repository's root. Never `--instance` here: that scaffolds a
   whole repository.
2. **Declare the graphs as their files arrive.** An IG's graphs are typically
   `ig-ast`, `fhir-artifact-index` and `docs` with `igSite: true`. Route
   every platform import through `platform.ts`: an empty seam on day one
   costs nothing, and retrofitting one later means rerouting every import.
3. **Get the IG source**, one of:
   - **authored here**: `sushi-config.yaml` and `input/` under the
     layer, authored with [`l3-fhir-authoring`](../content/fhir-ig-authoring/l3-fhir-authoring.md);
   - **an IG already published elsewhere**: mount or fork its source
     repository. Its artefact index and navigation are not ingested or
     committed: `bun run cat ig-index:build` writes them at publish from the
     IG's AST and its own `sushi-config.yaml`.
4. **Build its site** from a local checkout:
   `bun run fhir-harness/scripts/stage-ig-sites.ts --work <dir> --baseurl <baseurl> --only <name> --source <ig repo checkout>`
   ([`ig-build-pipeline`](ig-build-pipeline.md), [`ig-render-jekyll`](ig-render-jekyll.md)).
5. **Seed the plan**: one work-plan item for the IG, under the epic the work
   belongs to, after the existence check in `todo-manager`.

From there the IG grows in place, and leaves only through
`sub-kg-lifecycle`'s two owner confirmations.

### `new-repo` — its own repository

1. **Confirm before creating.** Creating a repository is outward-facing and
   is not undone by a revert, so the question in `sub-kg-lifecycle` §"7 and
   12" is asked first, with default "not yet". The owner may create it
   themselves; a session without the permission hands over with
   `agent-handoff` (opt-in `cat-harness.sdlc`).
2. **Mount, don't declare.** The repository gets an `index.config.json`
   naming the layer it builds on (this one, or an overlay above it such as
   the WHO SMART Base IG) as a remote layer with consent, and the `index.lock.json`
   `remote-mount.ts` writes. No `<repo>.json` and no submodule: an IG
   repository needs no harness of its own. The same `index.config.json`
   declares the repository an IG source with `contentTypes.ig` and its
   `include` list, the paths this harness reads. Start with the paths the IG
   holds: usually
   `sushi-config.yaml`, `ig.ini`, `input/fsh/`, `input/pagecontent/`,
   `input/includes/`, `input/images/`. [`ig-build-pipeline`](ig-build-pipeline.md)
   §"What this layer reads" has the rules and the legacy warning.
3. Then steps 3 to 5 of `in-repo`, at the root.
4. **Ask the two build questions** of §"4. Who starts a build" before the
   first push; a repository forked from an upstream IG is the usual case.
5. **Copy the site templates, unchanged.** `templates/ig-repo-site/`
   holds `ig-ast-refresh.yml` and `site-publish.yml`; copy both into
   `.github/workflows/`, as they are. When the IG has translations in
   `input/fsh/translations/`, copy `translation-supplements.yml` too: it
   compiles them on every pull request ([`ig-build-pipeline`](ig-build-pipeline.md)
   §"Translation supplements"). An IG repository's site is built from
   the AST cache (§"The AST cache lifecycle" of
   [`ig-build-pipeline`](ig-build-pipeline.md)), and `ig-ast-refresh.yml`
   is its one writer. Without it the repository has no site, and
   `stage-local.ts` refuses with *no cache branch for this IG*. The first
   refresh is dispatched once on the default branch by the owner, or by an
   agent the owner names for that run. Until it has run, the repository's
   preview is not built anywhere: say so and ask. Do not stage it on another
   repository's site instead
   (`feature-staging`,
   *Which site*).

### `existing-ig`

`repo-conversion` scans first and imports second, never the other way round.
After the import, mount its layer through `index.config.json` as in
`new-repo` step 2 (no declaration of its own), declare `contentTypes.ig`
with an `include` list of the paths the harness should read, then ask the
two build questions in §"4. Who starts a build": an existing IG repository
almost always carries build workflows that publish on every push. Then
`new-repo` step 5: copy the site templates if they are missing.

## 4. Who starts a build

Two questions for the owner, asked whenever an agent adopts an IG repository
(`existing-ig` or `new-repo` above, or
[`repo-conversion`](../../../cat-harness/skills/conduct/conduct-core/repo-conversion.md)
over a repository with a `sushi-config.yaml` or `ig.ini`), and whenever it
notices automatic builds in an IG repository it is already working in. Every
other skill that adopts, onboards or converts an IG repository points here.
Why: inherited fork workflows can publish previews on every push and pull
request, including to another organisation's Pages site.

### 4.1. Detect, read-only

List every workflow under `.github/workflows/` whose `on:` includes `push`,
`pull_request`, `pull_request_target` or `schedule` **and** that builds or
deploys a site: it runs the IG Publisher, pushes to `gh-pages` (or another
pages branch), or uses a Pages deploy action. For each, record:

| field | what |
|---|---|
| file | the workflow path |
| automatic triggers | which of the four, with their branch filters |
| what it publishes | full build, branch preview (`branches/<name>/`), PR preview |
| where it publishes | the repository's own Pages site, or a target **outside** it (another repository's pages branch, another organisation's `github.io`) |
| called by others | whether it declares `workflow_call`, and whether another repository calls it |

Report any deploy target outside the repository's own Pages site, even if
the owner keeps every trigger. If nothing matches, say so in one line and
skip to 4.3.

### 4.2. Ask whether to disable the automatic triggers

Put it per
[`interaction-modality`](../../../cat-harness/skills/conduct/conduct-core/interaction-modality.md):
the detection table first, then this question:

> This repository publishes to gh-pages automatically: *(the table from 4.1)*.
> Should those builds keep running on their own?
>
> 1. **Manual only** *(recommended)*. I change each listed trigger to
>    `workflow_dispatch`, so a build runs only when someone starts it from
>    the Actions tab. I keep `workflow_call` wherever another repository calls
>    the workflow, and I leave what is already on gh-pages untouched.
> 2. **Manual only, and remove the workflows nobody calls.** As 1, but a
>    workflow with no caller and no remaining use is deleted from
>    `.github/workflows/` rather than kept as a manual one.
> 3. **Keep them as they are.** Nothing changes; I record the finding
>    (and any out-of-repository target) in the work plan.
> 4. **Tell me more.**
>
> **Default if you do not answer: 1.**

The default is 1: a build workflow stays defined (runnable from the Actions
tab) but does not run on its own; disabling a trigger is reversible. Option 3
is for an owner who says so.

Whichever option is chosen:

- **Turning automatic BUILDS off never turns harness CHECKS off.** The
  harness checks are a separate workflow, a caller of cat-harness-tools'
  `layer-pr-checks.yml` on `pull_request`
  ([`index-config`](../../../cat-harness/skills/kg/kg-core/index-config.md),
  "A harnessed repository runs its checks on its own pull requests"). It
  stays on.
- **Never delete gh-pages content as part of this.** Removing published
  previews is a separate question, asked separately, with what would go and
  how big it is, per
  [`deletion-requires-confirmation`](../../../cat-harness/skills/conduct/conduct-core/deletion-requires-confirmation.md).
  Option 2 deletes a workflow file, which `git revert` restores; it deletes
  nothing the workflow published.

### 4.3. Ask whether to render the IG with the just-the-docs site

> Do you want this IG rendered as a just-the-docs site, with the harness's
> navigation, search and language bar, on this repository's own Pages site?
>
> 1. **Yes** *(recommended)*. I install the folio site workflow, manual
>    trigger only, and tell you how to run it.
> 2. **No.** The IG Publisher output stays the only rendering.
> 3. **Tell me more.**
>
> **Default if you do not answer: 1.**

The default is yes: the Publisher's HTML is opaque to every harness surface
(see [`ig-render-jekyll`](ig-render-jekyll.md)), and a manual-only workflow
publishes nothing until run.

On yes:

1. **Mount, don't declare**, as `new-repo` step 2: `index.config.json` names
   the layer as a remote layer, with `"site": {"landing": "<that
   layer>"}` (without it the route refuses rather than guess among the
   mounted layers) and `contentTypes.ig`.
2. **Keep one workflow that calls the upstream IG build workflow** (the route
   recognises `ghbuild.yml`, and `fhirbuild.yml` beside one). It is the
   recipe the publish mirrors, and it stays `workflow_dispatch` only.
3. **Copy the site templates**, as `new-repo` step 5. `site-publish.yml` is
   `workflow_dispatch` only; its first job, `ast`, calls this layer's
   reusable `ig-ast-refresh.yml`, then it runs
   `bun run cat-harness-tools/scripts/stage-local.ts --repo .`, the command
   every agent-run repository publishes with:
   - it builds the site from the IG's cached AST with the steps the mounted
     layers provide ([`ig-build-pipeline`](ig-build-pipeline.md) §"The IG
     repository's site route"), and runs no Publisher;
   - it publishes `main` at the root (keeping `branches/`, `_render-log/` and
     `branches/`) and any other branch as a preview under
     `branches/<branch>/`;
   - `--plan` prints what it would do and `--dry-run` builds without
     publishing; do not use `--bare-ig`;
   - an IG that needs steps beyond the layers' declares `site.build` inline
     in its `index.config.json` entry, never in a `<instance>.config.json`;
   - the menu is read from `sushi-config.yaml` at build time; nothing is
     committed for it.
4. **Tell the owner how to run it**: Actions tab → "Site publish (by hand)"
   → Run workflow, on the branch to publish, with `plan` ticked first. The
   site lands at the repository's own Pages URL; the template reads the base
   path from the repository name.
5. **Sibling and dependency sites.** If the IG has sibling sites (other IGs
   on the same platform) or depends on another IG with its own site, set the
   repository variables `FOLIO_SITE_SIBLINGS` (site URLs) and
   `FOLIO_SITE_DEPENDENCIES` (`owner/repo@ref`). The run then reports each
   sibling built with a different platform, and re-runs the dependencies'
   `Site publish (by hand)` after a publish, which needs a
   `FOLIO_SITE_DISPATCH_TOKEN` secret; without it the run summary says what
   was not rebuilt. Why: sites built by hand drift to different platform
   versions. Every build writes `folio-build.json` at its site root
   (`scripts/site-build-stamp.ts`), so a deployed site can be compared
   without rebuilding it. A sibling whose stamp cannot be read is reported as
   **not checked**, never as matching. The report is a message, not a gate.

### 4.4. Say what the pull request will fire

A pull request that changes a workflow **still runs the base branch's
`pull_request_target` workflows**, because `pull_request_target` runs the
workflow file from the base. So the PR that disables an automatic preview
fires that preview one last time. Say so before opening the PR, and offer
the two ways round it: cancel those runs as soon as they start
(`gh run cancel <id>`), or, with the owner's agreement, push the workflow
change straight to the working branch rather than through a PR. Once the
change is on the base branch, later PRs are quiet.

No BPMN activity covers IG repository adoption, so these steps are not in a
diagram; publishing the adopted site, and refreshing its AST, is
[`ig-ast-cache.bpmn`](../../processes/content/ig-ast-cache.bpmn). When one
is drawn, 4.2 and 4.3 are the owner's lane and 4.1 is the agent's, with
4.2's "manual only" default as the gateway's default flow.

## Anti-patterns

1. **Creating a repository because the request said "new".** "A new IG" is
   not "a new repository". Ask.
2. **Running `init-folio --instance` inside a harnessed repository** for an
   in-repo IG. It writes `AGENTS.md`, `.mcp.json`, a beans store and a
   session hook into a subdirectory. `--staged` is the in-repo mode.
3. **Hard-coding a publisher's identity here.** Template, chrome and
   publication target belong to a harness above this one.
4. **Skipping the seam because the IG has no code yet.** The first test that
   imports a platform helper is the first climb.
5. **Typing a workflow the templates already hold.** Copy
   `templates/ig-repo-site/` as `new-repo` step 5 says; a hand-written set
   that misses `ig-ast-refresh.yml` leaves the repository with no site.

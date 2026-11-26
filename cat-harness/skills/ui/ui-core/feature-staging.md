---
name: feature-staging
description: >
  Manages feature-branch staging deployments under gh-pages/branches/<branch-slug>/
  for before/after publication review comparison. Handles branch creation, staging
  deployment, commit SHA stamping, and cleanup.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Feature-branch staging

## When to use this skill

When a content change is being reviewed and the reviewer (or the author) needs
to **see the rendered result** before merging. The staging deployment puts the
feature branch's rendered site at:

```
https://<owner>.github.io/<repo>/branches/<branch-slug>/
```

**A preview is the general publication step with a different root.** The push
itself is [`render-kg-to-cdn`](../../process/workflow/render-kg-to-cdn.md) with
`branches/<branch-slug>/` as the publication root URL and the `gh-pages` Tool as
the target — the same step a release takes with the site root. What this skill
owns is everything around that call: the slug, the banner and `staging.json`,
the render log, the PR comment, and taking the preview down.

### Which site — the repository the change lives in

`<owner>/<repo>` above is **the repository that holds the change**, not the
repository of the index the agent happens to be working in. Read that
repository's `index.config.json` first:

| the change lives in | its preview is at | published by |
|---|---|---|
| a repository with its own site (its `index.config.json` has a `site` entry) | `https://<owner>.github.io/<repo>/branches/<slug>/`, and the root from its default branch | that repository: `stage-local.ts --repo .` from its checkout when it declares `site.agentRun` (below), else its own `staging.yml` |
| a layer an index mounts and publishes as part of its own site (no site of its own) | `branches/<slug>/` on the **index's** site | a **staging re-pin**: a pull request on the index that points the mount at the branch's commit, recorded with `bun run cat mount:remote --staging` (basis `staging`, no consent needed) |

A repository with a site of its own is previewed there, even when an index
also mounts it. The index's site shows it as one layer among its layers,
which is the wrong page for that repository's reviewers. If the repository's
own build cannot run yet (its publisher refuses for a missing cache or an
undeclared input), say what is missing and ask. Never fall back to the
index's site in silence.

## How it works

### 1. Feature branch → staging deployment

When an agent pushes to a feature branch with an open pull request, drafts
included, `feature-staging.yml` automatically:

1. Builds the docs site (Jekyll + TypeDoc + BPMN diagrams)
2. Writes the build's facts — commit SHA, timestamp, branch, PR, issue, build
   log — **once**, to `staging.json` at the preview root
3. Injects a **constant** staging banner at the top of every HTML page, which
   reads those facts in the browser
4. Comments on the PR that the preview is **staged and queued**, with the
   earliest push time and when it should be live
5. Waits for the rate-limit window (§8), then deploys to
   `gh-pages/branches/<branch-slug>/` **only the files that differ from the
   live site** (`staging-share.ts apply`). The preview's
   `staging-sw.js` serves the rest from the live site in the browser and puts
   the banner back on its pages; the live site's root `404.html`
   (`staging-share.ts write-404`, written by `docs-site.yml`) installs that
   worker for a deep link opened before it exists. A page is shared only when
   it matches the live one once the per-preview edits are set aside (banner,
   SEO strip, `fa-staging` and `fa-search-index`, TypeDoc's title suffix);
   anything else keeps the preview's own copy. The footer build stamp is
   filled in the browser on every build, the live site's from `build.json`,
   so an unchanged page is byte-identical across deploys
6. Rewrites the same comment: **pushed** at a time, live by about five
   minutes later

### 2. The staging banner

Every staged page carries a muted-sage banner:

> 🔀 **FEATURE BRANCH** — `claude/update-schedule` · commit `a1b2c3d` · built 2026-09-18T00:30:00Z · PR #42 · issue #215 · compare with main ↗ · build log

Its colour, `#4F6F52`, measures 5.63:1 against its white text, above the
4.5:1 WCAG AA threshold. Check any replacement the same way; the pale
decorator sages (`#9CAF88`, `#87A96B`) land near 2.5:1.

#### The facts are fetched, not baked — and that is a storage decision

`cat-harness-tools/scripts/staging-banner.ts` injects a fragment that is
**byte-identical on every page and across every rebuild**, and the browser
derives its preview root from `location.pathname`, fetches `staging.json` and
fills the banner in.

A per-build value in the fragment makes every page unique on every build, so
each re-push adds the whole site to `gh-pages` as new objects. Three rules:

- **Nothing per-build may go back into the fragment.**
  `staging-banner-constant.test.ts` runs two builds with different facts and
  compares the emitted bytes, so any leak fails regardless of how it is
  spelled. Add the fact to `staging.json` instead.
- **A failed fetch must still say PREVIEW.** The static markup carries
  "FEATURE BRANCH" before any fetch happens, and the fetch only ever ADDS
  detail. *"Could not determine" is never rendered as "this is the real
  site"* — the same third-state rule the rest of the repository runs on, and
  here the failure mode is a reviewer approving the wrong artefact.
- **Every value from the JSON goes in as `textContent`, never as markup.**
  Git ref names may contain `<`, `>` and `"` — they are not in git's forbidden
  set, which stops at space, `~`, `^`, `:`, `?`, `*`, `[`, `\` and the control
  characters. `staging-banner.e2e.ts` pins this with a branch name carrying
  an `onerror` payload.

Pages still differ **between** previews, because Jekyll's `relative_url`
prepends the `baseurl` to ~235 hrefs per page and the `fa-translation-index`
island publishes `site.baseurl` to JavaScript. Both are coupled to the
language switcher.

### 3. Commit SHA stamping — and the four fields staging must NOT write

Both builds write `docs/_data/build.yml`, and **they do not write the same
fields.** The difference is deliberate: it is the second half of the
deduplication above.

| | `docs-site.yml` (main) | `feature-staging.yml` (a preview) |
|---|---|---|
| `sha`, `short_sha`, `built_at`, `run_url` | **written** | **DELIBERATELY ABSENT** |
| `branch`, `staging`, `staging_slug`, `pr_number`, `search_index` | — | written |

**Why staging omits them.** `site-chrome/_includes/footer_custom.html` renders
`short_sha`, `built_at` and `run_url` into the footer of **every** page, so
writing them per build changes every page on every deploy.

The client fills those three in from the **same `staging.json`** the banner
already fetches — one request, two consumers — and a failed fetch leaves
Jekyll's `| default: 'dev'` in place rather than blanking the footer, which is
the same third state §"The facts are fetched, not baked" requires of the
banner. On main there is one copy and nothing to deduplicate, so the include's
own reason stands: *"a stale browser cache and a deploy that has not run look
identical."*

**Adding a per-build field back to the staging stamp will not fail a test.**
`staging-banner-constant.test.ts` compares the banner **fragment**, which is
genuinely constant; the footer is not in it, because it lives in a Jekyll
include rather than in the workflow's injection step. Check the deploy commits on
`gh-pages`, not the code, to confirm pages do not differ across rebuilds.

A Jekyll layout can read `site.data.build.sha` to display the deployed
version — on main. Under a preview, read it from `staging.json`.

### 4. Before/after comparison

The reviewer opens both URLs side by side:

| Surface | URL | What it shows |
|---|---|---|
| **Main** (current) | `<pages-url>/` | The published state on `main` |
| **Staging** (proposed) | `<pages-url>/branches/<slug>/` | The feature branch's changes |

The commit SHA on each page confirms exactly what is being compared.

### 5. Cleanup

When the PR is merged or closed, the `cleanup` job in `feature-staging.yml`
removes `branches/<slug>/` from `gh-pages` so stale previews don't accumulate.
The full retention rules — merged vs closed-unmerged, the label, the dispatch —
are in [`staging-review`](staging-review.md) §"Staging retention".

### 6. The cap — 3 GB of previews in total, the oldest rotated off

Previews are capped **by size, at 3 GB in total**, and the oldest are rotated
off. The cap is by size rather than count because one preview can run to
hundreds of megabytes. Per-PR cleanup bounds nothing in total, every preview is a full copy of
the site, and a `gh-pages` branch past GitHub's 10 GB Pages limit freezes the
live site.

So every `stage` run, inside its push loop, runs
`cat-harness-tools/scripts/staging-rotate.ts`: it stamps the preview it is staging
(`branches/<slug>/.staged-at`), keeps that one plus the most recently updated
others while the total fits `MAX_PREVIEW_BYTES` (3 GB, 3 x 1024^3 bytes, defined
there and nowhere else), and removes the rest, oldest first — each with a `removed` render-log entry, its record retired into
`branches/_retired/`, and a line (slug, age, size) in the commit message and
job log. `_retired/` and non-preview entries are never touched.

Two things to know when editing it:

- **The push loop re-reads `gh-pages` on every attempt; it does not rebase.**
  The commit carries removals decided against one read of the branch, and a
  replayed removal is a stale one — it could delete a preview another run has
  just refreshed. Same shape as `publish-gh-pages.sh`.
- **A rotated-off preview is regenerated by the next push to its PR branch.**
  It can reach an OPEN PR's preview; the cost is a 404 until the author
  pushes, not lost work. Detail and the reviewer's
  remedy: [`staging-review`](staging-review.md) §"The cap".

### 7. The cone — a preview rebuilds only what a changed file can reach

A preview rebuilds only the dependency cone of the changed files, at FILE
level, with each derived directory's generator declared as `writer`. The rule
is general across rendered kinds.

A rendered directory is **in the cone** when a changed file is

1. under its own path (its pages, or its source data), or
2. in the import closure of a `writer` it declares, or under a writer
   directory (a path ending in `/`: what a generator reads, such as its
   templates, rather than imports), or
3. in a directory it is `derivedFrom`, transitively (`check:derived-from
   --downstream <instance/id>` prints that half on its own).

`cat-harness-tools/scripts/staging-cone.ts` computes it; `compose-docs.ts`
`carriedInstances` applies it to the composed layers. Three rules:

- **Any doubt carries.** No file list, a writer that does not exist, or an
  import that does not resolve carries the directory, with the reason in the
  build log. A preview missing the pages under review misleads a reviewer,
  while an oversized one only costs bytes.
- **A computed `import()` is bounded, not ignored.** It can load only a
  module, so it carries on a changed module file and never on a page. The two
  such sites a generator reaches today (`harness-config.ts`'s `contributes`
  loader and `block-module.ts`'s block loader) have DECLARED targets and are
  walked exactly; `DECLARED_COMPUTED_IMPORTS` lists them.
- **The instance-prefix match is a floor.** The cone can only add to it.
  Narrowing below it is a separate decision, made once the cone has been
  measured in previews.

A skill-only change carries no IG; a change to `gen-ig-pages.ts` or to the
DAK layer's `themes/chrome.json` carries all three. `staging-cone.test.ts`
holds these cases as tests.

**Built sites follow the same rule.** An IG's own Jekyll site and its AST
site are BUILT in the preview from an upstream repository pinned in the
layer's own files, not composed from the checkout. `stage-ig-sites.ts` and
`stage-ast-sites.ts` take `--changed-files` and stage only the layers
`siteInCone` reaches. Its reasons, in order: no file list; a change to the
build environment (`SITE_ENVIRONMENT`: the docs Gemfile and this workflow); a
change under the layer; the cone reaching any of the layer's
directories (a theme change arrives this way); or a change in the stager's
closure. Each decision is printed with its reason.

**When you add a generated directory, declare its `writer` and
`derivedFrom`.** Without them the cone cannot reach it through code or data,
and the prefix floor is all it gets.

### 8. The rate limit — a preview never cancels the main site's Pages build

Staging previews are pushed to `gh-pages` at a limited rate. GitHub's `pages
build and deployment` keeps only the NEWEST run, so every push cancels the
build in flight, the main site's included; a build takes about three
minutes.

So before each push attempt the `stage` job re-reads `gh-pages` and runs
`cat-harness-tools/scripts/staging-push-gate.ts gate`, which holds the push until the
branch tip is old enough:

| tip of `gh-pages` | wait until it is |
|---|---|
| a staging commit (`staging(...)`) | `STAGING_WINDOW_MS` — 5 min |
| anything else: the main-site publish, `publish.yml`, any other publisher | `MAIN_WINDOW_MS` — 10 min |

The numbers live once, in that script. Exit `75` means it slept until the
window should open (plus up to a minute of jitter) and the loop must re-read
and ask again; exit `1` means the job has waited `MAX_WAIT_MS` (two hours) and
fails rather than pushing; exit `2` is an unreadable tip, never read as open.

Three things to know when editing it:

- **git's fast-forward rule is the lock.** Two jobs that both find the window
  open both build on the same tip; one push is rejected, re-reads, finds a tip
  younger than the window, and waits. So at most one staging push lands per
  window with no shared state. A rejection whose tip MOVED is therefore a lost
  race, sent back to the gate without spending one of the three attempts; only
  a rejection with the tip unmoved counts as a failure.
- **No concurrency group, and none should be added.** Every waiting preview
  would pend in one group and each arrival would cancel the last. The
  per-branch group at the
  workflow level stays: a newer push to the same PR cancels a preview still
  waiting at the gate, so a superseded preview is never pushed at all.
- **A staging push BEFORE a main-site push is harmless; only one AFTER it
  cancels the build that matters.** The main push then cancels the staging
  build, and the build that runs carries both. That is why the gate looks at
  the tip, and why it does not wait for `docs-site` runs that have not pushed
  yet.

A rate limit is used rather than a batching flush job because the gate is one
script and one loop whose correctness rests on git, while a flush job needs a
second workflow, an artifact round trip per preview, a record of what is
deployed, a best-effort schedule and a write token over content built from a
pull request. The cost is latency under load: with K previews waiting, the last one pushes
about 5 × K minutes later, and the PR comment gives its own estimate.

The `cleanup` and `cleanup-dispatch` jobs do NOT pass through the gate. They
push once per closed PR rather than once per push.

### 9. Build types — `preview` and `full`

There are two build types. A public comment (PC) build is a full build, and
so is a release.

| build type | used for | builds |
|---|---|---|
| `preview` | every pull request's `branches/<slug>/` preview | only what the change can reach (the cone, §7); every whole-corpus **index** is main's copy, put back rather than rebuilt |
| `full` | the main site deploy, a public comment release, a release | everything; every index rebuilt from the tree being published |

An **index** is computed over the whole corpus: the search index, the LSI
viewer, the SQLite slices, the handler index, the glossary pages, the
translation status pages and the node-kind pages. A `builtAtPublish` entry
says so with `index: true`; a writer is borrowed only when every entry it
writes says so. Rebuilding an index in a preview shows the reviewer almost
nothing and costs minutes, so in a preview `derive:publish` puts back main's copy from main's
writer-cone recording and logs `borrowed <writer>`; the search index is served
from main the same way (§"Serve the published search index" in the preview
workflow). So a preview of a glossary, translation or node-kind change shows
main's copy of those pages: review such a change on a `full` build (dispatch
with `build_type: full`) or in its source.

The switch is `CAT_BUILD_TYPE` (`cat-harness-tools/scripts/lib/build-type.ts`).
**Any doubt builds full**: unset means `full`, and a value that is neither word
is refused. A preview whose main recording holds no copy of an index builds it.

**A public comment release must be frozen from a full build.** A frozen
release is cited by page and line for the whole comment period, so its search
and slices must describe the draft, not main. Dispatch the preview workflow
for the branch with `build_type: full`, then run `pc:release freeze`. Freeze
refuses a copy whose `staging.json` says `buildType: "preview"`, and records
the build type in `release.json`.

### 10. Agent-built previews — deferred on the critical path, verified by a full CI rebuild

When an agent builds and pushes a preview with `stage-local.ts`, it writes
`branches/<slug>/_build-record.json` (`scripts/preview-record.ts`)
recording `builder: "agent"`, the git tree hash `tree` of the source tree it
built (`HEAD^{tree}` or the merge tree with `origin/main`), the `head` and
`base` commit SHAs, and the SHA-256 of every deployed file outside the
per-build metadata (`staging.json`, `_build-record.json`, `.staged-at`,
`build.yml`).

When `feature-staging.yml` runs on the pull request:

1. **Defer on the critical path.** `conflict-gate` checks
   `branches/<slug>/_build-record.json` on `gh-pages`. When `builder` is
   `"agent"` and `record.tree` equals `MERGE_SHA^{tree}` (`refs/pull/<n>/merge`),
   the preview is already live for that exact merge tree: the workflow sets the
   `preview/agent-build` commit status on the PR head to `pending`, posts a
   `<!-- preview-build-verify -->` notice on the PR, and skips the critical-path
   `stage` build so the runner is free. Any missing record, CI-built record, or
   tree mismatch (including when `main` moved under the branch) builds on the
   critical path as usual.
2. **Verify off the critical path.** `preview-verify-sweep.yml` (triggered when
   `feature-staging.yml` completes and on a 15-minute schedule) checks that no
   Feature Staging run is queued or in progress, finds the oldest open PR whose
   head commit has `preview/agent-build` in state `pending`, and dispatches
   `feature-staging.yml` with `verify_pr=<number>`.
3. **Compare or replace.** The verify run rebuilds `refs/pull/<n>/merge` in full
   and runs `preview-record.ts compare` against the agent's `_build-record.json`
   on `gh-pages`:
   - **Files match (`same=true`)**: nothing is redeployed; `preview/agent-build`
     is set to `success` (or `failure` if a built-site check failed) and the PR
     comment records the verified tree.
   - **Files differ (`same=false`) or the base moved (`same=stale`)**: CI's
     build is deployed to `branches/<slug>/` (guarded so a newer preview tree is
     never overwritten) with a `rendered` log entry, and when the agent's build
     differed, `preview/agent-build` is set to `failure` with the differing file
     paths listed in the PR comment.
   - **Merge guard**: `merge-guard` check 5 (`src/coordinator/merge-guard.ts`)
     reads `preview/agent-build` alongside check runs; `pending` holds the PR as
     not ready, and `failure` refuses the merge.

## Agent workflow

When an author requests a content change:

1. **Detect scope** — use `content-graph` and `integration-watcher` to
   identify affected blocks and downstream implications
2. **Create feature branch** — branch from `main`, open PR immediately
3. **Make changes** — edit content blocks, deterministic logic, translations
4. **Push** — on a folio whose `staging.yml` runs on push, the staging
   deployment happens automatically. On an agent-run repository, run
   `stage-local.ts` (below).
5. **Report staging URL** — tell the author the preview is at
   `<pages-url>/branches/<slug>/`
6. **Iterate** — each push updates the staging deployment with a new SHA

The BPMN for this workflow is the content core's `processes/content/content-change-review.bpmn`.

### Publishing without a runner — `stage-local.ts`, one command

When the Actions queue is backed up, the agent can build and publish itself:
it already has the checkout, the platform and bun.

On an **agent-run** repository (below) this is not a shortcut. It is the only
publish path. It is one command for a preview and for the main site, for a
folio and for a FHIR IG:

```sh
bun run cat-harness-tools/scripts/stage-local.ts --repo <repo> --plan        # what it would do; nothing built
bun run cat-harness-tools/scripts/stage-local.ts --repo <repo> --dry-run     # build, compose the commit, push nothing
bun run cat-harness-tools/scripts/stage-local.ts --repo <repo>               # build and push
bun run cat-harness-tools/scripts/stage-local.ts --repo <repo> --artifact <dir>
```

It prints its plan first, every time: which workflow it mirrors, where the
output lands, what it replaces and what it keeps, the commit message, and
what it does not run.

**The size review.** Owner, 2026-11-10: *"add size review as part of
authoring process"*. Every build, preview or main, prints a size report
before its push (`site-size.ts`, `bun run cat site:size`). The report gives
the total against the published root, the top directories, the size by
extension, the biggest files, byte-identical duplicates, source maps, the
directories named after another layer of `index.lock.json`, and the
directories the shared-assets host could serve. It writes `site-size.json`
beside the build, never into the site. The review is advisory: growth over
10% or 10 MB is a warning, and nothing is refused. Read the report before you
hand over the preview. The usual culprits each have one fix:

- another layer's pages copied in: link that layer's own site;
- the same bytes under several names: publish one index, and serve each file
  once;
- vendored libraries: serve them from the shared-assets host;
- `.map` files: do not publish them.

When the growth holds and none of these fixes applies, raise a decision card
with the owner, with the comparison line and the top contributing directories
on it.

**Which publisher** is read from the repository's own workflow files, from the
reusable workflow each one calls:

- a caller of `folio-staging.yml` is a **folio**. The build inputs
  (`build_command`, `site_dir`, `publish_branch`, …) are read from that
  caller.
- a caller of a reusable workflow that a mounted layer declares as a **site
  publisher** is that publisher's kind. The IG layer declares one: a caller
  of its `fhirbuild.yml` or `ghbuild.yml` is an **IG**, published by that
  layer's own code, which `stage-local.ts` reaches through the layer's
  declared `site-publisher-ig` pipeline slot and never by path. The
  reusable workflow is fetched at the ref the caller names, and its build job
  is run step by step as written: `run:` blocks with the environment a runner
  gives them, `docker://` steps in their image. Steps that read a secret, push
  to the source branch, or need an Actions runtime are skipped, and the plan
  names each one with its reason. `fhirbuild.yml` itself only triggers
  build.fhir.org's auto-build, so the Pages build is the `ghbuild.yml` beside
  it, and the plan says so.
- a repository that calls both (smart-ra carries an IG under `input/`) gets
  the **folio**, unless `--publisher ig` is given. The folio owns the publish
  root. An IG's root deploy is a clean one, and it is refused on a publish
  branch that holds a folio's `branches/`, `_render-log/` or `_main-site.json`.

**Main site or preview** follows the branch, as the workflows do. The default
branch publishes the main site; any other branch publishes a preview.
`--main` says the same explicitly, and it is refused off the default branch.
The main site is published only from a HEAD that is the pushed tip of the
default branch.

| | folio | IG |
|---|---|---|
| preview | `branches/<slug>/`, replaced wholesale; held by the rate-limit gate (§8); commit `staging(<slug>): from <sha>`; render log `staging-preview` | `branches/<last path component>/`, nothing deleted; commit `Deploy candidate branch` |
| main site | the root, through `publish-main-site.ts`: only the files the last publish's `_main-site.json` lists are replaced, and `branches/`, `_render-log/` and anything a person put at the root are kept; commit `main-site: from <sha>`; render log `main-site` for `/` | the root, cleaned except for the deploy step's `clean-exclude` (`branches`, `sitepreview`) and the action's own exclusions; commit `Deploy main branch` |

Every path refuses an empty build before it deletes anything.

- **Pushing removes the first wait and not the second.** Pages deploys on a
  runner, so say the page is live once that deploy has run, never sooner.
- **`--artifact <dir>`: no GitHub at all.** It writes the same build as a
  bundle for a claude.ai Artifact: `index.html` plus the files listed in
  `<dir>/artifact.json`. Publish that, and it is live in about a minute,
  private until shared.
  - An Artifact holds at most 254 files plus the page per publish. Whole
    top-level directories are left out to fit, the ones with the most files
    first. `artifact.json` names each one, and links into a left-out
    directory 404.
  - Before publishing a folio whose content belongs to a real organisation
    (a WHO draft, say), ask the author: an Artifact is a new place that
    content appears.
- **What it does not do, and says in its plan:**
  - the folio preview's QA sweep, screenshots, review-comment ingestion and
    PR comment (the banner says the preview was built locally);
  - the IG workflow's PR comments, its branch-history page and README
    write-back (each reads a token, or writes the source branch);
  - the IG deploy action's `single-commit`, which force-pushes one orphan
    commit and erases the publish branch's history. This path commits on top
    and never force-pushes.
- **An IG build needs what its workflow needs.** The workflow runs IG
  Publisher in a Docker image, so a machine with no Docker daemon gets the
  plan from `--dry-run`, and a real run stops naming the missing
  prerequisite.
- **An IG repository's own site is built from its AST, not from the
  Publisher's HTML**. The repository declares `site.build` in its
  `index.config.json` entry (inline — never a `<instance>.config.json`), and
  that recipe's first step
  restores the AST from its cache branch and refuses one that is not valid for
  the commit. The cache is refreshed by a Publisher run on a runner, through
  the IG layer's reusable refresh workflow. It is the one workflow an
  agent-run IG repository dispatches, and only a person, or an agent the
  owner names for that run, dispatches it. The layer that owns IG builds owns
  the rule and the workflow; this skill names no IG step.

### Agent-run repositories — the GitHub Actions path is documented, not run

A repository is **agent-run** when it says so in its own `index.config.json`:
`"site": { "agentRun": true }`. An agent builds and publishes its site, and
its publish workflow keeps only `workflow_dispatch`. This skill keeps no list
of them: the declaration is the list, and
`stage-local.ts` says in every plan whether the repository declares it. For
these repositories the GitHub Actions path is
**documentation**. It says what the workflow does, so that the agent path can
match it. It is not a fallback for an agent to take.

| what | agent path | GitHub Actions path (documented, not run) |
|---|---|---|
| a folio preview at `branches/<slug>/` | `stage-local.ts` from the branch | `folio-staging.yml` job `stage` |
| a folio's main site at the Pages root | `stage-local.ts` from the default branch | `folio-staging.yml` job `publish-main` |
| an IG preview at `branches/<branch>/` | `stage-local.ts` from the branch | the IG publisher's `ghbuild.yml`, "Deploy candidate" |
| an IG's main site at the Pages root | `stage-local.ts` from the default branch | the IG publisher's `ghbuild.yml`, "Deploy main" |
| QA sweep, screenshots, review comments, PR comments | not run (the plan says so) | jobs in the workflows above |

**Never dispatch the workflow, to cover a gap or for any other reason**: a
dispatched run contradicts the repository's agent-run setting. When the agent
path cannot do a step, say which step it is and ask.

**Skills that drive GitHub Actions are not to be implemented.** Document what the workflows do, here and in the workflow
files, so that an agent-run step can be checked against them —
`stage-local.ts` reads the workflow files rather than restating them, so a
change to a workflow's build or layout is a change to the agent path too.

## Staleness detection

The SHA stamp means staleness is always detectable:

- **Staging matches PR head** → the staging preview is current
- **Staging SHA ≠ PR head** → the staging preview is stale (push again)
- **Main site SHA = merge commit** → the publication is current
- **Main site SHA ≠ latest main** → docs-site.yml needs to run

## Example — a change that spans several blocks

An author needs to change the immunization schedule:

1. Agent detects the change affects:
   - Narrative content in the immunization chapter
   - Decision logic (CQL) for scheduling the next visit
   - Indicators that count doses administered
   - Referral logic for follow-up visits
2. Agent creates `feature/update-immunization-schedule`
3. Agent edits all affected blocks, assesses downstream impact
4. Push → staging deployment → author reviews
5. Author submits to the guidance review committee
6. Committee compares `main` vs `branches/feature-update-immunization-schedule/`
7. Committee approves → merge → staging cleaned up → main site updated

## Before you hand a staging URL to a person

**Check the ref, then say how long and come back.** A preview push is not a
served page, and the bot's *"Staging preview"* comment reports at most the
first, not the second — and while it says **queued**, not even that. List
`branches/<slug>/` on `refs/heads/gh-pages` before relaying the URL; quote the
comment's own push and live-by times (the rate limit in §8 can hold a push for
several windows), or say the `stage` job takes about 22 minutes plus the wait
and Pages adds 3 to 4 on top; schedule the re-check rather than promising it.

The three states, and why the third is not yours to assert, are in
[`staging-review`](staging-review.md) §"Before you hand a staging URL to a
person (STRICT)". It is the same rule and it is written once, there.

## Before you report a staging URL as broken

**Look at the publish ref, not the site.** A staging URL is LOOKED UP in
`gh-pages` under `branches/<branch-slug>/`, never composed from the source
path — `cat-harness/docs/guides/x.md` publishes to
`/docs/cat-harness/guides/x.html`, and composing it from the source path
yields a 404 for a page that is there. From
an agent container a `curl` against a Pages URL fails on the proxy regardless,
so a failed fetch is not evidence either way.

Full rule:
`github-state-inspection` (opt-in `cat-harness.sdlc`).

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md).

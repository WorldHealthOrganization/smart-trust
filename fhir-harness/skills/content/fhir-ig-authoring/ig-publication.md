---
input: schemas/skills/ig-publication/input.schema.json
output: schemas/skills/ig-publication/output.schema.json
---

# ig-publication

> Skill id: `ig-publication` · Package: `fhir-ig-authoring` ·
> Named by activities in `l3-fhir-pipeline.bpmn` (`Build pipeline` and
> `Publication manager` lanes), `ig-incremental-build.bpmn` (`Incremental
> build`, `Publisher + validator services (JVM)` and `Publication manager`
> lanes), `ig-ast-cache.bpmn` (`Site build` lane, the size review) and
> `ig-release.bpmn` (the owner's tag).

Build a FHIR Implementation Guide and publish it: version, tag, assemble the
site, deploy.

> **Sourcing.** The IG Publisher and the FHIR publication process are HL7's;
> an IG's own publisher sets its release conventions. This skill states how
> publication is wired **in this harness** — which lanes, which authority,
> which binaries — and defers to those for what a published IG must contain.

## Inputs and outputs

`fhir-harness/schemas/skills/ig-publication/`:

- **in** — `igRoot` (required), `versionIncrement` (required), `releaseNotes`,
  `publicationTarget`
- **out** — `version` (required), `publishedUrl` (required), `releaseTag`,
  `releaseBranch`, `publicationRequestPath`, `buildStatus`

How `versionIncrement` (`"major" | "minor" | "patch"`) is chosen from the AST
delta against the previous release, and which files in `igRoot` are
authoritative source versus compiled, cached or rendered output, is defined in
[`ig-build-pipeline`](../../fhir-ig-base/ig-build-pipeline.md) §"Source of
truth versus compiled, cached and rendered output" and §"Version numbering:
SEMVER for a FHIR IG".

## Authorising a release is not the same as managing one

Two permissions, two holders:

| permission | held by | means |
|---|---|---|
| `release-authorization` | `programme-manager`, `admin` | may decide a release happens |
| `release-management` | `publication-manager` | may configure, build, version and deploy one that has been authorised |

`draft-to-publication.bpmn` marks `Task_AuthorizeRelease` and
`Task_PublishRelease` **`relaxable="false"`**: no package's
`workflow-policy.json` may relax either, with or without a reason.

**An agent never records the authorisation.** `skills/requirements/agent-workflow.json`
states it as a SHALL: an agent shall not record an approval, a sign-off or a
decision to release on a human's behalf. Building the artefact is this
skill's job; deciding it ships is not.

## The toolchain

```sh
java -jar "${IG_PUBLISHER_JAR}"    # default /opt/ig-publisher/publisher.jar
jekyll build                       # site assembly
```

`ig-publisher` is a declared capability of this package and requires
`java-runtime`; `jekyll` is not one of its declared capabilities.

## What the Publisher run produces

The Publisher is **one step** in an IG's build. An overlay may wrap it in
pre- and post-processing of its own, which that overlay's skills describe;
this layer names none of them. The run itself produces:

| it produces | notes |
|---|---|
| `output/` — the rendered site | HTML per resource and per page, from `input/pagecontent/` and `sushi-config.yaml`'s `pages:` |
| `{ResourceType}-{id}.json` per resource | the **structured** surface everything downstream reads |
| `.xml` and `.ttl` per resource | not read, rendered or linked by this platform — see the JSON-only contract in [`ig-render-jekyll`](../../fhir-ig-base/ig-render-jekyll.md) |
| `package.tgz` → `package/.index.json` | filename / resourceType / id, index-version 2 |
| `canonicals.json`, `package.manifest.json` | partial views of the same artefact set |
| `artifacts.html` | the **only** source of an artefact's category |
| `qa.json` | the validation record, uploaded as a workflow artifact |
| POT files | extracted translatable strings |

**It also does two things no post-processing step can.** It *validates*
every resource against its profiles and the declared FHIR version, and it
*resolves* the dependency closure (`hl7.terminology`, `hl7.fhir.uv.cql`,
`hl7.fhir.uv.cpg`, `hl7.fhir.uv.crmi`, `hl7.fhir.uv.sdc` for a
clinical-reasoning IG) with version pinning and terminology expansion against
`tx`. A cache cannot fake that resolution, which is why the
[phased transition](../../fhir-ig-base/ig-publisher-reduction.md) keeps the
Publisher for the AST and QA.

### Where it is invoked from

Inside Docker (`hl7fhir/ig-publisher-base`), with `publisher.jar` downloaded
from the latest release on **every** run. The toolchain version is therefore
not pinned: two builds of an unchanged commit can differ.

## Full build versus restored state

`ig-incremental-build.bpmn` restores derived state and assembles the site
without a full publisher run, fast enough for an authoring loop. A release is
cut only from the **full publisher build** in that same diagram, in the JVM
services lane. Never publish from restored state: the site looks right and was
never built by the publisher the release claims produced it.

## Cutting a release

A release starts from a `v*` tag, never from a site deploy, and the tag is
the owner's: releasing is a governance decision (`ig-release.bpmn`,
`Task_Tag`). The owner tags the commit that set the current version in
`sushi-config.yaml` with `v<version>`; an agent never picks a version or
pushes a tag. Pushing the tag
runs the IG's `ig-release.yml` (template
`templates/ig-repo-site/ig-release.yml`): a full AST build, then
`ig-release.ts` makes a GitHub **draft** release carrying `package.tgz` (and
its R4/R4B variants), `ast-data.zip` and `SHA256SUMS`. Publishing the draft
is the owner's `Task_AuthorizeRelease`; a workflow never changes a published
release. The files, the pre-release rule and the order are
[`ig-binary-artefacts`](../../fhir-ig-base/ig-binary-artefacts.md)
§"Releasing". The site itself is published from the AST cache
(`ig-ast-cache.bpmn`) and carries none of these files.

**Catch-up.** Every AST refresh of the default branch runs
`ig-release.ts check`, which reports, as a notice, a current version with no
tag (naming the commit to tag) or a tag with no release (run
"IG release (draft)" by hand for it). Relay the notice to the owner; do not
act on it. The details are `ig-binary-artefacts` §"Catching up a version
that was not tagged".

## Report the URL only once it answers

`publishedUrl` is a measurement. A deploy that has returned is not a site that
serves — GitHub Pages takes minutes on a first publish. Probe it, and until it
answers report `not-yet` or `unknown`, never a live URL.
`scripts/pages-bootstrap.ts` implements this three-state probe and
`decisions/pages-live-gate.dmn` states the same logic as a table.

## Pages of statements extracted from the IG's sources

When the IG draws on library sources, the statements extracted from them are
published as pages of the IG before the Publisher runs, each linked to its
library entry and section. That is core's standard step
(`publish-extracted-statements`, `bun run cat statements:pages`), the same for
every content type. What the IG supplies is its look, and nothing else:

- the page spec's `out` is a page under the IG's own page content directory,
  so the Publisher and the site route render it like any other page;
- its `tableAttr` is the kramdown class the IG's tables use (for example
  `{:.grid}`);
- the page is registered in the IG's own `sushi-config.yaml` pages and menu.

`statements:pages --check` runs in the IG's CI, so a page that no longer
matches its extraction fails the build.

## Size review

Owner, 2026-11-10: *"add size review as part of authoring process"*. An IG's
Pages site had reached 216 MB and was brought back to about 25 MB by hand.
The review exists so that it does not grow back. It is a step of every
publish (`ig-ast-cache.bpmn`, `Task_SizeReview`, after `Task_BuildSite`). It
is **advisory**: it warns and never refuses a publish, unless the owner later
rules otherwise.

**What runs.** Every local or preview build through `stage-local.ts` /
`build-instance-site.ts` prints the size report (cat-harness-tools
`site-size.ts`). It writes `site-size.json` beside the build (in
`<repo>/../<instance>-site/`, next to `_site/`), never into the published
site. To run it by hand:

```sh
bun run cat site:size --site <build>/_site --lock index.lock.json \
  --against-ref origin/gh-pages --repo .        # git fetch origin gh-pages first
```

The build compares with the published root when the build has read it (a root
build's parity guard). Otherwise it compares with the local `origin/gh-pages`
(`git ls-tree -r -l`, which reads no blobs), and failing that, with the last
`site-size.json`. The previews (`branches/`, `STAGING/`), `_render-log/` and
`PC/` are not counted as the site.

**What to look at, in this order:**

1. **The total and the comparison line.** A `⚠ the site grew` line means the
   build is more than 10% or 10 MB over the published site (`--budget-pct`,
   `--budget-mb`). Find which top-level directory and which extension
   account for the growth.
2. **Directories named after another layer.** The instance list comes from
   `index.lock.json`. Another layer's pages, artefact index or assets in this
   site are a copy.
3. **Byte-identical files.** The same bytes published under several names:
   one index as `.json` and `.jsonld`, a resource beside its `.source.json`,
   a script under two paths.
4. **Source maps.** Any `.map` file.
5. **Shareable directories.** Directories the shared-assets host could serve,
   but the site still carries.
6. **The biggest files and the extension table**, for whatever is left: a
   bundle, a schema, a database, an image set.

**The usual culprits, and their fixes:**

| culprit | fix |
|---|---|
| vendored libraries (form renderers, the Form Builder, WebAssembly builds, editor bundles, harness images) | serve them once from the shared-assets host the IG names in `index.config.json` `site.sharedAssets` (cat-harness-tools `lib/shared-assets.ts`); a directory the host does not serve yet stays local, and the build says so |
| another layer's pages, index or assets | link that layer's own site rather than copy it (the scoped site's relinking; `ig-site:bar` leaves out another IG layer's artefact index); the owner's ruling is that another layer's content is cross-referenced, not copied |
| AST resources, sidecars or the artefact index mirrored onto the site | point at the raw URL of the file at the AST cache commit (§"The AST cache lifecycle" of [`ig-build-pipeline`](../../fhir-ig-base/ig-build-pipeline.md)): the pages read each full resource there, the sidecars from its `ig-api/`, the index through `fhir-artifact-index/index.ref.json`. Each resource is served once at the root as a REDUCED `<Type>-<id>.json` (no narrative, no ELM data: 13 MB instead of 47 MB on one measured IG); `SITE_ROOT_RESOURCES=0` drops them |
| source maps | not published: strip `.map` files and their `sourceMappingURL` comments at build |
| several indexes of the same artefacts (`index.json`, `index.jsonld`, a search index, a menu) | one index, from which the others are derived in the browser or left out |
| Publisher binaries (`full-ig.zip`, `package.tgz` variants, validator packs) | release assets, not pages-branch files ([`ig-binary-artefacts`](../../fhir-ig-base/ig-binary-artefacts.md)) |

**When to raise a card with the owner.** Raise a decision card when the growth
warning holds and none of the fixes above applies. Raise one also when the
fix would drop content a reader uses, or when it needs a parity ruling (the
published root carries something this build would no longer carry). Put the
comparison line, the top three contributing directories and the proposed fix
on the card. The review stays advisory, so a preview may still publish while
the card is open. Do not widen the budget to silence the warning.

## Afterwards

`quality-control` runs the QC gates on what was built; the summary goes on the
issue, not only the PR.

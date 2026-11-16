---
name: ig-binary-artefacts
description: >
  Where the IG Publisher's binary outputs go — full-ig.zip, package.tgz and
  its R4/R4B variants, package.db, validator packs, and the definitions,
  examples and expansions zips — and why a pages branch is the wrong place
  for them. Measure a branch with ig-binary-audit before deciding anything.
  Read before configuring an IG's deploy or release step, before linking a
  download from a page, and before a pages branch grows past its size limit.
---

# ig-binary-artefacts

> Skill id: `ig-binary-artefacts` · Package: `fhir-ig-base` · Layer:
> `fhir-harness` · Tool `ig-binary-audit`

## What the Publisher writes

Besides its pages, an IG Publisher run writes about twenty binary files into
`output/`. `PUBLISHER_BINARIES` in `fhir-harness/scripts/ig-binary-audit.ts`
is the list, not this paragraph. They fall into three groups:

- **The package.** `package.tgz` (with `package.r4.tgz`, `package.r4b.tgz`
  and sometimes `package-combined.tgz`) is what a FHIR tool installs. It is
  the one binary a consumer cannot do without.
- **Derived bundles.** `full-ig.zip` (the whole site), `package.db`,
  `validator.pack` and `validator-<id>.pack`, `ai.zip`, and the
  `definitions`, `examples` and `expansions` zips in JSON, XML and Turtle.
  Each is recomputable from the package or the build.
- **Spreadsheets.** `csvs.zip`, `excels.zip`, `schematrons.zip`, and
  `spreadsheets.zip` where a script bundles the loose `.xlsx` files.

## Why a pages branch is the wrong place

A pages deploy copies `output/` as it is. Each **branch preview** is another
full copy, and git keeps every byte for good. GitHub Pages publishes at most
1 GB; on one measured IG `gh-pages` branch, 966.5 MB were Publisher binaries
and 94 % of those were copies in 29 branch previews (`full-ig.zip` alone:
30 copies, 644.7 MB). Deleting files over 100 MB before deploy removes none
of these, because each copy is under the limit.

## Where each one goes

1. **A preview carries no binaries.** A reviewer reads pages, and binaries
   are published only on releases.
2. **A release carries the package and whatever the IG promises to
   distribute.** Upload them as release assets, and link the release from
   the downloads page. The link names the repository it is built in, never a
   hard-coded upstream.
3. **The knowledge graph points at release assets and does not hold them.**
   `fhir-artifact-index/releases.json` (`ig-releases/v1`) records each asset's
   name, size, digest and download URL. Anyone who wants the bytes fetches
   them from there. `ingest-ig-releases` (Tool of the same name) writes it
   from GitHub's release list.
4. **The IG's just-the-docs site lists them** on a generated `releases`
   page (`fhir-harness/scripts/templates/ig-site/releases.liquid`): file, size and SHA-256 per
   release, each linking to the asset.
5. **The published IG's root may keep `package.tgz`**, since FHIR tooling
   fetches `<canonical>/package.tgz`. Nothing else needs to be there.
6. **What this pipeline renders from the package reads it from the served
   knowledge graph**, never from a pages branch. The resource JSON views
   fetch the `package.tgz` that `ig-index:build` writes into
   `fhir-artifact-index/` at publish.
7. **Each resource is at the site root as `<Type>-<id>.json`, reduced.**
   FHIR readers expect the Publisher's names beside the pages, so the site
   serves every resource of the AST there (fhir-harness#359), but not
   whole: minified, with no `text` narrative, and each Library ELM
   attachment (contentType naming `elm`) without its `data`, pointing by
   `url` at the full resource in the AST cache. The CQL is a link too: `url`
   at the IG's `.cql` source, or else the full resource. On one
   measured IG that is 13 MB instead of 47 MB. The full resources
   are the AST cache commit's (by raw URL, which the pages read) and the
   release's `package.tgz` and `ast-data.zip`. `SITE_ROOT_RESOURCES=0`
   turns the root copies off ([`ig-build-pipeline`](ig-build-pipeline.md)
   §"What the site serves from the AST").

## Releasing

The owner set this process on 2026-11-09 (Q-REL-1 "A"). A release is cut
from a tag, carries the same files every time, and is published by a
person. The process is
[`ig-release.bpmn`](../../processes/content/ig-release.bpmn).

1. **The owner tags the IG's current version.** Releasing is a governance
   decision: the owner tags the commit that set the version in
   `sushi-config.yaml` with `v<version>` (for example `v0.2.0`) on the
   default branch, and pushes the tag. An agent never chooses a version,
   never pushes a tag and never publishes a release; it reports what is
   missing (below) and stops.
2. **The tag starts the build.** Pushing the tag runs the IG's
   `ig-release.yml` caller (template:
   `templates/ig-repo-site/ig-release.yml`). It can also be started by hand
   for an existing tag.
3. **The build is full.** The caller runs `ig-ast-refresh.yml` with
   `force` and `release` set. A release is never cut from an incremental
   AST.
4. **Every release carries the same files.** `ig-release.ts assets`
   gathers them:
   - `package.tgz`, plus `package.r4.tgz` and `package.r4b.tgz` when the
     build wrote them;
   - `ast-data.zip`, the IG's AST, whose Library resources keep their ELM;
   - `SHA256SUMS`.

   The Pages site serves neither the AST nor the ELM: its root
   `<Type>-<id>.json` copies are reduced (rule 7), and the ELM ships here. A build with no `package.tgz`
   is refused.
5. **It is made as a GitHub draft.** `ig-release.ts draft` makes the draft
   and uploads the files. If the tag already has a draft, its files are
   replaced. If the tag already has a published release, it is refused,
   because a published release is never changed by a workflow.
6. **The owner publishes it.** Publishing the draft on GitHub is
   `Task_AuthorizeRelease` in `draft-to-publication.bpmn`. Until then nobody
   but the repository's writers sees it, and `ingest-ig-releases` leaves it
   out of `releases.json`.
7. **A ballot, draft or CI-build version is a pre-release.**
   `ig-release.ts kind` reads `sushi-config.yaml`:
   - a version with a pre-release suffix (`1.0.0-ballot`) is a pre-release;
   - so is a `releaseLabel` naming a ballot, draft, CI build, preview or
     snapshot;
   - anything else, including `STU1` and `trial-use`, is a release.

   Pre-releases are recorded in `releases.json` with their flag, and the
   site's releases page lists them.

A `ci-build` version the owner tags is released as a pre-release; one the
owner does not tag gets no release, and its Pages site is the preview.

### Catching up a version that was not tagged

Every AST refresh of the default branch runs `ig-release.ts check`
(advisory: it never fails the run, never tags and never releases). It reads
the version in `sushi-config.yaml` and prints a notice for what is missing:

- `version X is untagged: the owner tags commit <sha> with vX`. The commit
  is the one that last set the version (`git log -G` over
  `sushi-config.yaml`), not necessarily HEAD; when the history cannot say
  (a shallow clone), HEAD is named and the notice says so.
- `tag vX has no release: run "IG release (draft)" (ig-release.yml) by hand
  with tag vX`, for a tag pushed before the IG carried the caller or whose
  run failed.
- `vX has a draft release waiting for the owner to publish it`.

To run it by hand: `bun run fhir-harness/scripts/ig-release.ts check --ig .
--repo <owner/repo>` (a draft is listed only to a token that may write the
repository). An older version left untagged is not reported: only the
current one is a release the owner may still want.

## Measure before deciding

```sh
git fetch --depth 1 origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages
bun run fhir-harness/scripts/ig-binary-audit.ts --repo <checkout> [--ref origin/gh-pages] [--json]
```

It reads the git tree, not a checkout, so a multi-gigabyte branch costs a
depth-1 fetch and no disk. `--previews <prefix>` changes where previews live
(default `branches/`).

## Do not

- **Promise a download the release does not carry.** A downloads page that
  lists assets no release has is a reader sent to a 404. Check the list
  against the release's actual assets, not against the script that was
  meant to upload them.
- **Treat "under 100 MB" as fine.** The limit that matters is the branch,
  and the copies add up.
- **Delete binaries from a published pages branch on your own initiative.**
  Report the measurement and wait to be told
  ([`deletion-requires-confirmation`](../../../cat-harness/skills/conduct/conduct-core/deletion-requires-confirmation.md)).

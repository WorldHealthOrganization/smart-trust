---
name: package-release
description: >
  Cut a release of a repository's packages: decide the next version, write
  the release notes, tag, and create the release — for any repository, the
  platform or a folio. Publishing the built artefact to a registry is a
  separate, later step that a person starts.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Cutting a package release

A **release** is a version number that one commit keeps from then on: a tag,
notes that say what changed, and a record on the host (a GitHub release).
Anything that depends on the package names that version and gets exactly that
commit.

This skill is **general**: it is for any
repository that publishes packages, including a folio that ships its own. It is
**not** the skill for publishing a folio's *content* — that belongs to the
content layer above this one, where a person supplies the version when the
release is authorised. The two share the word
"publish" and nothing else: a package release versions **code**; a content
publication versions a **document**.

## The four steps, and who owns each

| step | what happens | who |
|---|---|---|
| 1. **Decide the version** | the next semver triple, from what changed since the last tag | a mechanism proposes it, a person may raise it |
| 2. **Write the notes** | what changed, grouped the way a consumer reads it — breaking first | a mechanism drafts them, a person edits |
| 3. **Tag and create the release** | one tag per package, `<package>-v<version>`, and the host's release record | a mechanism, after a person approves |
| 4. **Publish the artefact** | push the built package to its registry (npm, PyPI, …) | **a person starts it**, separately |

Step 4 is kept apart on purpose. A tag can be deleted; a version pushed to a
public registry cannot be taken back or reused. So the one step nobody can
undo is the one step no mechanism takes on its own.

## Step 1 — where the version comes from

Two ways to compute a bump. They can disagree, and the rule for that is
below.

- **From commit messages** (conventional commits): `feat:` is minor, `fix:`
  is patch, `feat!:` or `BREAKING CHANGE:` is major. Cheap, and what
  `release-please` does. Its weakness: **a commit message is a claim about a
  change, not the change.** A `feat:` commit that removed something a
  consumer uses gives a minor bump and a broken consumer.
- **From the declared surface**: diff what the package exports (for an
  layer, the graph `kg-export` walks: graph typologies, skill ids, tool ids,
  block kinds) between the last tag and `HEAD`. A removal is major; an
  addition is minor; neither is patch.

**When both are available, the larger bump wins.** You may always release a
bigger bump than computed; never a smaller one.

A version is an exact triple: **no ranges**, anywhere. A version that has been
tagged is **never reused**, even if its release was deleted.

## Step 3 — before you tag

- **The package must build from the commit being tagged.** Check its
  manifest's file list: every entry must exist. A release of a package that
  cannot be built is worse than no release, because it looks like one.
- **Only a package declared publishable is released.** For a layer, that
  means `publishable: true` in its `<name>.json` (`check:publishable`). An
  layer that has not declared it is *undecided*, not *no*, and is not
  released.
- **The configuration names only what exists.** A release tool pointed at a
  config file that is missing either fails or falls back to guesses. Neither
  is a release.

## Mechanisms

Each Tool that can do this names `package-release` in its `satisfies`; ask for
them with `tool_list` rather than relying on this list.

- **`release-please`** — the GitHub Action or CLI. Does steps 1–3 from
  commit messages: it opens a release PR, and merging that PR creates the tag
  and the release. **In this repository it is declared but not configured**:
  there is no config. Before one is written, the package must build and the
  layers to release must declare `publishable: true`.
- **By hand** — `git tag`, a CHANGELOG entry and the host's release form. The
  same four steps and the same rules; slower, and nothing to misconfigure.
- **`pack-tarball`** (`bun run cat-harness-tools/scripts/pack-tarball.ts`) — packages an
  layer into an npm `.tgz` tarball using `bun pm pack`, computing size and
  SHA-256 digest into a `folio-binary-release/v1` release record. See the
  [`npm-kg-distribution`](../../../skills/kg/kg-core/npm-kg-distribution.md) skill.
- **`package-release-workflow`** (`gh workflow run release-npm.yml`) — dispatches
  the release workflow across any repository (`--repo <owner/repo>`) via GitHub
  Actions. Automates tarball building, tagging, GitHub Release asset upload, and
  publishing to GitHub Packages / npm registries. Satisfies `package-release`,
  `npm-kg-distribution`, and `document-publishing`.

## What this skill does not do

- It does not publish a folio's content (the content layer does).
- It does not take in an upstream's release (`upstream-version-adoption`).
  That is the other side of the same event: someone else's step 3 is the
  start of your adoption.
- It does not push to a registry on its own (step 4, above).

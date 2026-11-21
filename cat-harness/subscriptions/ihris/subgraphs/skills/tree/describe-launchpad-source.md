---
name: describe-launchpad-source
description: >
  Describe a Launchpad (Bazaar) project as catalogue nodes by reference: its
  project, release series with their lp: branches, and releases with every
  file's MD5, without copying any source. Use when adding a Launchpad project
  to this knowledge base or refreshing one.
input: src/schemas/skills/describe-launchpad-source/input.schema.json
output: src/schemas/skills/describe-launchpad-source/output.schema.json
---

# Describe a Launchpad source

**Principle:** the source stays on Launchpad. What lands here is a
`folio-catalogue-node/v1` per project, series and release (`materialization.state:
"referenced"`, `provenance.upstream` = the Launchpad URL), each with an
`ihris-source-record/v1` companion reached through `metadataRef`. The companion
exists because the catalogue-node schema is strict and has no field for an
`lp:` branch, an MD5 or a release note.

## Which endpoints work, and which do not

Measured 2026-09-22 from a Claude Code cloud session:

| host | reachable | gives |
|---|---|---|
| `launchpad.net/<p>`, `/<p>/+rdf` | yes | title, summary, description, licence, languages, maintainer, `lp:` default branch |
| `launchpad.net/<p>/+series`, `/<p>/<series>` | yes | series list; each series page names its branch (`code.launchpad.net/~owner/<p>/<branch>`) and milestones |
| `launchpad.net/<p>/+milestone/<m>` | yes | release date, registrant, release notes, changelog, file list |
| `launchpad.net/.../+download/<file>/+md5` | yes | the file's MD5 |
| `code.`, `bazaar.`, `bugs.`, `blueprints.`, `api.launchpad.net`, `launchpadlibrarian.net` | **no** (egress 403) | branch history, bugs, blueprints, the release files themselves |

So a session can describe everything **except** the bytes. For those it needs a
person to upload the file. Then **verify its MD5 against the recorded one before
using it** (see `extract-i2ce-modules`).

## Steps

1. Save the pages into `uploads/launchpad/`:
   `projects/<p>.html`, `projects/<p>.rdf`, `projects/<p>__series.html`,
   `projects/<p>__download.html`, `series/<p>@<series>.html` for each series,
   `milestones/<p>@<m>.html` for each milestone linked from a series page.
2. For every release file URL, fetch `<url>/+md5` and append
   `url<TAB>md5 name` to `uploads/launchpad/release-file-md5.tsv`.
3. If the project is **core** (owner ruling, issue #1), add it to `CORE` in
   `src/tools/build_kg.py` and add a declaration `src/<p>/<p>.json`.
4. Run `python3 src/tools/build_kg.py && python3 src/tools/validate.py`.

## Classification

`core` = i2ce, ihris-common, ihris-manage, ihris-qualify, ihris-plan,
openhie-pr. Anything whose summary names a country or site is a
`country-customization`. Libraries and side applications are `tool`. The
OpenHIE registries outside the iHRIS Suite group are `related`. Never
reclassify a project as core without the owner.

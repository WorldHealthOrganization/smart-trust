---
name: dak-postprocessing
description: >
  What the DAK post-processing phase produces after the IG Publisher runs —
  the JSON/JSON-LD surface, the DAK API hub, and the metadata-to-Liquid
  bridge — and how an IG repository's own site gets the same sidecars from
  the cached AST (`ig-site:sidecars`). Read before changing a post-processing
  step, and before assuming the Publisher produced something it did not.
graph-typologies:
  - qa-report
---

# dak-postprocessing

> Skill id: `dak-postprocessing` · Package: `authoring-who-smart-guidelines` ·
> Layer: **`smart-base`, DAK kind**, except the two Library strippers, which
> are `fhir-harness` — see §"One step is not WHO's".

Everything WHO's build (`.github/workflows/ghbuild.yml`) runs between
`publisher.jar` finishing and deployment, gated by `do_dak` and by the
`contentTypes.dak` section of the root `index.config.json` (see
[`dak-preprocessing`](dak-preprocessing.md), which also says where the scripts
come from). Each step runs **inside the Publisher's Docker container**
(`docker exec -w /work ig-run python3 …`), against `output/`.

## The steps, and what each accomplishes

| # | script | what it produces |
|---|---|---|
| 1 | `strip_library_binaries.py` | removes base64 `content.data` from `Library` resources |
| 2 | `strip_library_content.py` | replaces inline CQL/ELM with a URL reference |
| 3 | `generate_logical_model_schemas.py` | a JSON Schema per logical model |
| 4 | `generate_valueset_schemas.py` | a JSON Schema per ValueSet, plus the enumeration-response schemas |
| 5 | `generate_jsonld_vocabularies.py` | JSON-LD vocabularies from the ValueSet **expansions** |
| 6 | `generate_dak_api_hub.py` | `dak-api.html` — the hub page, and the `.openapi.json` / `.displays.json` sidecars |
| 7 | `update_translated_image_refs.py` | rewrites image references inside translated HTML pages |
| 8 | `generate_smart_liquid.py` + `inject_smart_liquid.py` | **IG metadata → Liquid variables**, and the include injected into every markdown page |

Steps 3 and 4 share one workflow step.

**Steps 1–5 belong to `fhir-harness`, not to this overlay**: they only
transform what the Publisher emitted and add no constraint or profile. They
stay in this table because `ghbuild.yml` still runs them in this phase.
`check:fhir-harness-exclusions` reads the script names from this table and
[`dak-preprocessing`](dak-preprocessing.md)'s and refuses them in
fhir-harness, except these five. Steps 6–8 are the WHO surface.

## Step 8 is the seam

`generate_smart_liquid.py` reads the Publisher's `output/`. It scans it for
`{ResourceType}-{id}.json` and, for each, emits Liquid assignments named

```
smart__<ResourceType>__<id_normalized>__<category>__<key>
```

with categories `url__canonical`, `url__page`, `url__json`, `text__display`,
`link__html`, and `elements__<key>` for scalars (`name`, `title`,
`description`, `status`, `version`, …). Ids are normalised by replacing every
non-alphanumeric character with `_`.

This already turns IG Publisher metadata into variables Jekyll processes, aimed
at the Publisher's own Jekyll. Moving to just-the-docs re-points this bridge
rather than building a new one.

### It is one build behind

The script writes `input/pagecontent/smart.liquid.md`, which the Publisher
only processes on the **next** build, and also writes
`output/smart.liquid.html` directly so the page exists in this one. A surface
that needs two builds to converge cannot drive an incremental staging loop;
under just-the-docs the variables are computed and consumed in one pass.

## One step is not WHO's

Steps 1 and 2 strip base64 binaries and inline CQL/ELM out of `Library`
resources. Nothing in either is DAK-shaped: **any** FHIR IG that embeds CQL
(any IG using `hl7.fhir.uv.cql`) produces oversized `Library` resources. By
the [`smart-stack-layering`](../../../skills/content/authoring-who-smart-guidelines/smart-stack-layering.md) test — *would a non-WHO
FHIR IG need this?* — **they belong in `fhir-harness`.** The deploy phase's
*"Delete files >100MB before deployment"* step is the same concern one layer
down.

## Steps 3–6 are the DAK API

The schema, vocabulary and hub steps produce the surface the artefact index
binds ([`ig-artifact-ingestion`](ig-artifact-ingestion.md)): `.schema.json`,
`.displays.json` and `.openapi.json` per artefact, `.jsonld` vocabularies, and
the enumeration schemas (`ValueSets.schema.json`, `LogicalModels.schema.json`).
No IG publishes an artefact-index instance: an enumeration schema is a
*schema* of a response, whose `example` happens to hold the list.

### On an IG repository's own site: `ig-site:sidecars`

An IG repository whose `index.config.json` names smart-base as its site's
landing declares no steps of its own. The site route (cat-harness-tools
`stage-local.ts`) runs the landing layer's `ig-site:sidecars`, which is
[`ig-site-sidecars.ts`](../../../scripts/ig-site-sidecars.ts):

- It runs fhir-harness's `ig-api-gen.ts`, the generic port of steps 3–6's
  generators, over the cached AST. This layer passes only the label and its
  data types' JSON-LD prefix.
- The per-artefact sidecars, including `<stem>.openapi.json`, go to
  `$SITE_WORK/ig-api/sidecars/`. The enumeration schemas and the Swagger UI
  page `openapi/index.html` go to `$SITE_WORK/ig-api/site/`, which
  fhir-harness serves at the site root without replacing a path the site
  already holds.
- `$SITE_WORK/ig-api/ig-api.json` says `{"label": "DAK API"}` when the IG
  declares a DAK (`index.config.json` `contentTypes.dak`, or a legacy
  `dak.json`; `scripts/ig-dak-metadata.ts`). Otherwise fhir-harness's default
  label, "IG API", stands.

fhir-harness binds and serves the sidecars (`ig-repo-site.ts`, fhir-harness
`ig-build-pipeline` §"The IG repository's site route") and never learns the
DAK name. `ig-index:build` runs the same step when it builds an IG's
artefact index.

The hub page is fhir-harness's: `ig-api-hub.ts` draws it from the artefact
index's bound sidecars, with one loader, on the docs site, an IG site and an
IG repository's own site. This layer names only what WHO calls it:
`ig-api.json` gives the label and the marker an IG's own `dak-api.md` holds
(`<!-- DAK_API_CONTENT -->`), and fhir-harness puts the hub at that page.

## Step 5 depends on expansion, which depends on a terminology server

`generate_jsonld_vocabularies.py` reads ValueSet **expansions**, which exist
only if the Publisher expanded them, which depends on `tx`, the optional
terminology server input. With a dead or restricted `tx` the step produces
fewer vocabularies, warns and **fails nothing**. A thin vocabulary output is
not evidence of a thin ValueSet: check the expansion first.

## Step 7 renders nothing and is not translation

`update_translated_image_refs.py` rewrites `<img>` references inside
translated HTML that has already been built. Where the locale layer is part of
rendering there is no built HTML to patch, and the step has nothing to do.

## What the QA reports say, and where they go

Every script here uses the same `QAReporter` as the pre-processing scripts
and emits a phase report: `successes`, `warnings`, `errors`,
`files_processed`, `files_expected`, `files_missing`, and a summary with
counts and a completion timestamp. `qa.json` from the Publisher run is
uploaded as a workflow artifact. The `qa-report` graph typology (cat-harness-tools
`schemas/sdlc/qa-report.ts`) takes the shape these scripts emit.

Its schema enforces three rules: a summary may not disagree with the details
it counts; `files_missing` must be a subset of `files_expected`, so an empty
result stays distinguishable from a not-found; and `running` is never a pass —
`qaReportVerdict` returns `unknown` for a script that died before finishing,
not `ok`.

## Binary artefacts on deploy and on release

The generic rule and the measuring Tool are
[`ig-binary-artefacts`](../../../../fhir-harness/skills/fhir-ig-base/ig-binary-artefacts.md)
and `ig-binary-audit`. What the WHO workflows do:

- **`ghbuild.yml` deploys `output/` with its binaries.** The only binary step
  is *"Delete files >100MB before deployment"*, and no Publisher binary is
  that large. Each branch build deploys to `branches/<branch>/`, so each
  preview carries another full copy, `full-ig.zip` included.
- **On a GitHub release, `release.yml` hands off to smart-html.** It runs only
  if `publication-request.json` exists, then calls
  `WorldHealthOrganization/smart-html/.github/workflows/release.yml` (pinned
  by commit). That runs smart-html's `scripts/ig_publisher.py`, which builds
  and publishes into the smart-html webroot, leaves `ig-build-zips/` out of
  the `sitepreview` copy, moves **only files over 100 MB** plus a copy of
  `output/package.tgz` into `release-assets/`, and uploads that to the
  release tagged `GITHUB_REF_NAME`. So a release gets `package.tgz` and, in
  practice, nothing else; every other binary goes to the webroot.
- **`create_package_release.py` is called by no workflow.** It would cut a
  release and move the 19 named binaries out of `output/`.
- **`downloads.md` lists 19 release assets that no release carries**, and
  leaves out `full-ig.zip`, the largest. `fix_release_links.py` correctly
  rewrites its `WorldHealthOrganization/smart-base` release links to the
  building repository; the list itself is what is wrong.

These workflows belong to the WHO repositories and are not changed here.

## Where the counterparts are

[`dak-preprocessing`](dak-preprocessing.md) — the steps before the Publisher,
most of which only populate `sushi-config.yaml`'s `pages:` and `menu:`.
[`ig-publication`](../../../../fhir-harness/skills/content/fhir-ig-authoring/ig-publication.md)
— the Publisher run and the authority to release.
[`ig-artifact-ingestion`](ig-artifact-ingestion.md) — the artefact index that
binds what steps 3–6 produce.

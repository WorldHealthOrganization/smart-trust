---
name: dak-preprocessing
description: >
  What each DAK pre-processing step does before the IG Publisher runs, which
  steps exist only to feed the Publisher's page index, and how the phase runs
  as the overlay on fhir-harness's AST cache refresh (`dak-pre-export.sh`).
  Also which files in a DAK repository are authored and which are generated,
  and the SEMVER rule for DAK and IG versions. Read before changing,
  assuming or moving a pre-processing step.
---

# dak-preprocessing

> Skill id: `dak-preprocessing` · Package: `authoring-who-smart-guidelines` ·
> Layer: **`smart-base`, DAK kind** ([`smart-stack-layering`](../../../skills/content/authoring-who-smart-guidelines/smart-stack-layering.md)),
> with two steps that are not pre-processing at all — see §"Two of these are
> authoring, not pre-processing".

*DAK Preprocessing* is everything WHO's build (`.github/workflows/ghbuild.yml`)
runs between checkout and `publisher.jar`, gated by the `do_dak` input and by
the `contentTypes.dak` section of the root `index.config.json`. Every script
reads and writes that section through `input/scripts/dak_index.py`. An IG that
still carries a legacy `dak.json` keeps building: `dak_index.py
--adopt-legacy` reads it into the index for that build only, with a warning.
Nothing is committed back.

`ghbuild.yml` runs the copy in the IG's own `input/scripts/` when there is
one, and otherwise downloads the script from `litlfred/smart-base` at a
commit pinned in the workflow (`SCRIPTS_BASE_COMMIT`). Step names and script
names are the stable handles; re-read the workflow before relying on a detail.

## The steps, and what each one accomplishes

| # | script | what it actually does |
|---|---|---|
| 1 | `generate_dak_from_sushi.py` | writes `contentTypes.dak` into `index.config.json` from `sushi-config.yaml` plus branch/repo context — only when `smart.who.int.base` is a dependency and the section is absent |
| 2 | `update_sushi_config.py` | **registers pages and menu entries in `sushi-config.yaml`, and writes placeholder markdown** — see below |
| 3 | `generate_dak_from_sushi.py`, again | re-runs step 1 "with current branch context" |
| 4 | `dmn_questionnaire_generator.py` | emits FHIR `Questionnaire` resources from the DMN decision tables |
| 5 | `transform_dmn.py` + `dmn2html.xslt` + `dmn.css` | renders each DMN file to HTML for inclusion in a page |
| 6 | `inject_translations.py` | substitutes translated strings into the diagram sources before they are rendered |

Steps 1 and 2 share the workflow step *"Prepare DAK environment"*; steps 3–6
each have a step of their own.

## What "get it into the IG index" meant — step 2, precisely

`update_sushi_config.py` does four things:

1. **Scans for resources** — `fsh-generated/resources/` (SUSHI's output) and
   `input/resources/` (static JSON), collecting every `ValueSet` and every
   logical-model `StructureDefinition`.
2. **Writes a placeholder markdown page per resource** into
   `input/pagecontent/`, as `ValueSet-<id>.md` and the logical-model
   equivalent, each carrying a `<!-- DAK_API_PLACEHOLDER: … -->` marker. A
   file that already exists **with real content** is left alone; the marker
   is how the script tells its own placeholder from an author's page.
3. **Registers `dak-api.md` in `sushi-config.yaml`'s `pages:` map**, creating
   the `pages:` key if the IG has none.
4. **Registers `Indices → DAK API → dak-api.html` in the `menu:` map**,
   creating `menu:` and the `Indices` subsection if absent.

So the "index" is **`sushi-config.yaml`'s `pages:` and `menu:` maps**: the IG
Publisher's Jekyll renders a page only if the file exists in
`input/pagecontent/` **and** `pages:` names it. Step 2 supplies both halves.

Under the just-the-docs pipeline navigation is derived from
`sushi-config.yaml` directly and the pages are folio pages, so this step has
no job there. See [`ig-render-jekyll`](../../../../fhir-harness/skills/fhir-ig-base/ig-render-jekyll.md)
for what replaces it.

## Two of these are authoring, not pre-processing

Steps 4 and 5 — `dmn_questionnaire_generator.py` and `transform_dmn.py` — mint
artefacts rather than prepare a renderer:

- the questionnaire generator emits **FHIR resources**, which the Publisher
  validates, indexes and publishes like any other. Without it the IG is
  missing `Questionnaire`s, not a page.
- the DMN transform produces the **only** human-readable rendering of a
  decision table the IG has.

They depend on nothing the Publisher does. **They are content generation and
belong upstream of the Publisher, as authoring steps of the DAK document
kind.**

`transform_dmn.py` outputs **HTML**, which the JSON-only render contract does
not take. Whether it gains a structured output or its HTML is treated as an
embedded asset is still open.

## Step 6 is conditional on who renders

`inject_translations.py` rewrites diagram sources **before** rendering because
the Publisher offers no later hook. When pages render through just-the-docs,
this platform's locale layer does that for **pages**. Diagram sources are
still rasterised outside Jekyll, so the step is still needed for them: do not
remove it on the page argument alone.

## Steps 1 and 3 — one fact, computed twice

`generate_dak_from_sushi.py` runs twice in `ghbuild.yml`; the second run
(*"Regenerate DAK configuration with current context"*) recomputes the same
section after the branch has been resolved. The DAK section is this
platform's own declaration, so compute it once, in the right order. Do not
reproduce the double run when lifting this step.

## What a QA report already exists for

Every one of these scripts instantiates a `QAReporter` and writes a phase
report — `successes`, `warnings`, `errors`, `files_processed`,
`files_expected`, `files_missing`, plus a summary with counts and a completion
timestamp. The `qa-report` graph typology (`qa-report/v1`, `holds: "state"`,
cat-harness-tools `schemas/sdlc/qa-report.ts`) takes exactly that shape,
upstream's snake_case field names included, so no translation step sits
between WHO's producer and this platform's consumer.

## In the AST lifecycle: the overlay on fhir-harness's refresh

smart-base's IG is published from the AST on its cache branch
(`cat/fhir-harness/fhir-ast/<package id>`), like every smart-* IG. The one
writer of that branch is fhir-harness's reusable `ig-ast-refresh.yml` (skill
`ig-build-pipeline`, §"The AST cache lifecycle"). The plain AST exporter does
not run this phase, so smart-base supplies it as an **overlay**; fhir-harness
never names it.

- **The command** is [`smart-base/scripts/dak-pre-export.sh`](../../../scripts/dak-pre-export.sh)
  (`bun run cat smart-base:dak-pre-export`). It runs steps 1, 2, 4, 5 and 6,
  in that order, from this checkout's own `input/scripts/`. It does not
  repeat step 3. Steps 4–6 run only when the IG declares `contentTypes.dak`.
  Any failure fails the run.
- **The caller** is smart-base's `.github/workflows/ig-ast-refresh.yml`:
  fhir-harness's template plus `pre-export: bash smart-base/scripts/dak-pre-export.sh`.
  It runs by hand, and on every push to `main` that changes
  `sushi-config.yaml`, `ig.ini` or `input/**`.
- **What the cache records.** This phase rewrites the IG's inputs
  (`sushi-config.yaml`'s `pages:`/`menu:`, placeholder pages under
  `input/pagecontent/`). fhir-harness takes the clean commit's input digest
  before the command runs, puts the inputs back after the export, and records
  the AST against the clean commit; the prepared tree's digest goes under the
  manifest's `preExport`. So the cache verifies on any clean checkout, and a
  merge that changes no input does not make it stale.
- **The counterpart** after the export is fhir-harness's `ig-api-gen.ts`, the
  generic port of the post-processing schema and vocabulary generators, run
  over the AST by `ig-site:sidecars` ([`dak-postprocessing`](dak-postprocessing.md)).

`ghbuild.yml` keeps its own copy of these steps for downstream repositories;
it does not write smart-base's cache.

## Source of truth versus generated artefacts in a DAK repository

This extends the base IG rule in
[`ig-build-pipeline`](../../../../fhir-harness/skills/fhir-ig-base/ig-build-pipeline.md)
§"Source of truth versus compiled, cached and rendered output". Two rules:

1. **Across knowledge layers, authority flows `L1 → L2 → L3 → compiled AST /
   rendered site`** ([`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md)
   §"The order is a rule: L1, then L2, then L3"). L1 narrative guidelines and
   referenced tables (`library/<bib>/l1-extraction/`) ground the L2 DAK
   components (business processes, decision-support logic, core data
   dictionary, L2 form wireframes, personas, scenarios, indicators,
   functional/non-functional requirements); those ground the L3 FHIR
   artefacts (`input/fsh/`, `input/cql/`). Never patch an L3 artefact or a
   rendered page to contradict its L2 source, or an L2 table to contradict L1
   without an L1 citation.
2. **Within the repository, hand-edit only the authored inputs — never files
   written by DAK pre-processing, row generators, SUSHI, the AST refresh or
   DAK post-processing.** `dak-pre-export.sh` and the QA suite
   ([`qa-checkers-dak.ts`](../../../pipeline/qa-checkers-dak.ts)
   `isGeneratedArtefact`) both draw this line:

| Authoritative source (edit here) | Generated, cached or rendered output (never hand-edit; overwritten on build) | Producer |
|---|---|---|
| `sushi-config.yaml` (`id`, `canonical`, `name`, `title`, `description`, `version`, `status`, `license`, `effectivePeriod`, `publisher`, `contact`) and `index.config.json` `contentTypes.dak` | Legacy `dak.json` (read-only fallback via `dak_index.py --adopt-legacy`; never committed back) and `fsh-generated/resources/ImplementationGuide-*.json` | `dak_index.py`, `generate_dak_from_sushi.py` |
| `input/fsh/**/*.fsh` (`ValueSet`, logical-model `StructureDefinition`, profiles, extensions, hand-authored instances) and authored `input/pagecontent/*.md` | Placeholder pages `input/pagecontent/ValueSet-<id>.md` and `input/pagecontent/<Model>.md` carrying `<!-- DAK_API_PLACEHOLDER: … -->`, plus `dak-api.md` in `sushi-config.yaml` `pages:` and `Indices → DAK API` in `menu:` (reverted after `AstExportCli` in `ig-ast-refresh.yml`) | `update_sushi_config.py`, `dak-pre-export.sh` |
| Authored L2 decision-support tables (`input/decision-support/**`), data dictionary / requirements workbooks and L2 form wireframes | Generated `Questionnaire` JSON/FSH resources, rendered DMN HTML tables, and row-generated `.fsh` instances carrying `generated from row N`, `Automatically generated from DAK artifacts` or `Autogenerated from DAK artifacts` | `dmn_questionnaire_generator.py`, `transform_dmn.py`, `qa-checkers-dak.ts` (`isGeneratedArtefact`) |
| Authored BPMN / diagram sources (`input/business-processes/**`, `input/images-source/**`) and gettext `.po` catalogues (`input/translations/**`) | Translated diagram copies and rewritten `<img>` references in `output/` | `inject_translations.py`, `update_translated_image_refs.py` |
| Cached AST (`cat/fhir-harness/fhir-ast/<package id>`) and `sushi-config.yaml` | DAK API sidecars (`$SITE_WORK/ig-api/sidecars/*.schema.json`, `*.displays.json`, `*.openapi.json`, `.jsonld` vocabularies), `dak-api.html`, `openapi/index.html`, stripped `Library` JSON (`strip_library_binaries.py`, `strip_library_content.py`), and `input/pagecontent/smart.liquid.md` / `output/smart.liquid.html` (`generate_smart_liquid.py`) | [`dak-postprocessing`](dak-postprocessing.md), `ig-site-sidecars.ts` |

## Version numbering: DAK SEMVER and how an IG's version relates to its DAK's

`index.config.json` `contentTypes.dak.version` ([`schemas/dak.ts`](../../../schemas/dak.ts)
`DakDeclarationSchema`, mirroring `input/fsh/models/DAK.fsh`) and
`sushi-config.yaml` `version` both use exact `MAJOR.MINOR.PATCH`:

| Increment | Bumps the DAK (`contentTypes.dak.version`) | Bumps the L3 IG (`sushi-config.yaml` `version`) |
|---|---|---|
| **`major`** (`X+1.0.0`) | Breaking L2 change in any of the nine DAK component types (`DAK.fsh`): removing or incompatibly redefining a core data element (`dataElement`), business process (`businessProcess`), decision-support table (`decisionSupportLogic`) or clinical rule, indicator (`indicator`) numerator/denominator, persona (`healthInterventions`), scenario (`userScenario`), L2 form wireframe (`form`), or functional/non-functional requirement (`requirement`); or rebasing onto a new L1 WHO guideline edition that invalidates prior L2 logic or data elements | Breaking L3 conformance change per [`ig-build-pipeline`](../../../../fhir-harness/skills/fhir-ig-base/ig-build-pipeline.md) §"Version numbering: SEMVER for a FHIR IG" (removing/renaming a canonical resource, tightening cardinality or bindings, incompatible CQL/operation signature change, `fhirVersion` change, or breaking dependency major bump), **or** any `major` bump in the DAK it encodes |
| **`minor`** (`X.Y+1.0`) | Backward-compatible L2 addition: a new persona, scenario, BPMN workflow, DMN decision table or rule row, optional data dictionary element, L2 form wireframe, indicator or requirement; or extending an L2 value set without invalidating existing rows | Backward-compatible L3 addition (new profile, logical model, extension, `ValueSet`, `CodeSystem`, `Library`, `PlanDefinition`, `Measure`, `Questionnaire`, optional element/slice, or narrative page), **or** any `minor` bump in the DAK it encodes |
| **`patch`** (`X.Y.Z+1`) | Backward-compatible L2 editorial or bug fix: typos, descriptions, labels, translations or diagram layout; correcting a DMN cell or data dictionary description to match the existing L1 source without changing data-element semantics or workflow structure | Backward-compatible L3 fix (narrative prose in `input/pagecontent/**`, translations, example fixes, CQL/FML bug fixes preserving declared inputs/outputs and clinical intent, or rendering fixes), **or** any `patch` bump in the DAK it encodes |

**How an IG's version relates to its DAK's:**

1. **DAK and L3 IG in one repository (`contentTypes.dak` + `contentTypes.ig`)
   — lockstep.** `index.config.json` `contentTypes.dak.version`,
   `sushi-config.yaml` `version` (and `publication-request.json` `version` on
   a release) carry the **same** `MAJOR.MINOR.PATCH` and matching `status`
   (`draft` | `active` | `retired`). Both move to the higher of the two
   increments: L2 `minor` with L3 `patch` is `minor`; an L3 `major` with L2
   unchanged is `major`.
   - **Update both files in the same commit.** Step 1 seeds
     `contentTypes.dak` from `sushi-config.yaml` **only when it is absent**
     (`if read_dak_section(repo_root) is not None: return`), so editing
     `version` or `status` in `sushi-config.yaml` alone leaves
     `contentTypes.dak` stale.
2. **Standalone L2 DAK and downstream L3 IG (`l3-fhir-authoring`).** When the
   DAK (`contentTypes: { dak }`) and the IG (`contentTypes: { ig }`) live in
   separate repositories, each has its own `MAJOR.MINOR.PATCH` series; a
   `major` or `minor` bump in the DAK requires at least the same bump in the
   IG release that adopts it.
3. **Adapted / country DAKs and IGs (`l2-dependency-choice`,
   `l3-dependency-choice`).** The adaptation pins the upstream WHO DAK and IG
   in `sushi-config.yaml` `dependencies:` (and `index.config.json`
   `dependencies`) at an exact released version (`bun run cat
   check:published-refs`); its own `contentTypes.dak.version` and
   `sushi-config.yaml` `version` follow its own release series.

## Where the counterpart is

[`dak-postprocessing`](dak-postprocessing.md) — the steps after the Publisher
run. [`ig-publication`](../../../../fhir-harness/skills/content/fhir-ig-authoring/ig-publication.md)
— the Publisher run itself and the authority to release.
[`smart-stack-layering`](../../../skills/content/authoring-who-smart-guidelines/smart-stack-layering.md) — which layer each step
belongs to.

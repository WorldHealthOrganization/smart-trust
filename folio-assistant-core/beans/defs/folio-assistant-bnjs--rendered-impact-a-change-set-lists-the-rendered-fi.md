---
# folio-assistant-bnjs
$schema: bean/1.0.0
title: 'RENDERED IMPACT: a Change Set lists the rendered files it changes — each renderer maps changed inputs to changed outputs through its dependency cone, and review approves against that list'
status: completed
type: feature
priority: normal
created_at: 2026-10-06T07:13:23Z
updated_at: 2026-10-06T16:54:17Z
parent: folio-assistant-q4jm
---

Owner, 2026-10-06 (#971): "for a Change Set (generalize/apply concept from Ref Arch) and Issue -> create PR with change set. see a list of rendered justthedocs files (fhir IG, whatever) that changed due to the described changeset. use that as part of review process of changeset PR approval. updates skills and processes." Then: "each renderer should be able to give you from list of input changed files, the list of output changed rendered files ... from the dependency cone". Ruling: generalise the public-comment Change Set (changeset/1.0.0) to any folio; the rendered-change list is one of its fields. Ref Arch: the draft already lives in litlfred/smart-ra folio/dpi-h-ra (284 CS records), library/ holds only the circulated PDF/docx.

Related: q4cm (edit set, accept = approve), c65n (measured FHIR chain), jwox (block ChangeSet).

## Todo
- [x] renderer contract: rendered-impact/v1 schema (files with role content|data|index, undetermined inputs never read as no change) + a build-diff that confirms a prediction
- [x] FHIR IG renderer: changed .fsh/.cql/pagecontent -> fsh-cone forward cone -> fsh-index -> AST pages, data, index pages
- [x] verify the FHIR prediction against the real smart-immunizations build diff (expect the 3 files of c65n)
- [x] Change Set generalised: refs optional, rendered[] field
- [x] document-folio renderer (block ChangeSet -> page anchors), for smart-ra: loaded from changeset.json + outline.json (owner: "use dynamic loading from the json(ld) KG and existing assets")
- [x] docs-site renderer (staging-cone, directory -> pages): `cat-harness/scripts/docs-rendered-impact.ts`, measured against two local builds (8 predicted / 8 measured / 7 confirmed; the 1 miss is environmental); `diffBuiltSites` now blanks build stamps (826 -> 1 file between two builds of one commit)
- [x] skill rendered-impact; update staging-review, before-after-preview, ig-ast-delta, public-comment change-sets
- [x] process: content-change-review.bpmn names rendered-impact at Compare, Slice and Comment-PR (produce/read/assign)
- [x] gate: the coverage DMN counts unreviewed rendered pages, missed files and site-wide undetermined inputs, once the staging build publishes rendered-impact.json (an input nothing computes is not added)
- [x] staging build: folio-staging.yml step "Compute the rendered impact" publishes rendered-impact.json beside changeset.json; the PR comment lists up to 20 pages with after/before links
- [x] PR comment + review page show the list: the review page FETCHES rendered-impact.json when opened (owner: "dynamic loading on review page"), and says "not known" when the build published none

## Rule: the original stays in library/, edits happen in folio/

Owner, 2026-10-06: "original stays in library/. the presumed workflow is then it was materialized to folio/ to make changes on". A Change Set applies to the MATERIALISED folio, never to the library source. smart-ra already works this way: `library/who-dpi-h-reference-architecture-draft-v1/` holds the circulated PDF/docx, `folio/dpi-h-ra/` holds the editable blocks, and `review/public-comment/changesets/` holds the CS records against the folio.

## Progress 2026-10-06
- Contract + FHIR renderer (187869fa0); verified on smart-immunizations: FSH edit 4 predicted / 3 measured / 0 missed (the 1 unconfirmed is the page that loads its data), page edit exact. 0.34 s vs SUSHI 165 s.
- Change Set general (24fed58de): refs default [], rendered[] field; 284 smart-ra CS records validate unchanged.
- Skill rendered-impact registered; content-change-review names it at Compare, Slice and Comment-PR.

## Document renderer (2026-10-06)
`folio-assistant-core/scripts/document-rendered-impact.ts`: renderers `document-site` and `public-comment-site`, loaded from the published `changeset.json` + `outline.json`, never from source (owner: "use dynamic loading from the json(ld) KG and existing assets"); `files[].anchors` added to the contract for deep links. Verified on litlfred/smart-ra (local test branch, not pushed): one block sentence + one chapter title -> predicted `dpi-h-ra/index.html#prose:1-1-1-dcc314` + `outline.json`, measured the same 2 files, 0 missed, 0 unconfirmed; 0.7 s with the asset, 1.8 s computing the ChangeSet. 7 unit tests.

## Staging step + review page (2026-10-06)
`folio-staging.yml` runs the document renderer after the ChangeSet and publishes `rendered-impact.json`; the PR comment lists the review pages (after + before links, block anchors) and the not-known inputs. The review page (`gen-review-page.ts` + `review-rendered.ts`) fetches the file in the browser, like `changeset.json`. Checked in Chromium on the smart-ra test build: the edited block's after link (200) and before link, and the missing-file state; no page errors.

## Staging step + review page (2026-10-06)
`folio-staging.yml` runs the document renderer after the ChangeSet and publishes `rendered-impact.json`; the PR comment lists the review pages (after + before links, block anchors) and the not-known inputs. The review page (`gen-review-page.ts` + `review-rendered.ts`) fetches the file in the browser, like `changeset.json`. Checked in Chromium on the smart-ra test build: the edited block's after link (200) and before link, and the missing-file state; no page errors.

## Coverage gate design (2026-10-06, this session; owner chose "1" = start it)

The DMN engine throws on a fact that is not supplied, so every fact is always
supplied and a status fact says whether it was COMPUTED: an uncomputed count is
never read as 0.

- Facts added to `review-coverage-gate.dmn`: `rendered` (known|absent),
  `unreviewedPages`, `undeterminedInputs`, `measured` (known|absent|not-base),
  `missedPages`. A page rule only fires when its status is `known`.
- A page is reviewed when every block anchor on it has a current block verdict,
  OR it has a current PAGE verdict. New tag lines beside `block:`:
  `page: <path>` and `input: <path>` (same `verdict:` / `waive:`). An anchorless
  page (manifest, media, comment store, every FHIR IG page) can only be
  reviewed that way.
- A page verdict is pinned like a block verdict: to a hash of the git blobs of
  the changed inputs on the page's `via` at head (not the built bytes, which
  carry a per-build banner). An input waiver pins to the input's blob. So an
  edit after review reopens exactly the pages and inputs it touched.
- `missedPages`: measured in the staging job, which already checks out the
  before site: `diffBuiltSites(before, _site)` before the banner is injected,
  over main's `_main-site.json` file list only. Counted only when that manifest's
  commit IS the PR's base (`not-base` otherwise: main drift would be read as
  missed pages). Missed pages need a page verdict too.

## Todo (coverage gate)

- [x] rendered-impact: optional `hash` on files and undetermined; `pinImpact`; renderers pin
- [x] `rendered-measured/v1` + `measure-rendered-impact.ts` (build diff + comparePrediction + base check)
- [x] verdict tag: `page:` / `input:`; ingestion validates against the published impact
- [x] computeCoverage / review-coverage CLI: the five new facts
- [x] DMN rules + process documentation + skills (rendered-impact, review verdict syntax)
- [x] folio-staging.yml: pin, measure step, ingestion args, PR comment shows missed pages

- [x] see it on a real staging run: MOVED to litlfred/smart-ra#23 and the bean created there (it needs network access to packages.fhir.org for SUSHI, which this environment refuses); nothing left in this repository

## Summary of Changes

Merged in #2261, #2285 and #2293 (issue #971).

- **Contract:** `rendered-impact/v1` (`cat-harness/schemas/rendered-impact.ts`).
  - A build diff and a prediction check (`diffBuiltSites`, `comparePrediction`).
  - Pins: `pinImpact`, which hashes the git blobs of the changed inputs on a file's `via`.
  - Build stamps blanked before hashing: the `?v=` cache-buster, `generatedAt`, `sourceTreeDirty`.
- **Renderers.** Each was checked against a real build, and none missed a file the build changed:

  | renderer | predicted | measured | confirmed | notes |
  |---|---|---|---|---|
  | `fhir-ig-pages` | 4 | 3 | 3 | |
  | `document-site` + `public-comment-site` | 2 | 2 | 2 | |
  | `docs-site` | 8 | 8 | 7 | the 1 miss is environmental |

- **Change Set:** generalised to any folio, with a `rendered[]` field.
- **Staging:**
  - `folio-staging.yml` publishes `rendered-impact.json`.
  - It measures the build against main's site (`rendered-measured.json`); missed pages count only when that site was built from the base.
  - Both ingestion paths accept `page:` and `input:` verdicts, pinned to the build's pins.
- **Gate:** `review-coverage-gate.dmn` reads `unreviewedPages`, `undeterminedInputs` and `missedPages`. Each has a status fact (`rendered`, `measured`), so an uncomputed count is never read as 0. Tested through the real engine.
- **Docs:**
  - the `rendered-impact` skill;
  - `review-comments` (the tag);
  - `prepare-merge`;
  - `content-change-review.bpmn`.

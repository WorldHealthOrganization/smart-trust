---
id: test-data-sets
name: test-data-sets
description: Curating fixed (committed, cited, SME-reviewed) and generated (template + params + seed recipe, never stored materialised) test data sets in separately declared graph directories, with per-content-type specialisation as a called subprocess and attributable SME review of decision support and indicator definitions.
depends-on:
  - test-plan-execution
  - untainted-verification
tested-by:
  - schemas/test-data.test.ts
tags:
  - qa
  - testing
  - test-data
  - sme-review
  - sdlc
lifecycle-stages:
  - author
  - test
  - review
---

# Test Data Sets & SME Case/Verdict Review

Governs how test data sets are authored, discriminated, specialized per content type, and reviewed by a subject-matter expert (SME) before a `test-plan/v1` binds them into [`test-plan-execution`](test-plan-execution.md).

## Two kinds of test data, two declared graph directories

Fixed and generated test data sets do not have the same provenance or audit standing, so they live in **separately declared graph directories** (`test-data-fixed` vs `test-data-generated` in [`schemas/kg/graph-typology-registry.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/kg/graph-typology-registry.ts)) and carry self-identifying `$schema` and `kind` tags in [`schemas/sdlc/test-data.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/test-data.ts):

| Kind | Graph typology | `$schema` tag | Discriminator | What is stored | Audit standing |
|---|---|---|---|---|---|
| **Fixed** | `test-data-fixed` | `test-data-fixed/1.0.0` | `kind: "fixed"` | Committed `records`, optional `citations`, optional SME `review` sign-off | Usable as certification evidence (`isEvidence` in [`schemas/sdlc/test-plan.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/test-plan.ts)) once `review` is present |
| **Generated** | `test-data-generated` | `test-data-generated/1.0.0` | `kind: "generated"` | Recipe only: `contentType`, `specialisation`, `template`, `params`, `seed`, and canonical `sha256` | **Never stored materialised**; synthesised at run time and hashed into `folio-test-run/v1` |

### Discriminate from the file content, never from the path

A consumer reading a test data node must call `discriminateTestDataSet(doc)` in [`schemas/sdlc/test-data.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/test-data.ts), which inspects `$schema` and `kind` inside the JSON document rather than inferring the kind from the directory path:

- `FixedTestDataSetSchema` is `.strict()` and refuses recipe fields (`template`, `params`, `seed`, `sha256`).
- `GeneratedTestDataSetSchema` is `.strict()` and refuses materialised payload fields (`records`, `cases`, `path`, `review`), and verifies that `sha256` equals `computeGeneratedSetDigest({ contentType, specialisation, template, params, seed })`.

## General curation process and per-content-type specialisation

The general curation process is [`sdlc/processes/test-data-curation.bpmn`](../../processes/test-data-curation.bpmn) (`Process_TestDataCuration`):

1. **Classify the data set (`Task_ClassifySet`, `GW_SetKind`)** — decide whether the test case needs a small curated fixed set (audit evidence for domain logic) or a deterministic generated recipe (scale, boundary, or combinatorial coverage).
2. **Fixed branch (`Task_CurateFixed`, `GW_NeedsSmeReview`, `Call_SmeReview`)** — author the `test-data-fixed/1.0.0` node under the layer's declared `test-data-fixed` directory; if the set exercises decision support or an indicator definition, invoke [`sdlc/processes/sme-test-data-review.bpmn`](../../processes/sme-test-data-review.bpmn) (`Process_SmeTestDataReview`).
3. **Generated branch (`Call_ContentTypeSpecialisation`, `Task_WriteRecipe`)** — invoke the content-type specialisation as a **called subprocess** (`Call_ContentTypeSpecialisation`), then write the `test-data-generated/1.0.0` recipe and its canonical `sha256` under the layer's declared `test-data-generated` directory without committing materialised records.
4. **Verify self-identification and bind (`Task_VerifySelfIdentifying`)** — verify via `discriminateTestDataSet` and `toTestDataRef` that the file self-identifies by `$schema` and `kind` and bind its digest into the `test-plan/v1` case.

### FHIR templating is one specialisation, named as such, not the design

`Call_ContentTypeSpecialisation` in `test-data-curation.bpmn` is parameterized by `contentType` and `specialisation` (`TestDataSpecialisationSchema` in [`schemas/sdlc/test-data.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/test-data.ts)):

- **`fhir-templating` (`FHIR_TEMPLATING_SPECIALISATION`)** is **one named specialisation** for FHIR IG / DAK content (for example, Liquid or FSH/JSON templates producing synthetic patient bundles or MeasureReport cohorts).
- Other content types supply their own specialisations — such as `markdown-fixture` for document folios, `lean-counterexample` for formal-proof folios, or `tabular-cohort` for aggregate indicator tables.
- Platform schemas and processes never hardcode FHIR resources or DAK structures as the general test-data model.

## SME review of decision support and indicator definitions

When a fixed test data set tests clinical or scientific **decision support** or **indicator definitions**, passing is a domain judgement: a subject-matter expert must confirm that the logic produces the right guidance on a worked case or the right value on a cohort.

### Two units of review in `sme-case-verdict/1.0.0`

[`SmeCaseVerdictKind`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/test-data.ts) (`$schema: "sme-case-verdict/1.0.0"`, graph typology `sme-case-verdict`) discriminates on `subjectKind`:

1. **`subjectKind: "decision-support"` — unit is a worked case (`case`)**:
   - `id`, `summary`, `decisionLogicRef`, structured `input`, `systemOutput`, and optional `expectedGuidance`.
   - Refuses `cohort`.
2. **`subjectKind: "indicator-definition"` — unit is a cohort plus an expected value (`cohort`)**:
   - `id`, `summary`, `indicatorRef`, `populationSize`, `inputs`, `expectedValue`, `computedValue`, and optional `period`, `numerator`, `denominator`.
   - Refuses `case`.

### Attributable SME identity and review date

An audited review without an attributable reviewer and date is not audited. Every `sme-case-verdict/1.0.0` node requires:

- `reviewer` (`SmeReviewerIdentitySchema`): `kind: "human"` (never `"agent"` or `"script"`), `provider` (e.g. `"github"`, `"orcid"`), `handle`, `role` (e.g. `"clinical-sme"`), and optional `displayName` and `actor`.
- `reviewedAt` (`ReviewedAtSchema`): ISO-8601 date (`YYYY-MM-DD`) or timestamp.
- `verdict`: `"pass" | "fail" | "needs-revision"`, plus a non-empty domain `rationale`.

### Why the SME lane in `sme-test-data-review.bpmn` is `judgementOnly`

In [`sdlc/processes/sme-test-data-review.bpmn`](../../processes/sme-test-data-review.bpmn) (`Process_SmeTestDataReview`), the SME review step (`Task_SmeJudge`) sits in `Lane_SME`, bound to role `clinical-sme` (`partitionElementRef="clinical-sme"`).

In [`scenarios/roles.json`](../../../scenarios/roles.json), `clinical-sme` declares `"judgementOnly": true` and carries no procedural skill on `Task_SmeJudge`: **no procedure yields the clinical or scientific answer, which is the whole reason a person is in the lane**. The preparation steps (`Task_PrepareWorkedCase`, `Task_PrepareCohort`) and the recording step (`Task_RecordCaseVerdict`) are mechanical and name `test-data-sets`; the judgement between them is the human SME's alone.

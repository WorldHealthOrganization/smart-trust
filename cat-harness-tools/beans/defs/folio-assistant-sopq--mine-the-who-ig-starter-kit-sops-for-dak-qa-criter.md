---
# folio-assistant-sopq
$schema: bean/1.0.0
title: Mine the WHO IG starter kit SOPs for DAK QA criteria
status: completed
type: task
priority: normal
created_at: 2026-08-26T19:15:00Z
updated_at: 2026-10-10T17:04:26Z
parent: folio-assistant-1swy
---

Split out of `p2en`, whose original question — what schema consolidates math and
health-policy ingestion — is answered. This is the follow-on it uncovered.

## Why

`p2en` landed DAK block kinds, adapter-scoped QA axes, and five DAK checkers,
but those criteria were written from what the corpus happens to contain. WHO
publishes its own authoring standards, and they are the better source: a
criterion derived from `checklist.md` is one a DAK author is already being held
to, rather than one this platform invented.

Repo: <https://github.com/WorldHealthOrganization/smart-ig-starter-kit>
(cloned at `/home/user/litlfred/smart-ig-starter-kit` during `p2en`).

## Unread

~3,900 of the kit's ~4,300 SOP lines. Only `l2_dak_authoring.md` (421) was read.

Highest-value first, by apparent fit to existing QA machinery:

- `checklist.md` (297) — reads as WHO's own pre-publication gate. Closest thing
  to a ready-made criterion list.
- `qa_check.md` (28) — short; likely names the mechanical checks WHO runs.
- `authoring_conventions.md` (78) — naming/structure rules, the kind a
  mechanical axis can enforce.
- `l3_*.md` (~12 files) — per-artefact-type L3 authoring rules
  (`l3_requirements`, `l3_testing`, `l3_indicators`, `l3_logicalmodels`,
  `l3_valuesets`, `l3_personas`, `l3_forms`, `l3_processes`,
  `l3_structuremaps`, `l3_scenarios`, `l3_examples`, `l3_libraries`).
- `l2_l3_overview.md` (247), `l2_templates.md` (99), `semanticreferences.md`,
  `structure.md`, `l4_compliance.md`.

## Two findings already in hand that belong here

1. **An unenforceable constraint WHO ships.** Every `*Source` in
   `DAKComponentSources.fsh` says in prose "**exactly one of** url | canonical |
   instance must be provided", and there is **not one `Invariant:`/`obeys` in
   any of WHO's 17 logical models** (grepped). A DAK supplying all three, or
   none, validates clean against the FHIR toolchain. This is a QA criterion this
   platform can carry and that toolchain structurally cannot — a strong
   candidate for the first SOP-derived axis.

2. **The official component templates are `.xlsx`, and we have them.**
   `input/images/` ships `DAK_core data dictionary_template_v2.1.xlsx`,
   `DAK_decision-support logic_template_v2.1.xlsx`, `DAK_scheduling logic…`,
   `DAK_indicators and performance metrics…`, `DAK_high-level functional and
   non-functional requirements…` (v2 and v2.1). These define the canonical sheet
   structure for exactly the kinds `WORKBOOK_BACKED_KINDS` exempts from a
   required companion. A workbook reader is now bounded against a published
   template rather than reverse-engineered from one repository — which also
   unblocks the `.xlsx` rendering deferred since §12.18.

## Also still open from `p2en`

- Compare `sgex`'s `bpmn-to-svg.js` (jsdom) against `scripts/bpmn-render.ts`
  (Chromium) on the same 8 WHO processes. Low priority: the Chromium route
  works (8/8, 0 failures), so this is a "is there a lighter dependency" question,
  not a gap.

## Not in scope

Authoring folio content. This repo is the platform; anything WHO-domain that
turns out to be subject matter belongs in a DAK repo as data, per AGENTS.md.


## 2026-10-09: finding 1 checked against the corpus (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)
Still true on litlfred/smart-base main (c1f7764): `input/fsh/models/DAKComponentSources.fsh` states "exactly one of the following must be provided" in prose with no `Invariant:`. But **no DAK instance in smart-base, smart-trust or smart-immunizations supplies component sources** (no `InstanceOf: DAK`, `dak.json` carries identity only), so a platform checker for it would judge nothing — the `dh4f` shape. The rule's home is the logical model itself: an FSH `Invariant:` (`obeys`) on each `*Source`, which is IG content (the WHO repository, or the fork as a proposal), not platform code. Left for the owner to route; nothing built.

## 2026-10-10 ~15:18 UTC — checklist.md and qa_check.md read and classified (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)

Kit read at WorldHealthOrganization/smart-ig-starter-kit `286b2a4`.

**qa_check.md (28 lines) names no checks of its own.** It defers to the IG Publisher's `qa.html`. The constraints themselves are "consolidated as profiles" in smart-base (its examples: title+description SHALL; a logical-model element SHALL map to an internal code). These rows belong to the **Publisher's** verdict. A platform copy of them would be the second, weaker verdict that `qa-checkers-dak.ts`'s header already refuses.

**checklist.md: 31 rows (L1 3, L2 9, L3 9, L4 5, Global 5).** Classified by who can answer each row:

| class | rows | can the platform carry it? |
|---|---|---|
| **A. "a page for X exists"** | L1 ×3, L2 ×9, L3 sequence-diagram, Global changes + downloads (15) | Yes, mechanically, BUT see finding 1 |
| **B. defers to qa.html / Publisher** | L3 SPC/executable profile ×2, codings, Global "no errors or unsuppressed warnings", HL7 publishing reqs (5) | No: read the Publisher's verdict, don't re-derive it. A reader of `qa.json` errors/suppressions is the honest version |
| **C. structural, counts over artefacts** | L3 "a logical model per data-dictionary asset", "a StructureMap IPS→dataset per data set", "artefacts per actor"; L4 "an example per non-abstract profile per UN language", "every CQL library has a test library", "every PlanDefinition/Measure has test cases" (6) | Yes: these are FHIR-AST counts (fhir-harness ig-ast) and the strongest candidates for a first SOP-derived axis |
| **D. judgement** | L3 actors "tied to and derived from L2", indicators per DSS/mADX, Global maturity in STU note, versioning (semver inheritance) (5) | Agent/human; semver inheritance is partly mechanical (IG version vs artefact versions) |

**Finding 1, measured. The kit's expected page filenames are NOT what real WHO IGs use**, so a class-A checker keyed on them would report false absences. Scanned on origin/main of the three forks:

- `usecases.xml` is `use_cases.md` (trust) and `scenarios.md` (immz).
- `business_process.xml` is `business-process(es).md` (immz).
- `adapting_guidelines.xml` is `adapting.md` (immz).
- `functional.xml` is `functional-requirements.md` (immz).
- `indicators` exists in immz as two pages (`indicators.md`, `indicators-measures.md`).
- smart-trust has no personas, dictionary, nonfunctional or adapting page under ANY name found by eye.

A class-A axis must key on a DECLARED mapping (menu entry / section title → checklist row), not on filenames. smart-base is the base IG rather than a DAK, so L1/L2 rows are n/a for it.

**Finding 2.** Two rows are unfinished in WHO's own text: the maturity row carries a `TODO: define maturity levels`, and Downloads has Required = `?`. A criterion derived from them would encode an undecided rule.

**Recommended first axis (judgement, not built):** class C, "an example resource per non-abstract profile". It is the most mechanical, it reads the FHIR AST the harness already produces, and nothing else answers it. The UN-language half needs the owner: 6 languages × every profile is a very large corpus obligation.

**Still unread:** authoring_conventions.md, the l3_*.md files and l2_l3_overview.md. Nothing built; bean stays todo.

## 2026-10-10 ~15:21 UTC — authoring_conventions.md measured against the three forks

I measured the kit's naming and location rules over the FSH entity names (Profile/Logical/ValueSet/CodeSystem/Instance/Extension/Resource) on origin/main. SUSHI derives the id from the name unless `Id:` is set; only 7 explicit `Id:` lines exist in total.

| IG | entities | underscore | outside `[A-Za-z0-9.-]{1,64}` | lowercase start | case-collision files |
|---|---|---|---|---|---|
| smart-base | 220 | 0 | 0 | 0 | 0 |
| smart-trust | 677 | 0 | 0 | 0 | 0 |
| smart-immunizations | 731 | 0 | 0 | 0 | 0 |

**There are no violations across 1,628 entities.** The id regex is also core FHIR, which the Publisher already enforces. An axis for these rules would therefore be a guard against regression with nothing to find today. It is low priority, and it would overlap the Publisher's verdict for the regex half. Underscore-free names and case-collision filenames are NOT enforced by the Publisher, so those two would be the only part worth carrying.

**The "File Locations" list is not exhaustive in practice.** Real IGs also use `fsh/conceptmaps`, `extensions`, `rulesets`, `instances` and `translations`, none of which the kit lists. A checker that treated the kit list as closed would flag correct content. If anything is built here, it should treat the list as the PREFERRED locations rather than the only allowed ones.

The class-C "example per non-abstract profile" axis from the previous entry remains the recommended first one.

## ~15:25 UTC — sized the recommended class-C axis ("an example per non-abstract profile")

Counted on origin/main: FSH `Profile:` entries with no `^abstract = true`, against FSH `InstanceOf:` targets. JSON examples are not counted, and none exist under `input/examples` in these three.

| IG | non-abstract profiles | with ≥1 `InstanceOf:` example | without |
|---|---|---|---|
| smart-base | 15 | 0 | 15 |
| smart-trust | 0 | 0 | 0 (its content is Logical models + instances) |
| smart-immunizations | 5 | 2 | 3 |

**Do not read smart-base's 0/15 as a defect.** Its `SG*` profiles (SGValueSet, SGLibrary, SGPlanDefinition…) are META-profiles that the artefacts of DEPENDENT IGs conform to. Their natural examples are those IGs' artefacts, reached cross-IG rather than through an `InstanceOf:` in smart-base. A same-IG count is the wrong denominator for a base IG. Any axis built here needs one of two things:
- (a) to be scoped to IGs whose profiles constrain clinical resources, or
- (b) to accept a dependent IG's conforming artefact as the example.

The same caution applies to the cross-IG "conforms to SPC profile" rows, which are class B and the Publisher's call.

smart-immunizations' 3 uncovered profiles are the only real, same-IG findings. That makes the axis's first-run signal small (3 items). It is still the most mechanical candidate, and it needs (a) or (b) decided first. That is an owner decision; nothing built.

## ~15:33 UTC — l3_*.md read for SHALL rules; one cross-artefact rule measured

17 L3 pages, 2,290 lines with l2_l3_overview. Of the SHALL/MUST statements:
- **Most are profile conformance.** For each artefact type they require conformance to CRMIShareable* / CRMIPublishable* (CodeSystem, ConceptMap, PlanDefinition, Questionnaire, Measure, Library), plus CPG/SDC/CQFM profiles. That is class B: the Publisher's validation answers it.
- **Field-population tables** (l3_libraries: ~25 rows of "SHALL be populated with {{ig …}}"). These are also expressible as profile constraints, so class B. Note `useContext` carries an unfinished `????` in WHO's own text.
- **Cross-artefact rules the Publisher does NOT answer** (class C candidates):
  - every CQL library has a Library resource (already measured 279↔279 1:1 in `qa-checkers-dak.ts`'s header);
  - every Decision Table has a Requirements document pointing at it;
  - every input in a decision/scheduling table has a CQL expression;
  - every Measure input is in the measure's `terms` and every term is in the Data Dictionary;
  - Name SHALL equal id (PlanDefinition, Measure, Library);
  - url SHALL be `[base]/Type/[id]`;
  - each definitional artefact has ≥1 example (l3_examples, the same rule as the checklist row sized earlier).

**Measured: name == id on smart-immunizations (origin/main 86898e6).** Raw FSH shows NO `* name =` on 319 of 320 Library/Measure instances, because name is set inside a RuleSet (`* insert LogicLibrary( X )`, `MeasureProportion( [[…]], X, … )`, both doing `* name = "{library}"`). After resolving the RuleSet argument:
- Library: 278/278 have argument == instance id.
- Measure: 41/41 have argument == instance id.
- PlanDefinition: 0 instances in this IG.

**So the rule holds, and the lesson is about WHERE to check.** Any FSH-text checker for a field-level SHALL is blind to RuleSet-set values and would report 319 false "missing name" findings here. Field-level rules must be judged on BUILT resources (SUSHI output, or fhir-harness's ig-ast), never on `.fsh` text. That narrows class C to two kinds of checker:
- presence/pairing counts, which are safe on FSH;
- field rules, which need the AST.

**"Every Decision Table SHALL have a Requirements document pointing at it": nothing to judge today.**
- smart-immunizations' decision logic exists only as `input/decision-logic/IMMZ DAK_decision-support logic.xlsx`, with no `.dmn` and no PlanDefinition.
- Its `input/fsh/requirements/` holds only a `.gitignore`.
- A checker for this rule would judge 0 items here, which is the dh4f shape: it waits on decision tables existing as artefacts. The workbook reader (the .xlsx templates in the kit's input/images/) is the precondition.

## ~15:37 UTC — l2_templates.md read; decision-support workbook compared with its template

The kit ships 5 workbook templates (data dictionary, decision-support, scheduling, indicators, functional/non-functional requirements), each in v2 and v2.1, plus a Word template for the narrative components. BPMN is authored in an external modeller (Camunda recommended).

**The template does NOT describe the real workbook's layout.** Compared with openpyxl 3.1.5:
- **Template v2.1** (8 sheets): one sheet PER decision table, header row `U or R or F | Input Expression 1 | Input Expression 2 | Output(s) | Annotation(s) | Reference(s)`. COVER columns: `Activity ID | Activity name | Decision-support table ID | Decision name | Description | Reference(s)`.
- **smart-immunizations' `IMMZ DAK_decision-support logic.xlsx`** (29 sheets): one sheet PER ANTIGEN, each holding several tables under `Decision ID | IMMZ.D2.DT.… | Schedule ID | IMMZ.D18.S.…` header blocks. It merges decision-support and scheduling logic in one workbook. Its COVER columns differ (`Activity ID.Activity name | Tab name | … identification (ID) | Table description | Reference/source`). No row carries the template's hit-policy marker (U/F/R) in column A.

**So a reader bounded by the template would read this workbook as zero tables.** A reader has to take the real layout as one of its inputs: find `Decision ID` / `Schedule ID` blocks rather than one table per sheet.

**What IS internally consistent:** 81 distinct `IMMZ.D*.DT.*` decision-table ids on the table sheets, the same 81 listed on COVER (0 sheets-only, 0 COVER-only), plus 67 scheduling ids. That is a usable workbook-level check, "every table is registered on COVER and vice versa", and it passes here.

**Workbook hygiene the reader must decide on:** sheets `Hepatitis B (old)` and both `Cholera L2 Publication` and `Cholera` exist. Superseded and duplicated tables sit beside current ones, with only the sheet name to tell them apart.

**This revises my earlier note.** Bean `sopq`'s opening says a workbook reader "is now bounded against a published template rather than reverse-engineered". Measured, that holds for the template but not for the one real decision-support workbook we hold. Reverse-engineering the real layout is still required.

## ~15:41 UTC — data-dictionary and indicators workbooks compared with their v2.1 templates

The only workbooks among the three forks are smart-immunizations' 3 (core data dictionary, indicators, decision-support). smart-trust has none. smart-base has only an ISCO-08 reference table.

**Core data dictionary is CLOSE to its template, with differences a header-name matcher must absorb:**
- Template: header on row 2. `Activity ID* | Activity name* | Data element ID* | Data element label* | Description and definition* | Data type* | List to include this data element… | Quantity subtype | Calculation`.
- IMMZ: header on row 1. `Activity ID | Data element ID | Data element label | Description and definition | Multiple choice type (if applicable) | Data type | Input option(s) | Calculation | Quantity subtype`.
- The differences:
  - IMMZ has no `Activity name`.
  - IMMZ's sheets differ among themselves (`Input option` on one, `Input options` on the others).
  - The required-marker `*` is absent.
  - The column order differs.
- One sheet per activity group (IMMZ.C, IMMZ.D, IMMZ.I…), as the template intends.
- **A reader keyed on normalised header NAMES (strip `*`, singular/plural, whitespace) would work. One keyed on column POSITION or the template's header row would not.**

**Indicators diverges more:**
- Template: `Indicator unique identifier | Indicator name | Indicator short name | Indicator also known as | Indicator definition | Direction of progress | Numerator | Denominator | Disaggregation criteria | …`.
- IMMZ: 8 columns, `Indicator ID | Indicator name | Indicator definition | Numerator | Denominator | Disaggregations | References | Annotations`.
- IMMZ lacks `short name`, `also known as` and `direction of progress`. Its identifier column is named differently.
- The 41 Measures (IMMZIND01…) are the L3 side of this table; the earlier name==id measurement covered them.

**Summary across all three workbooks:**
- The data dictionary is near-template.
- Indicators is a reduced variant.
- Decision-support is a different layout entirely.

So "bounded against the template" holds best for the data dictionary, which is where a workbook reader should start.

## Summary of Changes

Mirror copy. Completed in litlfred/cat-harness-tools' store by drain lane B: 19 candidate DAK QA criteria mined from the WHO IG starter-kit checklist and conventions. Implementing them belongs beside qa-checkers-dak.ts in smart-base; smart-base declares no bean store yet, so that follow-up is noted here until it does.



## Summary of Changes

Mined 2026-10-10 (lane B drain) from `WorldHealthOrganization/smart-ig-starter-kit` (`input/pagecontent/`): `checklist.md` (297 lines), `qa_check.md` (28) and `authoring_conventions.md` (78), the three files the bean ranked highest. The source was read as data.

**Already covered** by smart-base's `content/pipeline/qa-checkers-dak.ts`: `dak-companion-present`, `dak-bpmn-has-process`, `dak-dmn-has-decision-table`, `dak-fsh-declares-kind`, `dak-label-prefix-matches-kind`. None of the checklist's IG-structure rows below is covered.

**Candidate criteria, each a rule WHO already holds DAK authors to** (✓ = mechanically checkable over the IG source):

| source row | candidate criterion | check |
|---|---|---|
| L1 Home.Summary | `dak-home-links-guidance`: home page links its L1/L2 guidance documents | ✓ ≥1 external link with a description |
| L1 Home.Providing Feedback | `dak-feedback-section` | ✓ section present on the home page |
| L1 Adapting Guidelines | `dak-adapting-page` (`adapting_guidelines`) | ✓ page exists |
| L2 Business Requirements (8 pages) | `dak-l2-pages-present`: concepts, personas, usecases, business_process, dictionary, decision_support, functional, nonfunctional; indicators only if indicators are defined | ✓ each page exists (conditional rule for indicators) |
| L3 Logical Models | `dak-logical-model-per-dataset`: one logical model per L2 data-dictionary asset | ✓ given the dictionary list |
| L3 Sequence Diagram | `dak-sequence-diagram` | ✓ page exists |
| L3 Mappings | `dak-map-per-dataset`: a StructureMap per data set, IPS as source | ✓ per data set |
| L3 QA Report (×3) | `dak-qa-no-profile-errors`: no shareable/publishable/computable/executable profile errors | ✓ from the IG Publisher `qa.json` |
| L4 Testing | `dak-example-per-profile`: every non-abstract profile has an example | ✓ |
| L4 Test Data (optional) | `dak-cql-has-test-library` | ✓, advisory |
| Global STU note | `dak-stu-maturity`: home page states maturity and version | ✓ |
| Global footer | `dak-qa-warnings-reasoned`: no errors, and every suppressed warning carries a reason | ✓ from `qa.json` |
| Global Home.Changes | `dak-changes-page` | ✓ page exists |
| qa_check: every artefact | `dak-title-description`: every artefact has a title and a description | ✓ |
| qa_check: logical model elements | `dak-lm-internal-code`: each element maps to an internal code (LOINC/SNOMED optional) | ✓ |
| conventions: ids | `dak-resource-id`: `[A-Za-z0-9\-.]{1,64}`, no underscore | ✓ |
| conventions: names | `dak-resource-name`: `^[A-Z][A-Za-z0-9_]{1,254}$`, underscores discouraged | ✓ (warn on `_`) |
| conventions: files | `dak-file-matches-id`: FSH at `ResourceType/resourceid.fsh`, JSON/XML `ResourceType-resourceid`, no two names differing only in case, aliases in `fsh/Aliases.fsh` | ✓ |
| conventions: locations | `dak-input-folder`: each resource sits in its declared `input/[fsh/]<kind>` folder | ✓ |

**Where this goes next:** the criteria are DAK-adapter rules, so the implementing bean belongs to **smart-base's store**, beside `qa-checkers-dak.ts`. That was handed to the coordinating session to file. Still unread and worth a second pass there: the ~12 `l3_*.md` per-artefact SOPs (~3,600 lines).

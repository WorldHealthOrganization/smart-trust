---
$schema: folio-methodology/v1
name: requirements-standards-assessment
title: Assessment of open standards for requirements and methodologies fitting the bootstrap Requirement
origin: >
  Survey and comparative assessment of formal and open requirements standards:
  OMG Requirements Interchange Format (ReqIF 1.2, formal/2013-10-01);
  OASIS Open Services for Lifecycle Collaboration Requirements Management (OSLC-RM 2.1 / OSLC Core 3.0);
  Easy Approach to Requirements Syntax (EARS: Mavin et al., IEEE RE 2009);
  ISO/IEC/IEEE 29148:2018 (Systems and software engineering — Life cycle processes — Requirements engineering);
  IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications, superseded by ISO/IEC/IEEE 29148);
  ISO/IEC 25010:2011/2023 (Systems and software engineering — Systems and software Quality Requirements and Evaluation — System and software quality models);
  INCOSE Guide for Writing Requirements (INCOSE-TP-2010-006-04, 4th Edition, 2023).
  Evaluated against the bootstrap Requirement schema (bootstrap/schemas/requirement.schema.json, Issue #1164).
evidence:
  - library/rfc2119-key-words-requirement-levels
  - library/rfc8174-uppercase-vs-lowercase-2119-key-words
applies-when: >
  **Evaluating how requirements authored or verified in the harness map to or
  from open industry standards, interchange formats, statement grammars, and
  quality models — and deciding which transformations belong in higher harness
  layers (cat-harness, and content layers above it) while keeping the bootstrap
  Requirement schema strictly self-contained and free of external dependencies.**
  It answers *how bootstrap requirements translate to ReqIF, OSLC-RM, EARS, ISO
  29148, and ISO 25010, what each standard costs in serialization and semantic
  complexity, and where mapping adapters must live*. It does NOT govern runtime
  execution logs (`prov-o-provenance`), decision table structures (`dmn`),
  software package bills of materials (`spdx-3`), or access policy enforcement
  (`odrl-policies`).
---

# Assessment of open standards for requirements and bootstrap mapping

**Status: evaluated and recommended, NOT adopted into bootstrap.** Issue #1164.
Owner, 2026-09-23, choosing markdown front matter for requirement documents:
*"1 for now. need bean to assess open stds for requirements/methodologies that
fit in"*.

The bootstrap Requirement (`bootstrap/schemas/requirement.schema.json`) is
deliberately free of outside concepts. This methodology assesses open standards
across three categories — **interchange formats**, **statement templates &
grammars**, and **quality models** — evaluating their licensing, governance,
serialization overhead, and exact field-by-field fit to the bootstrap
Requirement. It concludes with concrete architectural recommendations on layer
placement and verifies the no-outside-concept boundary.

---

## 1. The bootstrap baseline: the six parts of a requirement

In the bootstrap and harness architecture, a requirement is defined by six
essential parts (formalized in Issue #2405, FR-007/FR-008, and documented in
`skills/content/requirements-planning/requirement-definition.md`):

1. **Identifier (`id`)**: A globally unique URI/slug (`req:<slug>`), with each
   individual requirement statement addressable as `req:<slug>#<key>` and each
   success criterion addressable as `req:<slug>#<key>/<criterion>`.
2. **Title & Label**: A concise human-readable heading (`title` for the document,
   `label` for each atomic statement).
3. **Statement & Conformance (`requirement`, `conformance`)**: Exactly one sentence
   that a reviewer or test can say yes or no to, qualified by an RFC 2119
   conformance verb (`SHALL`, `SHOULD`, `MAY`, `SHALL NOT`).
4. **Rationale / Benefit (`benefit`, `description`)**: The justification explaining
   why the obligation exists and what value it delivers.
5. **Parent & Lineage (`derivedFrom`)**: Direct upstream references in the
   specialization/conformance lattice.
6. **Acceptance & Verification (`successCriteria[]`)**: At least one concrete success
   criterion (`criterion`) with an explicit verification method (`verification` ∈
   `{test, inspection, review, analysis}`). A requirement without a success
   criterion can be filed and never judged.

A requirement document is authored in Markdown with YAML front matter or stored
as JSON, and grouped into a **`RequirementSet`** (`reqset:<slug>`) tracking stages
(`draft → proposed → approved → planned → in-progress → delivered → accepted`),
member decisions, work plans (work items), and recorded human sign-off attestations.

---

## 2. Survey of open standards

### Category A: Interchange formats

#### 1. ReqIF (OMG Requirements Interchange Format v1.2)
- **Origin & Governance**: Object Management Group (OMG formal/2013-10-01),
  originally standardized by ProSTEP iViP. Also ISO/IEC 17506:2022.
- **Licence**: Open specification, royalty-free (RF).
- **Maturity**: High. De facto interchange standard in automotive, aerospace,
  and defense systems engineering (supported by IBM DOORS / DOORS Next, PTC
  Integrity, Siemens Polarion, Dassault, Eclipse ProR).
- **Serialization Overhead**: Very high. XML-based schema with extensive
  metamodel indirection: `REQ-IF` → `CORE-CONTENT` → `DATATYPES` → `SPEC-TYPES`
  (`SpecObjectType`, `SpecRelationType`) → `SPEC-OBJECTS` → `SPEC-RELATIONS` →
  `SPECIFICATIONS` (`SpecHierarchy`). Attributes require multi-level XML wrappers
  (`<ATTRIBUTE-VALUE-STRING>`, `<THE-VALUE>`). Line-based Git diffs of raw
  ReqIF XML are unreadable.
- **Semantic Alignment to Bootstrap**:
  - `SpecObject` maps to a bootstrap `Statement` (or an atomic `Requirement`).
  - `SpecObjectType` defines attribute metadata.
  - `ReqIF.Name` maps to `title` / `label`.
  - `ReqIF.Text` maps to `requirement` (statement text).
  - `SpecRelation` (type `derives` or `parent`) maps to `derivedFrom`.
  - Verification items can be modelled either as separate `SpecObject`s linked via
    `SpecRelation` (type `verifiedBy`), or as structured attributes on the
    `SpecObject` (`VerificationMethod`, `SuccessCriteria`).
- **Verdict**: Excellent for enterprise import/export projection; totally unsuitable
  for native storage or authoring in Git.

#### 2. OSLC-RM (OASIS OSLC Requirements Management v2.1 / OSLC Core 3.0)
- **Origin & Governance**: OASIS Open Standard.
- **Licence**: OASIS Royalty-Free (RF) on Limited Terms.
- **Maturity**: High in ALM/PLM linked-data ecosystems (IBM Engineering Lifecycle
  Management, Siemens, Eclipse Lyo).
- **Serialization Overhead**: Moderate to High. RDF graph representations (JSON-LD,
  Turtle, RDF/XML). Relies on URI dereferencing, Linked Data Platform (LDP)
  protocols, and ontology vocabularies (`oslc_rm:`, `dcterms:`).
- **Semantic Alignment to Bootstrap**:
  - `oslc_rm:Requirement` resource type.
  - `dcterms:identifier` maps to `id` / `key`.
  - `dcterms:title` maps to `title` / `label`.
  - `dcterms:description` maps to `requirement` statement text.
  - `oslc_rm:derivedFrom` and `oslc_rm:elaboratedBy` map to `derivedFrom` / `dependsOn`.
  - `oslc_rm:validatedBy` links to test artifacts or verification definitions.
- **Verdict**: Natural fit with knowledge-graph / JSON-LD export pipelines
  (`ns.jsonld`, `kg-export`), but introduces unnecessary REST/graph server
  assumptions if forced into the local authoring loop.

---

### Category B: Statement templates and grammars

#### 3. EARS (Easy Approach to Requirements Syntax)
- **Origin & Governance**: Alistair Mavin, Philip Wilkinson, Adrian Harwood, Mark
  Novak (Rolls-Royce plc / IEEE International Requirements Engineering Conference 2009).
- **Licence**: Unencumbered, open methodology.
- **Maturity**: High. Widely adopted across aerospace, automotive, medical device,
  and agile systems engineering.
- **Serialization Overhead**: Zero. Operates directly on the requirement statement
  natural language text.
- **The Five EARS Patterns**:
  1. **Ubiquitous**: *"The `<system>` shall `<system response>`."*
     - Example: *"The harness SHALL validate every block against its declared schema."*
  2. **Event-driven**: *"When `<trigger>`, the `<system>` shall `<system response>`."*
     - Example: *"When a plan is requested, the agent SHALL produce a requirements document and work plan."*
  3. **State-driven**: *"While `<in a state>`, the `<system>` shall `<system response>`."*
     - Example: *"While the requirement set is in draft stage, the tool SHALL allow modification of statement keys."*
  4. **Unwanted behavior**: *"If `<trigger/error>`, then the `<system>` shall `<system response>`."*
     - Example: *"If a statement lacks success criteria, then `check:requirements` SHALL emit a validation finding."*
  5. **Optional features**: *"Where `<feature is present>`, the `<system>` shall `<system response>`."*
     - Example: *"Where LaTeX tooling is installed, the adapter SHALL generate typeset math blocks."*
  *(Complex requirements combine While, Where, When, and If clauses).*
- **Semantic Alignment to Bootstrap**:
  - Fits directly inside the `requirement` string in bootstrap `Statement`.
  - The `<system>` noun maps to `actors` / harness components.
  - Conformance verbs align 1:1 with RFC 2119 / bootstrap `SHALL`, `SHOULD`, etc.
  - Can be validated deterministically by regular expressions or syntax AST
    checkers in `check:requirements` without altering the data schema.
- **Verdict**: The optimal statement syntax pattern for authoring requirements in
  the harness.

#### 4. ISO/IEC/IEEE 29148:2018 (Systems and software engineering — Requirements engineering)
- **Origin & Governance**: Joint ISO/IEC/IEEE standard. Replaced and consolidated
  IEEE 830, IEEE 1220, and IEEE 1233.
- **Licence**: Formal international standard (copyright held by ISO/IEEE; concepts
  open for reference).
- **Maturity**: Definitive international benchmark for requirements engineering.
- **Serialization Overhead**: Zero (process and semantic standard, not a file format).
- **Core Elements**:
  - **Requirement Construct (Clause 5.2.4)**: Defines standard syntax comprising
    Conditions, Subject, Conformance Verb ("shall", "should", "may"), Action/Object,
    and Constraints.
  - **Verification Methods (Clause 6.4)**: Explicitly standardizes the four
    fundamental verification methods:
    1. *Test*: Quantitative verification using automated or manual test cases with
       controlled inputs and measured outputs.
    2. *Inspection*: Visual or manual verification by examining the product,
       code, or documentation without executing it.
    3. *Analysis*: Verification using mathematical models, calculations, simulations,
       or formal logic proofs.
    4. *Demonstration*: Qualitative verification of observable operation under
       specified scenarios (analogous to `review`).
- **Semantic Alignment to Bootstrap**:
  - Bootstrap's verification method enum (`test`, `inspection`, `review`, `analysis`)
    is an exact 1:1 realization of ISO 29148's verification quartet (with `review`
    representing demonstration/adjudication).
  - Traceability relations (`derivedFrom`, `dependsOn`) align with Clause 5.2.7.
- **Verdict**: The conceptual foundation for the harness's requirement definition.

#### 5. IEEE Std 830-1998 (Software Requirements Specifications — SRS)
- **Origin & Governance**: IEEE Computer Society.
- **Status**: **Officially withdrawn and superseded by ISO/IEC/IEEE 29148:2011/2018.**
- **Licence**: Historical IEEE standard.
- **Maturity**: Historic benchmark, but obsolete in modern systems engineering.
- **Fit to Bootstrap**: Premised on large, monolithic, document-centric Software
  Requirements Specification (SRS) manuals (Section 1 Introduction, Section 2
  General Description, Section 3 Specific Requirements). Bootstrap requirements
  are atomic, graph-linked statement nodes in Git rather than monolithic text
  chapters.
- **Verdict**: Superseded. Retained only for historical traceability; all modern
  harness mappings should cite ISO/IEC/IEEE 29148:2018.

---

### Category C: Quality models

#### 6. ISO/IEC 25010:2011 / 2023 (Systems and software Quality Requirements and Evaluation — SQRE)
- **Origin & Governance**: ISO/IEC JTC 1/SC 7.
- **Licence**: Formal international standard.
- **Maturity**: Universal international taxonomy for software quality characteristics
  and Non-Functional Requirements (NFRs).
- **Structure**: Defines 8 product quality characteristics (expanded to 9 in 2023):
  1. *Functional Suitability* (completeness, correctness, appropriateness).
  2. *Performance Efficiency* (time behaviour, resource utilization, capacity).
  3. *Compatibility* (co-existence, interoperability).
  4. *Interaction Capability / Usability* (recognisability, learnability, operability, aesthetics).
  5. *Reliability* (maturity, availability, fault tolerance, recoverability).
  6. *Security* (confidentiality, integrity, non-repudiation, accountability, authenticity).
  7. *Maintainability* (modularity, reusability, analysability, modifiability, testability).
  8. *Portability* (adaptability, installability, replaceability).
  9. *Safety* (2023 addition: operational risk, hazard mitigation).
- **Semantic Alignment to Bootstrap**:
  - Bootstrap `Statement` differentiates `kind: "functional"` and `kind: "non-functional"`.
  - For `kind: "non-functional"`, bootstrap requires a `category` string.
  - ISO/IEC 25010 characteristics provide the canonical controlled vocabulary
    for this `category` field (e.g. `security`, `performance-efficiency`,
    `maintainability`, `reliability`).
- **Verdict**: Strongly recommended as the controlled taxonomy for non-functional
  requirement validation in `cat-harness`.

#### 7. INCOSE Guide for Writing Requirements (INCOSE-TP-2010-006-04, 2023)
- **Origin & Governance**: International Council on Systems Engineering (INCOSE).
- **Licence**: INCOSE copyright; educational / professional guidance.
- **Maturity**: Universal de facto standard for requirements authoring quality and
  automated linting rules.
- **Structure**: Defines 9 Requirement Characteristics (Necessary, Appropriate,
  Conforming, Singular, Feasible, Verifiable, Correct, Conforming, Complete) and
  40+ specific quality rules:
  - *Singularity*: One requirement per statement; no compound sentences with "and/or".
  - *Verifiability*: Must state conditions that can be definitively verified.
  - *No ambiguous words*: Avoid vague terms ("user-friendly", "rapid", "cost-effective",
    "easy", "robust").
  - *No escape clauses*: Avoid "where possible", "as appropriate", "to the extent practical".
  - *Active voice*: Clear subject acting upon an object.
- **Semantic Alignment to Bootstrap**:
  - Directly justifies the bootstrap requirement rule: *"one sentence a reviewer can
    say yes or no to"* and *"at least one success criterion with a verification method"*.
  - Provides the precise linting rules for automated QA criteria in `check:requirements`.
- **Verdict**: Strongly recommended as the rule basis for requirements quality linters.

---

## 3. Field-by-field fit analysis

The table below maps each field of the bootstrap `Requirement` and `Statement`
to the surveyed standards:

| Bootstrap Field | ReqIF 1.2 XML | OSLC-RM 2.1 RDF/JSON-LD | EARS Syntax Pattern | ISO/IEC/IEEE 29148:2018 | ISO 25010 / INCOSE Rule | Fit Verdict |
|---|---|---|---|---|---|---|
| `id` (`req:<slug>#<key>`) | `IDENTIFIER` (UUID/NCName) + `ReqIF.ForeignID` | `dcterms:identifier` / Subject URI | N/A (statement syntax) | Requirement Identifier (§5.2.2) | INCOSE Identifiable | **Exact** |
| `title` / `label` | `AttributeValueString` (`ReqIF.Name`) | `dcterms:title` | N/A | Title / Short Name | Short description | **Exact** |
| `requirement` (statement text) | `AttributeValueXHTML` / String (`ReqIF.Text`) | `dcterms:description` | EARS Pattern Template | Requirement Construct (§5.2.4) | INCOSE Singular sentence | **Exact** |
| `conformance` (`SHALL`, etc.) | Attribute `ConformanceLevel` (Enum) | Statement verb / custom predicate | Pattern modal verb ("shall") | Obligation keyword ("shall", "should") | INCOSE Conformance verb (R4) | **Exact** (RFC 2119) |
| `kind` (`functional`/`non-functional`) | `SpecObjectType` / Attribute `Kind` | `rdf:type` / `dcterms:type` | Pattern type | Functional / Quality requirement | ISO 25010 Classification | **Exact** |
| `category` (NFR taxonomy) | Attribute `Category` | `dcterms:subject` | N/A | Quality characteristic | ISO 25010 Characteristic | **Exact** (canonical taxonomy) |
| `benefit` / Rationale | Attribute `Rationale` / `Benefit` | `oslc:rationale` | Optional rationale clause | Rationale (§5.2.6) | INCOSE Justification | **Exact** |
| `derivedFrom` (parent lattice) | `SpecRelation` (`type: derives`) | `oslc_rm:derivedFrom` | N/A | Traceability relation (§5.2.7) | INCOSE Traceability | **Exact** |
| `actors` (roles) | Attribute `Stakeholder` / `Actor` | `dcterms:creator` / custom | `<system>` / `<actor>` in pattern | Stakeholder role (§5.2.3) | Subject actor | **Exact** |
| `successCriteria[].criterion` | `SpecRelation` to VerificationItem / Attribute | `oslc_rm:validatedBy` target / criterion | N/A | Verification condition (§6.4) | INCOSE Verifiability (R24) | **Exact** |
| `successCriteria[].verification` | Attribute `VerificationMethod` (Enum) | Property `oslc_rm:verificationMethod` | N/A | Methods: Test, Inspection, Analysis, Demonstration | INCOSE Verification method | **Exact** (1:1 with 29148) |
| `dependsOn` | `SpecRelation` (`type: dependsOn`) | `oslc_rm:elaboratedBy` / dependsOn | N/A | Dependency relationship | Traceability | **Exact** |
| `status` | Attribute `Status` (Enum) | `oslc:status` | N/A | Lifecycle state | State model | **Exact** |

---

## 4. Architectural assessment: complexity, cost, and layer placement

### Why nothing is adopted into bootstrap (the no-outside-concept rule)

Bootstrap (`bootstrap/`) is the foundational, zero-dependency substrate of the
entire folio-assistant platform. It defines the core data contracts and schemas
that every tool, harness, and workspace inherits.

1. **No External Dependencies**: Bootstrap cannot import or depend on heavy XML
   parsers (for ReqIF), RDF/triple-store engines (for OSLC), or specialized NLP
   libraries.
2. **Git Hygiene and Line-Oriented Diffs**: Markdown front matter (`.md`) and lean
   JSON files (`.json`) produce readable, clean Git diffs on PR reviews. ReqIF XML
   produces massive, unreadable multi-thousand-line diffs for minor attribute changes.
3. **Speed and Portability**: Validating bootstrap schemas via Zod is nearly
   instantaneous in Bun or Node. It introduces zero runtime overhead.
4. **Conclusion**: Any standard mapping or projection **must live in higher layers**
   (`cat-harness`, or a content layer above it). Injecting outside formats into
   bootstrap would violate the repository's foundational architecture.

### Architectural layer placement

The diagram below illustrates the strict separation of concerns across layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Projection & Integration Adapters (tools / folio-assistant)   │
│  - ReqIF Exporter/Importer (.reqif XML for DOORS, Polarion, Cameo)     │
│  - OSLC-RM Linked Data Provider (JSON-LD / RDF / LDP)                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ maps to/from
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Layer 1: Harness Validation & Quality Linters (cat-harness)            │
│  - EARS Pattern Validator (checks statement regex / grammar in CI)    │
│  - INCOSE Requirements Linter (flags vague words, compound sentences) │
│  - ISO 25010 NFR Category Checker (validates non-functional categories)│
│  - check:requirements gate & requirement-set adjudication              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ validates
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Layer 0: Bootstrap Substrate (bootstrap/)                             │
│  - Pure Markdown Front Matter + Zod Schema                            │
│  - Zero outside concepts, zero external dependencies                  │
│  - 6-part requirement structure: id, title, statement, conformance,   │
│    derivedFrom, successCriteria (test, inspection, review, analysis)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Concrete recommendations

1. **Maintain Markdown Front Matter + Zod as Native Format**:
   - The current Markdown front matter format for requirement documents (and JSON
     for programmatic requirement nodes) is optimal.
   - It is human-readable, machine-checkable via strict Zod schemas, and perfectly
     suited for Git pull request workflows.
   - Do **not** replace the front matter format with ReqIF XML or raw OSLC RDF.

2. **Implement EARS Grammar Verification in `cat-harness`**:
   - Add an EARS pattern checker into `check:requirements` (or as a dedicated
     script `scripts/check-ears-patterns.ts`).
   - Every `requirement` statement should be checked against the 5 EARS patterns
     (Ubiquitous, Event-driven, State-driven, Unwanted behavior, Optional features).
   - This provides immediate authoring feedback and enforces rigorous syntax without
     changing the underlying data schema.

3. **Standardize NFR Categories on ISO/IEC 25010**:
   - In `cat-harness` validators, enforce that for statements with `kind: "non-functional"`,
     the `category` field belongs to the ISO/IEC 25010 quality taxonomy (`security`,
     `performance-efficiency`, `compatibility`, `interaction-capability`, `reliability`,
     `maintainability`, `portability`, `safety`).

4. **Build Projection Adapters in Higher Layers on Demand**:
   - When interoperability with enterprise requirements tools is required:
     - Develop `tools/reqif-adapter`: converts `RequirementSet` and `Requirement`
       nodes into standard OMG ReqIF 1.2 XML packages and vice versa.
     - Develop `tools/oslc-rm-adapter`: exposes requirement graphs via OSLC-RM JSON-LD
       contexts mapped through `ns.jsonld`.
   - Keep these tools isolated from the core bootstrap package.

---

## 6. What this methodology refuses

- **Refuses adopting ReqIF XML or OSLC RDF into `bootstrap/`.** Bootstrap must
  remain free of external interchange baggage.
- **Refuses monolithic document SRS models (IEEE 830).** Requirements in this
  platform are atomic, graph-addressable statements (`req:<slug>#<key>`).
- **Refuses requirements without success criteria.** A requirement without an
  explicit verification method (`test`, `inspection`, `review`, `analysis`) and
  criterion is unauditable and refused by CI gates.
- **Refuses ad-hoc NFR categories.** Non-functional categories must adhere to
  the established ISO/IEC 25010 quality model.

---
$schema: folio-methodology/v1
name: spdx-3
title: SPDX 3 — a bill of materials as a graph of elements, for what crosses a trust boundary
origin: >
  The Linux Foundation and its Contributors, with SPDX Model contributions from
  OMG, "System Package Data Exchange (SPDX) Specification Version 3.0", OMG
  formal/24-11-01, March 2025 (https://www.omg.org/spec/SPDX); its model is
  the SPDX 3.0.1 model (Annex A points at
  https://spdx.org/rdf/3.0.1/spdx-model.ttl). Licensed Community-Spec-1.0, with
  pre-existing portions CC-BY-3.0. SPDX® is a registered trademark of The
  Linux Foundation. SPDX 3.1, a release candidate since 2026-01-26, is held
  only as a secondary source (a 2025 conference deck, CC-BY-SA-3.0) and as its RC1
  machine-readable schema queued in uploads/, NOT as a specification.
evidence:
  - library/omg-2024-spdx-3-0
  - library/strauch-carbno-2025-spdx-3-1-supply-chain
applies-when: >
  **Describing an artefact that LEAVES this repository so that a party who
  does not run our tooling can check what is in it, what it depends on, under
  which licences, and that it arrived intact** — a release, a signed package, a
  published layer's dependency set, the licences of what we redistribute.
  It answers *what is this, what is it made of, who supplied it, under what
  licence, with what known vulnerabilities*. It does NOT answer what happened
  inside the repository or who answers for it (`prov-o-provenance`), what an
  actor may do (`odrl-policies`), how a node is serialised internally
  (`json-ld-serialisation`), or whether a block passed its QA criteria (the
  house QA schemas; see §"What it refuses").
---

# SPDX 3: a bill of materials as a graph of elements

**Status: ingested and analysed, NOT adopted.** The owner asked for the
analysis on 2026-10-03 and supplied the source the same day with *"ingest as
part of methodologies"*. Which parts are adopted is open as five decisions in
the applicability proposal (opt-in `cat-harness.proposals`)
§9, work item `sd5v`. This node records what the source says and where it would and
would not fit. It does not adopt anything.

## Its sources: what is held, what is not

| source | held | what this node takes from it |
|---|---|---|
| SPDX 3.0, OMG formal/24-11-01 (March 2025), model 3.0.1 | ✅ `library/omg-2024-spdx-3-0` (401 sections, text held: Community-Spec-1.0 permits it) | everything quoted below |
| SPDX 3.0.1, the Linux Foundation web edition | ❌ not held | nothing. The OMG edition's class pages carry `https://spdx.org/rdf/3.0.1/terms/…` IRIs, but the two editions were **not compared** |
| SPDX 3.1-RC1 JSON Schema + JSON-LD context | ⏳ queued, `uploads/spdx-3-1-rc1-machine-readable/` (not ingested: no rung reads a schema) | the 3.1 class names and enumerations the proposal cites. **Not compared with the published copy**: spdx.github.io is refused by the ingesting container's proxy |
| Strauch & Carbno, *Capturing the Supply Chain … with SPDX 3.1*, NIST, 2025-09-10 | ✅ `library/strauch-carbno-2025-spdx-3-1-supply-chain` (CC-BY-SA-3.0: the entry is share-alike) | a description of 3.1's direction, **not normative text** |
| the SPDX License List | ❌ not held | nothing yet. Licence-id validation needs it pinned (proposal M4) |

## The load-bearing idea, in the specification's words

> "The System Package Data Exchange (SPDX®) specification defines an open
> standard for communicating bill of materials (BOM) information for different
> topic areas. SPDX defines an underlying data model as well as multiple
> serialization formats to encode that data model." — §1 Scope (`sec-007`)

Its scope lists, among others, *"software composition"*, *"software build
information"*, *"provenance and integrity"*, *"licenses and copyrights,
including a curated list of licenses and exceptions"*, and *"security
vulnerabilities, defects, and other quality data"* (§1).

**It is profiled.** *"The Core Profile is mandatory. All others are
optional"* (§5.2, `sec-015`): Core, Software, Security, Licensing, Dataset, AI,
Build, Lite and Extension. A producer conforms at a profile, not to the whole.
The Lite Profile *"captures the minimum set of information required for
license compliance in the software supply chain"* (§5.10, `sec-023`).

**Everything is an Element with creation info.** `CreationInfo` requires
`specVersion`, `created` and `createdBy` (Figure A.1). The specification
qualifies `created` in a way that matters here: *"The dateTime created is often
the date of last change (e.g., a git commit date), not the date when the SPDX
data was created, as doing so supports reproducible builds"* (`CreationInfo`,
`sec-044`, where the page split carries it; also `sec-072`). A generator that uses the source commit's date writes the same document
twice for the same commit.

**Serialisation is JSON-LD with ONE global context.** *"The SPDX global
JSON-LD context file must be used universally for all SPDX documents in
JSON-LD format that adhere to a specific SPDX version … `"@context":
"https://spdx.org/rdf/3.0.1/spdx-context.jsonld"`"* (`sec-032`). There is also
a *"canonical serialization"*: *"a single, consistent, normalized,
deterministic, and reproducible form"* (`sec-029`). That is the form to hash
and sign.

**"Known unknown" is not the same as absent.** For licences: *"a missing
hasDeclaredLicense is not the same as a relationship to NoAssertionLicense
since the latter is a 'known unknown' whereas no assumptions can be made from
a missing hasDeclaredLicense relationship"*, and *"A written explanation of a
relationship to a NoAssertionLicense MAY be provided in the comment field for
the relationship"* (Licensing, `sec-210`).

## How it would sit beside what this platform already holds

These are the mappings the proposal rests on. Each is **ours**, read against the
held text, and none is adopted.

| house fact | SPDX 3 term | fit |
|---|---|---|
| `licence.json` `status: stated` + `id` | `simplelicensing_LicenseExpression` via `hasDeclaredLicense` | exact, once ids are validated against a pinned License List |
| `status: unknown` + `searched[]` | `hasDeclaredLicense` → `NoAssertionLicense`, the search log in the relationship's `comment` | exact. The three states survive: SPDX's absent relationship is our absent record |
| `bun.lock`, `python-deps.ts` | `software_Package` + purl (`packageUrl`) + `dependsOn` | exact for npm. Python is blocked: `requirements*.txt` pin no versions |
| `kg-to-portal`'s manifest of digests | `software_File` with `verifiedUsing: Hash` inside a `software_Sbom` | exact |
| a published layer's `needs[]` / FHIR `dependsOn` | `dependsOn` between `software_Package`s | exact, but only GENERATED from one authoritative record (#592) |
| `folio-tool-run/v1`, `attribution.ts` `toolchain` / `inputDigest` | `build_Build` (`buildType`, `configSourceDigest`, `parameter`, `environment`) | close, and it competes with `prov-o-provenance` for "what ran" |
| a QA or test report about a released package | `ExternalRef` with `externalRefType: qualityAssessmentReport`, *"A reference to a quality assessment for a package"* (`sec-123`) | exact as a POINTER. The report stays ours |
| `bun audit` advisories | `security_Vulnerability` + `security_Vex*VulnAssessmentRelationship` | exact, and a VEX `not_affected` needs a person's decision |

## What it refuses, with reasons

- **A QA verdict store.** SPDX 3.0 has no verdict class. A result is an
  `Annotation` (*"An assertion made in relation to one or more elements"*,
  free-text `statement`; `sec-039`) or a relationship (`hasEvidence`, `hasTest`,
  `testedOn`). A house sidecar holds `{criterion, result, reviewer,
  field_hash}` per criterion, many reviewers over time, with four-state
  freshness. Serialising that into SPDX turns validated fields into a string.
  **3.1 changes the first half of this**, and the change is recorded rather
  than smoothed over: the RC1 schema has `functionalsafety_EvaluationResult`
  (`evaluation` ∈ {pass, fail, inconclusive}, a required `evaluationBasedOn` →
  `RequirementVerification` with `verificationMethod` ∈ {analysis, assessment,
  audit, demonstration, inspection, review, test, other}, and a required
  rationale), plus a Core `Requirement` class. That is a verdict class. It
  makes an SPDX **export** of a certification report plausible, once 3.1 is
  final. It does not make SPDX the **store**, for the remaining reasons: the
  records are mutable, they would churn, the class sits in a *functional
  safety* profile whose semantics a non-safety QA run would be borrowing, and
  "stale" and "absent" have no SPDX term (`inconclusive` covers only
  could-not-determine).
- **A second execution log.** "What ran, as whom, under which plan" is
  `prov-o-provenance`'s, by owner decision. A release document that must say
  how it was built references the PROV record, or generates `build_Build`
  from it. It never authors one beside it.
- **The AI profile for agent authorship.** `ai_AIPackage` describes a model
  distributed as a package (training, energy consumption, limitations). The
  platform ships no model. Who wrote a block is provenance.
- **Authoring SPDX by hand, or committing it where its facts already live.**
  A document generated from `bun.lock` that is also committed is a second
  answer to "what are we running", the failure `upstream-pins.json` names.

## What the source does NOT establish

- **Anything about 3.1.** The held specification is 3.0. Every 3.1 statement
  above comes from an RC1 schema that was not compared with its published
  copy, or from a conference deck.
- **That the OMG edition and the Linux Foundation 3.0.1 web edition are
  identical.** Not compared.
- **Which `buildType` IRIs to use.** The Build profile requires one
  (`buildType: anyURI[1]`, Figure A.7) and leaves it to the producer.
- **How to sign.** SPDX carries `verifiedUsing` integrity methods. Signing
  the document is outside it, and is `qa-report-signing.bpmn`'s question.

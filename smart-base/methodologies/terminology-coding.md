---
$schema: folio-methodology/v1
name: terminology-coding
title: WHO SMART Guidelines Terminology Classification and Reuse-First Coding
origin: >
  World Health Organization, *SMART Guidelines: Digital Adaptation Kits (DAKs)*
  (Mehl et al., *BMJ Global Health* 2021;6:e004908, ingested at
  `smart-base/library/mehl-2021-who-smart-guidelines/`); *Classification of
  digital health interventions, services and applications in health (CDISAH)
  v2.0* (WHO, 2023, ISBN 978-92-4-008194-9, ingested at
  `who-iris/library/9789240081949-eng/`, superseding CDHI v1.0 at
  `who-iris/library/who-rhr-1806-eng/`); *Digital transformation handbook for
  health supply chain architecture* (WHO, 2024, ISBN 978-92-4-010119-7, ingested
  at `who-iris/library/9789240101197-eng/`); and *Digital transformation
  handbook for health product catalogue* (WHO, 2025, ISBN 978-92-4-011619-1,
  ingested at `who-iris/library/9789240116191-eng/`).
evidence:
  - library/mehl-2021-who-smart-guidelines
  - library/9789240081949-eng
  - library/who-rhr-1806-eng
  - library/9789240101197-eng
  - library/9789240116191-eng
applies-when: >
  Classifying and coding L1 narrative content (guideline recommendations,
  implementation practices, remarks) and L2 Digital Adaptation Kit (DAK)
  artefacts (personas, user scenarios, business processes, data-dictionary
  elements, decision-table concepts and indicators) against authoritative
  vocabularies and local code lists. Reach for it whenever a slot requires a
  code or SKOS concept (condition, intervention, persona/role, medicine,
  guideline domain, business process, or GRADE rating), or when deciding
  whether to reuse an existing term, fall back to a generic base concept, or
  propose a local glossary candidate. It does NOT grade evidence (that is
  `grade`), does NOT model BPMN/DMN control flow (`bpmn-authoring`,
  `dmn-authoring`), and does NOT plan
  programme investment (`diig`).
---

# WHO SMART Guidelines Terminology Classification and Reuse-First Coding

**The method behind [`classify-and-code-content`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/classify-and-code-content.md),
[`recommendation-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-extraction.md),
and [`recommendation-scenarios`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-scenarios.md).**
It joins the platform's generic ontology and glossary rules —
[`ontologist`](../../folio-assistant-core/skills/library/cataloguing/ontologist.md),
[`glossary-terms`](../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md),
[`vocabulary-authority`](../../cat-harness/skills/kg/kg-core/vocabulary-authority.md),
and [`code-lists`](../../cat-harness/library/skills/library-core/code-lists.md) — with the
WHO Family of International Classifications (WHO-FIC) and SMART Guidelines DAK
component conventions.

## 1. The scheme for each slot

Every classifiable slot in an L1 extraction or L2 DAK component has an
authoritative primary scheme and a local fallback or code list. Coding a slot
means resolving a concept in the scheme designated for that slot, never picking
an arbitrary string or borrowing a code from an unrelated axis.

| Slot | Where it sits | Authoritative scheme(s) | Local representation in this stack |
|---|---|---|---|
| **Condition / disease / health problem** | L1 `recommendation.population` / `condition`; L2 data dictionary (C5) & DMN inputs (C6) | **ICD-11** (WHO International Classification of Diseases, 11th Revision; MMS & foundation URI) | `KGTerminologySystem` (`#ICD11`, `http://id.who.int/icd/release/11/mms`); DAK C5 `ICD-11` binding column |
| **Intervention (clinical, public-health or digital)** | L1 `recommendation.intervention`; L2 user scenarios (C3), business processes (C4), data dictionary (C5), indicators (C8) | **ICHI** (International Classification of Health Interventions) for clinical and public-health interventions; **CDISAH / CDHI v2.0** (`library/9789240081949-eng`, `input/fsh/codesystems/CDHIv2.fsh`, `CDSCv2.fsh`) and **CDHI v1.0** (`library/who-rhr-1806-eng`, `CDHIv1.fsh`) for digital health interventions and system categories; **WHO UHC Intervention Compendium** for service packages | `input/fsh/codesystems/CDHIv2.fsh`, `CDHIv1.fsh`, `CDSCv2.fsh`, `CDSCv1.fsh`; `KGTerminologySystem` (`#ICHI`, `#SNOMEDCT`, `#LOINC`) |
| **Persona / actor / occupational role** | L2 generic personas (C2), user-scenario `involves` edges (C3), BPMN swimlanes (C4) | **ISCO-08** (ILO International Standard Classification of Occupations) and **CDISAH / CDHI health-workforce categories** | Target guide's `personas.md` (`l1-scenario-vocabulary/v1`), then `smart-base` generic personas (`input/fsh/actors/*.fsh`, `DAK.Persona.*`, `input/fsh/codesystems/ISCO08.fsh`), then local [`glossary-terms`](../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md) candidate |
| **Medicine / vaccine / health product** | L1 `recommendation.intervention`; L2 data dictionary (C5), scheduling logic (C7), product catalogues (`library/9789240116191-eng`) | **WHO ATC** (Anatomical Therapeutic Chemical classification) and **ICD-11** medicaments/vaccines extension | `KGTerminologySystem` (`#ATC`, `http://www.whocc.no/atc`); product-catalogue attributes per `library/9789240116191-eng` |
| **Guideline / scenario domain** | L1 intake classification; L2 user-scenario `domain` property | **SMART Guideline domain scheme** (`clinical` \| `public-health` \| `health-system-strengthening`) | `folio-assistant-core/glossary/guideline-domain.glossary.json` (`folio-glossary/v1`, SKOS `ConceptScheme` `guideline-domain`) |
| **Business process** | L2 business processes (C4); `business-process realises user-scenario` edge | Target SMART Guideline's **C4 business process catalogue** (`business-processes.md`); domain process catalogue where published | `l1-scenario-vocabulary/v1` `processes[]`; `could-not-determine` with a structured warning when absent |
| **Normative statement strength, direction & certainty** | L1 `recommendation` (`strength`, `direction`, `certaintyOfEvidence`); EtD frameworks | **GRADE** (Grading of Recommendations Assessment, Development and Evaluation) and **RFC 2119 / BCP 14** requirement levels | `smart-base/code-lists/grade-*.json` (`grade-recommendation-strength`, `grade-recommendation-direction`, `grade-certainty`, `grade-etd-criterion`, `grade-rating-down`, `grade-rating-up`) and `folio-assistant-core/code-lists/rfc2119-requirement-level.json` |

## 2. The reuse-first precedence

An agent or terminologist coding any slot walks the **four-rung ladder** and
**stops at the first rung that yields an exact or well-scoped match**:

1. **Rung 1 — Target guide's own declared vocabulary (`exactMatch` in guide).**
   The target guide's own personas (`personas.md`), business processes
   (`business-processes.md`), data dictionary (C5) and local code lists. If one
   defines the concept and its scope covers the statement, reuse its
   identifier verbatim.
2. **Rung 2 — Layer base vocabulary (`smart-base` generic personas, FSH CodeSystems, and shared code lists).**
   When the target guide does not declare the concept, or declares it more
   narrowly than the statement needs (an immunization guide's health worker
   cannot be stretched to cover inpatient clinical management):
   - `smart-base` generic personas (`DAK.Persona.*` in `input/fsh/actors/`,
     extracted in `smart-base-generic-personas.json`);
   - `smart-base` FSH CodeSystems (`ISCO08`, `CDHIv2`, `CDHIv1`, `CDSCv2`,
     `CDSCv1`, `KGTerminologySystem` and `KG*`);
   - shared `folio-code-list/v1` lists (`smart-base/code-lists/*.json`,
     `folio-assistant-core/code-lists/*.json`) and SKOS glossaries
     (`folio-assistant-core/glossary/guideline-domain.glossary.json`).
3. **Rung 3 — External authoritative standard (`WHO-FIC` / `ILO` / `HL7` / `W3C`).**
   A standard clinical, occupational or ontological term not in Rungs 1–2 is
   resolved against the external authority in
   [`vocabulary-authority`](../../cat-harness/skills/kg/kg-core/vocabulary-authority.md)
   and §1 above (`ICD-11`, `ICHI`, `CDHI`, `ISCO-08`, `ATC`, `SNOMED CT`,
   `LOINC`), recording the mapping predicate (`skos:exactMatch` or
   `skos:closeMatch`) per [`ontologist`](../../folio-assistant-core/skills/library/cataloguing/ontologist.md).
4. **Rung 4 — Local candidate or explicit third state (citing [`glossary-terms`](../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md)).**
   When Rungs 1–3 hold no match:
   - **For a persona or domain concept:** mint a local glossary entry in
     `<instance>/glossary/<scheme>.glossary.json` following
     [`glossary-terms`](../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md)
     with `status: "candidate"`, `source: "extracted"` (citing the `doc_id` and
     `section` / quote), and emit `WARNING <slot>-glossary-candidate`. An agent
     writes only `status: "candidate"`; promotion to `status: "authored"` is a
     person's, in the terminologist/ontologist lane.
   - **For a business process:** **never invent a process.** Record
     `could-not-determine` with `WARNING process-not-determined` and the basis
     quoting the statement. That warning is the work list for the guide or
     domain process catalogue.

## 3. Provenance and review status on every coding

Every classification or coding link records two independent facts:

1. **How the coding was obtained (`source`):**
   - `declared` — a person acting in an authorised role explicitly stated the
     code or link (must carry `by`);
   - `context` — the printed section heading, table header, or structural
     container in the source document settles the classification without
     inference;
   - `inferred` — an agent or author read the statement text and matched it
     against the scheme's definitions.
2. **Where it sits in review (`status`):**
   - `candidate` — proposed by the `authoring-agent` (using
     [`terminology-lookup`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/tools/terminology-lookup/terminology-lookup.ts)
     and [`classify-and-code-content`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/classify-and-code-content.md));
   - `reviewed` / `authored` — checked and signed off by a person acting in the
     `terminologist` (or `l1-extraction-reviewer`) role in
     [`classify-and-code-content.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/processes/classify-and-code-content.bpmn).

## 4. Adjudicating L1 coverage exclusions (`l1-extraction-reviewer`)

When `l1-recommendation-candidates` scans an L1 source, every sentence carrying
a normative marker (`should`, `shall`, `must`, `recommend*`, `may be …`) must
either become an L1 node (`recommendation`, `implementation-practice`, `remark`,
or `part-of`) or be **excluded** with one of the five closed reasons
(`background-fact`, `manufacturer-statement`, `editorial`, `research-question`,
`duplicate-of:<id>`).

An agent may **propose** an exclusion in `exclusions.proposed.json`
(`"signerRole": {"role": "l1-extraction-reviewer"}`) and **never signs it**. A
person acting as `l1-extraction-reviewer`, in
[`classify-and-code-content.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/processes/classify-and-code-content.bpmn),
reads each candidate sentence in place on the printed page
(`sections/page-NNN.md`), checks that it is non-normative under the stated
reason, and either signs it (`signedOffBy`) or rejects it back to extraction
curation, so no guidance is silently dropped.

## 5. Refusals

- **Never invent a business process to make coverage look complete.** When no
  process in the target guide or a published domain catalogue realises a
  scenario, the only valid value is `could-not-determine` with a warning.
- **Never stretch a narrower code as `exactMatch`.** If a guide's persona or a
  code list entry covers only part of the concept, use `skos:closeMatch` (or
  `skos:broadMatch` / `skos:narrowMatch` per [`ontologist`](../../folio-assistant-core/skills/library/cataloguing/ontologist.md))
  or fall through to the next rung.
- **Never self-approve a candidate term or an L1 exclusion.** An agent writes
  `status: "candidate"` on glossary terms and leaves `signedOffBy` absent on
  exclusions; only a person in the reviewer lane records sign-off.

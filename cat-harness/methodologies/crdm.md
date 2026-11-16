---
$schema: folio-methodology/v1
name: crdm
title: "Collaborative Requirements Development Methodology (CRDM) — process-centric requirements engineering and harness adaptation"
origin: >
  Public Health Informatics Institute (PHII, a program of The Task Force for
  Global Health), "Collaborative Requirements Development Methodology (CRDM):
  A Collaborative Approach to Public Health Systems" (2021, updated 2023-08-29,
  https://phii.org/crdm/) and companion EHR Toolkit guide "5. Analyzing
  Technical Options: Defining and Validating System Requirements Guide"
  (2016/2021, https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf);
  applied to health information systems in PATH & PHII, "Common Requirements for
  Maternal Health Information Systems: Produced with the Collaborative
  Requirements Development Methodology" (December 2012,
  https://media.path.org/documents/MCHN_mhis_crdm.pdf); combined in the
  harness's requirement statement template with IETF BCP 14 / RFC 2119 (Bradner
  1997) and RFC 8174 (Leiba 2017) for normative conformance keywords.
evidence:
  - library/phii-2023-crdm
  - library/phii-2021-defining-and-validating-requirements-guide
  - library/path-2012-common-requirements-mhis-crdm
  - library/rfc2119-key-words-requirement-levels
  - library/rfc8174-uppercase-vs-lowercase-2119-key-words
applies-when: >
  **Eliciting, structuring, prioritising, and validating functional and
  non-functional requirements from current-state and redesigned business
  processes before implementation begins.** Use it when a capability,
  specification, or workflow spans actors and tasks that must be analysed and
  redesigned first so every requirement traces to a concrete business activity.
  Not a replacement for filing and lifecycle governance
  (`requirements-filing-and-organisation`), interchange standards mapping
  (`requirements-standards-assessment`), one-off option trade-offs
  (`kepner-tregoe`), recurring decision logic (`dmn`), or architecture decision
  records (`madr`).
---

# Collaborative Requirements Development Methodology (CRDM)

**Adapted from the Public Health Informatics Institute (PHII) and PATH.** The
harness's CRDM requirements workflow (`crdm-requirements-workflow` (opt-in `cat-harness.sdlc`))
and specification template (`crdm-requirements-template`)
**adapt** PHII's *Collaborative Requirements Development Methodology (CRDM)*
and PATH's 2012 application of CRDM to health information systems, combining
their process-centric requirements method with the platform's own agentic
facilitation, codebase impact analysis, work-plan decomposition, and pull-request
sign-off gates.

- **Canonical SKOS glossary concept:**
  `https://litlfred.github.io/cat-harness/v0/ns/glossary/platform/collaborative-requirements-development-methodology`
  ([`docs/assets/glossary/cat-harness--platform.skos.jsonld`](../docs/assets/glossary/cat-harness--platform.skos.jsonld))

| Ingested source | What it establishes | Library entry |
|---|---|---|
| **PHII (2021/2023)**, *Collaborative Requirements Development Methodology (CRDM): A Collaborative Approach to Public Health Systems* (`https://phii.org/crdm/`, 10 pp.) | The three concentration areas (Business Process Analysis, Business Process Redesign, Requirements Definition), the Business Process Matrix, and swimlane Task Flow Diagrams | [`library/phii-2023-crdm`](https://phii.org/crdm/) |
| **PHII (2016/2021)**, *5. Analyzing Technical Options: Defining and Validating System Requirements Guide* (`EHR Toolkit`, 6 pp.) | Functional vs. non-functional requirement grammar (*"The system must or should…"*), the three-level priority scale (**High / Medium / Low** = **Must-have / Should-have / Nice-to-have**), nine requirement quality criteria, and three validation techniques (*Desk checking*, *Walkthrough*, *Peer review*) | [`library/phii-2021-defining-and-validating-requirements-guide`](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf) |
| **PATH & PHII (2012)**, *Common Requirements for Maternal Health Information Systems: Produced with the Collaborative Requirements Development Methodology* (36 pp.) | Domain-scale application of CRDM: a four-column Process Framework (Table 1), swimlane Task Flow Diagrams across facility and community pools with numbered activity narratives (Appendix 1), Activity-Linked Functional User Requirements (Appendix 2), and General System Requirements (Appendix 3) | [`library/path-2012-common-requirements-mhis-crdm`](https://media.path.org/documents/MCHN_mhis_crdm.pdf) |
| **IETF BCP 14 — RFC 2119 & RFC 8174** (Bradner 1997; Leiba 2017) | Normative conformance keywords (`MUST` / `SHALL`, `MUST NOT` / `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `MAY`) in uppercase | [`library/rfc2119-key-words-requirement-levels`](https://www.rfc-editor.org/rfc/rfc2119), [`library/rfc8174-uppercase-vs-lowercase-2119-key-words`](https://www.rfc-editor.org/rfc/rfc8174) |

---

## 1. The PHII and PATH CRDM method

PHII developed CRDM as a process-centric methodology grounded in business
process management that brings multi-disciplinary subject matter experts (SMEs)
together to document how work is performed, redesign how it should be
performed, and derive what an information system must do to support that work
([`phii-2023-crdm`, pp. 1–3](https://phii.org/crdm/);
[`path-2012-common-requirements-mhis-crdm`, pp. 4–7](https://media.path.org/documents/MCHN_mhis_crdm.pdf)).

### 1.1 The three concentration areas

PHII organises CRDM around three sequential concentration areas
([`phii-2023-crdm`, pp. 2–9](https://phii.org/crdm/)):

| Concentration area | Guiding prompt | Core artefacts | What happens |
|---|---|---|---|
| **1. Business Process Analysis (BPA)** | **Think:** *How do we do our work now?* | **Business Process Matrix** (process goal, inputs, activities, outputs, actors/roles, business rules, issues/opportunities) and **Task Flow Diagrams** (swimlane diagrams showing the sequence of tasks across pools and actors) | SMEs map current-state operations end to end, making implicit workflows, hand-offs, and decision points explicit ([`phii-2023-crdm`, pp. 3–6](https://phii.org/crdm/)). |
| **2. Business Process Redesign (BPR)** | **Rethink:** *How should we do our work?* | Redesigned **Business Process Matrix** and updated **Task Flow Diagrams** | Before automating anything, participants examine the current-state model to eliminate bottlenecks, redundancies, policy barriers, and information gaps ([`phii-2023-crdm`, pp. 7–8](https://phii.org/crdm/)). |
| **3. Requirements Definition** | **Describe:** *How can an information system support our work?* | **Functional User Requirements** (anchored to numbered task-flow activities) and **Non-Functional / General System Requirements** | Every activity in the redesigned task flow is examined to state the information system capabilities needed to support it, followed by structured SME validation ([`phii-2023-crdm`, pp. 8–9](https://phii.org/crdm/); [`phii-2021-defining-and-validating-requirements-guide`, pp. 1–5](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=1)). |

### 1.2 PATH (2012): domain-scale health information system artefacts

PATH & PHII (2012) demonstrate how CRDM scales across a clinical and public
health domain ([`path-2012-common-requirements-mhis-crdm`](https://media.path.org/documents/MCHN_mhis_crdm.pdf)):

1. **Process Framework (Table 1, PDF p. 8):** Inventories all domain business
   processes across functional columns (*Patient Administration*, *Patient
   Care*, *Patient Fees and Accounting*, *Planning, Management & Surveillance*)
   and selects priority processes for deep modeling
   ([`sec-009-outputs-of-the-crdm-process.md`](https://media.path.org/documents/MCHN_mhis_crdm.pdf)).
2. **Task Flow Diagrams with Activity Narratives (Appendix 1, PDF pp. 11–20):**
   Draws each priority process using a ten-element notation (*Pools*, *Swim
   Lanes*, *Start Event*, *End Event*, *Sequence Flow*, *Activity*,
   *Subprocess*, *Decision*, *Multi-Page Connector*, *Annotation*) paired with
   numbered activity details and narratives
   ([`sec-013-appendix-1-business-process-flows.md`](https://media.path.org/documents/MCHN_mhis_crdm.pdf)).
3. **Activity-Linked Functional User Requirements vs. General System Requirements
   (Appendices 2–3, PDF pp. 21–36):** Groups functional requirements by process
   and numbered activity ID, and separates cross-cutting system requirements
   (security, audit logging, reporting, interoperability, offline operation)
   into a dedicated general system requirements catalogue
   ([`sec-014-appendix-2-requirements.md`](https://media.path.org/documents/MCHN_mhis_crdm.pdf),
   which also holds the general and nonfunctional requirements).

### 1.3 Quality criteria and validation techniques

PHII's *Defining and Validating System Requirements Guide*
([`phii-2021-defining-and-validating-requirements-guide`, pp. 3–5](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=3))
checks every requirement against nine quality criteria — **Correct**,
**Unambiguous**, **Complete**, **Consistent**, **Ranked for importance and/or
stability**, **Verifiable**, **Modifiable**, **Traceable**, and
**Comprehensible** — using three validation methods:

1. **Desk checking:** Individual review of the specification against the
   business process models and quality criteria.
2. **Walkthrough:** Facilitated step-by-step group traversal of task flows and
   requirements with the SMEs who perform the work.
3. **Peer review:** Independent structured inspection by peers to catch
   ambiguities, omissions, and conflicts before sign-off.

---

## 2. How the harness adapts PHII and PATH CRDM

The relation between `crdm-requirements-workflow`
and PHII/PATH CRDM is **adapts**: Phases 1–3 and the SME validation walkthrough
follow PHII/PATH CRDM directly, while the facilitation channel, Phase 4/4b
codebase impact and dependency analysis, Phase 5 work-item and filing
decomposition, and Phase 6 pull-request sign-off are the platform's own
extensions.

| Workflow phase / mechanism | Relation to PHII & PATH CRDM | What follows PHII/PATH CRDM vs. what is the platform's own |
|---|---|---|
| **Facilitated elicitation channel** (`crdm-requirements-workflow` § Core Principle) | **Platform adaptation of CRDM workshop facilitation** | PHII/PATH run multi-stakeholder SME workshops facilitated by a human business analyst. The harness adapts this into an LLM agent acting in the Business Analyst role (`Role_BusinessAnalyst`) conversing with the human SME (`Role_SME`) over an issue/PR thread before any code is modified. |
| **Phase 1: Needs Assessment & Problem Framing** | **Follows PHII CRDM** (*Business Process Analysis — context & scope*) | Establishes the business problem, actors/personas (`Role_*`), scope boundaries (in-scope vs. out-of-scope), and information inputs/outputs, matching PHII's Business Process Matrix header and PATH's process framework scoping. |
| **Phase 2: Business Process Analysis & Redesign** | **Follows PHII & PATH CRDM** (*Concentration Areas 1 & 2: BPA + BPR*) | Models current-state ("as-is") and redesigned ("to-be") workflows using swimlane task-flow diagrams (BPMN 2.0 / Mermaid) across pools and actor lanes, paired with a gap analysis table (bottlenecks, redundancies, missing rules). |
| **Phase 3: Requirements Definition (Functional, Non-Functional & Data Model)** | **Follows PHII & PATH CRDM** (*Concentration Area 3*) **+ BCP 14 keywords** | Derives atomic Functional Requirements (`FR-001`, …) linked to redesigned process steps, Non-Functional / General System Requirements (`NFR-001`, …), business rules/decision tables, and domain data entities with cardinalities and validation criteria. |
| **Phase 4: Impact Analysis & Effort Estimation** | **Platform's own extension** | Inspects the repository's existing schemas, skills, BPMN/DMN models, UI components, pipelines, tests, and downstream consumers across 7 impact dimensions to identify breaking changes and t-shirt effort estimates. PHII/PATH CRDM is technology- and codebase-agnostic and has no code impact phase. |
| **Phase 4b: Capability Area Grouping, Dependency Ordering & Formalize-First Rule** | **Platform's own extension** | Groups requirements into capability areas (`CA-1`, `CA-2`, …), orders them by a dependency DAG, and enforces the platform's *formalize-first* rule (formalizing existing implicit behavior before adding net-new capabilities). |
| **Phase 5: Work Breakdown, Work Items & Specification Filing** | **Platform's own extension** (+ PHII *Walkthrough* / *Peer review*) | Writes the specification to `docs/proposals/<slug>.md` (and upon filing to `docs/requirements/<slug>.md` per [`requirements-filing-and-organisation`](requirements-filing-and-organisation.md)), decomposes work into agent work items (`beans/`) and human todos (`todos/`), and conducts the SME walkthrough on the proposal PR. |
| **Phase 6: Implementation & Merge Sign-Off** | **Platform's own extension** | Implements approved requirements on a feature branch, publishes a `branches/<branch-slug>/` preview, verifies every acceptance criterion against automated gates, and requires explicit human owner sign-off before merging. |

---

## 3. Priority scale and normative conformance keywords

In CRDM and in the harness's requirement template
(`crdm-requirements-template`),
**implementation priority** and **normative conformance level** are two
distinct fields with different semantics and different standards origins:

### 3.1 Priority weighting (`High / Medium / Low` = `Must-have / Should-have / Nice-to-have`)

PHII's *Defining and Validating System Requirements Guide*
([`phii-2021-defining-and-validating-requirements-guide`, p. 2](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=2))
and PATH (2012) ([`path-2012-common-requirements-mhis-crdm`, p. 1 / Appendix 2](https://media.path.org/documents/MCHN_mhis_crdm.pdf))
rank requirements by relative implementation importance using a three-tier
priority scale. The harness aligns its three priority labels one-to-one with
PHII's scale:

| PHII / PATH priority rank | Harness template label | Meaning when sequencing or trading off scope |
|---|---|---|
| **High** | **Must-have** (`High / Must-have`) | Essential to the core business process; the system cannot satisfy the process goal without this capability. |
| **Medium** | **Should-have** (`Medium / Should-have`) | Important for operational efficiency or completeness; expected in standard operation, though a temporary workaround may exist. |
| **Low** | **Nice-to-have** (`Low / Nice-to-have`) | Desirable enhancement that improves convenience or secondary workflows when resources permit. |

### 3.2 Normative conformance keywords (`SHALL / SHOULD / MAY / SHALL NOT`)

While PHII's informal prose grammar phrases requirement statements as *"The
system must or should…"* ([`phii-2021-defining-and-validating-requirements-guide`, p. 1](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=1)),
the harness's separate **Conformance** field (`SHALL` / `MUST`, `SHOULD`,
`MAY`, `SHALL NOT` / `MUST NOT`) uses uppercase normative keywords governed by
IETF BCP 14:

- **RFC 2119** (Bradner 1997, [`library/rfc2119-key-words-requirement-levels`](https://www.rfc-editor.org/rfc/rfc2119)):
  Defines `MUST` / `SHALL` (absolute requirement of the specification), `MUST
  NOT` / `SHALL NOT` (absolute prohibition), `SHOULD` (recommended; valid
  reasons may exist in particular circumstances to ignore, but full
  implications must be understood and weighed), `SHOULD NOT` (not recommended),
  and `MAY` (truly optional).
- **RFC 8174** (Leiba 2017, [`library/rfc8174-uppercase-vs-lowercase-2119-key-words`](https://www.rfc-editor.org/rfc/rfc8174)):
  Clarifies that **only UPPERCASE** words carry the RFC 2119 normative
  meanings; lowercase *"must"*, *"should"*, and *"may"* in surrounding prose
  carry only their normal English meaning.

Keeping **Priority** (`High / Must-have`, `Medium / Should-have`, `Low /
Nice-to-have`) separate from **Conformance** (`SHALL`, `SHOULD`, `MAY`, `SHALL
NOT`) avoids conflating *when a capability is scheduled for delivery* (priority)
with *how strictly an implementation must behave once it claims conformance to
that requirement* (BCP 14 modality).

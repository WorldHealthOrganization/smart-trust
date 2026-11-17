---
name: specification-management
description: >-
  Governs the lifecycle, syntax, and traceability of specifications and requirements
  across the harness. Connects spec-kit and CRDM tracks to the 6-part bootstrap
  Requirement definition, enforces EARS and ISO 29148 statement quality, and defines
  how requirements project to open standards (ReqIF, OSLC-RM) while keeping bootstrap
  strictly decoupled.
user_invocable: false
---

# Specification and requirements management

> Skill id: `specification-management` · Package: `sdlc-core`

This skill defines the governance, architectural boundaries, and standards
alignment for authoring, tracing, and verifying specifications and requirements
across the harness.

---

## 1. The two authoring tracks and the single requirement definition

Requirements enter the harness via two distinct, non-blended tracks
(distinguished in `methodology-adoption` and `spec-kit`):

1. **Platform / Tooling Track (`spec-kit`)**: For capabilities raised by tool
   developers where requirements are content-agnostic (`specify → plan → tasks
   → implement → converge`). Requirements are drafted as `FR-###` with `SC-###`
   in issue comments.
2. **Domain / Guideline Track (`crdm`)**: For requirements tied to WHO/IG domain
   content and subject matter requiring formal stakeholder sign-offs (`needs →
   detect → requirements → impact → signoff → close`). Authored in
   `docs/requirements/<slug>.md`.

**They share one underlying definition of a requirement** (detailed in
`requirement-definition.md`):

| Part | Field in `bootstrap/schemas/requirement.schema.json` | Obligation |
|---|---|---|
| **ID** | `id` (`req:<slug>#<key>`) | Unique, stable, addressable URI |
| **Title / Label** | `title` (doc), `label` (statement) | Concise human-readable name |
| **Statement** | `requirement` | Exactly one sentence checkable as yes/no |
| **Conformance** | `conformance` | RFC 2119 verb (`SHALL`, `SHOULD`, `MAY`, `SHALL NOT`) |
| **Rationale** | `benefit`, `description` | Clear justification and expected value |
| **Parent** | `derivedFrom` | Upstream requirement lattice link |
| **Success Criteria** | `successCriteria[].criterion` | Observable, measurable verification conditions (≥ 1) |
| **Verification Method** | `successCriteria[].verification` | One of `test`, `inspection`, `review`, `analysis` |

---

## 2. Standards alignment and statement quality

While the bootstrap schema is deliberately lightweight and zero-dependency,
requirements authored in the harness must adhere to proven international
notations and quality models evaluated in
[`requirements-standards-assessment`](../../../methodologies/requirements-standards-assessment.md):

### A. EARS syntax for statement formulation
Requirement statements should follow the **Easy Approach to Requirements
Syntax (EARS)** patterns (Mavin et al., IEEE RE 2009):
- **Ubiquitous**: *"The `<system>` shall `<response>`."*
- **Event-driven**: *"When `<trigger>`, the `<system>` shall `<response>`."*
- **State-driven**: *"While `<state>`, the `<system>` shall `<response>`."*
- **Unwanted behavior**: *"If `<error/trigger>`, then the `<system>` shall `<response>`."*
- **Optional feature**: *"Where `<feature present>`, the `<system>` shall `<response>`."*

### B. ISO/IEC/IEEE 29148:2018 verification quartet
Verification methods declared on success criteria map directly to ISO 29148 Clause 6.4:
- `test`: Automated execution against test suites (Bun test, Playwright).
- `inspection`: Visual verification of files, schemas, or front-matter declarations.
- `review`: Adjudicated human or agent qualitative sign-off.
- `analysis`: Deductive proof, simulation, or deterministic measurement.

### C. ISO/IEC 25010:2023 for non-functional requirements (NFRs)
For statements where `kind: "non-functional"`, the `category` field must be
classified against the ISO 25010 product quality taxonomy (`security`,
`performance-efficiency`, `compatibility`, `interaction-capability`, `reliability`,
`maintainability`, `portability`, `safety`).

---

## 3. Boundary rule: no outside concepts in bootstrap

Per the architectural assessment in `requirements-standards-assessment`:
- **Bootstrap remains pure**: No ReqIF XML types, OSLC RDF vocabularies, or
  heavy third-party dependencies may be added to `bootstrap/`.
- **Projection lives above**: Higher layers (`cat-harness`, or a content
  layer above it) provide conversion tools (e.g. exporting `RequirementSet` to OMG ReqIF 1.2 XML
  for DOORS/Polarion, or projecting to OSLC-RM JSON-LD).
- **Markdown front matter is the canonical authoring form**: Markdown front
  matter + JSON schemas in Git provide fast parsing, clean PR diffs, and zero
  vendor lock-in.

---

## 4. RequirementSets, work plans, and sign-offs

A requirements document is governed as a **`RequirementSet`** (`reqset:<slug>`):
- **Stages**: `draft → proposed → approved → planned → in-progress → delivered → accepted`.
- **Work Plan**: Requirements connect to execution via `beans/`. A work item delivering
  a requirement copies its `## Done when` checkboxes from the requirement's
  success criteria.
- **Sign-offs**: Recorded via `adjudication` as `requirement-signoff` attestations
  referencing the governing GitHub issue comment. `check:requirements` refuses
  `approved` or `accepted` without a recorded human sign-off.

---

## 5. Related skills & methodologies

- [`requirements-standards-assessment`](../../../methodologies/requirements-standards-assessment.md) —
  Formal evaluation of open requirements standards (ReqIF, OSLC-RM, EARS, ISO 29148, ISO 25010).
- [`crdm-requirements-template`](../../../skills/process/crdm/crdm-requirements-template.md) — CRDM Phase 3
  template and elicitation guide.
- [`spec-kit`](../spec-kit/spec-kit.md) — Platform feature spec-driven development.
- [`adjudication`](../../../skills/process/process-core/adjudication.md) — Settle review disagreements and record human sign-offs.
- `todo-manager` (opt-in `cat-harness.work-plan`) — Work item work-plan management and claim discipline.

---
name: crdm-requirements-template
description: >
  Guide and template for CRDM Phase 3 — Requirements Definition.
  Helps the agent structure requirements from conversation using a
  REQ-### format with acceptance criteria, priority, and traceability.
uses-methodology:
  - crdm
---

# Phase 3 — Requirements definition (detail)

This skill expands the Phase 3 summary in [`crdm-requirements-workflow.md`](crdm-requirements-workflow.md) and applies the [`crdm` methodology](../../../methodologies/crdm.md).

## Requirement format

**One definition, shared with spec-kit**: a statement, a
conformance level, a source, **at least one success criterion with its
verification method**, and a sign-off owner —
the `requirement-definition` skill (`skill_fetch requirement-definition`)
in the content layer. The fields below are CRDM's rendering of it;
*Acceptance criteria* are the success criteria. A requirement with none is not
ready to post.

Each requirement has:

| Field | Format | Example |
|---|---|---|
| **ID** | `REQ-###` | `REQ-001` |
| **Title** | Short phrase | "Beans filtered by epic type" |
| **Description** | Plain language, no jargon | "The agent can filter work items by their type (epic, story, task)" |
| **Conformance** | `SHALL` / `SHOULD` / `MAY` / `SHALL NOT` (RFC 2119 / RFC 8174) | `SHALL` |
| **Acceptance criteria** (= success criteria, ≥ 1) | Testable, measurable, each with a key and a verification method (`test` / `inspection` / `review` / `analysis`) | "`SC-1` (test) — Given an epic with 3 child stories, when filtered by epic, then all 3 appear" |
| **Sign-off owner** | Who says it is met — a named person or role | "The BA" |
| **Priority** | `Must-have` (`High`) / `Should-have` (`Medium`) / `Nice-to-have` (`Low`) | `Must-have` (`High`) |
| **Source** | Phase 1 needs statement / Phase 2 process activity ref | "Needs statement §2 — BA cannot see work grouped by release" |
| **Impact** | Phase 4 footprint | "Schema: new `type` field on bean. Pipeline: none" |
| **Estimated scope** | Work item count / PR sizing | "2 beans, 1 PR" |

### Priority scale and conformance keywords

CRDM separates **implementation priority** (how essential a requirement is when sequencing work or trading off scope) from **normative conformance** (how strictly an implementation must behave once it claims conformance to that requirement):

#### 1. Priority scale (`High / Medium / Low` = `Must-have / Should-have / Nice-to-have`)

Aligned with PHII's *Defining and Validating System Requirements Guide* ([`library/phii-2021-defining-and-validating-requirements-guide`, p. 2](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=2)) and PATH & PHII (2012) ([`library/path-2012-common-requirements-mhis-crdm`, p. 1](https://media.path.org/documents/MCHN_mhis_crdm.pdf)):

| Priority label | PHII / PATH CRDM scale | Meaning |
|---|---|---|
| **Must-have** (`Must`) | **High** | Essential to the core business process; the system cannot satisfy the process goal without this capability. |
| **Should-have** (`Should`) | **Medium** | Important for operational efficiency or completeness; expected in standard operation, though a temporary workaround may exist. |
| **Nice-to-have** (`Nice-to-have`) | **Low** | Desirable enhancement that improves convenience or secondary workflows when resources permit. |

#### 2. Normative conformance keywords (`SHALL / SHOULD / MAY / SHALL NOT`)

While PHII's informal prose grammar phrases requirement statements as *"The system must or should…"* ([`phii-2021-defining-and-validating-requirements-guide`, p. 1](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf#page=1)), the separate **Conformance** field uses uppercase normative keywords governed by IETF BCP 14 — [`library/rfc2119-key-words-requirement-levels`](https://www.rfc-editor.org/rfc/rfc2119) (RFC 2119) and [`library/rfc8174-uppercase-vs-lowercase-2119-key-words`](https://www.rfc-editor.org/rfc/rfc8174) (RFC 8174, specifying that **only UPPERCASE** words carry RFC 2119 normative meaning):

- `SHALL` (`MUST`) — mandatory requirement of the specification
- `SHOULD` (`RECOMMENDED`) — recommended; valid reasons may exist in particular circumstances to ignore, but full implications must be understood and weighed
- `MAY` (`OPTIONAL`) — truly optional capability
- `SHALL NOT` (`MUST NOT`) — absolute prohibition

## Generating from conversation

### 4-step elicitation

1. **Listen and deconstruct** — identify the nouns (entities), verbs
   (capabilities), and adjectives (qualities) in the BA's description
2. **Disentangle what from how** — "I need to see beans grouped by release"
   is a requirement; "use a Jekyll page" is an implementation choice
3. **Formulate testable criteria** — every requirement must have a
   Given/When/Then or a checkable statement
4. **Validate with the BA** — read it back. "Does this capture what you
   need? Anything missing?"

## The document is a requirement set

The requirements document as a whole is a **`RequirementSet`**
(`bootstrap-tools/schemas/requirement-set.ts`, published as
`bootstrap/schemas/requirement-set.schema.json`): `reqset:<slug>`, the
methodology, the issue, a **stage** — `draft → proposed → approved → planned →
in-progress → delivered → accepted`, or `rejected`, `cancelled`, `superseded` —
its members (`req:` references, each with its own decision), its work plan
(work item ids) and its sign-offs. Commit it beside the proposal as
`<slug>.requirement-set.json`, or as a `requirementSet:` key in the proposal's
front matter; `check:requirements` judges it.

The set's stage and each member's `status` are **independent** — a requirement
outlives the document that proposed it — with one link enforced: a set is
`accepted` only when every member it approved is `in-force`. The stage moves
only through a sign-off (Phase 5's `BA_Signoff`, close-out's `BA_Confirm`),
and `check:requirements` refuses `approved`/`accepted` without a human
sign-off, `planned` without work items, and `cancelled` without a reason.

## Grouping requirements

### By workflow area

| Area | Examples |
|---|---|
| Ingestion | Document upload, structure extraction |
| Authoring | Block editing, chapter management |
| Validation | Schema checks, QA criteria |
| Rendering | PDF, HTML, Markdown output |
| Review | Staging, before/after comparison |
| Translation | PO extraction, machine + human translation |
| Release | Versioning, changelog, release gating |

### By architectural layer

| Layer | Examples |
|---|---|
| Schemas | Type definitions, constraints, builders |
| Pipeline | Validators, renderers, extractors |
| Adapters/Tools | Block-kind routing, MCP tools |
| Skills | Agent guidance, workflow definitions |

## Posting to the issue

Format as a markdown checklist:

```markdown
## Requirements — [Feature name]

### Must-have

- [ ] **REQ-001** (SHALL) — Beans filtered by epic type
  - _Source:_ needs statement §2
  - _Acceptance:_ `SC-1` (test) — Given an epic, when `beans list --type epic`, then only epics appear
  - _Sign-off owner:_ the BA
  - _Scope:_ 1 bean, 1 PR

- [ ] **REQ-002** (SHALL) — Release lifecycle skill
  - _Source:_ needs statement §3
  - _Acceptance:_ `SC-1` (inspection) — Skill exists at `cat-harness/sdlc/skills/sdlc-core/release-lifecycle.md`
  - _Sign-off owner:_ the BA
  - _Scope:_ 1 bean, 1 PR

### Should-have

- [ ] **REQ-003** — ...

### Deliverables summary

| ID | Title | Priority | Beans | Status |
|---|---|---|---|---|
| REQ-001 | Beans filtered by epic type | Must | 1 | ⬜ |
| REQ-002 | Release lifecycle skill | Must | 1 | ⬜ |
```

### UI / wireframe

Every requirement set carries this section, filled or marked not applicable.
When a requirement changes a rendered surface (a page, a visualiser, the
navbar, a form, an app screen), the wireframe is designed and chosen **before**
implementation, by [`wireframe-design-review`](../../ui/ui-core/wireframe-design-review.md)
in Design use; its output (`schemas/skills/wireframe-design-review/output.schema.json`)
supplies every row:

```markdown
### UI / wireframe

- _Surface:_ the review page's heat map (REQ-004, REQ-005)
- _Candidates:_ `docs/proposals/<slug>/wireframes/` — assets of this proposal
  - `a.html` — [staging](…) · web ![](…/checks/a-web.png) · mobile ![](…/checks/a-mobile.png)
  - `b.html` — [staging](…) · web ![](…/checks/b-web.png) · mobile ![](…/checks/b-mobile.png)
- _Chosen:_ `b` by @requester ([where they chose](…): the conversation, the issue or the PR), because …; `a` rejected because …
```

Or, when no requirement changes a rendered surface:

```markdown
### UI / wireframe

N/A — no rendered surface.
```

## Traceability

Every requirement traces in both directions:

```
Needs statement (Phase 1)
    ↓ "Source" field
Requirement (Phase 3)
    ↓ "Impact" field
Impact assessment (Phase 4)
    ↓ bean reference
Bean (Phase 5) — names its REQ / req: statements; `## Done when` copied from their acceptance criteria
    ↓ PR link
PR (Phase 6)
```

## Cross-references

- [`../../../methodologies/crdm.md`](../../../methodologies/crdm.md) — CRDM methodology node (PHII & PATH origin, adaptation table, priority vs. conformance alignment)
- [`../../../library/corpus/process/phii-2023-crdm/README.md`](https://phii.org/crdm/) — PHII (2021/2023) CRDM web page
- [`../../../library/corpus/process/phii-2021-defining-and-validating-requirements-guide/README.md`](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf) — PHII (2016/2021) Defining and Validating System Requirements Guide
- [`../../../library/corpus/process/path-2012-common-requirements-mhis-crdm/README.md`](https://media.path.org/documents/MCHN_mhis_crdm.pdf) — PATH & PHII (2012) Common Requirements for Maternal Health Information Systems
- [`../../../library/corpus/content/rfc2119-key-words-requirement-levels/README.md`](https://www.rfc-editor.org/rfc/rfc2119) — RFC 2119 requirement level keywords
- [`../../../library/corpus/content/rfc8174-uppercase-vs-lowercase-2119-key-words/README.md`](https://www.rfc-editor.org/rfc/rfc8174) — RFC 8174 uppercase requirement keyword ambiguity clarification
- [`crdm-requirements-workflow`](crdm-requirements-workflow.md) — Phase 3
- [`crdm-impact-analysis`](crdm-impact-analysis.md) — Phase 4 follows this
- [`crdm-detect`](crdm-detect.md) — detection
- `../../work-plan/skills/work-plan/todo-manager.md` (opt-in `cat-harness.work-plan`) — work item creation
- `../../sdlc/skills/sdlc-core/specification-management.md` (opt-in `cat-harness.sdlc`) — governance and EARS/ISO statement quality
- [`../../../methodologies/requirements-standards-assessment.md`](../../../methodologies/requirements-standards-assessment.md) — open standards (ReqIF, OSLC-RM, EARS, ISO 29148) assessment

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md).

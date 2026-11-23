---
name: spec-kit
description: >
  Spec-driven development, adopted whole: define what and why before deciding how,
  and do not develop before a spec exists. Carries what this platform adopts and —
  separately, with reasons — what it refuses.
allowed-tools: Read Grep Glob Bash
consulted: true
---

# Spec Kit — spec-driven development

## Origin

github/spec-kit (GitHub, 2025), <https://github.com/github/spec-kit>. Its
`/speckit-*` command set, its specify → plan → tasks → implement → converge
cycle, and its `templates/spec-template.md`. Rendered here from the upstream
README and spec template, read 2026-09-21.

## Applies when

A change to the PLATFORM's own capability — a tool, a schema, a pipeline, a
skill, a gate — raised by somebody building the tooling rather than by somebody
writing a folio's subject matter, and whose answer does not depend on what any
folio says: content-agnostic feature development, run as a scrum-like process.
NOT for work whose requirements come from stakeholders who must
sign them off, and not for anything tied to a folio's domain — that is `crdm`.


**Adopted whole.** Spec-kit sits **beside** `crdm` as a parallel track, not
blended with it. External
method, rendered faithfully. Where this text and the published method differ, the
published method is right and this file is wrong.

Its one-line claim, upstream's words:

> Define **what and why** before deciding **how** to build it.

## The cycle

`constitution` once per project, then per feature:

**specify → plan → tasks → implement → converge**, repeating **implement →
converge** until converge reports *Converged*.

Upstream installs these as skills:

| command | what it does |
|---|---|
| `/speckit-constitution` | establishes project principles |
| `/speckit-specify` | creates the specification from the request |
| `/speckit-plan` | develops the technical implementation strategy |
| `/speckit-tasks` | generates actionable work items |
| `/speckit-implement` | guides the building |
| `/speckit-converge` | validates completion against the artefacts |

Two extensions ship alongside: bug-fixing (`bug-assess` → `bug-fix` →
`bug-test`, artefacts under `.specify/bugs/{slug}/`) and idea assessment
(`assess-intake` → `assess-research` → `assess-define` → `assess-shape` →
`assess-decide`, producing go / needs-clarification / kill, under
`.specify/assessments/{slug}/`).

## The spec template

Upstream's `templates/spec-template.md`, in order. **Mandatory** where upstream
marks it so:

| section | asks for |
|---|---|
| header | feature name, branch, creation date, status |
| **User Scenarios & Testing** *(mandatory)* | prioritised independent journeys (P1, P2, …), each delivering standalone value, each with its rationale, an independent test approach, and Given-When-Then acceptance scenarios |
| Edge Cases | boundary conditions and error scenarios |
| **Requirements** *(mandatory)* | functional requirements `FR-001…`, plus key entities where data modelling applies |
| **Success Criteria** *(mandatory)* | measurable, **technology-agnostic** outcomes `SC-001…` |
| Assumptions | the defaults taken where the request was silent |

**The declared template artefact.** The canonical template is declared in the
knowledge graph at `cat-harness/sdlc/skills/spec-kit/spec-template.md`, carrying
`$schema: folio-spec-template/v1` with machine-readable `mandatory_sections` and
`metadata_fields` front matter. Automated validation (`bun run cat check:spec`) fails any
spec missing a mandatory section and names the section.

**Markers.** `[NEEDS CLARIFICATION: …]` flags an ambiguity that must be resolved
rather than guessed. `ACTION REQUIRED` marks a section that must be substantively
completed before approval. An unresolved clarification marker **blocks** a spec
from reaching Adjudicated status.

## Spec discovery & deduplication

Before drafting a new specification, the agent **MUST** scan the governing issue
and any parent or related issues for an existing spec. If a spec already exists,
the agent works from that spec rather than creating a duplicate.

## Spec lifecycle & graduation — the durable trace

A spec is a proposal: it lives in `docs/proposals/<slug>.md` and is discussed
on its governing issue; accepted requirements graduate into `req:*` statements
and automated tests.

1. **Drafting & Discussion**: A spec is committed as `docs/proposals/<slug>.md`
   and discussed on its governing GitHub issue, per `where-a-proposal-goes`.
2. **Adjudication**: When all `[NEEDS CLARIFICATION]` markers are settled by
   human decision (never by agent judgement), the status moves from `Draft` to
   `Adjudicated`.
3. **Filing at adjudication**: when the spec reaches `Adjudicated`, its accepted `FR-NNN` are filed as a
   `req:*` file under `cat-harness/skills/requirements/` with
   `status: proposed` and `proposedIn` naming the governing issue. Each
   `SC-NNN` becomes a success criterion of the statement it shows, with the
   `SC-NNN` as its key. A test plan can then cite
   `req:<slug>#<statement>/SC-NNN` before the feature ships. There is one id
   space: no `spec:` reference into an issue comment is minted, because an
   issue can move or be renumbered and the reference would outlive it.
4. **Graduation**: Upon feature completion, the requirement's `status` flips
   from `proposed` to `in-force`. Nothing is renamed, so every test that
   cited it still resolves.

## The change-size rule

Detailed in [`change-size.md`](change-size.md):
- **Limit**: 400 effective lines (`(code_lines * 1.0) + (prose_lines * 0.25)`).
- **Basis**: Cohen et al. (2006) Cisco review study and Google Modern Code Review (2018).
- **Exemptions**: Lockfiles, generated artifacts, uniform mechanical refactors with justification.
- **Mode**: Report-only advisory limit initially; transitions to blocking CI gate after calibration.
- **Reporting**: Reported as a count with its denominator.

## What this platform adds, and why it is an addition rather than a reading

**Upstream does not itself state a hard "no code without a spec" rule**, and it
does not claim its specs are executable. The gate is *ours*. It is stated here so
that nobody later cites spec-kit as the authority for a rule spec-kit does not
carry:

> No implementation work on a feature begins before a spec for it exists in the
> declared template and is posted to its governing issue.

### The spec-before-code gate

The spec-before-code gate requires that feature work be backed by an accepted
specification before implementation code is written.

- **Where an agent reads it**: here, in the governing skill (`spec-kit`), and
  in opening briefs.
- **Mechanically detectable**: Detectable automatically via `check-spec.ts`:
  ```sh
  bun run cat-harness-tools/scripts/check-spec.ts --spec-before-code --issue <number>
  bun run cat-harness-tools/scripts/check-spec.ts --spec-before-code --bean <path>
  ```
- **Three-state reporting**:
  - `exit 0` (`pass`): The referenced issue carries a valid spec comment adhering
    to `spec-template.md` (all mandatory sections present: *User Scenarios & Testing*,
    *Requirements*, *Success Criteria*).
  - `exit 1` (`finding`): A spec comment is missing, missing mandatory sections,
    carries unresolved `[NEEDS CLARIFICATION]` markers when adjudicated, or a
    feature work item lacks an issue reference. **Breach is a finding, NOT silence.**
  - `exit 2` (`could not determine`): The issue cannot be fetched or reached (e.g.
    network error or GitHub API outage).

## Sub-issue splitting: Parent carries spec, children deliver increments

When a proposed feature change is oversized (>400 effective lines) or naturally
spans multiple increments:

1. **Splitting uses GitHub sub-issues**: The parent issue serves as the single
   source of truth and **carries the overarching specification** (user journeys
   P1..Pn, requirements FR-001.., success criteria SC-001..).
2. **Sub-issues link to parent**: Child sub-issues do not duplicate or fork the
   spec; they implement specific requirements defined on the parent.
3. **One PR per child sub-issue**: Each child sub-issue delivers **one standalone,
   adjudicable, reviewable, revertible increment with its own PR**:
   - *Standalone*: Delivers a coherent, self-contained capability slice.
   - *Adjudicable*: Change size stays within the ~400 effective lines threshold
     to keep human review thorough and prevent cognitive fatigue.
   - *Reviewable*: Includes automated tests and documentation for that increment.
   - *Revertible*: Can be merged or rolled back independently without corrupting trunk invariants.
4. **Spec-before-code gate applies before any child begins**: Implementation of child
   sub-issues cannot start until the parent issue's specification has been accepted
   and posted. Feature work items and child PRs must reference the parent or sub-issue
   hierarchy verified by `check-spec.ts --spec-before-code`.

### An increment, not a slice

The usual mistake is to split by **file** or by **size** instead of by
**reviewable unit**. Five PRs that make sense only when read together are worse
than one PR. The reviewer has to hold five diffs in their head instead of one,
and none of the five can be reverted on its own. Before opening a child, ask
two questions:

> Can a reviewer approve this child on its own, without opening its siblings?
> Can it be reverted without breaking them?

If the answer to either is no, the child is a **slice**, not an increment.
Re-cut it along a requirement (an FR or a user journey), not along a directory.

### Every PR names its increment

A reviewer must be able to say, for any PR, which increment of which spec it
discharges **without opening the branch**. This is a requirement on the PR body,
and the agent that opens the PR is bound by it. The body names:
- the parent issue that carries the spec;
- the child issue that is the increment;
- the FRs or SCs it discharges.

For example: *"Increment 4/5 of #N's spec. Discharges FR-009, SC-005, SC-008
(#M)."* The rest of the body follows the
`pr-description` skill (`skill_fetch pr-description`).

### Split so an open question blocks only its own increment

Size is not the only reason to split. An increment carrying an open
`[NEEDS CLARIFICATION]` would hold up all the work if unsplit; split, the other
increments can be reviewed and merged while it waits for its ruling.

## A request for a plan reaches the gate

**A request for a plan is a detection signal here as in `crdm`** — "plan",
"approach", "proposal", "how would you", "come up with". It ALWAYS gets a
requirements document and a work plan for review before implementation. Under
spec-kit the requirements document IS the spec,
posted as a comment on the governing issue, and the work plan is the work items
`tasks` produces. The operation — what to produce, permalinks for every link
handed over, and **stop until sign-off is recorded on the issue** — is
the content layer's
`plan-request-gate` skill (`skill_fetch plan-request-gate`),
shared with `crdm` without blending the two methods.

**Every FR names at least one SC, and every SC states its verification
method** (`test`, `inspection`, `review`, `analysis`). That is the one
definition of a requirement both methodologies use —
the `requirement-definition` skill (`skill_fetch requirement-definition`)
— and, like the gate, it is this platform's addition rather than upstream's.

## What this platform refuses, with reasons

`methodology-adoption` requires both halves stated — a silent omission
misrepresents the standard.

- **The on-disk layout.** Upstream keeps a spec at `specs/NNN-feature/spec.md`
  and its own state under `.specify/`. **Not adopted.** A spec instance here is a
  proposal, `docs/proposals/<slug>.md`, per `where-a-proposal-goes`: proposals
  have one home, so a spec is found where every other proposal is. The
  **template** is a skill; an **instance** is a proposal.
  `.specify/` is refused on a second ground as well: this repository's
  dot-prefix guard rejects a dot-prefixed segment.
- **The `/speckit-*` command surface, as a surface.** The *method* is adopted;
  the concrete command names are upstream's packaging for tools that install
  slash commands. Adopting names this repository does not serve would be
  adoption by citation — the refusal `methodology-adoption` names second.
- **`constitution`, for now.** This repository already has a constitution in
  everything but the name: the skills `AGENTS.md` points to, and the
  `req:*` conformance lattice. A second statement of principles would be a
  second answer to "what binds here", free to disagree with the first. Revisit
  only if the two are ever reconciled into one.

## Against `crdm` — parallel, never blended

Both answer *request → agreed requirements*. `methodology-adoption` is explicit
that parallel means parallel: pick one per decision, name it, follow it. The
discriminator is in each one's `applies-when` above and in `crdm-detect`'s, and
the ladder question that reaches them is in `methodology-adoption`.

The short form: **who is asking, and does the answer depend
on what a folio says?** Tool developer, content-agnostic → here. Stakeholders who
must sign it off, tied to WHO/IG subject matter → `crdm`.

## Refusals

- **Never blend this with `crdm`.** A composite inherits neither one's authority
  while claiming both.
- **Never resolve a `[NEEDS CLARIFICATION]` by agent judgement.**
  `req:agent-workflow` → `judgement-stays-human` (SHALL) applies unchanged: an
  agent does not record a human's decision on their behalf. A marker silently
  closed is worse than one never raised, because it looks answered.
- **Adjudicated status IS a sign-off, and it is recorded.** A spec reaches it
  through the same adjudication the CRDM sign-off steps call — answers
  `approve amend reject defer cancel` (code list `adjudication-requirement-set`)
  — and the answer is written as a `requirement-signoff` attestation for the
  spec's requirement set, never only stated in a comment. The comment is the `evidence` the record links to.
- **Never let a spec reach adjudicated status with a marker open.** Otherwise
  the marker becomes a way of appearing to ask without having asked.
- **Never cite spec-kit for the spec-before-code gate.** It is this platform's
  addition, stated above.

## Related

- [`specification-management`](../sdlc-core/specification-management.md) —
  specification and requirements governance across spec-kit and CRDM
- [`requirements-standards-assessment`](../../../methodologies/requirements-standards-assessment.md) —
  assessment of open requirements standards (EARS, ISO 29148, ReqIF)


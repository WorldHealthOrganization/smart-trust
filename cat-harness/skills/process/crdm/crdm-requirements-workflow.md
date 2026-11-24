---
name: crdm-requirements-workflow
graph-typologies:
  - proposals
  - requirements
uses-methodology:
  - crdm
---

# CRDM requirements workflow

Once a feature request is detected (see `crdm-detect.md`), the agent follows
this workflow to gather, validate, and implement requirements collaboratively.

## Method origin and how this workflow adapts it

This workflow **adapts** the **Collaborative Requirements Development
Methodology (CRDM)** developed by the **Public Health Informatics Institute
(PHII)** and applied to health information systems by **PATH & PHII (2012)** —
see the [`crdm` methodology node](../../../methodologies/crdm.md) and the
canonical SKOS glossary concept
[`https://litlfred.github.io/cat-harness/v0/ns/glossary/platform/collaborative-requirements-development-methodology`](../../../docs/assets/glossary/cat-harness--platform.skos.jsonld):

- **PHII (2021/2023)**, *Collaborative Requirements Development Methodology
  (CRDM): A Collaborative Approach to Public Health Systems*
  ([`library/phii-2023-crdm`](https://phii.org/crdm/))
- **PHII (2016/2021)**, *5. Analyzing Technical Options: Defining and
  Validating System Requirements Guide*
  ([`library/phii-2021-defining-and-validating-requirements-guide`](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf))
- **PATH & PHII (2012)**, *Common Requirements for Maternal Health Information
  Systems: Produced with the Collaborative Requirements Development Methodology*
  ([`library/path-2012-common-requirements-mhis-crdm`](https://media.path.org/documents/MCHN_mhis_crdm.pdf))

The relation to PHII and PATH CRDM is **adapts**:

- **Phases that follow PHII & PATH CRDM:**
  - **Phase 1 (Needs assessment)** and **Phase 2 (Business process analysis &
    redesign)** follow PHII's first two concentration areas (*1. Business
    Process Analysis — think: How do we do our work now?* and *2. Business
    Process Redesign — rethink: How should we do our work?*), using swimlane
    task-flow diagrams across pools and actor lanes and a business process / gap
    matrix.
  - **Phase 3 (Requirements definition)** follows PHII's third concentration
    area (*3. Requirements Definition — describe: How can an information system
    support our work?*) and PATH (2012)'s separation of activity-linked
    functional user requirements from cross-cutting non-functional / general
    system requirements, together with PHII's priority scale (`High / Medium /
    Low` = `Must-have / Should-have / Nice-to-have`) and validation walkthroughs
    (*Desk checking*, *Walkthrough*, *Peer review*).
- **Phases and mechanisms that are the platform's own extensions:**
  - **Agentic BA-only facilitation channel:** An LLM agent facilitates the
    process with the human BA (`Role_BusinessAnalyst`) over issues and pull
    requests rather than a multi-day in-person workshop.
  - **Phase 4 (Codebase impact analysis):** 7-dimension impact analysis across
    the repository's schemas, skills, BPMN/DMN models, UI components, pipelines,
    tests, and downstream consumers ([`crdm-impact-analysis.md`](crdm-impact-analysis.md)).
  - **Phase 4b (Capability area dependency ordering & formalize-first rule):**
    Grouping requirements into capability areas (`CA-1`, `CA-2`, …) ordered by a
    dependency DAG and formalizing existing implicit behavior before adding net-new
    features.
  - **Phase 5 (Work-plan decomposition & specification filing):** Creating agent
    work items (`beans/`) and human todos (`todos/`), and filing proposals from
    `docs/proposals/<slug>.md` to `docs/requirements/<slug>.md`.
  - **Phase 6 (Implementation, `branches/` preview & merge sign-off):** Feature-branch
    delivery, automated verification gates, `branches/<branch-slug>/` review, and
    explicit human owner confirmation before merging (`merge-to-main.md`).

## Actors

| Actor | Role | Swim lane |
|---|---|---|
| **BA / Feature Requestor** | The person who identified the need and coordinates the CRDM process. Acts as Business Analyst: interacts with the agent, reviews increments, translates stakeholder feedback into agent-actionable direction. May be an author, editor, programme lead, or reviewer. | BA / Feature Requestor |
| **Agent** | The LLM agent running in the folio-assistant harness. Facilitates the process, synthesises inputs, implements on feature branches, posts summaries to the issue. Interacts with the **BA only**, not with stakeholders directly. | Agent |
| **Stakeholders** | The people affected by the feature who must review and approve it. They participate at defined checkpoints (needs confirmation, requirements approval, MVP testing, feature sign-off) — not in the day-to-day development loop. Examples: review committee, country programme managers, IT teams, end users. | Stakeholders |

## BPMN reference

[`processes/process/crdm-requirements.bpmn`](../../../processes/process/crdm-requirements.bpmn)
is the outer process — detection, the `Feature?` decision, then six phases, each
a real subprocess in its own file:

| phase | file | what happens |
|---|---|---|
| Link the work to an issue | `crdm-issue-linking.bpmn` | scan, then link or ask; never create without permission |
| Phase 1 — needs | `crdm-needs.bpmn` | stakeholders, needs statement, loop until recognised |
| Phases 2–4 — BPA + requirements | `crdm-requirements-definition.bpmn` | current workflow, requirements, impact, loop until approved |
| Phase 4b — prioritization | *(inline in Phase 4 exit)* | dependency-order capability areas, formalize-first rule, BA confirms |
| Phase 5 — work items + sign-off | `crdm-signoff.bpmn` | requirements become work items, BA signs off, branch announced |
| Phase 6 — implement + acceptance | `crdm-deliver.bpmn` | implement, review increment, share MVP, take findings |
| Close-out | `crdm-close.bpmn` | stakeholder sign-off, BA confirmation (an adjudication, recorded as a `requirement-signoff` attestation that moves the set to `accepted`), then the close |

`workflow_complete` takes step ids such as `A_Implement`, `A_Close` and
`BA_Signoff` by name; the interpreter enters a phase by itself and `workflow_next` tells you which one
you are in (`inside: Phase 6 Implement + acceptance`). You cannot complete a
phase — a phase is done when its steps are.

**Phase 6 is one subprocess**, because a rejected increment, an MVP that is not
ready, and stakeholder findings all route back into implementation, and a
subprocess has one exit and cannot be re-entered once finished.

## Every question you put to the BA carries its context first (STRICT)

Every phase of this process hands the BA a decision they were not inside the
analysis for. **The ordering rule in
[`interaction-modality.md` §4.1](../../conduct/conduct-core/interaction-modality.md) governs this whole
workflow, not just its explicit checkpoints: context → options → recommendation
→ question.** Its test applies unchanged:

> **Can the BA answer without opening anything?**

Terms the agent coined during its analysis feel defined to it and are new to
everybody else. Three traps:

- **An option name you invented.** "Prefix-at-rest or prefix-at-install?" names
  two things that exist nowhere outside your own head and your own issue.
  Describe what each one *does* instead, and put the coined name in parentheses
  if it earns its place at all.
- **A question that resolves to "go read the issue".** The issue is where the
  BA goes for depth. It is never where the question's terms are defined, and a
  question that needs it read turns a quick decision into a long one.
- **Options without their costs.** "A or B" is not a choice; "A, which changes
  nothing here, or B, which rewrites every `bootstrap.processes:skill` ref in the diagrams"
  is. The BA is deciding on the consequences, so the consequences are the
  question.

This applies to **every** surface this workflow uses: the chat, the summary
comment posted to the issue after each round, the PR body, and a work item's
`## Done when`.

## Phase 1 — Needs assessment

**Input:** the feature request (from chat, issue, discussion, or upload)

1. **Identify the requester** — who is asking?
2. **Identify stakeholders** — who else is affected? Check:
   - `<name>.config.json` roles across active folios
   - GitHub CODEOWNERS
   - Recent activity on related issues
3. **Gather source material** — the request may come from:
   - Chat messages in the current session
   - A GitHub issue body or comment
   - An uploaded document (Word, PDF) in `uploads/`
   - A referenced document in `library/`
   - An attachment to a GitHub issue comment
4. **Synthesise a needs statement** — write a clear, jargon-free statement of
   what is needed and why, with rationale linking to a concrete workflow
5. **Post to the issue** — the synthesised needs statement goes on the GitHub
   issue as a comment, not in chat
6. **Request feedback** — ask the requestor and stakeholders to review

**Loop:** iterate until the needs statement is approved.

## Phase 2 — Business process analysis

**Input:** approved needs statement

1. **Find the current workflow** — check `processes/**/*.bpmn` for existing
   process diagrams that cover the affected area
2. **Map the gap** — where in the current workflow does the need appear?
   Identify the specific activity or decision point
3. **Document current state** — if no BPMN exists, document the as-is workflow
   in prose or create a new BPMN fragment
4. **Identify bottlenecks** — probe for the real pain point behind the stated
   request

**Post to the issue:** current-state workflow description with gap identified.

## Phase 3 — Requirements definition

**Input:** current-state analysis with identified gap

For each requirement:

1. **Functional requirement** — stated as "SHALL" / "SHOULD" / "MAY"
2. **Proposed implementation:**
   - Skill file (name, location, description)
   - MCP tool registration (if applicable)
   - Schema changes (Zod types, block kinds, constraints)
   - Pipeline changes (validators, renderers, scripts)
3. **Acceptance criteria** — testable conditions
4. **Consumer burden** — see below. A requirement that shifts work onto the
   consumer is not done.
5. **Cross-references** — link to related documentation pages under
   `docs/source/`, existing skills, existing workflows
6. **Wireframe candidates, when a requirement changes a rendered surface** — a
   page, a visualiser, the navbar, a form, an app screen. Before anything is
   built, run [`wireframe-design-review`](../../ui/ui-core/wireframe-design-review.md)
   in Design use (`Call_Wireframe` in `crdm-requirements-definition.bpmn`):
   at least two candidates, each with a web and a mobile layout, committed as
   assets of the proposal under `docs/proposals/<slug>/wireframes/` on the
   feature branch, and shown where the requester will look, chosen from
   context — the conversation, the issue the request came from, the PR, or
   several — each place carrying the same branches/ deep links and screenshots
   ([`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md),
   point 5). The
   candidates are the options Phase 4's comparison lays out; the requester or
   BA chooses one at the review. Record "N/A — no rendered surface" in the
   template otherwise. The wireframe is part of the design process for
   adjudication ([`wiregen`](../../../methodologies/wiregen.md)).

### Consumer burden is a requirement, not a nicety (STRICT)

**Every requirement states what a downstream consumer must do to use the
result — and the target is nothing.**

The standing rule: *a downstream consumer must never have to
string-manipulate, re-derive, or assume a rule in order to use what we
publish.* If an artefact makes a consumer parse a name, strip a prefix,
substitute a base URL, or know a convention that is written down only in prose,
the requirement is not met.

Ask it in this form, because the failure is always phrased as a saving:

> *"We don't need to emit X — it can be derived from Y."*

That sentence is the smell. **A rule a consumer has to know is a rule a
consumer can get wrong**, and the cost is paid by someone who cannot see the
code that made the assumption reasonable. Emitting the derivable field costs
bytes in a regenerated artefact; the derivation rule costs correctness in every
consumer. So emit the derivable field. For example, a preview
knowledge graph's nodes each carry an explicit `prov:alternateOf` link to
their canonical counterpart, rather than relying on a documented base-URL
substitution: a consumer should follow a link, not implement a substitution.

Three checks that catch most of it:

- **Would a consumer in another language need our source to understand this?**
  If yes, emit the field.
- **Is the convention stated anywhere a machine can read?** Prose in a skill is
  not machine-readable. A typed term in a `@context` is.
- **Does the artefact answer "what am I?" from itself?** A preview that needs
  an external convention to be told apart from the canonical version fails
  this. Put it in the type, not in a filename or a path segment.

This is also why the declaration file keeps a fixed name while artefacts are
stub-named: a consumer must be able to open a repository it has never seen
without first deriving a filename. See
[`directory-conventions`](../../kg/kg-core/directory-conventions.md) §Naming.

**Post to the issue:** structured requirements with acceptance criteria.

## Phase 4 — Impact analysis

**Input:** defined requirements

1. **Schema impact** — which types, constraints, builders change?
2. **Pipeline impact** — which scripts under `pipeline/` are affected?
3. **Adapter impact** — paper, document, dak? Does it ripple?
4. **QA impact** — new criteria? Modified criteria? Registry changes?
5. **Folio impact** — which active folios need migration?
6. **Consumer impact** — what must every downstream consumer change, and what
   must it now *know*? An impact analysis that lists only our own files has
   measured half the change. Enumerate: fields added or removed from published
   artefacts, IRIs or filenames that move, conventions a consumer would have to
   learn. **A convention added is an impact**, even when no file changed shape.
7. **Test plan** — what tests to add or update? Include at least one that
   asserts the consumer-facing contract, not only the internal one — a test
   over the emitted artefact, not over the function that built it.
8. **Migration plan** — steps, rollback, what breaks without it

**Post to the issue:** impact assessment and migration plan.

### When the analysis yields more than one viable approach

Phase 4 often ends with a **choice** rather than a plan, and that is the moment
the BA is handed a decision. Not a list of approach names with the analysis
linked: a **comparison**, per
[`decision-comparison`](../../conduct/conduct-core/decision-comparison.md) — per option its pro, its con,
what it changes **downstream** and how reversible it is, laid out where the rows
can be read against each other, then one recommendation and a stated default.

Items 1–6 above enumerate the downstream question for the change as a whole;
the comparison asks it once per option, so an empty downstream column discards
work already done.
## Phase 4b — Prioritization and dependency ordering

**Input:** impact analysis complete, possibly multiple capability areas identified

When a feature request decomposes into **more than one capability area** (as
most non-trivial requests do), the agent must explicitly order them before
creating work items. This is not optional: a flat work item list has no implementation
sequence, so the next session either guesses the order or asks the BA a
question the analysis already answered.

### The prioritization protocol

1. **Identify capability areas** — each is a coherent cluster of requirements
   that can be implemented and reviewed independently. Name them.

2. **Map dependencies** — draw the dependency graph:
   - Does area A define concepts that area B assumes?
   - Does area A produce artefacts that area B consumes?
   - Does area A change structure that area B builds on?
   If yes, A must precede B.

3. **Apply the formalize-first rule** — within the dependency order:
   - **Structural/organizational** work first (taxonomies, indexes, schemas)
   - **Process/policy** formalization second (skills, workflows, conventions)
   - **Implementation** third (code, pipelines, tools)
   - **Visualization/UI** last (dashboards, pages, views)

   Only the UI's **build** comes last. Its **wireframe** is designed and
   approved in Phases 3–4 (step 6 of Phase 3), so the order fixes when it is
   implemented, not when it is decided.

   This is not arbitrary — a visualization built before the process is
   formalized will be rebuilt; a process formalized before the structure is
   organized will reference the wrong paths.

4. **Present the order to the BA** — as a dependency chain, not a list:
   ```
   Area 5 (structure) → Area 2 (process) → Area 3 (review) → Area 4 (planning) → Area 1 (visualization)
   ```
   With one sentence per arrow explaining **why** the dependency exists.

5. **BA confirms or reorders** — the agent proposes, the BA decides. The BA
   may override the dependency order (e.g. "I need the visualization first
   even if it's throwaway") — that's a legitimate business decision, and
   the agent records it as such rather than arguing.

### What this step produces

- A numbered list of capability areas in implementation order
- A dependency rationale for each ordering decision
- An estimate of scope per area (work item count)
- A recommendation for which areas constitute the MVP release

**Post to the issue** alongside the impact analysis. This becomes the
input to Phase 5's work item creation — work items are created in dependency order,
not in the order the BA mentioned them.

### Cross-domain applicability

This step applies identically to code features, paper milestones, and
project deliverables. The formalize-first rule is domain-independent:
a paper's structure (chapter order, block kinds) must precede its
content (prose), which must precede its presentation (PDF layout).

## Phase 5 — Sign-off and bean creation

**Input:** requirements + impact analysis reviewed and approved by stakeholders

1. **Post sign-off summary** on the issue — what was agreed, what was deferred
   — **and record it.** `BA_Signoff` is an adjudication:
   the BA answers `approve`, `amend`, `reject`, `defer` or `cancel`, and
   `A_RecordSignoff` appends a `requirement-signoff` attestation for the
   requirement set (who, when, scope, outcome, the stage it moves the set to,
   the reason, and the permalink to the issue comment). `GW_SignoffRecorded`
   reads it back, so the phase cannot continue on a sign-off nobody recorded.
   An agent records the BA's decision; it never makes it.
2. **Create work items** for each implementation unit — each naming the `req:`
   statements it delivers, with `## Done when` copied from their success
   criteria, and listed in the set's `workPlan` (a set at `planned` with no
   work items is refused):
   - Follow the check-before-create protocol (see `todo-manager.md`)
   - Scope to a single PR-sized unit
   - Reference the parent issue in each work item
3. **Offer the knowledge-graph destinations** for the agreed set — `A_OfferKg`,
   `BA_ChooseKg`, `A_RecordKg` in `crdm-signoff.bpmn`. **This step is not
   optional and its default creates nothing.** See below.

### The agreed set is an ASSET, and Phase 5 is where it gets a home

The agreed set is a design-memory asset, so it goes into `docs/`; when it
relates to a harness, feature or tool, its detailed design and planning go
into that harness's `docs/`. Without this step requirements end as an issue
and a conversation: requirements are produced while building, and they are not
the thing built.

Three rules, and the first is the one a run skips:

- **Ask; never pick silently.** The destinations are DERIVED from the owning
  layer's declared graphs at the time of asking, `none` is a listed answer,
  and if nobody answers **nothing is created** and *"asked, answered none"* is
  recorded. `kg-contribution-offer` carries the option set and the question
  that identifies a design-memory asset.
- **It goes in the OWNING layer's `docs/`** — a `cat-harness` feature's
  reasoning in `cat-harness/docs/`, a folio's subject matter not in the
  platform at all. `placement` decides where inside it: `architecture/` for why
  it is shaped this way, `guides/` for how a person does something with it,
  `reference/` for generated material that is never hand-edited.
- **Not `fsh-guts`.** That is the declared non-rendered trashcan and its
  content may be thrown away or lost. A design record's whole value is that it
  survives the conversation that produced it.

**What separates the record from the skills the same phase produces:** a skill
carries what a competent practitioner needs *in order to do* the task;
everything past that line — background, options not taken, how to reach a data
source, an API's full surface when the task touches three calls — is
documentation. Both directions fail silently, so state which one you are
writing before you write it.

### A harness feature's documents: proposed in `docs/proposals/`, filed in `docs/requirements/` (STRICT)

When the feature is **the harness's own**, the documents this process produces (initial analysis, MVP, the options, the
agreed requirements) **live and are updated under `docs/`**, in two declared
sub-graphs of it.

| stage | where | what it is | checked by |
|---|---|---|---|
| Phases 1–5, and while building | `docs/proposals/<slug>.md` | the argument: needs, options, MVP, what was agreed | — |
| the feature ships | `docs/requirements/<slug>.md` | the promise: its front matter is a `Requirement` | `check:requirements` |

**The directory says what KIND of document it is; the stage is a field.** The
requirements document is a `RequirementSet` whose `stage` (`draft` …
`accepted`, or `rejected`, `cancelled`, `superseded`) is recorded in the set
and moved only by a recorded sign-off. The directory follows the stage — a set
reaching `accepted` is when its proposal is filed — but does not stand in for
it, because a file's location records neither the decision nor who made it.

Both kinds, `proposals` and `requirements`, declare `within: "docs"`. Every
list of kinds (the navbar's Folders among them) therefore draws them inside
the Docs row, **folded shut until the reader opens it**. That is general
behaviour for any kind declaring `within`, not a special case for these two.

**One proposal per feature, updated in place, never forked.** A later phase
edits the same page rather than writing a second one, so the history of the
argument is `git log` on one file.

**Filing on ship is a MOVE, never a copy.** In Phase 6, once the owner has said
to merge:

1. `git mv docs/proposals/<slug>.md docs/requirements/<slug>.md`, so
   `git log --follow` walks the requirement back through its argument.
2. Add the `Requirement` fields to its front matter, from
   `bootstrap/schemas/requirement.schema.json`:
   - `id: req:<slug>`. The id IS the file name.
   - `status: in-force`
   - `proposedIn`: the old path.
   - `actors`, `description`.
   - `statements`: one per agreed requirement, each with a `key`, a
     `conformance` level (`SHALL`, `SHOULD`, `MAY` or `SHALL NOT`) and one
     `requirement` sentence a reviewer can say yes or no to. A `functional`
     statement may add `activity`, `capability` ("I want") and `benefit`
     ("so that"). A `non-functional` one may add a `category`.
   Keep the body: the reasoning stays with the promise it produced.
3. Point the feature's test runs at the statements they check, in
   `folio-test-run/v1`'s `requirements` array, as `req:<slug>#<key>`. **The test
   points at the requirement, never the reverse.**
4. `bun run cat check:requirements`. It refuses a slug that is in both sub-graphs
   (a copy, or a proposal landing on an existing requirement), an id that is
   not its file name, and front matter the schema rejects.

**The schema names no outside concept.** It lives in bootstrap, so every
harness has it, and `check:bootstrap-concepts` fails if any bootstrap schema
names a derivative's content model, layer names, organisation or interchange
standard. A harness that follows a particular standard maps that standard's
fields onto these fields **in its own layer**, never in the base.

**How filed requirements are organised, traced, superseded, and retired:**
- The assessment of open requirements standards is in [`methodologies/requirements-standards-assessment.md`](../../../methodologies/requirements-standards-assessment.md), and the literature search, adopted/rejected methodologies, and the BPMN filing workflow (`Process_RequirementsFiling`, `sdlc/processes/requirements-filing.bpmn` (opt-in `cat-harness.sdlc`)) are in [`methodologies/requirements-filing-and-organisation.md`](../../../methodologies/requirements-filing-and-organisation.md).
- Physical files stay flat at `docs/requirements/<slug>.md` (`id: req:<slug>`, statement keys `req:<slug>#<key>`), organised in `docs/requirements/index.md` under the eight canonical concern groups (`code-lists/concern-group.json`), with three-axis traceability (`proposedIn`, `derivedFrom`, `dependsOn`, `beans`, `skills`, `processes`, `test/attestations/`) and an immutable lifecycle (`proposed → in-force → superseded | retired`, never `git rm`).

**A folio's features are not filed here.** This applies to the harness's own
feature work. A folio's subject matter lives in the folio, as Phase 5 already
says.

## Phase 6 — Iterative development

**Input:** work items

For each work item:

1. **Create feature branch** — always, no exceptions. Before the first edit,
   run the collision review in `coordinate` (opt-in `cat-harness.sdlc`)
   §"Starting new work".
2. **Implement** — following the accepted requirements, and, where a
   requirement changes a rendered surface, **against the wireframe candidate
   the requester or BA chose** in Phases 3–4. The delivery summary links the
   chosen candidate beside the after-screenshot.
3. **Open PR** — link to the work item and the parent issue
4. **Deploy staging preview** — the `feature-staging.yml` workflow
   auto-deploys to `branches/<branch-slug>/` on `gh-pages`. The magenta
   "FEATURE BRANCH" banner at the top of every page links to the source
   branch and provides a "compare with main" link.
5. **Post before/after comparison to issue** — use the `staging-review`
   skill. Every changed page gets a before (main) and after (staging)
   URL pair in a Markdown table. See `schemas/staging-comparison.schema.json`
   for the schema:
   ```
   | Page | Before (main) | After (staging) | What changed |
   |---|---|---|---|
   | Landing | [main](…) | [staging](…) | Added badge |
   ```
6. **Iterate on PR feedback** — code review is on the PR; visual review
   uses the staging preview URLs. When the change touches a **folio's
   blocks**, the page a reviewer opens is the preview's **review page**,
   `branches/<slug>/review/`: every changed block before and after, with the
   heat map and outline. The review itself runs through
   `content-change-review.bpmn`. The review coordinator slices the change and
   assigns the slices, reviewers work them in `review-task`, disagreements go
   to `adjudication`, and the coverage gate must pass before sign-off.
7. **Ask user for explicit confirmation before merging to main.** This is the
   `merge-to-main` (opt-in `cat-harness.sdlc`) sub-process, called from
   `crdm-close.bpmn` (`Call_MergeToMain`) once the sign-off is recorded and
   before the issue is closed, and run the same way for any increment the owner
   asks to land earlier. A stakeholder sign-off or the BA's confirmation is
   acceptance of the feature, not authorisation to merge it.
8. **Update documentation** — the OWNING layer's `docs/` pages and the
   workflow BPMNs. For the harness's own feature, **file its proposal as its
   requirements** once the merge is agreed: see *"A harness feature's
   documents"* above. If Phase 5's offer chose a `docs/` destination, this is
   where that page is written and kept true; if the implementation diverged
   from what was agreed, the divergence is recorded there rather than
   smoothed.
9. **Staging cleanup** — **a merged PR's preview goes away on its own**:
   the merge is the confirmation, since the main site
   now shows the same thing. Everything else is retained by default. While a
   PR that will not be merged is open, the user adds the `staging:cleanup`
   label; **once it is closed the label can no longer reach it**, and removal
   is a `feature-staging.yml` dispatch the user runs with `cleanup_slug` and a
   matching `cleanup_confirm` (see [`staging-review`](../../ui/ui-core/staging-review.md)).
   **Never remove a staging preview any other way, and never on your own
   initiative.**

### Theme and UI review is NOT a Phase 6 step — it happens at ingestion

[`theme-ui-review`](../../ui/ui-core/theme-ui-review.md) runs only at
ingestion of graphical assets for a website or app design, from
`ingest-theme.bpmn`. `GW_StakeholderOK`'s `accepted` branch in
`crdm-deliver.bpmn` closes the phase directly. Accessibility, branding and
locales for a UI are checked there, not here, because at ingestion a finding is
a decision about what the assets will be rather than a defect in something
that shipped.

When a round of implementation is complete (one or more work items resolved):
1. **Post a round summary comment on the issue** — addressed to the BA and
   stakeholders, containing:
   - What was accomplished in this round
   - What remains to be accomplished (open work items)
   - Links to updated content for review (staging URLs, docs pages)
   - Before/after comparison table for changed pages
2. **Never close the issue without explicit authorization** — the BA or
   stakeholder closes it, or the agent closes it only when the BA
   explicitly says to. An agent must never assume completion.

## Cross-references

- [`../../../methodologies/crdm.md`](../../../methodologies/crdm.md) — the CRDM methodology node (PHII & PATH origin, three concentration areas, and platform adaptation)
- [`../../../library/corpus/process/phii-2023-crdm/README.md`](https://phii.org/crdm/) — PHII (2021/2023) CRDM web page
- [`../../../library/corpus/process/phii-2021-defining-and-validating-requirements-guide/README.md`](https://phii.org/wp-content/uploads/2021/07/Defining-and-Validating-Requirements-Guide_0.pdf) — PHII (2016/2021) Defining and Validating System Requirements Guide
- [`../../../library/corpus/process/path-2012-common-requirements-mhis-crdm/README.md`](https://media.path.org/documents/MCHN_mhis_crdm.pdf) — PATH & PHII (2012) Common Requirements for Maternal Health Information Systems
- [CRDM methodology page](https://litlfred.github.io/folio-assistant/docs/cat-harness/process/crdm-methodology.html) — the documentation page for users
- [`interaction-modality.md`](../../conduct/conduct-core/interaction-modality.md) §4.1 — context before the question; the ordering rule this workflow runs on
- [`crdm-detect.md`](crdm-detect.md) — feature-request detection skill
- `staging-review.md` (opt-in `cat-harness.sdlc`) — before/after staging comparison skill
- `todo-manager.md` (opt-in `cat-harness.work-plan`) — work item creation protocol
- `bean-coordination.md` — cross-session work item coordination
- `coordinate.md` (opt-in `cat-harness.sdlc`) — session coordination
- [Publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) — the content lifecycle this fits within

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md).

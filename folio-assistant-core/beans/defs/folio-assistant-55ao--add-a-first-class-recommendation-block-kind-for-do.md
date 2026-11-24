---
# folio-assistant-55ao
$schema: bean/1.0.0
title: Add a first-class `recommendation` block kind for document folios
status: completed
type: task
priority: normal
created_at: 2026-08-28T15:04:51Z
updated_at: 2026-10-10T17:04:26Z
parent: folio-assistant-0lmb
---


Split out of `ehve`, which added the `document` content type and deliberately
stopped short of this.

## Why

An L1 health-policy guidance note exists to state **recommendations**. A
recommendation is the block readers cite, implementers trace to, and reviewers
sign off individually — it wants a label, a stable identity and a place in the
`uses[]` graph, which is everything a `theorem` has. It is emphatically not a
theorem: nothing proves it, and its authority is the issuing body's.

There is no kind for it, and the repo has been papering over that.
`document-intake.md` maps "Recommendation (numbered, boxed)" onto `definition`
and "Good-practice statement" onto `proposition`. Both are **math** kinds, and
`DefinitionBlock.lean` is *required* — so in a document folio the first mapping
does not merely read oddly, it **cannot validate at all**. `ehve` corrected that
file in place and pointed it at the interim convention; this bean is the real
fix.

## Interim state (works, so this is not urgent)

A labelled, titled `prose` block. `skills/authoring/folio-document-adapter/normative-statements.md`
states the convention: one statement per block, strength stated in the prose
(nothing structural encodes it), published number kept out of the label because
numbers are renumbered between editions and the label must survive that.

Structurally that is already correct — a titled, labelled, individually
reviewable node in the editorial graph. What it misses is a kind name that says
what it is, and therefore any criterion that could check it. **A `prose` block
converts by changing one builder call**, so content authored under the interim
convention is not wasted.

## What it costs

~30 files, from grepping `conjecture` across the repo. A new authorable kind is
not a one-line addition:

- `schemas/block-kinds.ts` — `BLOCK_KINDS`, and the `DOCUMENT_BLOCK_KINDS`
  derivation picks it up automatically (it is the complement of
  `MATH_BLOCK_KINDS`), which is the one part that is already right.
- `schemas/types.ts` — the `Block` union member, plus the compile-time
  exhaustiveness proof against `BLOCK_KINDS`.
- `schemas/builders.ts`, `schemas/constraints.ts` (Zod + `appliesTo` rows +
  `KNOWN_LABEL_PREFIXES`), `schemas/jsonld.ts` (`KIND_PREFIXES`),
  `schemas/block-qa.ts`.
- `src/blocks/registry.ts` (viewer), `content/pipeline/render-latex.ts`,
  `content/pipeline/render-markdown.ts` (`KIND_HEADING`),
  `content/pipeline/qa-criteria-registry.ts`, `generate-index.ts`,
  `block-module.ts`, and the several sweeps that switch on kind.

## Design questions to settle first

1. **Label prefix.** `rec:` is the obvious candidate and does not collide with
   the 17 existing prefixes. But the interim convention deliberately says the
   *folio* picks its own — a standards body may have its own grammar. Decide
   whether the platform reserves one or keeps it folio-chosen.
2. **Does it carry `strength` as a field?** Today it is prose. A typed field
   (`must` / `should` / `may` / good-practice) makes it checkable, but the
   grading taxonomy is domain-specific — WHO's GRADE is not IETF's RFC 2119.
   A free-text `grading` beside a small closed `force` enum is what
   `schemas/skills/normative-statements/input.schema.json` already proposes;
   that schema is the design sketch to start from.
3. **Its relation to the DAK side.** `dak-blocks.ts` has `realises`, described
   as "the L1 end of every `realises` edge", and `health-intervention` was added
   as the L1 anchor. A `recommendation` kind in the paper/document adapter and
   `health-intervention` in the DAK adapter are two representations of the same
   thing at different layers — settle whether they relate, and how, before
   minting a second vocabulary for it.

## Do not start this speculatively

It is worth doing when a real L1 folio starts and its authors hit the gap, not
before. The interim carrier works, and question 2 in particular is much easier
to answer against a corpus than in the abstract.

## OWNER'S RULINGS, 2026-09-23 — and a pause on the third

Put as one question each while going through the open beans:

- **Build it, as a block kind plus a skill.** The owner chose "Block kind + skill": a `recommendation` kind in the content model, a skill for authoring one, and a BPMN step where it is drafted and reviewed.
- **Q1, the label prefix: the FOLIO chooses.** The platform reserves none, which keeps the interim convention in `normative-statements.md`. A standards body's grammar is its own.
- **Q2, strength: a reference to a SKOS vocabulary or value set.** It is not a closed enum and not free text. The field names a concept in a declared scheme, so each domain brings its own grading and the check is "resolves in the scheme". **Build on the sibling code-list work:** `claude/magical-archimedes-4qkfxp-codelists` adds `schemas/code-list.ts`, closed code lists authored as nodes and published as a `skos:ConceptScheme` with `notation`, `prefLabel`, `definition` and `dcterms:source`. A strength scheme is one of those. Do not mint a second mechanism.
- **Q3, the relation to the DAK side's `health-intervention`: PAUSED.** The owner said *"needs stakeholder discussion"*.

## Blocked

- **waits on:** a stakeholder decision about how `recommendation` (generic, document adapter) relates to the DAK `health-intervention` (the L1 anchor). The options put were: link without merging, or treat them as one vocabulary. This bean says to settle that before minting a second vocabulary, so the build does not start.
- **since:** 2026-09-23T22:45Z
- **expires:** 14 days, then re-ask the owner whether the discussion has happened.
- **handoff:** Q1 and Q2 are settled above. When Q3 is answered, build in this order: code-list scheme for strength, the block kind (about 30 files, listed above), the skill, then the BPMN step. Also update `content-profiles.md`, which says "deliberately no `recommendation` kind".



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06 on Q3: LINK, don't merge

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, with three options (recommended first): link without merging; one vocabulary; still waiting on stakeholders. **The owner chose "Link, don't merge".**

- `recommendation` (document adapter, folio-assistant-core) and `health-intervention` (DAK adapter, smart-*) stay **two kinds**, joined by an optional edge from a recommendation to the health-intervention it is about.
- Each layer keeps its own vocabulary, and nothing in core depends on the DAK adapter.
- The block resolves. **The build waits until the content split across repos is done**, per the owner (2026-10-06: *"that needs to be done before F"*). It then lands in folio-assistant-core.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). Q1–Q3 are all ruled and
the content split has landed, so the build is unblocked. It spans two
repositories, re-measured today:

- **core:**
  - a `block-kinds/recommendation.json` node (`folio-block-kind/v1`,
    `adapter: paper`, `profile: document`, `prefixEnforced: false` per Q1);
  - the SKOS strength scheme (Q2);
  - the authoring skill and BPMN step;
  - `content-profiles.md`.
- **cat-harness:** a paper-adapter kind is still TYPED there.
  `schemas/types.ts` needs a `RecommendationBlock` member of the `Block` union
  (with the optional edge to a `health-intervention`, per Q3),
  `schemas/builders.ts` needs a `recommendation()` builder, and
  `schemas/constraints.ts` needs its Zod schema and the `strength` reference.
  A core kind node with no cat-harness type would break the discovery-vs-type
  agreement.

1. **(Recommended) Build it in two PRs: the cat-harness typing first, left for
   review, then the core node, scheme, skill and BPMN step on top.** This
   needs the session to be given push access to `litlfred/cat-harness`.
2. Build only the core half now (the scheme, the skill, the BPMN step against
   the interim `prose` carrier), and add the kind when cat-harness typing
   lands.
3. Keep waiting for a real L1 folio whose authors hit the gap (the bean's
   original "do not start speculatively").

**Default if no answer:** option 2. It changes nothing outside core, and
everything it writes carries over.


## Owner ruling 2026-10-10, answered directly in the lane C session (https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): option 1, build both halves

The owner chose to build both halves, noting the session has cat-harness
access. Order, per the decision above: the cat-harness typing PR first
(`RecommendationBlock`, builder, Zod schema with the `strength` reference
and the optional `health-intervention` edge), then the core node, the SKOS
strength scheme, the skill and the BPMN step.


## Summary of Changes

Built 2026-10-10 by the bean-backlog drain (lane C), in all three layers, on
the owner's rulings (Q1–Q3, and "build both halves" on 2026-10-10).

- **cat-harness** (litlfred/cat-harness#109, merged):
  - `RecommendationBlock` and `CodeRef` in `types.ts`;
  - `RecommendationSchema` and `CodeRefSchema` in `constraints.ts`, in
    `BlockSchema` and in `md-exists`;
  - the `recommendation()` builder;
  - inline as its default diff renderer.
- **cat-harness-tools** (litlfred/cat-harness-tools#73): the viewer-registry
  entry, and a LaTeX arm. The arm is a run-in `\paragraph{Recommendation.
  <title>}`, not a theorem-like environment. 3 tests.
- **core** (this PR):
  - `block-kinds/recommendation.json`: adapter `paper`, profile `document`,
    `labelPrefix: rec`, `prefixEnforced: false` (Q1);
  - a `Recommendation` heading in the five `block-kinds` catalogues, marked
    UNOFFICIAL as those catalogues already are;
  - a new declared `code-lists/` directory with
    `grade-recommendation-strength` (strong, conditional; WHO handbook for
    guideline development, 2nd ed.) and `rfc2119-requirement-level` (BCP 14)
    (Q2);
  - `schemas/recommendation-strength.ts` with `strengthFinding`, the
    "resolves in the scheme" check, and 8 tests;
  - the `normative-statements` skill rewritten for the kind, with
    conversion from the interim `prose` carrier, and its input and output
    schemas;
  - `document-intake`'s superseded note and the skill definition updated;
  - `Task_AuthorBlocks` in `authoring-a-document.bpmn` now drafts a
    `recommendation` block, with its `.pot` templates and generated glossary
    entry;
  - the memory note "there is no `recommendation` block kind" archived.
- **Q3:** `about[]` holds health-intervention labels: a link, never a merge.

**Verified:**
- In a `.git`-free workspace laid out as CI mounts it, cat-harness's
  `block-kind-nodes.test.ts` passes 11/11 with the node present (it failed
  only on `recommendation` without it). Its full suite shows the same 7
  failures as main.
- Core: `bun run typecheck` exits 0, and `bun test` shows the same 72 failures
  as main plus 8 new passes.

**Not done:** wiring `strengthFinding` into `content_validate` (cat-harness-tools
`validate.ts`), so an unresolvable strength fails a folio build. It is pure and
tested, ready for that call site.


## Summary of Changes

Mirror copy. Completed by drain lane C across three repos: cat-harness#109 (RecommendationBlock type, Zod schema, builder), cat-harness-tools#73 (viewer registry entry, LaTeX render), folio-assistant-core#41 (kind node, GRADE and RFC 2119 strength code lists, strengthFinding check, skill, BPMN step).



## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). Q1–Q3 are all ruled and
the content split has landed, so the build is unblocked. It spans two
repositories, re-measured today:

- **core:**
  - a `block-kinds/recommendation.json` node (`folio-block-kind/v1`,
    `adapter: paper`, `profile: document`, `prefixEnforced: false` per Q1);
  - the SKOS strength scheme (Q2);
  - the authoring skill and BPMN step;
  - `content-profiles.md`.
- **cat-harness:** a paper-adapter kind is still TYPED there.
  `schemas/types.ts` needs a `RecommendationBlock` member of the `Block` union
  (with the optional edge to a `health-intervention`, per Q3),
  `schemas/builders.ts` needs a `recommendation()` builder, and
  `schemas/constraints.ts` needs its Zod schema and the `strength` reference.
  A core kind node with no cat-harness type would break the discovery-vs-type
  agreement.

1. **(Recommended) Build it in two PRs: the cat-harness typing first, left for
   review, then the core node, scheme, skill and BPMN step on top.** This
   needs the session to be given push access to `litlfred/cat-harness`.
2. Build only the core half now (the scheme, the skill, the BPMN step against
   the interim `prose` carrier), and add the kind when cat-harness typing
   lands.
3. Keep waiting for a real L1 folio whose authors hit the gap (the bean's
   original "do not start speculatively").

**Default if no answer:** option 2. It changes nothing outside core, and
everything it writes carries over.


## Owner ruling 2026-10-10, answered directly in the lane C session (https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): option 1, build both halves

The owner chose to build both halves, noting the session has cat-harness
access. Order, per the decision above: the cat-harness typing PR first
(`RecommendationBlock`, builder, Zod schema with the `strength` reference
and the optional `health-intervention` edge), then the core node, the SKOS
strength scheme, the skill and the BPMN step.


## Summary of Changes

Built 2026-10-10 by the bean-backlog drain (lane C), in all three layers, on
the owner's rulings (Q1–Q3, and "build both halves" on 2026-10-10).

- **cat-harness** (litlfred/cat-harness#109, merged):
  - `RecommendationBlock` and `CodeRef` in `types.ts`;
  - `RecommendationSchema` and `CodeRefSchema` in `constraints.ts`, in
    `BlockSchema` and in `md-exists`;
  - the `recommendation()` builder;
  - inline as its default diff renderer.
- **cat-harness-tools** (litlfred/cat-harness-tools#73): the viewer-registry
  entry, and a LaTeX arm. The arm is a run-in `\paragraph{Recommendation.
  <title>}`, not a theorem-like environment. 3 tests.
- **core** (this PR):
  - `block-kinds/recommendation.json`: adapter `paper`, profile `document`,
    `labelPrefix: rec`, `prefixEnforced: false` (Q1);
  - a `Recommendation` heading in the five `block-kinds` catalogues, marked
    UNOFFICIAL as those catalogues already are;
  - a new declared `code-lists/` directory with
    `grade-recommendation-strength` (strong, conditional; WHO handbook for
    guideline development, 2nd ed.) and `rfc2119-requirement-level` (BCP 14)
    (Q2);
  - `schemas/recommendation-strength.ts` with `strengthFinding`, the
    "resolves in the scheme" check, and 8 tests;
  - the `normative-statements` skill rewritten for the kind, with
    conversion from the interim `prose` carrier, and its input and output
    schemas;
  - `document-intake`'s superseded note and the skill definition updated;
  - `Task_AuthorBlocks` in `authoring-a-document.bpmn` now drafts a
    `recommendation` block, with its `.pot` templates and generated glossary
    entry;
  - the memory note "there is no `recommendation` block kind" archived.
- **Q3:** `about[]` holds health-intervention labels: a link, never a merge.

**Verified:**
- In a `.git`-free workspace laid out as CI mounts it, cat-harness's
  `block-kind-nodes.test.ts` passes 11/11 with the node present (it failed
  only on `recommendation` without it). Its full suite shows the same 7
  failures as main.
- Core: `bun run typecheck` exits 0, and `bun test` shows the same 72 failures
  as main plus 8 new passes.

**Not done:** wiring `strengthFinding` into `content_validate` (cat-harness-tools
`validate.ts`), so an unresolvable strength fails a folio build. It is pure and
tested, ready for that call site.

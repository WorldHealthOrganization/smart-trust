---
# folio-assistant-rkqp
$schema: bean/1.0.0
title: Ingest Gemini-CLI agent-skill best-practices PDF + commit 4677175 as MODEL-SPECIFIC voices for skills
status: completed
type: task
priority: normal
created_at: 2026-09-20T14:45:12Z
updated_at: 2026-10-07T17:48:00Z
parent: folio-assistant-slw1
---


Owner, 2026-09-20, with an upload and a link:

> `Agent_Skill_best_practices___Gemini_CLI.pdf` one-voice source for skills
> <https://github.com/litlfred/folio-assistant/commit/467717508cf8ee3f8bb4cf1eaace91e769d92e16>
>
> for model specific sources, make those model specific voices. make sure .ts
> skill data model accomodates all. (preference leave unstructured schema,
> agentic review b/c of "best practice" drift, not formal).
> ingest the commit and attachement

## What this is

Two sources of **skill-authoring** guidance, to become **voices** — the same
object `check:voices` already audits prose against — rather than a new kind:

1. the uploaded PDF, which is **Gemini-CLI-specific**, and
2. commit `4677175` in this repository, which is ours.

## The decision the owner already made

**A model-specific source becomes a MODEL-SPECIFIC voice.** Not one merged
"skill authoring" voice with per-model caveats: Gemini CLI's advice is
evidence about Gemini CLI, and folding it into a single voice makes it
unfalsifiable which model a rule was measured on. This is the same
`ThemeRef`/inheritance shape settled earlier today — a shared default with
named overrides — and it is what lets a rule that turns out to be
Gemini-only be dropped without touching the rest.

## Explicitly NOT formal

Owner: *"preference leave unstructured schema, agentic review b/c of 'best
practice' drift, not formal"*. So:

- the `.ts` skill data model **accommodates** these sources without
  constraining their content — no enum of rule kinds, no required fields
  beyond provenance;
- conformance is an **agentic QA review**, not a schema gate. "Best practice"
  drifts; a formal check would pin whichever vintage was current when it was
  written and then report clean over the drift, which is the `dh4f` shape one
  level up.

## Done when

- [ ] The PDF is ingested with **extraction provenance** (`capturedAt`,
      `producer`, `readAt`) per `skills/library/library-core/asset-extraction.md` —
      metadata by default, contents only on explicit ask, which this is.
- [ ] Commit `4677175` is ingested as a source with its sha pinned.
- [ ] The `.ts` skill data model carries both, with the model-specific ones
      attributable to their model.
- [ ] A Gemini-CLI voice and our own voice exist as SEPARATE voices, and
      `check:voices` sees both (it fans out over `instancesWithVoices`).
- [ ] The agentic QA review axis exists and is wired; NO formal gate on
      rule content.

## Related

Sits beside the documentation-voice work the owner asked for in the same
session: *"make that QA audit review (agentic) on the agentic memory content
types (agents.md etc.). need one voice to go with it as part of documentation
creation"*. Same mechanism, different subject — that one is about `AGENTS.md`
and agent memory, this one is about authoring skills.


---

## COORDINATION NOTE from another session, 2026-09-21 — read before you author

Not a claim on this bean, and no action asked for. This is the
`/coordinate` bean trigger firing: this item is `in-progress` and will CREATE
VOICES, and the layout it would have created them in has moved underneath it.
Written here rather than messaged because a sibling session cannot be reached
directly — `ListAgents` lists none and `SendMessage` is refused; a committed
bean is what arrives.

**Branch `claude/bean-8h42-layout`, PR #773 (draft, green), in flight.**

### 1. Voices moved, and `<instance>/voices/<id>.json` is the OLD path

Now `<instance>/skills/voices/<id>/voice.json`, beside an optional
`SKILL.md` — because a voice IS a skill. Four instances declare a `voices`
directory at `skills/voices/`: `who-style-guide` (3 voices),
`folio-assistant-sci` (1), `folio-assistant-core` (1), `agent-skills`
(declared, still empty — bean `26tu`).

A bare `folio-voice/v1` profile at `skills/voices/<id>.json` still loads:
`voiceFilesIn` reads both file shapes deliberately, so nothing you write in
the old FILE shape breaks. It is the DIRECTORY that moved.

### 2. `cat-harness` declares no voices, deliberately

The platform holding another instance's editorial rules was the defect
(bean `btuv`). A voice added under `cat-harness/voices/` is now orphaned by
the migration — **which already happened once**: main commit `9b60f366` put
`technical-writer` there, and it had to be relocated by hand during a merge,
with git's rename detection dropping it inside another voice's folder first.

### 3. Where a model-specific voice should GO is a judgement

Owner, 2026-09-21: *"voices should be associated to appropriate home
semantically/by judgement."* Recorded in `schemas/voice-skill.ts`, which until
then said "the instance that DERIVED the voice" — a mechanical rule the corpus
falsifies twice. `who-editorial` cites who-iris's library and lives in
who-style-guide; `technical-writer` cites RFCs ingested in `agent-skills` and
lives in `folio-assistant-core`. **Where the source sits has never decided
ownership.** So this bean's Gemini-CLI voice does not automatically belong
wherever the PDF is ingested.

`agent-skills` is the obvious candidate for model-specific voices — it already
declares the graph and its description names exactly this plan ("a shared base
plus one override per vendor") — but that is the owner's call, not mine.

### 4. Two checks now run over voices

- `check:voices` — every rule cites a source that RESOLVES, with a quote. A
  `kgRef` resolves against the voice's OWN instance unless it names one, so
  cross-instance citations need `instance: "<name>"`.
- `check:voice-skills` — the instruction body must not RESTATE the rules. It
  asks for a `SKILL.md` only when the voice PROMISES one, so a bare profile
  with no `instructions` is fine.

Both are in the gate set. If you author against `main` today, neither this
layout nor these gates exist there yet; they arrive when #773 merges.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.


## 2026-09-30 — the Gemini CLI voice
- [x] **A Gemini-CLI voice exists SEPARATELY from our own**: agent-skills/skills/voices/vendors/agent-skill-authoring-gemini-cli/voice.json, extends the shared base agent-skill-authoring (the base's own description reserves vendors/ for exactly this). Home by judgement per the owner's 2026-09-21 ruling: agent-skills declares the voices graph and its base already names 'a shared base plus one override per vendor'.
  - 10 rules, each quoting its page of agent-skill-best-practices---gemini-cli (already ingested in agent-skills/library): descriptions do not overlap; the context budget in WORDS (~100 / <5k — vs the base's ~500 lines, a different source and unit); degrees of freedom; scripts for deterministic tasks; LLM-friendly script output; templates in assets/; the directory anatomy; reference material out of the body; no hardcoded secrets (critical); limit scope. Rules the base already states are inherited, not repeated.
  - provenance **assertion** (a vendor describing its own product), and **superseded** — the capture's own banner: 'Unpaid tier and Google One users: Gemini CLI was replaced by Antigravity CLI on June 18th, 2026.' No successor: Antigravity's pages do not cover skill authoring, which VoiceSupersessionSchema's own docblock records for this very document.
  - Verified: resolveVoice folds it to 22 rules (10 + 12 inherited); check:voices and check:voice-skills pass; the voices viewer lists it.
- [x] **Commit 4677175** is six uploads (2602.12670v4, 2607.25032v1, 2608.08453v1, Anthropic's 'Equipping agents…', Claude Platform Docs' 'Skill authoring best practices', 'Skills in OpenAI API'); all six are ingested in agent-skills/library with their source sha256 in structure.json. The two arXiv papers already back the base voice.
- [ ] STILL OPEN — the other MODEL-SPECIFIC sources in that commit as vendor voices of their own: Claude (Anthropic + Claude Platform Docs) and OpenAI. Same shape as the Gemini one.
- [ ] STILL OPEN — the agentic review axis for skills against these voices (no formal gate on rule content, per the owner).


## 2026-09-30 (later) — Claude voice, the OpenAI source, and the vendors declaration
- [x] **Claude vendor voice**: agent-skills/skills/voices/vendors/agent-skill-authoring-claude/voice.json — 8 rules from 'Skill authoring best practices' (Claude Platform Docs, in agent-skills/library): front-matter limits (critical), gerund names, no vague/reserved names, forward-slash paths, no voodoo constants, plan-validate-execute, consistent terminology, author with one Claude and test with another. provenance assertion; extends the base; resolves to 20 rules (8 + 12). Base rules traceable to this same document (500 lines, one-level references, TOC over 100 lines, third person, evaluations first) are inherited, not repeated. check:voices, check:voice-skills pass.
- **OpenAI** (owner: '1 + 2 … share links you need'): (1) RECORDED — the PDF capture in agent-skills/library/skills-in-openai-api is one page, step 7 of a cookbook, almost all code: no authoring guidance to cite. (2) FETCHED — developers.openai.com and github.com are denied by this environment's network policy; raw.githubusercontent.com is not. The cookbook's own registry.yaml names examples/skills_in_api.ipynb; fetched, 37 cells, 2,154 words of prose (what a skill is, when to use one, the manifest, versioning, security), MIT-licensed (repository LICENSE, 'Copyright (c) 2025 OpenAI').
  - [ ] ingest it — the pipeline has NO rung for a Jupyter notebook (ingest reports the rung undetermined and refuses), so this needs a notebook rung: markdown cells to sections by heading, code cells kept as code. Then the OpenAI vendor voice.
  - Link the owner could allow for the canonical text: https://developers.openai.com/api/docs/guides/tools-skills (the notebook's own 'Skills documentation' link).
- [x] **Owner, 2026-09-30: 'vendors/<id>/ should be declared subgraphs along with vendors/'.** Reverses the 2026-09-22 reading ('one declaration; vendors nested inside it', schemas/voices.ts VOICE_VENDORS_DIR). The same owner ruling of 2026-09-22 (directory-conventions §'Nesting is declared FROM WITHIN') says HOW: a node inside the directory names its subdirectories — never the root declaration reaching down a path. What it left OPEN, recorded there as not an agent's to settle: **the node's name and kind**. Proposed default for the owner: reuse the beans/beans.json pattern positionally — skills/voices/voices.json declaring vendors/, and skills/voices/vendors/vendors.json declaring each <id>/, as ContentDirectory entries. Blocked on that answer.


## 2026-09-30 — the OpenAI notebook needs a design decision before a rung
Measured before building: structure.json is pdf-structure/v1 (cat-harness/schemas/pdf-structure.ts) — a LITERAL _schema tag, source.mimetype_sniffed, text_source embedded|ocr, toc_source's five states — and every consumer reads it through that schema (check:l1-complete, gen-library-jsonld, summaries, LSI). A notebook is not a PDF, so a rung must either:
- (A) add notebook-structure/v1 — its own schema and entry kind; honest, and every consumer learns a second shape;
- (B) generalise pdf-structure/v1 to 'document-structure' — one shape, a rename across the corpus;
- (C) render the notebook to PDF first (nbconvert HTML → headless Chromium print, with a document outline) and run the existing PDF rungs — zero schema change, but the library would hold a DERIVED PDF, which structure_note must say.
Also measured: image-descriptions accepts a determined empty images.json, and a notebook with image outputs can record images: null with its reason (the sidecar's own third state). Put to the owner as blocker 2 of this round.

_2026-09-30T10:39:35Z_ — Claimed by claude/brave-hawking-511rrx — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).



## Owner, 2026-09-30 (round 3): vendors — the beans.json pattern
`skills/voices/voices.json` declares `vendors/`, and `skills/voices/vendors/vendors.json` declares each `<id>/`. Both are ContentDirectory entries, like `beans/beans.json`. Notebook shape: the owner asked about combining A and B; the follow-up is below.



## Owner, 2026-09-30 (round 3, after a measured analysis): notebook shape — A+B
A shared `document-structure` base with two variants. `pdf-structure/v1` stays unchanged as one variant, and `notebook-structure/v1` is new. Readers of `structure.json` measured: 17 in total. Nine read only shared fields. Three are page-aware and already null-safe (gen-library-jsonld, l1-blocks, library-graph). One is a strict validator, check-l1-complete, which breaks under any option. Four are PDF-only tools (pdf-tables, extract-candidates, document-image, and materialization fixity, whose sha256 check still works).
Plan:
- [x] base schema plus a `structureOf()` accessor returning a `{pages}|{cells}` locator (PR #1628)
- [x] check-l1-complete and the three page-aware readers switched to the accessor (gen-library-jsonld, l1-blocks, library-graph; 3,824 library nodes unchanged)
- [x] PDF-only tools skip a notebook with a stated reason: by construction, `withDerivedArms` gives a notebook only its rung and l1-blocks, and a test pins it
- [x] a check refusing a direct parse of structure.json outside the accessor: `check:structure-accessor` (owner's pick: a literal allowlist). It refuses the quoted token on code lines outside the accessor and two existence-only readers, each with its reason. Stale entries fail too, and tests prove it catches a violation and ignores prose
- [x] a notebook rung in ingest-document (markdown cells become sections by heading, code cells kept with their language): `scripts/notebook-structure.ts`, routed by CONTENT (PR #1628)
- [x] ingest the OpenAI notebook, then write the OpenAI vendor voice: `agent-skills/library/skills-in-openai-api-notebook` (12 sections, L1 complete, MIT licence carried) and `agent-skill-authoring-openai` (12 `oa-*` rules, each a verbatim quote), declared in `vendors/vendors.json` (PR #1628)


_2026-09-30 15:40_ — vendors declared from within (`voices.json` names `vendors/`, `vendors/vendors.json` names each vendor; kind `voice-vendors`) landed in PR #1483. The loader refuses an undeclared vendor. Three vendor voices now: Gemini CLI, Claude, OpenAI.



## Owner, 2026-09-30 (round 4): the accessor gate is a literal allowlist
Refuse the literal `structure.json` in TypeScript outside a short allowlist, each entry with its reason. The existence-only readers (library-ref, check-materialized-fixity, check-catalogue) are listed as such. The orphan `scenarios.detangle.json` was deleted with the owner's approval (commit 3095e92).


## 2026-09-30 — the agentic review axis for skills (the last open item)
- [x] `skill-voice-review-current` (kg-qa, `minor`, gated by nothing): does a CURRENT review exist of this skill against each ACTIVE voice whose rules are scoped `appliesTo: ["skill"]`. Rule-content verdicts are recorded in the sidecar's `voice_reviews` and are never a finding — the owner's "no formal gate on rule content".
- [x] Reviews carried across `kg:audit` runs exactly like `pair_attestations`; each pins the skill's content hash and the hash of the voice's skill-scoped rules, so either moving makes it stale (the old review kept as evidence).
- [x] `bun run cat voice:review` writes one (refuses a set missing a rule, judging one twice, or an unexplained fail/n/a); `--rules <voice>` prints what to judge, resolved through `extends`.
- [x] Agent half: `skill-voice-review` skill (folio-core), bound to the `code-reviewer` lane beside `skills-and-tools`.
- [x] The four skill-authoring voices now declare `appliesTo: ["skill"]` — until now they claimed every block kind.
- Measured: 323 skill sidecars each gain only `n/a` (no voice is active in `folio-assistant.config.json`); nothing else moved.
- OPEN, the owner's: which voices to ACTIVATE (`voice.active`). Nothing is reviewed until then.


## Owner, 2026-09-30 (round 5): activate the BASE voice only — issue #1694
`folio-assistant.config.json` → `voices.active: ["agent-skill-authoring"]`. The vendor overrides stay inactive (our skills are agent-agnostic; a vendor voice describes that vendor's own platform).
- Measured: all 325 skill sidecars go `n/a` → `fail` (minor, ungated) "never reviewed against agent-skill-authoring (12 skill rules)" — that is the review backlog, and nothing else in any sidecar moved.
- Closed a hole the activation exposed: `voiceOverlayCriteria` made a BLOCK-prose criterion for every shipped voice, ignoring `appliesTo`, so an active skill voice would have asked agents to hold folio prose to rules written for a SKILL.md. `judgesBlocks()` now drops voices scoped only to artefact kinds; the four skill-authoring voices make no block overlay (test pinned).

## Completed on landed evidence
Landed on main in PR #1461 / commit a3722a508c8c (Ingest Gemini-CLI agent-skill best-practices PDF; fix rendered impact).

---
layout: default
title: Skills & roles
nav_order: 5
lang: en
supported_locales: ["ar", "zh", "en", "fr", "ru", "es"]
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Skills & roles
{: .no_toc }

This page is the master list of every **skill** and **role** in folio-assistant,
and explains how they fit together with the LLM. For the typed input/output
contract of each skill, see the [Skill schema reference]({{ '/reference/skills/' | relative_url }}).

1. TOC
{:toc}

---

## How it works together with the LLM

folio-assistant gives an LLM agent a structured way to do real authoring work.
Five concepts compose:

```mermaid
flowchart TD
    LLM[LLM agent] -->|skill_list / skill_fetch| Skill[Skill<br/>schema-bounded unit of work]
    Skill --> Pkg[Skill package<br/>groups skills + Docker deps]
    Skill --> Schema[JSON Schema<br/>typed input/output]
    LLM --> Role[Role / actor<br/>who the agent acts as]
    Role -->|RBAC| Cap[Capabilities<br/>what the environment can do]
    Role --> Stage[Lifecycle stage<br/>plan→author→…→retire]
    Cap --> Req[Requirements<br/>gates that must hold]
```

1. **Skill** — a documented, schema-bounded unit of work (e.g.
   `lean-formalization`). The agent discovers skills with the `skill_list` MCP
   tool and loads a skill's instructions with `skill_fetch`. Each skill has a
   typed [input/output contract]({{ '/reference/skills/' | relative_url }}).
2. **Skill package** — a group of related skills that also declares its
   Docker/runtime dependencies (`package-manifest.json`).
3. **Role (actor)** — *who* the agent is acting as. An **actor** takes on a
   **role** because of the BPMN lane it acts in. What the actor may **do** is a
   W3C ODRL policy in `policies/`, not a property of the role. Before every task
   the executor checks authentication, role assignment, policy and content
   access ([`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }}));
   the HTTP routes ask the same policies through `src/core/rbac.ts`.
4. **Capability** — a concrete environment ability (e.g. `latex-compiler`,
   `lean-toolchain`). Skills require capabilities; `check_dependencies` probes
   them.
5. **Requirement** — a gate that must hold (e.g. `commit-hygiene`,
   `lean-verification`) before/while a stage proceeds.

The loop, in practice: the agent primes the work-plan (`work_plan_prime`),
checks it has the capabilities it needs (`check_dependencies`), lists and loads
the right skill (`skill_list` → `skill_fetch`), does the work as the user's role
(subject to RBAC), and validates/builds/publishes through the content adapter's
tools.

---

## Skills

### Where skills live (and their status)

A skill is defined across a few layers — not a single file. For any skill:

| Layer | Location |
|-------|----------|
| **Definition** (roles, required capabilities, requirements, routing patterns, lifecycle stages, schema ref) | `skills/skill-definitions/<skill>.json` |
| **Typed contract** (input/output JSON Schema) | `schemas/skills/<skill>/` — see the [reference]({{ site.baseurl }}/reference/skills/) |
| **Instruction body** (prose how-to the LLM loads, served by `skill_fetch`) — browse them in the [Skill instructions]({{ site.baseurl }}/reference/skill-instructions/) reference | `skills/<topic>/<package>/*.md`, `sdlc/skills/<package>/*.md`, `work-plan/skills/work-plan/*.md` |
| **Package** (Docker/runtime deps) | `package-manifest.json` beside the package's instruction bodies |

### Cross-cutting: `content-lifecycle`

The lifecycle stages the harness's own processes call, for **every** content type:

| Skill | Stage | Purpose |
|-------|-------|---------|
| [`content-validate`]({{ site.baseurl }}/reference/skills/content-validate.html) | validate | Check schema + constraints |
| [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) | review | Formal review & approval |
| [`content-test`]({{ site.baseurl }}/reference/skills/content-test.html) | test | End-to-end QA / build green |
| [`content-feedback`]({{ site.baseurl }}/reference/skills/content-feedback.html) | feedback | Collect & triage feedback |

Planning, authoring, publication and retirement are operational, so the content layer above this one supplies them.

### Documents & policy guidance: `folio-document-adapter`

| Skill | Purpose |
|-------|---------|
| [`document-authoring`]({{ site.baseurl }}/reference/skill-instructions/document-authoring.html) | Create and revise blocks in a prose folio |
| [`document-structure`]({{ site.baseurl }}/reference/skill-instructions/document-structure.html) | Chapters and sections — add, remove, reorder |
| [`normative-statements`]({{ site.baseurl }}/reference/skill-instructions/normative-statements.html) | Carry a recommendation, requirement or rule |
| [`document-publishing`]({{ site.baseurl }}/reference/skill-instructions/document-publishing.html) | Markdown → HTML / PDF, no TeX |

### Papers & books: `authoring-math`

| Skill | Purpose |
|-------|---------|
| [`lean-formalization`]({{ site.baseurl }}/reference/skill-instructions/lean-formalization.html) | Formalize statements/proofs in Lean 4 |
| [`latex-authoring`]({{ site.baseurl }}/reference/skill-instructions/latex-authoring.html) | Author LaTeX documents |
| [`proof-verification`]({{ site.baseurl }}/reference/skill-instructions/proof-verification.html) | Verify proofs, audit `sorry`/axioms |
| `scientific-visualization` | Figures & diagrams |
| `hypothesis-generation` | Propose conjectures / directions |
| `scientific-critical-thinking` | Adversarial review of arguments |

### WHO SMART Guidelines: `authoring-who-smart-guidelines`

| Skill | Purpose |
|-------|---------|
| [`l2-dak-authoring`]({{ site.baseurl }}/reference/skill-instructions/l2-dak-authoring.html) | L2 DAK artifacts (data dictionary, etc.) |
| [`l3-fhir-authoring`]({{ site.baseurl }}/reference/skill-instructions/l3-fhir-authoring.html) | L3 FHIR resources via FSH |
| [`bpmn-authoring`]({{ site.baseurl }}/reference/skills/bpmn-authoring.html) | BPMN 2.0 business processes |
| [`dmn-authoring`]({{ site.baseurl }}/reference/skills/dmn-authoring.html) | DMN decision tables |
| [`terminology-management`]({{ site.baseurl }}/reference/skill-instructions/terminology-management.html) | Code systems / value sets |
| [`fhir-validation`]({{ site.baseurl }}/reference/skill-instructions/fhir-validation.html) | Validate against FHIR profiles |
| [`ig-publication`]({{ site.baseurl }}/reference/skill-instructions/ig-publication.html) | Build & publish the IG |
| [`quality-control`]({{ site.baseurl }}/reference/skill-instructions/quality-control.html) | QA gates |

### Agent/platform skills

Skills the LLM uses to work effectively in the repo (loaded via `skill_fetch`):

| Skill | Package | Purpose |
|-------|---------|---------|
| `corpus-grep` | `kg-core` | Search across the content corpus |
| `editor`, `readability-editing`, `todo-review` | `authoring-core` | Editing and review of prose |
| `symbiotic-interaction` | `conduct-core` | Reading the register of author input |
| `deployment-auth` | `folio-core` | Deployment authentication |

A paper folio wants the `folio-document-adapter` skills too: a paper *is* a
document plus Lean-bearing blocks, so `document-structure` and
`document-publishing` apply to both. The two bundles are halves of one content
model, not alternatives to choose between.

### Coordination skills (`sdlc-core`, `work-plan`)

| Skill | Purpose |
|-------|---------|
| `prepare-merge` | Take a branch to clean/green/mergeable (see also `watch`) |
| `bean-coordination` | Multi-agent claim/coordination discipline |
| `todo-manager` | beans-as-todos discipline |

### Platform skill bundles (`skills/tools/folio-core`, the content core's `skills/content/folio-document-adapter`, the science layer's `skills/content/folio-paper-adapter`)

Larger **platform bundles**, content-agnostic and meant to be synced into any
folio:

| Bundle | Skills | Scope |
|--------|-------:|-------|
| **`folio-core`** | 7 | The tool surface: MCP assembly, contract and projection, skills-and-tools, tool authoring, tool coverage, deployment auth — applies to *any* content type. |
| **`folio-document-adapter`** | 4 | Prose folios: block authoring, chapter/section structure, normative statements, and the TeX-free publication path. Applies to papers too. |
| **`folio-paper-adapter`** | 40 | Formal-math paper-adapter (any Lean 4 + LaTeX paper): Lean workflow, proof tooling, content-object validation, LaTeX, paper structure, import, simulators. |

Each bundle ships a `package-manifest.json`.

> Skill **schemas** are generated into the
> [Skill schema reference]({{ '/reference/skills/' | relative_url }}), so they
> never drift from what the framework validates.

---

## Roles (actors)

Roles answer *who the agent is acting as*. The current user is mapped to a role
by `role-assignments.json`, and the role's capabilities bound what the agent may
do (RBAC). Roles **inherit** (e.g. `author` inherits `reviewer`).

> To see these roles *as lanes* — who edits, who reviews, who signs off, and
> which steps an agent may take on its own — read
> [Publication workflow → Who is who](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html#who-is-who).

```mermaid
flowchart LR
    viewer --> reviewer --> author --> admin
```

### People

| Role | What they can do |
|------|------------------|
| `viewer` | Base read-only. View content, no changes. |
| `reviewer` | View + review comments; no direct changes. |
| `author` | Create/modify content (inherits reviewer). |
| `admin` | Full administrative access — roles, settings, all content. |
| `programme-manager` | Scope, team formation, timeline, stakeholder governance. |
| `technical-officer` | Programme-area coordinator + first-pass reviewer. |
| `business-analyst` | L2 DAK author (BPMN, data dictionaries, decision logic, indicators). |
| `clinical-sme` | Clinical validator / ground-truth provider. |
| `terminologist` | Terminology governance (ICD-11, SNOMED CT, LOINC). |
| `fhir-modeller` | L3 FHIR artifacts (FSH, SUSHI, CQL, IG Publisher). |
| `content-reviewer` | Formal approval / phase-transition sign-off. |
| `qc-reviewer` | Publication-readiness QA across layers. |
| `publication-manager` | Releases, IG config, builds, versioning, publication. |
| `translator` | Localization for UN-supported languages. |

### System actors

| Actor | Provides | Cannot |
|-------|----------|--------|
| `authoring-agent` | Drafts and revises a **proposed** change to a content block | Commit — its output goes to the editor through the validation gate |
| `review-agent` | Non-mechanical validation: accuracy, voice, exposition | Approve — it reports findings only |
| `lean-mcp` | Lean 4 proof checking & diagnostics via MCP | — |
| `ig-publisher-service` | FHIR IG Publisher build & QA reporting | — |

Where each of these sits in the process — and what an agent may and may not
decide — is modelled in the
[publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) BPMN diagrams.

### Role assignment

`role-assignments.json` maps a user identity (from git config / auth) to a role
by priority. The shipped defaults:

| Pattern | Source | Role | Priority |
|---------|--------|------|----------|
| `litlfred@gmail.com` | git-config | `admin` | 100 |
| `*@who.int` | git-config | `author` | 50 |
| `*` | default | `viewer` | 0 |

---

## Capabilities & requirements

**Capabilities** are concrete environment abilities a skill may require; the
`check_dependencies` MCP tool probes them:

`bun-runtime` · `node-runtime` · `python3` · `git-push` · `docker` ·
`latex-compiler` · `lean-toolchain` · `lean-mcp` · `ig-publisher` ·
`sushi-compiler` · `java-runtime` · `jekyll` · `plantuml` · `graphviz`

**Requirements** are gates that must hold during work:

`commit-hygiene` · `lean-verification` · `fhir-validation` ·
`content-lifecycle` · `session-start`

---

## See also

- [Publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) — BPMN swimlanes: which skill runs at which step, and who decides
- [Skill instructions]({{ '/reference/skill-instructions/' | relative_url }}) — the prose how-to bodies the LLM loads
- [Skill schema reference]({{ '/reference/skills/' | relative_url }}) — typed input/output for each skill
- [Content types](content-types.html) — which skills each content type uses
- [Architecture](architecture.html) — RBAC, adapters, and the MCP server
- [Getting started](../start/getting-started.html) — running your first skill

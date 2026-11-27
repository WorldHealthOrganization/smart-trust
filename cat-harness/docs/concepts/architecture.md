---
layout: default
title: Architecture
nav_order: 9
has_children: true
lang: en
supported_locales: ["ar", "zh", "en", "fr", "ru", "es"]
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Architecture
{: .no_toc }

1. TOC
{:toc}

---

## Overview

> **The rules behind this page.** Architecture describes the shape; the Skills
> govern the decisions. Adapters against profiles —
> [`content-profiles`]({{ '/reference/skill-instructions/content-profiles.html' | relative_url }}).
> Where a new node belongs before you create it —
> [`placement`]({{ '/reference/skill-instructions/placement.html' | relative_url }}). The repository
> layout and every graph typology —
> [`directory-conventions`]({{ '/reference/skill-instructions/directory-conventions.html' | relative_url }}).
> Composing and verifying the MCP surface —
> [`mcp-assembly`]({{ '/reference/skill-instructions/mcp-assembly.html' | relative_url }}) and
> [`mcp-contract`]({{ '/reference/skill-instructions/mcp-contract.html' | relative_url }}).
> Where this page and a Skill disagree, the Skill wins.

folio-assistant is an **MCP server** with a pluggable **content adapter** layer,
a **skill** system, a typed **content-object model**, **RBAC**, and a deploy
story. The content it operates on lives in a *separate* repository — the
platform is content-agnostic.

```mermaid
flowchart TD
    subgraph Harness[LLM harness · Claude Code / Antigravity / Gemini]
      LLM[Agent]
    end
    LLM <-->|MCP stdio/http| Server[FolioServer · src/server.ts]
    Server --> Tools[Core tools<br/>check-deps · skill-fetch · preview · preferences · work_plan_prime]
    Server --> Adapter{Content adapter}
    Adapter --> Paper[paper adapter<br/>lean · validate · render]
    Adapter --> Future[other adapters …]
    Server --> RBAC[Access · src/core/rbac.ts + access.ts → ODRL policies/]
    Server --> Git[Git helper · src/core/git.ts]
    Server --> Feedback[Feedback store · src/core/feedback.ts]
    Tools --> Skills[Skill packages<br/>schemas/skills/*]
    Paper --> Model[Content-object model<br/>schemas/types.ts · constraints.ts · builders.ts]
```

## Separation of concerns — current and future state

The split of the platform into composable layers is described by the child
pages:

| page | what it answers |
|---|---|
| [Repo taxonomy](architecture/repo-taxonomy.html) | What kinds of repository exist — Tool, Test, Content, Consumer — and what each may contain |
| [Current state](architecture/current-state.html) | What is actually in this repo today, measured, and where the mixture is |
| [Future state](architecture/future-state.html) | The five target repos and which directory lands in which |
| [Migration plan](architecture/migration-plan.html) | Phase 0/I/II/III, the gates, and what is still undecided |
| [Minimum `cat-harness`](architecture/cat-harness-minimum.html) | What survives in the harness once "renders no content type" is applied as a test |
| [Harness layers](architecture/harness-instances.html) | What a layer IS — schematics, visualisations, tools; the four directories; the default rendering |

The minimum says a harness produces nothing a human looks at, and the layer
page says a layer renders by default; both hold because the rendering
requirement is a **floor that rises**: `bootstrap` is exempt
from the visualiser and owes its own `.json`/`.jsonld` instead, and
`cat-harness` is the layer where the rest applies — see
[Where the requirement starts](architecture/harness-instances.html#where-the-requirement-starts--bootstrap-is-the-exception).

The rest of this page describes the architecture **as it is now**.

## Repository layout

The authoritative list is `cat-harness.json`: every directory this layer
declares, with the kind of graph it holds. The ones a reader looks for first:

| Path | What lives here |
|------|-----------------|
| `skills/` | The knowledge graph: skill packages (`skills/<area>/<package>/`, each with a `package-manifest.json`), roles, permissions and requirements |
| `processes/` | Executable BPMN processes and the DMN tables their gateways compute from |
| `schemas/` | Per-skill JSON Schemas (`schemas/skills/`) and the schema documents the harness declares |
| `tools/` | Tool definitions, one `tools/<id>/<id>.json` per tool |
| `policies/` | What an actor may do, as W3C ODRL 2.2 policies |
| `sdlc/`, `work-plan/` | The software-delivery and work-plan sub-graphs |
| `library/`, `uploads/` | Ingested L1 source content, and the queue it is ingested from |
| `docs/` | This documentation site |
| `.github/` | CI workflows |

The server code, adapters and scripts named on this page (`src/`, `adapters/`,
`scripts/`, `deploy/`) are not in this layer; they ship with the tools layer.

## The MCP server

`FolioServer` (`src/server.ts`) registers the core tools, then asks the active
**content adapter** to register its tools. It supports two transports — `--stdio`
(what harnesses launch) and `--http` (a shared long-running instance). Tool calls
are logged with timing.

## Content adapters

A content adapter encapsulates everything type-specific: which artifacts exist,
how to validate them, how to build/render them, and which extra MCP tools to
register. The `document` adapter (`adapters/document/`) is the base for prose
folios; the `paper` adapter (`adapters/paper/`) extends it and provides Lean lifecycle tools
(`lean_setup`/`build`/`check`/`status`), validation, and rendering
(`paper_render_pdf`/`html`, `formula_render`). New content types add a new
adapter — see [Adding a content type](../guides/new-content-type.html).

## Skills and skill packages

A **skill** is a documented, schema-bounded unit of work (e.g.
`lean-formalization`). Skills are grouped into **packages** that declare their
Docker/runtime dependencies via a `package-manifest.json`. The LLM discovers
skills with `skill_list` and loads instructions with `skill_fetch`. The full
list of skills and roles — and how they compose with the LLM (RBAC, capabilities,
requirements) — is on the [Skills & roles](skills.html) page; each skill's
input/output contract is published in the
[Skill schema reference]({{ '/reference/skills/' | relative_url }}).

## The content-object model

For papers, content is a tree of typed **blocks** validated at runtime with Zod:

- `schemas/types.ts` — `Block`, `Section`, `Chapter`, `Paper`, and block kinds
- `schemas/constraints.ts` — Zod schemas and constraint rules
- `schemas/builders.ts` — validated constructors (`definition()`, `theorem()`, …)

These are documented in the generated [TypeScript API reference]({{ '/api/' | relative_url }}).

## Access control — ODRL, checked before every task

There is one permission system, and it is W3C ODRL 2.2: actions
in `skills/permissions/permissions.json`, grants in `policies/*.jsonld`,
evaluated by `permits()` / `decide()` in `schemas/odrl.ts`. Two callers ask it:

- **The BPMN executor**, before every task and decision
  (`src/workflow/authorize.ts`): is the actor authenticated, eligible for the
  lane's role, permitted to `perform-task` here, and allowed to touch the
  content? Advisory today: a `deny` or a role mismatch refuses, and `unknown`
  is recorded.
- **The HTTP routes**, through `src/core/rbac.ts`: each route names the action
  it performs (`content-authoring`, `review-comments`, `adjudication`), and the
  auth-gateway's sessions are declared actors whose grants are
  `policies/http-gateway.jsonld`. Here `unknown` refuses.

The discipline is the
[`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }})
skill.

## Work-plan priming (cross-harness)

The work-plan is stored in `beans` and surfaced three ways so any harness is
primed identically:

1. **`AGENTS.md`** — static discipline, read natively by every agent.
2. **`SessionStart` hook** — each harness runs the shared
   `scripts/session-start-coord-sweep.sh` primer.
3. **`work_plan_prime` MCP tool** — live priming for any MCP-connected agent.

See `docs/folio-assistant-migration.md` for the full cross-agent design.

## Deployment

`deploy/` (tools layer) contains a Caddy reverse-proxy template, `docker-compose.yml`, a
provisioning script, Google OAuth setup, and a self-update script for running a
shared HTTP instance. The skill-package Docker manifests aggregate apt/pip/npm
dependencies into a single image per active package set.

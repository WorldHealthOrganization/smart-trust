---
layout: default
title: Adding a new content type
parent: Authoring guides
nav_order: 4
---

# Adding a new content type
{: .no_toc }

folio-assistant is content-agnostic by design. A new content type ("others" in
the supported-types list) is added by providing two things — a **content
adapter** and a **skill package** — after which the lifecycle, RBAC, MCP
transport, and work-plan plumbing all apply for free.

1. TOC
{:toc}

---

## What you provide

```mermaid
flowchart LR
    New[New content type] --> A[Content adapter<br/>adapters/your-type/]
    New --> P[Skill package<br/>skills/authoring-your-type/]
    A --> Server[FolioServer registers adapter tools]
    P --> Schemas[schemas/skills/your-skill/*]
    P --> Manifest[package-manifest.json · Docker deps]
```

## Before you add one: could it be a *profile* instead?

Two content types that share a content model and differ only in which block
kinds they admit do **not** need two adapters. `document` and `paper` are one
adapter with two *profiles* — nested restrictions of one vocabulary — and the
`paper` adapter is a fifty-line subclass of the `document` one.

The test is whether the new type needs different *code* (a different resolver,
different tools, a different render path) or only different *rules* about what
its blocks may be. If it is only rules, add a profile in
`schemas/block-kinds.ts` and a subclass, because then there is one
implementation to keep correct rather than two.

Adapters are for genuinely disjoint namespaces — `paper` and `dak` share no
block kind at all.

## 1. The content adapter

Model the `document` adapter (`adapters/document/`), which is the base for
prose folios, or `paper` (`adapters/paper/`) for how a specialization extends
one. An adapter:

- implements the content-adapter interface the `FolioServer` expects (list /
  validate / build, plus any type-specific tools);
- registers its MCP tools via `server.tool(...)` (e.g. the paper adapter adds
  `paper_render_pdf`, `lean_build`, …);
- resolves paths in the *content* repo, not in folio-assistant.

Wire it up by selecting it through the folio config:

```json
{
  "contentType": "your-type",
  "adapter": "your-type",
  "adapterModule": "./adapters/your-type/index.ts"
}
```

## 2. The skill package

Create `skills/<topic>/authoring-your-type/package-manifest.json` declaring the skills
and the Docker/runtime dependencies (apt/pip/npm, setup commands, env). Follow
the existing manifests (`authoring-math`, `authoring-who-smart-guidelines`):

```json
{
  "name": "authoring-your-type",
  "version": "0.1.0",
  "description": "…",
  "skills": ["your-authoring", "your-validation"],
  "docker": { "baseImage": "ubuntu:24.04", "aptPackages": ["…"] },
  "providesCapabilities": ["…"],
  "lifecycleStages": ["plan", "author", "validate", "review", "test", "publish"]
}
```

## 3. The skill schemas

For each skill, add `schemas/skills/<skill>/input.schema.json` and
`output.schema.json` (JSON Schema draft-07), and name them in the skill's own
front matter (`input: schemas/skills/<skill>/input.schema.json`, `output: …`).
These are the typed contract the LLM works against; a contract no skill names is
reported as unclaimed. Then regenerate the reference:

```sh
bun run cat-harness-tools/scripts/gen-schema-docs.ts
```

Your skill pages appear automatically in the
[Skill schema reference]({{ '/reference/skills/' | relative_url }}).

## 4. Reuse the lifecycle

You do **not** re-implement plan/author/validate/review/test/publish — the
cross-cutting `content-lifecycle` package already provides those stages. Your
package only adds the *authoring* skills unique to the type.

## Checklist

- [ ] Considered a *profile* first — a subclass plus a kind list, not a new adapter
- [ ] Adapter under `adapters/<type>/` implementing list/validate/build + tools
- [ ] `<name>.config.json` points at the adapter
- [ ] Skill package + `package-manifest.json` with Docker deps
- [ ] JSON Schemas under `schemas/skills/<skill>/`
- [ ] `bun run cat-harness-tools/scripts/gen-schema-docs.ts` regenerated
- [ ] Capabilities probed by `check_dependencies`
- [ ] Tests (`bun test`) and lint (`bun run cat lint`) green

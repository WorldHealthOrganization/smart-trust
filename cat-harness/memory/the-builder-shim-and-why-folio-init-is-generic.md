---
$schema: folio-memory/v1
id: the-builder-shim-and-why-folio-init-is-generic
label: stable
summary: "the builder shim, and why `folio_init` is generic"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`bun run cat init-folio` / the `folio_init` MCP tool writes a folio's `content/`,
`uploads/`, `library/`, manifests, `<name>.config.json`, the root
`index.config.json` that instantiates it (skill `index-config`), the `content/schema/`
builder shim, `AGENTS.md` + `CLAUDE.md`/`GEMINI.md` stubs, `.mcp.json`, the
session-start hook and the work items store.

- **The builder shim exists so the path to folio-assistant is written down
  once**: block manifests import `../schema/builders`, never the platform
  directly, so re-linking is a two-file edit rather than a corpus sweep.
- **`folio_init` is registered among the generic tools**, not in an adapter,
  because it runs *before* the folio has a content type. A bare repo falls
  back to the paper adapter, so an adapter-scoped tool would be unreachable
  in exactly the case it exists for.

---
name: folio-init
description: >
  Scaffold a new folio layer from the harness — the instantiate affordance
  of the knowledge graph. Covers when to run folio-init vs remote-mount, what
  the scaffold writes, the builder shim, state branch seeding, write capability
  requirements, and --dry-run degradation.
adapters: [document, paper, dak]
profiles: [document, paper]
tested-by:
  - schemas/kg-affordances.test.ts
---

# Instantiate a folio — `folio-init`

`folio-init` is the **`instantiate`** affordance of the knowledge graph
([`kg-affordances`](kg-affordances.md)): standing up a new folio repository or
adding a folio layer so an author has a conformant workspace (`folio/`,
`uploads/`, `library/`, declarations, agent instructions, and work-plan state
branches) linked back to the harness.

| | where |
|---|---|
| the Tool node | [`tools/folio-init/folio-init.json`](../../../tools/folio-init/folio-init.json) (`id: "folio-init"`, MCP `folio_init`, CLI `bun run cat init-folio`) |
| the entry processes | `getting-started.bpmn` (`new-repo` and `add-folio` branches), `repo-conversion.bpmn` (`overlay` branch) |
| companion skills | [`getting-started`](../../conduct/conduct-core/getting-started.md), [`repo-conversion`](../../conduct/conduct-core/repo-conversion.md), [`index-config`](index-config.md), [`remote-mount`](remote-mount.md) |

## When to use `folio-init`

Reach for `folio-init` when triage in [`getting-started`](../../conduct/conduct-core/getting-started.md)
or [`repo-conversion`](../../conduct/conduct-core/repo-conversion.md) has
settled that a **new folio structure** should be created:

- **`new-repo`** — a brand-new repository is being stood up to author a paper,
  document or DAK folio.
- **`add-folio`** — an existing repository wants a new folio added alongside its
  existing directories (`overlay`), without overwriting its tracked files.

Do **not** run `folio-init` when:

- The repository already has a `<name>.json` declaration and only needs a lower
  harness layer brought in at a pinned SHA — that is **`materialise`**, served
  by [`remote-mount`](remote-mount.md) (`bun run cat mount:remote`).
- The user is converting existing prose in place (`convert` in
  `repo-conversion.bpmn`) — that uses ingestion, not a blank scaffold.

Because `folio-init` runs *before* the target repository has a content type, the
Tool is registered among the generic harness tools rather than inside a
content-type adapter.

## Write capability requirement and read-only degradation

`folio-init` is a **writing verb**: it creates directories, writes manifests and
agent stubs, and (when git is available) prints the command that seeds the
`cat/<instance>/beans` and `cat/<instance>/todos` orphan state branches.

Before invoking `folio-init` to write, check that at least one write capability
is present (`scenarios/capabilities/`):

- **`git-push`** — local filesystem write plus git remote push capability for
  the target repository and its state branches.
- **`github-api`** — GitHub API token (`gh` / REST / GraphQL) able to create or
  populate the target repository and refs.
- **`github-connector`** — MCP GitHub connector able to push the scaffolded
  files into the target repository.

**When no write capability is available** (a read-only container or an
unauthenticated session), `folio-init` degrades cleanly via **`--dry-run`**
(`dry_run: true` on the MCP tool): it computes and returns the complete Markdown
report of every directory, manifest, builder shim and config file it *would*
write, without touching the filesystem or git refs. Never attempt a partial
write when write capability is absent, and never report a failed capability
probe as a completed scaffold.

## What `folio-init` writes

Given `title` and one or more `authors` (plus optional `content_type`, `slug`,
`dir`, `link`, `assistant_path`, `force`, `dry_run`), `folio-init` lays down:

1. **The folio directories and initial manifests** — `folio/` (or `content/`),
   `uploads/`, `library/`, the root `<slug>.json` layer declaration and
   `<slug>.config.json`, and the root `index.config.json` that instantiates it
   ([`index-config`](index-config.md)).
2. **The builder shim (`content/schema/builders`)** — block manifests in the
   folio import `../schema/builders` rather than importing the platform path
   directly. Writing the path to the harness once in the shim means re-linking
   a folio (`submodule` ↔ `sibling` ↔ remote mount) is a two-file edit rather
   than a sweep across every block manifest.
3. **The link back to the platform (`--link`)** — links the harness via
   `sibling` (`--assistant-path ../folio-assistant`) or `submodule`, and writes
   `.mcp.json` and the `.claude/` session-start hook (`bun run cat state:mount`)
   pointing at that link.
4. **The agent instructions** — `AGENTS.md` and the one-line `CLAUDE.md` and
   `GEMINI.md` stubs pointing to it.
5. **The work-plan state branches** — declares `beans` and `todos` on the
   `cat/<slug>/beans` and `cat/<slug>/todos` branches and prints the seed
   command; once it has been run, `bun run cat state:mount` mounts a working
   store on the first session start
   ([`directory-conventions`](directory-conventions.md) §"Where a NEW
   layer's state lives").

## What to check afterwards

- `bun run cat check:declaration-resolution` — every directory and asset the new
  `<slug>.json` declares resolves on disk.
- `bun run cat index:render:check` — the generated `AGENTS.md` matches the
  new `index.config.json` and layer declaration.
- `bun run cat state:status` — the `beans` and `todos` stores are mounted and
  writable.

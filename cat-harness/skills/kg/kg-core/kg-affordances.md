---
name: kg-affordances
description: >
  The four affordances of a conformant knowledge graph — browse, materialise,
  instantiate and copy-into-folio — which capabilities each requires, how each
  writing verb degrades cleanly when no write capability is available, and how
  copying an asset stamps KgAsset.source provenance.
adapters: [document, paper, dak]
profiles: [document, paper]
tested-by:
  - schemas/kg-affordances.test.ts
---

# Knowledge graph affordances — browse, materialise, instantiate, copy-into-folio

A person or an agent arriving at any conformant layer has **four verbs**
available on what they find:

1. **`browse`** — explore the graph, its subgraphs, its skills, its processes,
   its schemas and its assets without mutating anything.
2. **`materialise`** — pull a remote harness closure or a subscribed subgraph
   onto local disk at a pinned commit or recorded digest.
3. **`instantiate`** — scaffold a new folio or harnessed repository from the
   harness so it can author and publish its own graphs.
4. **`copy-into-folio`** — take a node or asset from a knowledge graph into
   your own folio (`assets[]` or `folio/`), stamp `KgAsset.source` provenance,
   and edit, comment or raise todos on your copy.

## The four verbs and their capability floor

Three of the four verbs **write**, and an agent in a read-only container, a
viewer on a static site, or a session without repository credentials cannot
perform a write. Each verb therefore declares its capability requirement up
front and **degrades cleanly** rather than failing halfway through a procedure.

| verb | write capability required | process | governing skills | Tools | read-only degradation |
|---|---|---|---|---|---|
| **`browse`** | **none** (`git-read` or published HTTP/files only) | — (stateless read) | [`kg-navigation`](../kg-navigation/kg-navigation.md), [`directory-conventions`](directory-conventions.md) | `skill-list`, `skill-fetch`, `search-graph`, `get-neighbors`, `kg-graph-export` | *none needed* — `browse` is the read-only floor and must remain completely useful with zero write capabilities |
| **`materialise`** | one of `git-push`, `github-api`, `github-connector` (to persist lock/record changes; local worktree write for `--staging`) | [`mount-dependency.bpmn`](../../../processes/kg/mount-dependency.bpmn), [`materialize-remote.bpmn`](../../../library/processes/materialize-remote.bpmn) | [`remote-mount`](remote-mount.md), [`materialize-remote`](../../../library/skills/large-datasets/materialize-remote.md), [`kg-subscription`](../../../library/skills/large-datasets/kg-subscription.md) | `remote-mount` (`mount:remote`), `mount-from-lock`, `kg-retrieve-npm` | run `bun run cat mount:remote --plan` or `mount:remote:check` to inspect the resolved closure and digests without writing |
| **`instantiate`** | one of `git-push`, `github-api`, `github-connector` | `getting-started.bpmn`, `repo-conversion.bpmn` | [`folio-init`](folio-init.md), [`getting-started`](../../conduct/conduct-core/getting-started.md), [`repo-conversion`](../../conduct/conduct-core/repo-conversion.md) | `folio-init` (`folio_init` / `bun run cat init-folio`) | run `folio-init` with `--dry-run` (`dry_run: true`) to emit the full manifest and file plan as Markdown without touching disk or remote refs |
| **`copy-into-folio`** | one of `git-push`, `github-api`, `github-connector` | [`copy-into-folio.bpmn`](../../../processes/kg/copy-into-folio.bpmn) (for KG assets); [`copy-out-materialized.bpmn`](../../../library/processes/copy-out-materialized.bpmn) (for materialized library items) | `kg-affordances`, [`copy-out-materialized`](../../../library/skills/large-datasets/copy-out-materialized.md), [`directory-conventions`](directory-conventions.md) | `declaration-resolution` (`check:declared-assets`), `witness-conformance` | inspect the upstream asset in place via `browse`, and emit the target `KgAsset` declaration snippet (with `source` pre-filled) so the user can apply it where they have write access |

## Why `browse` requires zero write capability

`browse` is the **read-only floor** of every conformant knowledge graph:

- On a published site (`gh-pages` or a CDN), `browse` reads the exported JSON-LD
  graph (`kg.jsonld`), the per-subgraph visualisers, and the rendered BPMN/DMN
  surfaces over plain HTTP.
- In a checkout with an MCP server attached, `browse` uses `skill-list`,
  `skill-fetch`, `search-graph` and `get-neighbors`.
- In a bare filesystem checkout with no server and no network, `browse` reads
  `<name>.json` at the layer root, resolves `directories[]` and `assets[]`,
  and reads the files directly ([`kg-navigation`](../kg-navigation/kg-navigation.md)).

No step of `browse` may require `git-push`, `github-api` or `github-connector`.
If a browse tool or visualiser refuses to run because write credentials are
absent, that is a defect in the tool.

## Checking write capability before a writing verb

Before starting `materialise`, `instantiate` or `copy-into-folio`, determine
which write capability the current environment holds (`scenarios/capabilities/`):

1. **`git-push`** — a working tree with push access to the target repository's
   remote (`git push --dry-run` succeeds).
2. **`github-api`** — a `GH_TOKEN` / `GITHUB_TOKEN` or `gh auth status` capable
   of creating commits, branches or pull requests via the GitHub API.
3. **`github-connector`** — an MCP GitHub connector (`push_files`,
   `create_or_update_file`, `create_pull_request`) attached to the session.

The three states of the capability check are kept distinct:

- **Available** (`git-push`, `github-api`, or `github-connector` present):
  proceed with the writing verb using the corresponding tool path.
- **Absent** (probed and none of the three is present): take the **read-only
  degradation** branch (`--plan`, `--dry-run`, or in-place inspection plus an
  exportable snippet). Never silently drop the provenance or leave a half-written
  tree.
- **Could not determine** (the probe itself failed for an environmental reason,
  such as an unreachable host): report `could-not-determine` with the probe
  error; do not report the capability as absent and do not attempt a blind write.

## `copy-into-folio` and `KgAsset.source` provenance

When a folio owner or authoring agent copies an asset from an upstream knowledge
graph into their own folio to adapt it, comment on it or raise todos against it,
the process is [`copy-into-folio.bpmn`](../../../processes/kg/copy-into-folio.bpmn).

Like [`copy-out-materialized`](../../../library/skills/large-datasets/copy-out-materialized.md),
copying a knowledge-graph asset into a folio is **two writes and a refusal**:

1. **Never touch the source graph.** The upstream layer is read-only from the
   copier's point of view; the arrow runs out of the source lane and never back.
2. **Copy the bytes and declare the asset in the target folio's `<name>.json`
   `assets[]`.** A file copied into an undeclared scratch path is invisible to
   `check:declared-assets` and to the folio's visualisers.
3. **Stamp `KgAsset.source` (`AssetSourceSchema` in `schemas/kg/kg-node.ts`)** on
   the target folio's `KgAsset` entry:

```json
{
  "id": "adapted-guideline-table",
  "src": "assets/adapted-guideline-table.json",
  "role": "guideline-table",
  "source": {
    "instance": "litlfred/example-ig",
    "path": "assets/guideline-table.json",
    "ref": "0123456789abcdef0123456789abcdef01234567"
  }
}
```

### The three states of `KgAsset.source`

`KgAsset.source` (`{ instance, path, ref? }`) is how the graph tells a copy
from original work:

| `source` state | meaning |
|---|---|
| **present, and `ref` matches upstream** | copied from `instance` at `path` and current with that upstream commit |
| **present, and `ref` differs or is omitted** | copied from `instance` at `path`, either adapted locally since `ref` or taken without a commit pin (staleness is checkable only when `ref` is recorded) |
| **absent (`undefined`)** | **authored in this layer** — a third state, never "copied from an unknown place" |

A copied asset MUST carry `source`: without it the copy is indistinguishable
from locally authored work, and nothing downstream can reconstruct which
layer it came from.

### Working on the copy in the target folio

Once the asset is declared in the target folio with `KgAsset.source` stamped and
verified by `bun run cat check:declaration-resolution` (`check:declared-assets`),
it is ordinary writable content of the target folio. The folio owner can edit it
in place, attach review comments, or raise todos (`todo-manager`) against it
without disturbing the upstream knowledge graph.

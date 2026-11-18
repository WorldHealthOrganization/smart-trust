---
name: work-plan-store-git-branch
description: >
  How the git state branch Tool performs the work-plan store's operations:
  the branch per graph, the mount at beans/, which command does get, list,
  create, update, note, history and positions, and how it keeps the race
  guarantee by fetching, rebuilding on the tip and pushing, never forcing.
  Read this only when the deployment's work-plan Tool is the git branch.
graph-typologies:
  - beans
---

# The work plan on a git state branch

This is **one Tool** for the [`work-plan-store`](work-plan-store.md)
contract, the one every checkout uses today. A process or skill names the
contract's operation; this page says how this Tool performs it. Another Tool
(a work items server, an MCP service, a run-scoped store) has its own page and
keeps the same contract.

## Where the beans are

The work plan does not live on `main`. It lives on a branch per graph,
`cat/<harness>/beans` (for this harness `cat/cat-harness/beans`), declared by
the `beans` entry's `source` in `cat-harness.json`. It is mounted at `beans/` when a session starts:

```sh
bun run cat state:mount
```

`beans/beans.json` declares the parts: `defs/` (work items), `defs/archive/`,
`notes/`, `workflows/` (instances), `queue/`, `surveys/`, `marks/`.

## The operations, by this Tool

| Operation | With the `beans` CLI (`beans-cli`) | By hand (`beans-manual`) |
|---|---|---|
| `get(id)` | `beans show <id>` | read `beans/defs/<id>--*.md` (or `defs/archive/`) |
| `list(filter)` | `beans list --status … --type … --tag …`, or `bean-query` | `bun run cat beans:fallback` |
| `create(bean)` | `beans create "<title>" --type … --parent …` after the existence check in [`todo-manager`](todo-manager.md) | write the file with its front matter |
| `update(id, change, ifMatch)` | `beans update <id> …` | edit the front matter |
| `note(id, text)` | `beans update <id> --body-append …`, or a file in `beans/notes/` | append to the body, or add a note file |
| `update(id, { archived: true }, …)` | `beans archive` (the sweep), or move the file | move `defs/<id>--*.md` into `defs/archive/`; the status is kept |
| `history(id)` | `git log --follow -- beans/defs/<id>--*.md` on the branch, merged with the `history` of every instance in `beans/workflows/` that names the work item | the same |
| `positions(id)`, `beansAt(…)` | read `beans/workflows/*.json`: an instance names its work item in `bean` and `carriedBeans`, its position in `tokens` | the same |

Every write is then **pushed to the branch**, never committed to a code PR on
`main`:

```sh
bun run cat state:push
```

## How it keeps the race guarantee

The contract's `ifMatch` is the blob id of the work item file the writer read
(`BranchStore`'s `expect`). A write whose file has changed at the tip since
that read is refused as a conflict, so the caller re-reads and retries. A push
refused only because the tip moved for another file fetches, rebuilds the
change on the new tip and pushes again. It is never forced. Two sessions
writing the same work item both land, and the later one sees the earlier one's
change before it writes. The work-plan store's conformance suite holds this Tool to it.

## Limits

- The `beans` CLI is third-party and absent on a fresh container until
  `cat-harness-tools/scripts/install-beans.sh` has run; `beans-manual` writes the same layout.
- `history` costs one `git log` per work item, and needs the branch's history
  fetched (`--depth` enough to reach the work item's creation).
- `positions` scans every instance file; a store with many instances should
  use a Tool that indexes them.

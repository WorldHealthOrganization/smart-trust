# AGENTS.md — bootstrap-tools

What this toolset *is* is [`README.md`](README.md). Three rules govern work here, and each guards a boundary that is easy to erase by accident.

## 1. Nothing you add here may make `bootstrap` need a tool

Bootstrap promises an agent that it needs nothing installed: *"a file you read, not something you run"*. So the direction is one-way: **bootstrap-tools reads and writes bootstrap; bootstrap never imports from here.** A change that would put an import, a dependency, a `package.json` or a build step into `bootstrap/` is the wrong change: bootstrap does not know Zod at all.

## 2. Nothing here may import above bootstrap

bootstrap-tools depends on bootstrap, on `zod`, on `liquidjs` (the README templates), on `@playwright/test` and `bpmn-js` (to draw a Process), and on the runtime, and on nothing else. `bun run check:closure` fails on any import that leaves this directory or names another package; tests may also use `bun:test` and `ajv`. When you need something from a harness, move the small piece down, or have the harness call this toolset instead.

The outside libraries this toolset imports are recorded, but not here. cat-harness-tools holds them as `software-library` nodes under `libraries/held/bootstrap-tools/`, keyed by `layer: "bootstrap-tools"`, because the kind is cat-harness's and this toolset may not name it. Do not add a `libraries/` here. After a dependency change, the next re-pin of this toolset in cat-harness-tools runs `libraries:derive`.

## 3. A generated schema is a published contract

The JSON Schemas in `bootstrap/schemas/` are generated from `schemas/*.ts` and published at their `$id`. Changing the Zod changes what a third party accepts. Two known traps:

- **`.refine()` exports nothing to JSON Schema.** A rule written only as a refinement vanishes from the published document. Add its JSON Schema form too (`JSON_SCHEMA_CONDITIONALS`), and a test case that fails without it.
- **`z.object()` is strict.** The exporter would add `additionalProperties: false`; the generator strips it. Adopting strictness is a decision, not a side effect.

A published node's identifier must be its file's path under the release address; `bun run check:node-iris` fails otherwise.

After a change here: `bun run schemas`, then `bun test .`. The `--check` twins are in the gate set.

## Running a tool as a process step

Each script is a step an agent can perform in a process lane: the agent runs it, reads its output, and reports. Nothing here requires a CI service. A GitHub Actions workflow may be described, but is not enabled, and nothing runs that is billed, unless the owner asks.

Which lane runs what:

| step | command (from this directory) | lane | fails when |
|---|---|---|---|
| regenerate schemas and the schema page | `bun run schemas` | authoring agent | — (writes) |
| schemas are current | `bun run schemas:check` | build pipeline | a generated file differs from its Zod |
| every file's identifier is its path | `bun run check:node-iris` | build pipeline | an `$id`/`@id` under the release base names another path |
| literal release IRIs at the declared version | `bun run iri:sync:check` | build pipeline | a literal names another version |
| no outside concept in the schemas | `bun run check:concepts` | build pipeline | a forbidden word appears |
| imports stay inside the toolset | `bun run check:closure` | build pipeline | an import leaves or names a package not allowed |
| READMEs and diagrams are current | `bun run readmes:check`, `bun run render:check` | build pipeline | a generated region or picture is stale |
| named subgraphs frame the graph | `bun run subgraphs:check` | build pipeline | a subgraph file does not validate, a child has no file, a node cannot be placed, or a diagram is not a documented Process |
| unit tests | `bun test .` | build pipeline | any fails |
| status of a push to GitHub Pages, and its message | `bun run pages:status -- --root <instance> [--url <root>] [--sha <commit>]` | Site Publisher (`processes/render-kg-to-github-pages.bpmn`) | exit 1 not pushed, 3 could not determine |

The last row is a step of this toolset's own Process, `processes/render-kg-to-github-pages.bpmn`, whose Skill and Roles are here: it renders a Knowledge Graph (or a list of its Subgraphs) to GitHub Pages at a publication root URL. A harness above may name it as one way of publishing; nothing here names that harness.

A step that fails is reported with its output and the command to reproduce it; the agent does not "fix" a check by editing what the check reads unless that is the change under review.

## CI — the README checks are enabled; the rest is described

Each repository's own CI fails when its README is stale. Here that is `.github/workflows/check.yml`: this repository's READMEs, checked with bootstrap-tools standing alone, because their output must not depend on what sits beside them (a term outside bootstrap links to bootstrap's published schema page, never to a sibling path). bootstrap carries no workflow, because one would name this toolset, so its READMEs and schemas are checked from here, by `.github/workflows/check-bootstrap.yml`, with bootstrap checked out beside the tools. It runs on a schedule and by hand, never on a bootstrap push or PR. `.github/workflows/harness-pr-checks.yml` runs the hosting harness's shared layer checks on every PR here.

The fuller check of bootstrap below is only described. When the owner asks for it, this is the whole of it: one more job in `check-bootstrap.yml`, calling the tools at a pinned version. It is not committed, so nothing more runs or is billed until someone decides it should.

```yaml
# litlfred/bootstrap-tools — a further job for check-bootstrap.yml (NOT ENABLED)
on: [workflow_dispatch]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { repository: litlfred/bootstrap, path: bootstrap }
      - uses: actions/checkout@v4
        with: { ref: v0.1.0, path: bootstrap-tools }
      - uses: oven-sh/setup-bun@v2
      - run: bun install --cwd bootstrap-tools
      - run: |
          cd bootstrap-tools
          bun run schemas:check && bun run check:node-iris && bun run iri:sync:check \
            && bun run check:concepts && bun run readmes:check && bun test .
```

The tools are checked out at a **tag**, never a branch: a content check that changes under the content without a commit to it cannot be reproduced. Rendering the diagrams needs a browser and is left to the agent's run, not this workflow.

No npm package is published: `package.json` is `"private": true` until the first release.

## The skills this layer publishes

<!-- skills:index:begin -->

_3 skills in 1 directory, generated from each skill's front matter. `bun run cat readme:sync` rewrites this list and `readme:sync:check` fails when it is stale. Skills this repository inherits are listed by the repositories that publish them._

**`skills/`** (3)

| Skill | What it is for |
|---|---|
| [`bootstrap-contract-semver`](skills/bootstrap-contract-semver.md) | What MAJOR, MINOR and PATCH mean for bootstrap's PUBLISHED schemas and graph, and why the bump is computed from a diff of the generated documents rather than asserted. |
| [`github-pages`](skills/github-pages.md) | The contract GitHub Pages keeps as the host of a rendered Knowledge Graph: serve the gh-pages branch at the publication root URL, exactly as committed, and answer 404 for what is not there. |
| [`render-kg-to-github-pages`](skills/render-kg-to-github-pages.md) | Render a Knowledge Graph, or a list of its Subgraphs, to GitHub Pages at a publication root URL, and report the push: a status (pushed, not pushed, could not determine) and one message carrying the… |

<!-- skills:index:end -->

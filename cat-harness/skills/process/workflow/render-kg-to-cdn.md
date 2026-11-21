---
name: render-kg-to-cdn
description: >
  Render a Knowledge Graph, or a list of its Subgraphs, for publication to a
  CDN at a publication root URL, and report a status and one message. The
  same step for a staging preview and for a release — only the root URL and
  the target differ. Names the target's Tool, never its steps: GitHub Pages
  (`gh-pages`) is one Tool, and it carries its own subprocess.
---

# Render a Knowledge Graph to a CDN

Render the content of a Knowledge Graph, or a list of its Subgraphs, for
publication to a CDN at a given publication root URL, independent of staging
or release, and report the status of the push with a message. GitHub Pages is
one Tool for this general step. Drawn as [`render-kg-to-cdn.bpmn`](../../../processes/process/render-kg-to-cdn.bpmn).

## Inputs and output

| input | what |
|---|---|
| Knowledge Graph | a layer root — or a tree the caller has already rendered and verified |
| Subgraphs | optional: declared directory ids; absent means the whole graph |
| publication root URL | where the rendering is served |
| CDN target | which Tool performs the push — a Tool that `satisfies: ["render-kg-to-cdn"]` |

| output | what |
|---|---|
| status | `pushed`, `not-pushed`, or `could-not-determine` — a check that could not look is never `pushed` |
| message | one line, postable as it stands: what is live (a commit), where, and the QA result |

## Staging and release are the same step

A preview is this with a root under the release root; a release is this with
the release root. **What differs belongs to the caller**: who may start it,
what must be reviewed or verified first, what else lives on the same host and
must survive the push. That is why [`feature-staging`](../../ui/ui-core/feature-staging.md)
and `docs-site-publish` both *call* this process rather than restating it, and
keep their own steps — the slug, the render log, restoring the open previews,
the publication-manager alert — around the call.

## Name the Tool, not its steps

The general process has one call activity, **bound by the Tool**: the
activity names this skill, the Tool for the chosen target `satisfies` it, and
the Tool lists its own `subprocesses` — the diagram of *its* steps
([`skills-and-tools`](../../tools/folio-core/skills-and-tools.md),
[`bpmn-processes`](bpmn-processes.md)). The general skill never lists them.

| target | Tool | its subprocess | its message |
|---|---|---|---|
| GitHub Pages | `gh-pages` | bootstrap-tools `processes/render-kg-to-github-pages.bpmn` | the commit merged onto `gh-pages` + the QA of what is staged and what is served |

**A target may need provisioning before it accepts a push; the Tool's
subprocess owns that.** For GitHub Pages a `gh-pages` branch has to exist
before Pages can be switched on to serve it, so the
`gh-pages` subprocess creates it first — the general step does not.

Another CDN is another Tool with its own subprocess, and nothing here changes.
A CDN in front of an origin is a *layer*, not a publication host
([`kg-to-portal`](../../kg/kg-core/kg-to-portal.md)): the publication root URL
stays the origin's canonical one even when a CDN serves it.

## What this is not

Not the verification of what a build produced — that is
`publish-verification`, and it runs
*before* a caller hands its tree over. Not the decision to release — the content layer's publication step and
`release-lifecycle`. This step renders, pushes, and says
whether the push landed.

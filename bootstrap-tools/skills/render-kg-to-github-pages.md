---
name: render-kg-to-github-pages
description: >
  Render a Knowledge Graph, or a list of its Subgraphs, to GitHub Pages at a
  publication root URL, and report the push: a status (pushed, not pushed,
  could not determine) and one message carrying the deployed commit and the
  QA result. The same steps for a staging preview and for a release; only the
  root URL differs.
---

# Render a Knowledge Graph to GitHub Pages

**Inputs**, each named by whoever starts the process:

| input | what | default |
|---|---|---|
| the Knowledge Graph | a layer root, the directory holding its `<name>.json` | none; required |
| Subgraphs | a list of directory ids from that declaration | the whole graph |
| publication root URL | where the rendering is served | the declaration's `iriBase`, else `https://<owner>.github.io/<repo>/` |

**Output**: a status and a message, and nothing else a caller must read.

| status | when |
|---|---|
| `pushed` | the staged tree had no problem, the root URL answers, its README page (`README.html`) answers, and every document address answers |
| `not-pushed` | a check ran and failed: a staging problem, or a 404 at the root or at a document address |
| `could-not-determine` | nothing failed, but an answer was about the way here (403, 407, 5xx, no network) |

The message is one line a caller posts as it stands:
`pushed 1a2b3c4 to <root> — QA: staged ok (N files, M documents); root 200; README.html 200; documents M/M answer`.
The commit is **which bytes are live**: the commit on the `gh-pages` branch
the site is served from.

**Staging and release are not two processes.** A preview is this process
with a root under the release root (`…/branches/<slug>/`, say) and a release is
it with the release root. Anything that differs between them (who may
start it, what must be reviewed first) belongs to the process that
*calls* this one, never in here.

## The steps

Drawn in [`processes/render-kg-to-github-pages.bpmn`](../processes/render-kg-to-github-pages.bpmn).
Every command below is run from bootstrap-tools, with the layer as `--root`.

1. **Resolve the inputs.** Read the declaration; check every Subgraph id is
   one it declares; settle the root URL. An unknown id is refused, never
   rendered as a smaller site.
2. **Make sure `gh-pages` exists and Pages serves it.** Pages cannot be
   switched on to serve a branch that does not exist, so in order:
   - `git ls-remote --heads origin gh-pages`; if absent, push an orphan
     placeholder (`index.html` + `.nojekyll`);
   - Pages on, Source = branch `gh-pages`, folder `/`:
     `gh api -X POST repos/<o>/<r>/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'`
     when `gh` is signed in, otherwise the manual step (Settings → Pages →
     Deploy from a branch → `gh-pages`, `/ (root)`).
   `bun run scripts/init.ts --root <instance>` runs both as `site:branch` and
   `site:enabled`. This provisioning belongs to this process, not to the
   publication step that calls it.
3. **Stage the rendering.**
   `bun run scripts/site.ts --root <instance> --out <dir> [--subgraph <id>]…`:
   every JSON Schema and JSON-LD document at the IRI it names, the files as
   they sit, the README page as `README.md` — served at `<root>/README.html`
   — and `index.html`, a redirect to it. The redirect is only the default:
   a layer that carries its own `index.html` or `index.md` at its root
   gets that as its landing page instead. Every generated page opens with a
   notice naming bootstrap-tools and the script that wrote it, and its footer
   links the generator and its source rather than GitHub's editor, which
   would edit the `gh-pages` copy the next publish overwrites.
4. **Check what was staged.** `site.ts --check` and
   `bun run scripts/readme-book.ts --root <instance> --check`. Any problem
   stops here: the report says `not-pushed` and names the problem, and nothing
   is deployed. A push of a tree known to be broken is not a push to report.
5. **Deploy.** Commit the staged tree onto `gh-pages` as a full replace with
   `bun run scripts/publish-site.ts --site <dir> --remote <git url>`: the
   layer's Pages workflow runs it on a push to `main`, and an agent runs it
   with its own git credentials for a layer that carries no workflow
   (bootstrap). GitHub Pages builds the branch (Jekyll, unless `.nojekyll`).
   A rejected push is rebuilt and retried, never rebased. The `gh-pages`
   commit is the one the message names.
6. **Check what is served, and report.**
   `bun run scripts/pages-status.ts --root <instance> [--url <root>] [--sha <commit>] [--subgraph <id>]…`
   asks the root URL and every document address, and prints the message;
   `--json` gives the whole record. Exit 0 `pushed`, 1 `not-pushed`, 3
   `could-not-determine`.

## What this is not

It is **one** target. A harness above these tools may have several ways of
putting a rendering in front of readers, and treat GitHub Pages as one of
them; nothing here needs to know that, and nothing here names it. It does
not decide who may publish, whether review has happened, or what happens
to other previews on the same host: those are the calling process's.

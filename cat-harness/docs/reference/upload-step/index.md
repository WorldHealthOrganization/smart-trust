---
layout: default
generated: cat-harness-tools/scripts/gen-upload-step-docs.ts — do not hand-edit; edit the Tool nodes
title: The upload step
nav_order: 44
---

# The upload step

The **first step of document ingestion** — what puts a file into the queue everything downstream assumes it is already in — and the Tools that perform it.

{: .note }
> Generated from the **Tool documentation** and from the process diagram. Nothing here is authored on this page: edit the Tool node or the `.bpmn` and re-run `bun run cat-harness-tools/scripts/gen-upload-step-docs.ts`.

## Where this step sits

| | |
|---|---|
| process | Basic ingestion — an upload to an asset catalogued in library/ (`Process_Ingestion`) |
| begins at | A contributor has a file for the folio |
| first step | **Place it in uploads/ by a declared route** (`Task_Place`) |
| performed in the lane | Contributor (human or agent) (role `user`) |
| governed by the skill | `upload-routes` |
| Tools that satisfy it | 2 |

What the diagram says about the step itself:

> THE FIRST LINK: everything downstream of here takes a file that is already in the queue, so without this step how the file got there is governed by nothing.
>
> WHAT THIS STEP IS. The basic flow's ACCEPT step: choosing an arrival route, writing the bytes into the declared queue of the layer that will own them, and discharging what that route does not discharge for you. The routes, what each writer owes, and the two that are mechanisms against the one that is a persona are in the `upload-routes` skill; `upload-url` composes the forge URL for the web route from the declaration rather than from a literal, because a hand-written one can 404.
>
> WHY A PLAIN `bpmn:task` AND NOT A `userTask`. A `userTask` asserts a human performs it, and this lane is "Contributor (human or agent)" because both do; asserting human-only would be an `activity-fulfilment-kind` contradiction. A plain task asserts nothing about the performer.
>
> WHY THE BEAN OP IS `note` AND NOT `claim`. Placing a file claims nothing; it adds to a queue. What it owes the work plan is visibility. A note against the ingestion bean is what makes the queue's growth something another session can see.

The skill is the prose an actor reads; each Tool below is one concrete way to exercise it. See [`upload-routes`](../skill-instructions/upload-routes.html).

## Directory READMEs from the Knowledge Graph

`subgraph-readmes` · satisfies `docs-generation`, `upload-routes`

Write a README for every directory a layer declares, from the declaration and the files themselves: the declared title and description, the Graph Typologies, and one row per file described from the file, with 'used by' only where a diagram records it. Renders the Liquid templates in `tools/templates/readme/`, part of the tools graph, which may include one another with Jekyll-style include tags. Writes only between `<!-- kg:subgraph:begin -->` and `:end`; a README without the markers is left alone and reported. Records every missing title, missing or over-long description, absent directory and unmarked README in `test/results/subgraph-readmes.qa-results.json`.

| | |
|---|---|
| install | nothing to install |
| invoke | `bun run cat readme:subgraphs` |
| requires | runtime `bun` · no network |

### Inputs

| name | required | how it is passed | what it is |
|---|---|---|---|
| `check` | no | `--check` | Fail if any directory README or the QA record is stale; write nothing. |

### Outputs

| name | what it is |
|---|---|
| `readmes` | `<directory>/README.md` for each declared directory, and the QA record. |

### Choosing it

_This Tool declares no `selection`, so when to reach for it, what it will not do and what it costs are undocumented. That is a gap in the Tool node, not on this page._

## Where to drop a file — the queue's upload URL

`upload-url` · satisfies `upload-routes`, `content-acquisition`

Compose the forge URL a person can drop a file at, from the layer's own declaration: the `uploads` graph's directory, resolved against the ROOT its scope names, expressed relative to the repository, and appended to the origin remote as GitHub's `/upload/<branch>/<path>`. Every failure is NAMED and no URL is guessed — no declaration, no declared `uploads` graph, a declared queue absent from disk, no `origin` remote, and a non-github.com remote each return a reason and a remedy instead. The declared path is relative to the LAYER and a forge URL needs it relative to the REPOSITORY, so pasting the declared path can mint a 404.

| | |
|---|---|
| install | nothing to install |
| invoke | `bun run cat upload:url` |
| requires | runtime `bun` · no network |

### Inputs

| name | required | how it is passed | what it is |
|---|---|---|---|
| `branch` | no | positional 0 | The branch the upload form targets. Defaults to `main`; pass the working branch to send somebody to a pull request's head instead, so the upload lands on a commit CI judges. |

### Outputs

| name | what it is |
|---|---|
| `url` | The upload URL on stdout, exit 0 — or, on stderr and exit 1, the reason it could not be composed and the remedy for that reason. Never a guessed URL: a URL is believed, and somebody sent to a wrong one cannot tell it from an empty directory. |

### Choosing it

**When.** You are about to tell somebody where to put a file, in any channel. Reach for it every time, not only when unsure: a hand-written path breaks silently when a directory moves. It also answers "which queue" when a checkout declares more than one (one per layer): the answer is whichever layer root you pass, never a literal.

**Limits.** It answers WHERE, and nothing else. It does not upload, does not check whether the person has write access, and cannot tell you which of several declared queues should own a given file — that is undecided and `upload-routes` says so rather than picking. The `/upload/<branch>/<path>` form is GitHub's, so another forge gets a named refusal rather than a guess. And the URL it hands back opens the route with the FEWEST guarantees: the web form has no working tree, so no pre-commit hook and no generator run happen on it, and everything `upload-routes` lists has to be discharged afterwards from a checkout.

**Cost.** One read of the declaration and one of the git remote; no network at run time and nothing installed.

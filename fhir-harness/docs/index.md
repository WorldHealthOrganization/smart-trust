---
title: "fhir-harness"
description: "The bare FHIR IG pipeline: SUSHI, the IG Publisher, Jekyll assembly and publication, for any implementation guide."
has_children: false
---

# fhir-harness

**The bare FHIR IG pipeline.** SUSHI compiles FHIR Shorthand, the IG Publisher
builds and validates the guide, and the result is assembled and published to a
pages branch. There is no pre-processing and no post-processing, so any FHIR
implementation guide can use this layer.

```
input/fsh/          →  SUSHI      →  fsh-generated/resources/
input/pagecontent/  ┐
sushi-config.yaml   ┘  →  IG Publisher (JVM, Docker)  →  output/  →  pages branch
```

## Start here

| I want to… | Read |
|---|---|
| render an IG through the harness on my machine | [Render an IG from the command line](fhir/run-locally.html) |
| know how this differs from running the IG Publisher | [Harnessed or bare: two routes](fhir/run-locally.html#two-routes) and [How the harness runs it](fhir/ig-publisher.html#how-the-harness-runs-it) |
| publish an IG, or see what is published | [Publishing an IG](fhir/publishing.html) |
| choose where to deploy (GitHub Pages, Cloudflare) | [Deployment targets](fhir/publishing.html#deployment-targets) |

The two commands, from an IG repository's root. On a fresh clone the first
`bun run cat` mounts the layers `index.lock.json` pins, then runs:

```bash
bun run cat prepare:fhir-harness        # build the AST (the one IG Publisher run)
bun run cat stage:local --repo . --dry-run   # render the site; push nothing
```

## Pages

- [Render an IG from the command line](fhir/run-locally.html): the two
  routes, what to install, the one command, and each step it runs.
- [Publishing an IG](fhir/publishing.html): the workflows, where each output
  lands, what is published now, and the deployment targets.
- [The FHIR IG Publisher](fhir/ig-publisher.html): what one run emits,
  what only it can do, and what it cannot tell you.
- [FHIR content](fhir/fhir-content.html): what an implementation guide is as
  content, which representation is taken, and why the artefact index is
  reconstructed.

## Where it sits

It sits on the content core and may import from it. The layers that build
particular guides sit on top of this one and pass their own names in as
configuration. This layer never names them.

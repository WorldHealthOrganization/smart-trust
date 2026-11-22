---
name: github-pages
description: >
  The contract GitHub Pages keeps as the host of a rendered Knowledge Graph:
  serve the gh-pages branch at the publication root URL, exactly as
  committed, and answer 404 for what is not there. A mechanical Actor plays
  this Role; this is what it must do, and what it is tested against.
tested-by:
  - scripts/pages-status.ts
  - scripts/pages-status.test.ts
---

# GitHub Pages' contract

**A host plays a Role, and this is the Role's contract**: what it must do,
and what it is tested against. It decides nothing.
[`pages-status`](../scripts/pages-status.ts) is the test: it asks the
publication root URL and each document address, and reports `pushed`,
`not-pushed` or `could-not-determine`.

It sits in the `GitHub Pages` lane of
[`render-kg-to-github-pages`](../processes/render-kg-to-github-pages.bpmn). The
Site Publisher, following [`render-kg-to-github-pages`](render-kg-to-github-pages.md),
is the other side of each step.

## Responsibilities

1. **Serve the `gh-pages` branch at `/`**, once Pages is on with that source.
2. **Serve what is committed.** After a deployment commit, the publication
   root URL, its `README.html` and every document address answer with the
   committed files.
3. **Answer 404 for what is not there**, so a missing page is a failure a
   check can see, not an empty success.

## Not its responsibility

Choosing the root URL or the Subgraphs, staging, or deciding whether a push
landed. Those happen in the Site Publisher's lane.

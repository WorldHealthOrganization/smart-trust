---
name: site-presentation-assets
description: >
  A visual fact — a colour, a glyph, a theme — lives in a graph node, and the
  stylesheet the site serves is a rendering of it. Read before adding a colour,
  an icon or a theme, before hand-editing any generated stylesheet, and before
  referencing a generated asset from a page.
---

# Site presentation assets — the node is the source, the stylesheet is a rendering

**A visual fact has one home, and it is a node in the knowledge graph.** A
colour, a glyph, an avatar, a theme's token set: declared once as data, and the
stylesheet the site serves is **generated** from it: named CSS assets in the
graph, never hard-coded colours.

Authoring the stylesheet by hand beside the nodes gives **two answers to one
question**, free to disagree silently, because nothing compares a hex triple in
a `.css` file with one in a node.

## The test

> **Could a reader change this visual fact in one place and be sure the site
> agrees?**

If the answer needs them to remember a second file, the fact has two homes and
one of them is wrong.

## Four rules

**1 — Never hand-edit a generated stylesheet.** It is build output that happens
to be committed, and it is committed only so it is readable on the forge. An edit
survives exactly until the next generator run.

**2 — Gate staleness, do not trust it.** The generator takes a `--check` arm that
compares against the committed copy and fails rather than writing. Put that
`--check` in CI: without it the output drifts, and the drift is invisible
because the file looks authored.

**3 — A published generated asset needs a Tool that `maintains` it.** Otherwise
the provenance is unreachable: nothing can answer "which node produced this
stylesheet", and the asset becomes the third case in
[`covered-is-not-reachable`](../../tools/folio-core/covered-is-not-reachable.md) — a mechanism nobody
can find. Declare the artefact by its **published** path, and check that
something actually publishes it before claiming so.

**4 — An asset reference resolves; it is never composed.** A page that names a
generated asset must reach it relative to its own location, so the same bytes work
at the canonical base and under a staging prefix with no configuration. A page
that composes the URL from a base needs a different build per environment, and a
staging build that differs from what ships is testing something else.

**An address may be relativized. A name may not** — a JSON-LD `@id` or a schema
`$id` is an identity, and relativizing it changes what the document claims to be,
resolving against whatever URL happened to serve it.

## Themes are token sets, not stylesheets with branches

A theme declares **tokens** — the named values a stylesheet reads. Light and dark
are two valuations of one token set, not two hand-maintained blocks that drift
apart.

So a new colour is a token on the node, and the generator decides how it reaches
CSS. Adding a `@media (prefers-color-scheme: dark)` branch by hand to cover a
value the node does not carry is rule 1 broken with extra steps: the node still
does not know about the colour, so the next layer to render it gets the light
value in the dark.

## The third state applies here too

An asset whose presence **cannot be determined** — the site not built, a fetch
refused — is not *present*. Report it as could-not-determine and do not let it
clear the assets the check did not reach. A generated asset that silently went
missing renders as an unstyled page, which looks like a design choice rather than
a failure.

## What this skill does not cover

- **Prose voice and tone** — [`one-voice-style-guide`](../../authoring/authoring-core/one-voice-style-guide.md).
- **Whether a rendered block LOOKS right** — that is a content question, and the
  rendering auditor's.
- **How a link is spelled** —
  [`readme-sections`](../ui-core/readme-sections.md) §"On link style — `raw`
  is not the private-repo answer" (summarised in the agent-memory entry
  `link-style-raw-is-not-the-private-repo-answer`).

This skill is only about the direction of authority: **the graph decides, the
stylesheet reports.** It names no script, because a skill written to give a
command somewhere to point passes every check and teaches nothing.

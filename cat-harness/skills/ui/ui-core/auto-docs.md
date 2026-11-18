---
name: auto-docs
description: >
  Derived documentation for a sub-graph — what the handler emits, what it
  deliberately does not, and the obligation on whoever authors a harness's
  docs: summarise what the index lists, by reusing it rather than restating
  it.
---

# auto-docs — the index is generated, the meaning is authored

`<base>/<handler>/auto-docs/<auto-doc-type>/<sub-graph>/` is an index of what
exists. **It is not the documentation.** The handler generates the index; the
author of `<harness>/docs` summarises each business process it lists, reusing
the index's assets rather than restating them.

## The obligation: reference the index, then say what it cannot

`bun run cat auto:docs` emits, per artefact, what that artefact **declares about
itself** — a skill's front-matter description, a process's own
`<bpmn:documentation>`, its lanes, the skills its activities name. That is a
complete answer to *what exists* and no answer at all to:

- what this process is **for**, and when you would be in it;
- what it is **not**, and which neighbouring process you actually want;
- why it has the lanes it has, and what changes when you cross one;
- which of them a newcomer should read first.

**An index with no authored prose around it reads as complete while explaining
nothing.** So when you author `<harness>/docs`, for each business process the
index lists, write the paragraph the index cannot contain. Judgement, not a
gate.

## Reuse the assets; never restate them

The summary **links to and embeds** the derived entries — the rendered BPMN,
the lane and activity names, the skill descriptions the activities point at.
It does not paraphrase them into a second copy, because a second copy is free
to drift and the copy a reader finds first is the one with no generator behind
it.

For example, a page whose requirements table is **parsed out of** the skill
that states the requirements, rather than typed beside it, and which **refuses
rather than rendering an empty table** when the source moves. Do that, not a
transcription.

## What the handler emits, and what it does not

**Read the type list off `TYPES` in `gen-auto-docs.ts`, not off this table.**

| | |
|---|---|
| built | `index/skills`, `index/docs`, `index/processes`, `glossary` — each emitting under `auto-docs/` |
| declared, **not** built | `index`, `index/bpmn`, `index/dmn`, `index/tasks`, `index/roles` |
| **withdrawn** | `toc` |

**`toc` is out.** A table of contents is a document-order notion, and a
sub-graph has no single order to take one over.

**Unbuilt types are absent, not stubbed.** A type that emits an empty page is
indistinguishable from one whose sub-graphs happen to be empty, and the second
is a fact while the first is an unfinished feature.

## Two rules the generator keeps

**A type names the GRAPH TYPOLOGY its artefacts live in.** Walking every
declared directory would count the generated markdown rendering of each skill
under `docs/` as a second skill. *A rendering of an artefact is not the
artefact.*

**Ask the repository's own function; do not re-derive its rule.** Supporting
pages *inside* a skill (`skills/<package>/<skill>/<page>.md`) carry the same
front matter and are not skills; `skillMdDirs()` already encodes that, so the
generator calls it: two answers to "what is a skill" is one answer too many.

## The sub-graph segment is the declared `id`, not its path

The URL carries the declared entry's **`id`**: it is what `<name>.json`
declares and what an override matches on, so an id-derived URL **survives the
directory moving**. It also stays one segment, which lets `orphanSubjectPages()`
prune with an exact ownership test rather than a new pruner. Each page **states
its declared path**, so the mapping lives on the artefact rather than only in
the URL.

## An empty sub-graph gets no page

A sub-graph contributing nothing to a type is not rendered: a page claiming to
index an empty directory is a link that resolves to nothing while reading as a
section.

The corollary is that a page **disappearing** is normal, so the generator
prunes its own orphans through the shared helper — ownership read off the
page's own `var SCOPE` line, never assumed from the directory.

## What else belongs to a harness's docs

- the **QA check** `check:docs-populated`, run by `code-quality-gates.yml`;
- a per-harness **docs landing page** and a **navbar** over harnesses with a
  populated `docs/` — neither is built. `<base>/cat-harness/` is served by the
  generated `published-graphs.md`, so the obligation above is **unmet** for
  that route.

## Related

- [`readme-sections`](readme-sections.md) — the same split one level out: the
  platform owns the markers, the folio owns the file.
- [`uses-editorial-review`](../../authoring/authoring-core/uses-editorial-review.md) — why a count in prose is
  a claim rather than evidence, which is why these pages compute their counts.

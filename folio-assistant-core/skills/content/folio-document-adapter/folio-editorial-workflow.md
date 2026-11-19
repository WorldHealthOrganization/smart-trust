---
name: folio-editorial-workflow
description: >-
  The content-folio half of the harness's editor, content-graph, md-authoring,
  canonical-watcher, and uses-editorial-review skills: routes glossary and
  notation work to ontologist and glossary-build, bibliography audits to
  bib-qa, and term-ordering checks to glossary-terms.
---

# Folio editorial workflow — glossary, bibliography, and block routing

The harness skills [`editor`](../../../../cat-harness/skills/authoring/authoring-core/editor.md),
[`content-graph`](../../../../cat-harness/skills/authoring/authoring-core/content-graph.md),
[`md-authoring`](../../../../cat-harness/skills/authoring/authoring-core/md-authoring.md),
[`canonical-watcher`](../../../../cat-harness/skills/authoring/authoring-core/canonical-watcher.md),
and [`uses-editorial-review`](../../../../cat-harness/skills/authoring/authoring-core/uses-editorial-review.md)
govern manuscript coordination, editorial `uses[]` graphs, markdown conventions,
and watcher queues across any project. In a content folio, apply these
core-layer routing rules alongside them.

## 1. Glossary, terminology, and notation routing

- **New terms and symbols (`editor`, `canonical-watcher`):** when a block
  introduces a terminology synonym or symbol, route to
  [`ontologist`](../../library/cataloguing/ontologist.md) to register a
  glossary entry and verify notation-register compliance; when it introduces a
  new domain concept, author a definition block.
- **`:defterm` / `:refterm` backfilling (`md-authoring`):** use
  [`glossary-build`](../../library/cataloguing/glossary-build.md)
  (`folio-assistant-core/scripts/codemod-refterm.ts`) to backfill `:refterm[…]` directives from bare-text mentions of defined
  slugs.
- **Ordered glossaries (`uses-editorial-review`, `render-order`):** a glossary
  term's `requires` relation follows the same authored-never-inferred
  discipline as block `uses[]`, verified in declaration order per
  [`glossary-terms`](../../library/cataloguing/glossary-terms.md) §"Ordered glossaries".

## 2. Bibliography routing

- **Reference intake and verification (`editor`):** for adding, editing, or
  auditing bibliography entries — or when a review comment flags a DOI, author,
  or work mismatch — dispatch [`bib-qa`](../../library/cataloguing/bib-qa.md)
  and [`bib-human-review`](../../library/cataloguing/bib-human-review.md)
  rather than hand-editing citation metadata inline.

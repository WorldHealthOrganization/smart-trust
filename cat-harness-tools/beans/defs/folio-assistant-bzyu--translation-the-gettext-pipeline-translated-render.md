---
# folio-assistant-bzyu
$schema: bean/1.0.0
title: 'TRANSLATION: the gettext pipeline, translated renders, and their QA'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:43Z
updated_at: 2026-10-21T19:35:00Z
parent: folio-assistant-rwmf
---

Everything from a `.pot` template to a rendered page that declares its own
`lang`, and the QA that says the rendering is right.

The through-line is that a translation is the SAME KIND of thing as the page it
translates, differing by a field the file declares — never by its directory's
name. These items are the parts of that claim that are not yet true: diagrams
whose labels never reach a catalogue (`8xx6`, `0hd6`), a `.pot` refresh that
does not sync its stubs (`a98i`), assets whose text is invisible to the pipeline
(`j1r2`), and the viewer itself (`xcyh`).

`x3h9` is the one that decides the others' home: if the gettext pipeline is
HARNESS CORE rather than folio-only, every instance inherits it.

## Closed 2026-10-21 — all 33 child beans completed

With `folio-assistant-m4s1` completed (catalogues authored and re-pinned into `folio-assistant` `main` via `#2611`, `translation:drift:check` green), all 33 child beans under `bzyu` are `completed`.

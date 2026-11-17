---
layout: default
title: The folio board — requirements as agreed
parent: Architecture
nav_order: 8
---

# The folio board — requirements as agreed
{: .no_toc }

1. TOC
{:toc}

---

## What this is

The requirements agreed for the folio board, with their acceptance criteria and
the reasons that constrain an implementation. The rules an agent follows live
in the `cat-harness` skills this set produced —
[`board-windows`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/board-windows.html),
[`board-diagram-interchange`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/board-diagram-interchange.html),
[`harness-tiles`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/harness-tiles.html)
— and the processes in the executable BPMN diagrams beside them. Where this page
and a skill disagree, the skill wins.

## The two constraints everything follows

- **The `todos/` ↔ `cat-harness` split** — the board's content sits under
  `todos/`; the schema and behaviour of the folio board are in `cat-harness`,
  with tools kept distinct from schema.
- **Always collapsible to a linear rendering** — an accessibility floor. A
  board that cannot be read linearly cannot be read by a screen reader, printed
  or translated.

Notes move around the board, attach to nothing or to content nodes by their
relationships, and show on content (or its avatar) as an icon with a count
badge when more than one.

## R1 to R7 — the board's mechanics

| | requirement | new mechanism? |
|---|---|---|
| **R1** | the board renders content, not only notes | no — a second rendering of an existing relation |
| **R2** | semantic zoom, with the threshold **declared** rather than a literal | **yes — the only one** |
| **R3** | `targetLabel` publishes its parts | no — a bug fix |
| **R4** | linear collapse, reachable without XSS | no, but it constrains R1 |
| **R5** | the badge counts only when `> 1` | no — two lines |
| **R6** | badge and panel stay **one** query | no — a regression test for something already true |
| **R7** | badges on avatars | no — R2 plus R6 |

### R1 — the board renders content, not only notes

The board SHALL render content nodes alongside notes, and a note attached to a
content node SHALL render **at that node** rather than at an independent
position.

*Accepted when* a board with one note attached to a block and one attached to
nothing renders **both** — the first at its block, the second at its declared
position. Removing the attachment moves the note to its position rather than
hiding it: "attached to nothing" is an existing declared state, not a new one.

### R2 — semantic zoom, with a declared threshold

As the board shrinks, a card SHALL stop rendering its words and render its
**avatar** instead. The threshold SHALL be **declared data**, not a literal in
the renderer.

*Accepted when* the card renders text at a declared size and its avatar below
it, a kind with no avatar takes `GENERIC` rather than rendering blank, and the
behaviour is **falsified in both directions** — a test that only checks the
shrunk case passes for a board that is always avatars.

*Consumer burden:* the threshold is **emitted**, never documented. *"We don't
need to emit it — the renderer knows"* is the smell this phase names.

### R3 — `targetLabel` SHALL publish its parts

The published todo index SHALL emit a note's **page and node as separate
fields**, not only the composite `targetLabel`. The value is `sec:<page>-<node>`,
page-qualified because a bare node id can exist on two pages; node ids contain
`-`, so the composite cannot be split without the page list.

### R4 — the linear floor

The board SHALL always be collapsible to a linear rendering, **reachable
without XSS**: the linear rendering MAY fetch and build its content
client-side, and MUST NOT be reachable by anything that executes markup it did
not author. Movement SHALL be **keyboard-operable**; drag MAY be an accelerator
but SHALL NOT be the only way in — this layer's declared interaction profile
is low-dexterity.

R4 binds the board. Its linear floor is the todo listing, asserted by the tools
layer's `test/linear-floor.e2e.ts`. The docs site is bound by
[`ui-accessibility`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/ui-accessibility.html)
(WCAG 2.2 A/AA), which also states what a client-side rendering owes: print and
PDF wait for load and render, and a load that fails says so rather than
rendering as empty.

### R5 to R7 — the badge

The badge SHALL show a count only when more than one note is attached (R5); the
badge and its panel SHALL be **two readings of one query** rather than a number
somebody maintains (R6); and an avatar carries the same badge from the same
query as the card it replaced (R7). A badge cannot disagree with its own panel,
by derivation rather than by discipline.

**Cards start closed.** A closed card shows its words above the declared
threshold and its avatar below it, with the avatar present at every width as
the control that opens the window (R2 with R9).

## R8 to R16 — overlay, windows and tiles

| | requirement | relation to round one |
|---|---|---|
| **R8** | the dynamic board is an **overlay**; the standard rendering is a simple tile listing | **sharpens R4** — the floor is a tile listing, and movement is additive over it |
| **R9** | **everything starts as an avatar**; opening is an explicit act, `[x]` closes back | **splits R2** into two mechanisms — an explicit open/close a person performs, and automatic zoom by size. Conflating them is the defect to design out |
| **R10** | an open card is a panel with **fixed controls**, plus others depending on content; each content type controls its own rendering | the kind owned the zoom threshold; it now owns its whole rendering, under a chrome contract it cannot reach |
| **R11** | `fsh-guts` is a tile, and `[fishbones]` puts content into it as a **confirmed** action | new; reuses the declared non-rendered trashcan, whose founding rule is *do not delete unless explicit confirm* |
| **R12** | create a new sticky note — itself a tile | new |
| **R13** | filter the board by kind properties, **interactively** | a *reader's* filter at view time, distinct from the board document's *declared* filter. Two things that must not become one field |
| **R14** | resize open content, move it, drag and drop | rides R4's floor: drag is an accelerator, keyboard operation is not optional |

Each of these gets its skill and its BPMN diagram, not only its schema.

| | requirement |
|---|---|
| **R15** | selecting any part of an open window **raises** it — z-order is a reader's act |
| **R16** | a tile opens the **existing** visualisation; nothing builds a second viewer |

## R17 — render safety

Assume assets in the KG are accessible, lazy-load, and render dynamically where
possible, without XSS. The `Url` half is `schemas/safe-url.ts`, default-deny,
with a source-level check that a renderer ignoring it fails a test. A
Tool-output render vocabulary is **not** defined, because nothing renders a
tool's output: a safety property with no consumer to check it is not declared.

## R18 to R32 — the folio visualisation

### Geometry — R18 to R23

| | requirement | in the requester's words |
|---|---|---|
| **R18** | the board's spacing SHALL be condensed | *"to much padding between panels, condense"* |
| **R19** | the board's tiles SHALL be the **same square tiles** as the LHS navbar's expanding menu, *or* a theme/avatar where that is the better fit — **which is which is R19b, settled below** | *"i meant to use same SQUARE TILES taht are in the expanding menu of LHS navbar OR use theme/avatars as appraopriate"* |
| **R20** | **no sub-panels.** One open, Miro-like board; everything lives on `fa-sticky-board` / `fa-landing-board` | *"i dont want sub-panels of the folio, just one open (miro-like) board"* |
| **R21** | stickies SHALL be **closed avatars, and small** | *"THE STICKIES MUST BE CLOSED AVATRS AND SMALL"* |
| **R22** | the folio visualisation SHALL have **no rounded corners** | *"drop all the rounded corners… too much dead space"* |
| **R23** | the square tiles SHALL be lined up along the **top** of the board, and the whole strip SHALL slide up when the reader does not want it | *"lets have the square tiles lined up on the top of the folio-sicky-board-landingpanel whole slides up if user doesnt want"* |

R23 means **top**, and **open by default**: tiles a reader must open before
they can see what a folio offers read as absent.

R21 and R22 share one reason: dead space. The count badges keep their `999px`
radius, because dead space is recoverable from a panel and not from a pill.

### The folio is a **convention**, not a page — R24 to R29

| | requirement | note |
|---|---|---|
| **R24** | the folio visualisation is **`cat-harness`'s**, and SHALL be available by convention on **any** harness, for a consistent feel | the harness supplies the folio; the layer supplies the library |
| **R25** | a reader SHALL be able to **pull their folio down** over whatever they are browsing | *"the user in visualization should be able to pull down their folio"* |
| **R26** | `cat-harness` SHALL declare **`folio/`** as the directory of the reader's own content | a declared `ContentDirectory`, like every other graph |
| **R27** | **materialised** assets from the static KG SHALL live in the folio — see [R27](#r27--where-materialised-assets-live) | *"clarifying if KG is static w/ materizlied…, materialized should live in folio"* |
| **R28** | new documents a reader creates **or links to** go in `folio/` | linking is a creation act here, not a reference |
| **R29** | todos and sticky notes MAY reference things **across** KG libraries | *"todo, etc can refernces cross KG library"* |

**A content library is not a folio.** The IRIS replica and the `smart-*`
layers are things a reader *browses*; each may implement its own landing
page and its own harness. What travels with the reader between them is the
folio — their notes, materialised assets and links — and it looks and behaves
the same in each because it belongs to `cat-harness`. **Consistency is the
requirement**, not similarity: two harnesses that each build a good folio have
failed R24.

### An asset has **three** states, not two — R30

| | requirement |
|---|---|
| **R30** | an asset SHALL have three distinguishable states: **in the library** (not the reader's), **in `folio/` but not displayed** (materialised, theirs, off the glass), and **on the glass** (displayed in the pulled-down folio). Closing it from the glass returns it to the second state, never the first; returning it to the first is a separate act performed **from the library** |

A two-state model makes closing a sticky and un-materialising an asset the same
gesture, so a reader tidying their glass silently discards work. The middle
state makes closing safe, and the inverse of **close** is reachable from a
different surface (the library) than the one that closed it.

### A sticky's face — R31 and R32

| | requirement | in the requester's words |
|---|---|---|
| **R31** | a closed sticky SHALL show its **condensed own text** — whitespace, newlines, bullets and list markers stripped. **No second string** | *"no, not hidden label, that's new data to maintain… just the condensend text"*, *"(strip whitesaplnce, newlines, bullets….)"* |
| **R32** | a sticky SHALL still be about **2.5 physical inches** on a large MacBook screen | *"sticky should stilll be ~2.5\" in large macbook screen"* |

**R31: no second string.** A hidden accessible label beside the visible summary
is new data to maintain, and a label that disagrees with the visible text is a
defect no reader can see.

**R32 is a physical measurement, and CSS cannot express it.** A CSS `in` is 96
CSS px, not an inch of glass. A 16" MacBook Pro presents 1728 CSS px across
about 13.6" of width, so one physical inch is roughly **127 CSS px** and 2.5"
is about 318px: `20rem`. `2.5in` would render about 1.9". The device is named
in the code comment because the conversion is device-dependent: the same
`20rem` is about 3.7 physical inches on a 27" 1440p display, which is correct,
since the size is chosen for the screen the requester uses.

**R21 and R32 are a pair.** "Small" without R32 shrinks the card until its text
is unreadable; R32 without "small" leaves the dead space R18 was about.

### R19 — tile or avatar

| | the rule |
|---|---|
| **R19b** | a thing renders as a **tile** iff the **harness** declares it; as an **avatar** iff the **folio** holds it (a note, a document, a materialised asset in `library/` or `uploads/`). A **theme** is how either one looks, never a third kind |
| **R19c** | a tile is one of **two kinds**. A **functional** tile (a directory or sub-graph) is the visual interface to a **skill**, implemented by a **tool** chosen from potentially several — so it names the skill, never the tool. A **content** tile stands for a set of **schema instances** |

R19c is a separate requirement because R19b stays true but is insufficient:
*who declared it* answers **tile or avatar** and stops, and the two kinds of
tile bind to different things, resolve different things when opened, and mean
opposite things when empty:

| | **functional** | **content** |
|---|---|---|
| bound to | a **skill** | a **schema** |
| resolved on open | a **tool** implementing it | the **instances** |
| empty means | a **gap to report** — a skill nothing implements is unreachable | a **real state** — "nothing outstanding" is not "broken" |

**A tile names the skill, never the tool.** `schemas/tool-types.ts` exists to
make tools interchangeable, so a tile bound to a tool breaks the moment another
is chosen. `VisualiserDeclarationSchema` takes one path or several
visualisations, so a sub-graph may be rendered more than one way exactly as a
skill may be implemented more than one way.

R30 puts *avatars of materialised assets, including whole knowledge graphs* on
the glass, so size does not decide tile or avatar; declaration ownership does.
The rule is preferred because it is already in the corpus: `harness-tiles`
says a tile is the harness's, not the node's.
The rule lives in
[`harness-tiles`](https://litlfred.github.io/folio-assistant/reference/skill-instructions/harness-tiles.html),
with a pointer from `board-windows`. There is no check: nothing classifies a
folio item yet, so a gate would be a declared property whose check cannot
answer its own claim.

### R27 — where materialised assets live

The knowledge graph is static and modelled by reference; materialisation is a
separate, gated, checked act that produces bytes:

| | |
|---|---|
| the content core's `schemas/materialization.ts` | **three states** — `referenced` (we know where, we hold no bytes), `materialized` (the bytes are here), `unknown` (we have not established which) — with **no default**, plus five gates, and `localPath` present **iff** `materialized` |
| `cat-harness/library/processes/materialize-remote.bpmn` | the act itself, as an executable **STRICT** process running five gates in a fixed order; `unknown` on any one keeps the node `referenced` |
| `skills/kg/kg-core/directory-conventions.md` | the `catalogue` graph typology — *"a remote catalogue modelled BY REFERENCE … Distinct from `library`: that is content which IS here, this is the shape of a collection of which almost none is"* |

**Materialised bytes land in `library/` and `uploads/`, not in a `folio/`
directory.** The folio is the reader's **repository**, of which `library/` and
`uploads/` are declared parts, each marked as the reader's own copy (the
`perInstance` flag on the kind). Two reasons rule out `folio/` itself:
`corpus-grep` searches `library/` only, so a node materialised elsewhere reads
as absent, and `folio/` is the **renderable** typology, so it would put large
PDFs into the site build. The content core's `scripts/check-catalogue.ts`
checks that a `materialized` claim names bytes that exist, with
`local-path.ts`'s three states (`ok` / `missing` / `unknown`).

### Still open

**The library view renders all three states.** `gen-iris-pages.ts` emits
`materialized`, `referenced` and `unknown` as distinct badges, defaulting to
`unknown`, never to `referenced`. Catalogue pages are generated at build time,
so check the published site, not the source tree. What is missing is one
**action**: the way from a library row onto the glass (state 1 → 3). The glass
(R25) and its pull-out action are one unit of work.

**Folio surfaces on library pages are blocked on R25.** A replica library page
is complete standalone HTML from its own generator — no Jekyll, no
`head_custom.html` — because it is a faithful replica. Loading `docs-ui.js`
there is safe (every mount guards itself), and nothing mounts:

| surface | requires | on a replica page |
|---|---|---|
| launcher | a **sidebar header** | absent |
| board | `#main-content` / `.main-content` / `<main>`, inserted at the **top** | absent, and the top is the IRIS content |
| language bar | `.main-content` | absent |

Every visible folio surface is bound to just-the-docs page furniture, and
giving a library page that furniture would make it look like folio-assistant —
the one thing a replica exists not to do.

The delivery mechanism is an exported mount fragment plus a gate, as
`staging-banner.ts` does, reusing `bodyInsertionPoint()`. A pull-down glass
comes down over what is being browsed, so it is the only folio surface that
does not need the host page to look like the harness; it comes first, because
shipping the mount fragment before it would create a gate for a thing with no
consumer.

## What the set produced

| graph | what landed |
|---|---|
| `cat-harness` (BPMN) | `board-open-close`, `board-relocate`, `board-place-note` — executable diagrams with hand-authored Diagram Interchange |
| `cat-harness` (skills) | `board-windows`, `board-diagram-interchange`, `harness-tiles`, plus the `board-renderer` role and actor |
| `schemas` | `board-positions`, `window-stack`, `panel-chrome`, `reader-filter`, `semantic-zoom`, `safe-url` |

### A board is a diagram OF a folio

In the OMG sense that a `BPMNDiagram` is a diagram of a `bpmn:process`: the
folio carries what is true; the layout layer carries where it was drawn; the
arrow runs `folio → board → position → note` and never back. `board-positions`
may not put `x`/`y` on a note, and **a folio is complete with no board** —
deleting every board loses layout and no content.

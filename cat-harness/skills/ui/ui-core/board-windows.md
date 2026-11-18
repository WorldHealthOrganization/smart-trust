---
name: board-windows
description: >
  Everything starts as its avatar; opening projects a window onto the board.
  The two mechanisms that must not be conflated, z-order, and the fixed chrome
  a content kind fills in.
---

# Start in the avatar, open into a window

Everything starts as its avatar, and `[x]` closes a window back to it. Opening
projects a window onto the board; selecting any part of a window raises it.
Each content kind controls its own avatar and rendering, and opens into a
full-screen panel with fixed controls such as `[x]`, `[linksrc]` or `[edit]`.

## TWO mechanisms, and conflating them is the defect

| | trigger | who |
|---|---|---|
| **semantic zoom** | the card's rendered width crosses a declared threshold | automatic |
| **open / close** | `[x]`, or opening a card | a person |

**An open window is not a zoom state**: it is projected *onto* the board rather
than being the card grown large, so it survives zooming out. Only `[x]` closes
it. Collapsing the two gives a board where a card can close itself with no
action taken, and where `[x]` and a zoom-out are indistinguishable.

### Semantic zoom is the GLASS's, not the board's

Every board slot — a landing sticky and a todo sticky alike — is **one
component**: the same closed square tile (`--fa-sticky-tile-size`) with the
theme's faded art, and the same compact icon row underneath it. A slot is its
closed tile at **every** width, so **semantic zoom does not run on the board**.
It decides what a card shows **on the folio glass**, where a card is resized
freely. Do not add a width observer to the board grid: it would be a zoom with
nothing to change, and the next agent would read it as the card's state.

## One sticky, one icon row, in one order

Under every sticky, on every panel: **view, edit, pin, send to fsh-guts**, as
icon buttons. An icon-only control carries `aria-label` (what a screen reader
announces) AND `title` (the same words on hover); they are not
interchangeable. No control sits inside the card body. The open window's bar
uses the same icons for the same acts. A link the sticky cannot serve is
absent, never dead.

## Pin is a toggle onto the FOLIO glass

There is one store answering *"what is on my glass"*: the folio. A second
store holding a page-level copy of the card gets no glass tools, no folio
geometry and no shelve, and has to be special-cased by the glass filter and
count.

- **Pin makes the sticky a folio asset** — `todo/<id>` (the key the glass's own
  Todos panel pulls a todo out under, so the two ways onto the glass agree) or
  `landing/<slot>` — with `shown: true`, drawn by the glass's own card path and
  placed by `placeOnGlass`. A landing sticky's theme, picture URL and text
  travel in the entry as data, never as stored markup.
- **Unpin is `shelveFromGlass`** — the middle of the three states below. The
  entry stays; the same pin puts it back, where the reader left it.
- **The pressed state is the store's answer** (`folioStateOf(key) ===
  "glass"`), never the button's memory. The glass's own × shelves too, and the
  row's pin follows it.

## Send to fsh-guts asks first

A control a reader has to ask about has not said what it does, so discard is
named for where it goes (**Send to fsh-guts**, the trashcan that is kept) and
opens a confirmation that names the sticky, says it is restorable and
per-browser, and says **where** it is restored from — the fish in the navbar's
icon row. Focus starts on Cancel; Cancel and Escape do nothing but close it. A
dialog whose dismissal performs the act did not ask. The window bar's send is
the same act and takes the same confirmation. The inverse is Restore in
fsh-guts.

## The threshold is declared, inherited, and traceable

`schemas/kg/semantic-zoom.ts` (instance data: `semantic-zoom.json`): a **folio
default** (`belowPx`) with a **per-kind override** (`byKind`) — the
repository's inheritance rule (*inherit everything, override anything; a
variant states only what it CHANGES*). So:

- the folio always has a number, and every kind resolves to one;
- a kind that states nothing is **complete, not invalid** — requiredness is
  checked after resolution, never on the declaration;
- an override carries a required `because`, and the resolver returns the
  **source** alongside the value, so a reviewer can tell a deliberate override
  from a folio default that does not fit.

**The boundary is stated once.** Strictly below the number, so the declared
width is the last one that still shows words. A boundary written one way in a
comment and the other way in the renderer makes a card flicker.

## Z-order: selecting any part raises

Windows stack, and **selecting any part of one raises it** — not a title bar,
any part, because a reader who clicks into a window's content has already said
which one they mean.

**Z-order is session-only.** The DI layer carries no `z`: a committed stacking
order would make every raise a file write and every two sessions a conflict,
on the most concurrently-edited state a folio has. If that proves wrong, `z` is
one optional field in the positions document.

## The chrome is fixed; the kind fills it in

A content kind **declares which controls it offers**, and the platform fixes
the frame:

- `[x]` is always present and always in the same place, so a reader learns the
  frame once;
- a declared control that names nothing known is a **finding**, not a missing
  button;
- a control the environment cannot perform is **hidden, and the reason
  reported** — a dead `[edit]` 404s for exactly the reader who cannot edit,
  which reads as *"this page is broken"* rather than *"you cannot do this"*.

## Closing must have a reachable inverse

**An action whose inverse is not reachable is not a toggle.** On an overlay,
close may set `hidden`, because the launcher tile re-opens it. On a board that
IS page content, `hidden` removes a section of the page, so the inline board collapses to a control in its own position,
and focus follows it — left alone, focus lands on `<body>` and the keyboard
position is gone. A control two clicks deep inside a collapsed launcher does
not count as reachable.

**A default of "hidden" is allowed only with the inverse on screen.** The
glass's tile strip starts slid away; its "Show tiles (N)" tab stays in view, in
the strip's own position, and the same tab hides the tiles again. See
[`harness-tiles`](harness-tiles.md) §"The glass strip".

## The floor, which is not negotiable

This layer's declared interaction profile is **low-dexterity**. Every board
action is keyboard-operable; drag is an accelerator and never the only way in.
Targets are at least the tile size. And the board is ALWAYS collapsible to a
linear, tile-based listing — a board that cannot be read linearly cannot be
read by a screen reader, printed, or translated.

### The listing is the ARTEFACT and the board is the overlay

The board is an extra laid over a simple tile-based listing. So the floor must
be correct **with no JavaScript at all**, not merely when the board is toggled
off: notes built only by `docs-ui.js` from a `fetch` of
`assets/todos/index.json` give a reader with JavaScript off no note, no count,
and no hint that notes exist. Three checks follow:

**Document order, never the board's order.** The board may stack by BPMN
subprocess depth; the floor does not, because document order is what a screen
reader and a printout depend on, and a floor that reordered would be a second
answer to "what comes next".

**Collapsed, never removed.** When the board mounts it moves the listing into a
disclosure so the page does not show the same notes twice. It does not delete
it, hide it from assistive technology, or `display: none` it: a listing the
board removed would have no way back while the board is open.

**Assert against the SERVED HTML.** A test that reads the DOM passes because
the board built that DOM. The assertion is on bytes the server sent — a
browser context with `javaScriptEnabled: false` over the same renderer the
generator writes with.

## The folio belongs to the HARNESS, not to the library

A **content library** is something a reader browses — a replica, a published
layer, any folio published as a site. A **folio** is the reader's own
surface: their notes, the assets they have materialised, the documents they
created or linked.

So the folio visualisation is `cat-harness`'s, **available by convention on
any harness**, and a library never implements its own. A library may have its
own landing page and its own harness; neither is licence to build a second
folio. **Consistency is the requirement**: a reader moving between libraries
must find the same folio, because the point of carrying a folio is that it does
not change underneath them.

A note or a todo MAY reference nodes in **another** KG library. The folio is
not scoped to the library it is pulled down over, so a renderer must not
assume local resolution.

## A tile, or an avatar?

A tile is what the HARNESS declares, an avatar is what the FOLIO holds, and a
theme is how either one looks rather than a third kind. The test is in
[`harness-tiles`](harness-tiles.md) §"A tile, or an avatar?", and only there,
because one rule with two homes is free to drift.

## An asset has THREE states, not two

Pulling the folio down gives a **glass** — a surface over whatever is being
browsed, carrying sticky notes and the avatars of materialised assets,
including materialised KG like `cat-bootstrap` or `cat-harness` themselves.

| state | where the asset is | how it got there |
|---|---|---|
| **in the library** | not the reader's at all | the default |
| **in the folio, not displayed** | materialised into the folio's own `reproduce` directories — `library/` for the bytes, `uploads/` for a source — off the glass | the reader closed it, *"back in library"* |
| **on the glass** | displayed in the pulled-down folio | the reader pulled it out of the library |

**"In the folio" is not `folio/`.** The folio is the reader's REPOSITORY, of
which `library/` and `uploads/` are declared parts — both carry `dependents:
"reproduce"`. `folio/` is a different graph typology: **renderable** authored
content. `corpus-grep` searches `library/` only, so a node materialised
anywhere else reads as ABSENT to every consumer.

**Closing returns an asset to the middle state and NEVER to the first.** Only
its display goes. Putting it back on the glass is a separate act performed
**from the library**, not from the glass it just left. A two-state model would
make *closing a sticky* and *un-materialising an asset* the same gesture, and
a reader tidying their glass would silently discard work; the middle state is
what makes closing cheap enough to do freely. When you implement
close, check that the library offers the way back — not that the glass does.

**Close says where the way back is, at the moment of closing.** The glass's
`[x]` opens a confirm that names the layer's library and links it; Escape
and Cancel leave the card where it is, and only the confirm shelves it — after
which the glass says, with the same link, where the asset went. Naming the
library matters because a reader holding assets from several libraries would
otherwise have to remember which one each came from.

**The place is the card's own, so there are three.** A library card goes back
to its layer's library, a todo to the Todos board, and a landing sticky
pinned to the glass to the page it was pinned from; calling a sticky "your
Todos" would send the reader to a list it was never on. One function answers
"where does this card go back to", and the confirm, the status after it and
the `[x]` button's own label all read it, so the three cannot disagree. The confirm is the page's one
confirm dialog, shared with sending a sticky to fsh-guts, so focus-on-Cancel
and Escape-cancels are stated once.

Opening a library card goes to the asset's visualizer when its index entry
declares one, else to its entry page; resizing is a corner drag, with `+`/`−`
in move mode and the move bar's buttons as the non-drag path.

## Two settings panels, two names, each points to the other

The glass has its own settings (theme, avatars, opacity, blur), and the page
has its own under ▦ Actions (scheme, reading preferences, the Discarded fish,
Declared kinds). They are named **"Glass settings" and "Page settings"**, so a
screen reader does not read two controls identically, and each panel opens
with a link to the other, as its first control, because a reader who opens the
wrong panel needs a pointer to the right one. Site chrome and board state are
unrelated settings but they are neighbouring places, and a reader moves
between places.

- **The names are declared once** (`SETTINGS_NAMES` in `docs-ui.js`), because
  each panel's link prints the OTHER panel's name; a panel renamed in one
  place only would leave the other panel's link naming something that no
  longer exists.
- **The link must OPEN its target, not toggle it, and not open it
  underneath.** The glass's `openPanel` closes a panel that is already open,
  and the open glass covers the sidebar where Page settings lives. So the
  glass-to-page link shuts the glass first, and the page-to-glass link shuts
  the launcher first. In both cases focus lands on the target panel's heading.
- **No link to nothing.** A page with a glass and no sidebar has no launcher.
  Each panel registers an opener, and the link is drawn only when its target
  registered one.

The same holds for any future pair of panels that share a word: name each one
for what it acts on, and point each one at the other.
`scripts/tests/settings-labels-distinct.test.ts` checks the source;
`test/settings-crosslinks.e2e.ts` checks the rendered page at 1280×800 and
390×844, by mouse and keyboard.

## Lazy window content fetch and render safety

Rendering the board with `N` cards makes **0** per-card detail fetches up
front: each board slot (`todoSlot` / `renderBoardTiles`) renders only its
summary tile/avatar. When a card carries a per-card detail or artifact URL
(`detailHref`, `bodyHref`, `artifactHref`, or a non-inlined `jsonldHref`),
opening its window (`openCard` / `createLazyWindowLoader.openWindow`) fetches
that card's content **lazily on open**, caches the result by card `id` (so
re-opening uses the cached result and never pre-fetches the other `N - 1`
cards), and
renders any body or tool/skill output through the declared `renderToolOutput`
(`RENDER_AS`: `text`, `url`, `markdown`, `json`) and `safeHref` boundary
(`schemas/ui/render-output.ts`, `site-chrome/assets/js/docs-ui.js`). A refused
URL scheme (such as `javascript:`) is never fetched and is shown as escaped
text.

## Not this skill

The layout layer and why a note carries no coordinates:
[`board-diagram-interchange`](board-diagram-interchange.md). Relocating content
out of a folio is `deletion-requires-confirmation`, applied by
the content core's `processes/ui/board-relocate.bpmn`.

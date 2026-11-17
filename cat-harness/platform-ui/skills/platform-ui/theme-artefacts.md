---
name: theme-artefacts
description: >
  The per-surface SPECIALISATION layer — sticky, landing board, docs
  background, navbar avatar. Only what DIFFERS lives here; the general rule
  lives in its stage. Read this last, after the stage that owns your question.
---

# Per-artefact specialisation

**This is level 3 of the axis, and it is deliberately the narrowest.** The
general rule lives in its stage — `intake`, `declaration`, `generation`,
`contrast` — and an artefact carries only its difference.

The avatar crop boxes are the worked example: the **rule** that a crop is
declared data belongs to `theme-declaration`; the **boxes themselves** are
navbar-avatar specialisation, and they are below.

## The surfaces

| artefact | what differs | where |
|---|---|---|
| **sticky** | the container sizes to its CONTENT, so a text region would reimpose the geometry the sticky removes | `schemas/content/landing-sticky.ts`, `.fa-sticky` |
| **landing board** | text is composited INTO the art, so it needs `textRegion` per layout and a crop chosen by content shape | `docs/_includes/landing.html` |
| **docs background** | the page ground, not a card — a different CSS surface and probably a different crop set | not built |
| **navbar avatar** | the art CLIPPED to the subject in a square frame — `avatarRegion` | `<name>.json`, `bun run cat avatar:crops` |
| **the mark** | ONE geometry, TWO inks — a scheme pair, because one ink cannot clear 3:1 on both grounds | `<name>.json` `mark` + `mark-dark`, `docs/assets/img/icons/` |

## Sticky: art backs it, text does not sit IN it

**Most sticky-backing art carries no `textRegion` on purpose.** A sticky is a
container that sizes to its content; a region would fit the text into a cloud
interior, which is the geometry the sticky exists to remove. The three
`landing-*.webp` entries keep theirs because the composited landing path still
uses them.

**A floating sticky keeps its theme.** `.fa-sticky-floating`'s opaque override
is scoped to `:not([data-fa-sticky-theme])`, because the theme is a property of
the sticky and not of the pinned state. That scoping is sound
only while every theme surface is opaque, which is why `theme-declaration`
carries the rule and `themes.test.ts` gates it.

## Landing board: the crop is chosen by CONTENT, then overridden by viewport

The default crop is the one the sticky's content wants — computed from how much
text and how many links the card carries. The narrow-viewport `<source>`s stay
on top of it: **content decides the default and the viewport still overrides**,
which is the right precedence, because the viewport is a hard constraint and
the content shape is a preference.

`<picture>` swaps the FILE at `30rem` and `48rem`, so the card's ratio and the
cloud's position must change at exactly those widths or the words land in the
wrong part of the art. A media query cannot read which `<source>` won, so both
sides are keyed to the same two numbers.

## Navbar avatar: the box is per-image and measured

**The avatar is the card art clipped to the cat's head and torso, not the card
scaled down.** A whole 1:1 card in a 46px frame makes the cat about four pixels
tall and every theme reads as grey mush.

Measured off a 5–10% grid overlay of each card, as fractions `x y w h`:

| card | box |
|---|---|
| `landing-card` (grumpy-cat) | 0.00 0.46 0.50 0.50 |
| `landing-library-card` | 0.14 0.40 0.42 0.42 |
| `landing-bootstrap-card` | 0.27 0.615 0.24 0.24 |
| `landing-operations-card` | 0.17 0.475 0.27 0.27 |
| `landing-engineer-card` | 0.00 0.40 0.46 0.46 |
| `landing-analyst-card` | 0.05 0.48 0.36 0.36 |
| `landing-architecture-card` | 0.02 0.38 0.44 0.44 |

**Only CARD crops carry one.** The avatar is cut from the square crop; a box on
the laptop or mobile art would be measured against a composition the frame
never shows — and it would validate, because squareness is checkable and
relevance is not.

**The schema cannot see whether a box frames the subject** — a box can be
square, in bounds, and still clip the head or sit on scenery. Render and look:

    bun run cat avatar:crops     # every declared box, drawn on the card and clipped
    bun run cat theme:sheet      # every theme: palette, contrast, art, both regions

## The page ground: the first paint is DARK

**The rule: the first frame of every published page is dark. A light page
becomes light AFTER that, never the other way round, and a reader in dark
mode never sees a light frame.** A dark frame before light is a blink; a white
frame before dark is a flashbulb in a dark room — the asymmetry is the whole
reason for the default.

What that takes, on any page that picks its scheme on the client:

1. **Decide the scheme before any stylesheet paints.** An inline, render-
   blocking script in `<head>` sets `data-fa-scheme` on `<html>` from the
   reader's stored choice (`fa-color-scheme`, the key `docs-ui.js` writes),
   else `prefers-color-scheme`, else **dark**. On the Jekyll site this is the
   `fa-first-paint` block at the top of `_includes/head_custom.html`, and it
   also switches the theme's stylesheet while the head is still being parsed,
   so a light reader is light from the first frame too.
2. **Paint `html` dark from the very first CSS** (light only when the
   attribute says light). A page ground that nothing paints is the browser's
   WHITE canvas whenever the theme's sheet is missing — a slow CDN, or a swap.
3. **Never swap a stylesheet the page is already painting with.**
   `jtd.setTheme(name)` swaps just-the-docs' first stylesheet, and a swap
   UNLOADS the sheet until the new file arrives, which flashes white.
   `applyScheme` in `docs-ui.js` asks `jtdShows(name)` first, so a stored
   choice that the page already shows swaps nothing.

**How it is held:** the tools layer's `test/first-paint-scheme.e2e.ts` lifts the
shipped snippet out of `head_custom.html`, holds the deferred bundle, and reads
`html`'s computed background before the bundle runs; it holds the dark sheet in
flight to prove no swap happens; and it checks a stored light choice ends up
light. A page you add that emits its own `<head>` is covered by the same spec's
"generated dashboards" block — add it there.

**Pages that switch nothing with script cannot flash**, and do not need the
snippet: the generated dashboards (`state-visualizer.ts`,
`gen-translation-status.ts`) paint dark from their first CSS, and the viewers
that follow `@media (prefers-color-scheme)` are decided by the browser before
first paint. Do not give a dashboard the snippet as a tidy-up: it would switch
ON `data-fa-scheme="light"` rules that are unfinished and fail axe contrast.

## Adding a surface

1. Find the stage that owns the general rule and read it.
2. Add **only the difference** here.
3. If the surface renders art behind text, it inherits `theme-contrast`
   unchanged — a measured scrim, AAA over pure black.
4. If it renders art at all, render it and LOOK.

## The mark: one geometry, two inks, and the pair is a MEASUREMENT

A mark is not a sticky backdrop — it is a small glyph that sits on the sidebar
header, on the page, and in the browser's tab strip. The rule that makes it
different from every other artefact above:

> **One ink cannot clear 3:1 on both grounds. So a mark is a PAIR, and the
> second file exists because of a number rather than because somebody wanted
> a darker one.**

Worked, from `cat-harness`:

| ink | on white | on the light sidebar `#f5f6fa` | on the dark sidebar `#27262b` |
|---|---|---|---|
| `#596a5b` (the supplied art's own) | 5.77:1 | 5.35:1 | **2.60:1** |
| `#9db89f` (same hue, lifted) | — | — | 7.00:1 |

3:1 is the bar for **meaningful non-text content**, and the light ink is under
it on the dark ground.

### Two inks, never two drawings

Both variants are emitted from **one trace**, differing in a single `fill`
attribute, so they cannot drift: re-run the generator and both change
together. Never hand-draw a second dark mark: it would be a second answer free to
drift, the same failure as a hand-written stylesheet beside the theme node.

### Not a CSS filter

The obvious cheaper move is one file plus a `filter: brightness()` under the
dark scheme. Do not: a filter over an arbitrary path is a **guess** about the
resulting colour, and the entire reason the pair exists is a measured ratio.
You cannot measure what a filter will produce without rendering it, and if you
are rendering it you may as well declare it.

### Which surface follows which scheme

They are not the same question and the answer differs per surface:

| surface | follows | why |
|---|---|---|
| sidebar mark | the PAGE's `data-fa-scheme` | it sits on the page; both `<img>`s are emitted and CSS picks one, because Liquid cannot read a client-side attribute |
| browser tab icon | the OPERATING SYSTEM, via `media="(prefers-color-scheme: …)"` | a `<link rel="icon">` is resolved outside the page's styling and cannot read the DOM — and the tab strip is browser chrome, which follows the OS, so matching the OS is matching what it actually sits on |

A reader who sets the page against their system will see the two disagree.
**That is correct**, and the note in `head_custom.html` says so: each matches
its own background, which is the only rule satisfiable everywhere at once.

### Absent is a real state

A layer that declares no `mark-dark` renders its one mark in both
schemes. `imageForRole`
returns undefined and both templates fall back; nothing downstream
special-cases a folio that never opted in.

### Tracing supplied art

When somebody hands over a raster mark, trace it rather than approximating it
by hand: a hand-drawn approximation can differ in kind from the original (a
solid silhouette where the art was line work). Three things to know:

- **`potracer` treats ZERO as foreground**, the inverse of what the name
  suggests. Passing the ink mask directly traces the *background*.
- **Crop to square with an explicit canvas**, not `Image.crop` past the edge:
  PIL pads with black, and the tracer reads that as ink.
- **Measure the result.** Rasterise the traced path and compare it to the
  source bitmap — IoU against the original is a fact, "it looks right" over a
  2 KB path is not.

Check the reduction too, rather than assuming a small variant is needed: thin
strokes vanish at tab size, but fill-only art has no such floor. Measure the
ink fraction from 16px to 32px.

## Related

- [`theming`](../../../skills/ui/theming/theming.md) — which stage owns your question
- [`theme-declaration`](theme-declaration.md) — the rule these specialise

---
name: theme-generation
description: >
  Turning a declared theme into CSS — `bun run cat themes:css` — and the single
  consumer-side failure this stage exists to stop: a theme with no CSS rule
  falls back to an opaque surface and paints over its own art.
---

# Generating a theme's CSS

**Consumer stage.** `declaration` says what a theme is; this says what a
stylesheet gets told about it, and what happens to a reader when it is not told.

## One command — run it

    bun run cat themes:css          # regenerate site-chrome/assets/css/themes.css
    bun run cat themes:css:check    # fail the build when it is stale

`scripts/gen-themes-css.ts` reads `schemas/ui/themes.ts` and writes
`site-chrome/assets/css/themes.css`. **Never hand-edit the output.**

## The failure: a theme with no rule paints over its own art

`.fa-sticky` paints `var(--fa-sticky-grad-from, var(--fa-sticky-surface,
rgba(128,128,128,0.08)))` as its background. A theme's `[data-fa-sticky-theme=
"<id>"]` block is what sets those custom properties. **If the generated
stylesheet has no block for a theme, the sticky does not render unthemed — it
renders with the FALLBACK surface, opaque, over the art.**

So the symptom is *"the art is not showing"* and the cause is *"the stylesheet
was not regenerated"*. Those look nothing alike, which is why the cause gets
rediscovered rather than read.

**This is a CONSUMER fact, and the producer/consumer axis is what makes it
one.** The generator did its job — it was not run. The reader of a missing rule
is where it goes wrong, and a reader that falls back to something opaque hides
the very thing whose absence it is reporting.

**A fallback that is INVISIBLE is the design error**, not the missing run —
the same reason a theme missing a layout is invalid rather than degraded: the
degraded one ships and the invalid one is noticed.

## The default block is for "nothing has selected a theme"

    .fa-sticky-board:not([data-fa-sticky-theme]) { … }

An unthemed board is a **state, not an error** — leaving it unstyled would make
"no selection yet" look broken. Note the scope: it is the BOARD, not every
element, and a rule that matched everything would beat the per-theme blocks.

## Every value is a named role

`--fa-sticky-surface`, `-ink`, `-edge`, `-accent`, never a colour name. Emitted
by `themeCssVars`, so a theme swap touches the generated file only.

Per-layout geometry (`--fa-sticky-min-width`, `-padding`, `-font-scale`) is
emitted three times per theme: base, a `max-width: 40rem` media query, and a
`[data-fa-sticky-layout="card"]` block. **A phone sticky is not a laptop one
scaled down**, which is the whole reason the three layouts are declared rather
than computed.

## Before you believe a rendering

1. `bun run cat themes:css` — then look again.
2. `bun run cat themes:css:check` — 0 means the committed file matches the source.
3. Only then is *"the art is not showing"* a real finding.

## Related

- [`theme-declaration`](theme-declaration.md) — where the values come from
- [`theme-contrast`](theme-contrast.md) — what the generated ink must clear
- [`theme-artefacts`](theme-artefacts.md) — the surfaces that consume this

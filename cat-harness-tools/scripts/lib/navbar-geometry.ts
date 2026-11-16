/**
 * The navbar's geometry, stated ONCE for both surfaces.
 *
 * ## Why this is its own module
 *
 * `sjic`: *"we should have same navbar across all folios though. presented
 * same way."* The markup was unified into `lib/navbar.ts`; **the numbers were
 * not.** Measured on `main`, 2026-09-22, before this module existed:
 *
 * | | `navbar.ts` | `docs-ui.css` |
 * |---|---|---|
 * | strip at rest | 40px | `3.5rem` = **56px** |
 * | open | 232px | `15.5rem` = **248px** |
 * | open, wide viewport | *(no such state)* | `16.5rem` = **264px** |
 *
 * Three of four disagreed, and the fourth did not exist on one side. Two
 * navbars called "the same navbar" were literally different widths, and each
 * had a test asserting its own copy — which is the agreement-by-maintenance
 * `sjic` was opened to stop paying for.
 *
 * ## The sidebar's numbers won, and the reason is not seniority
 *
 * Both sides DERIVED their strip, from different premises:
 *
 * - the rail from a 20px glyph and two 10px gutters;
 * - the sidebar from *"the theme's own 1rem gutter on `.site-title`, plus
 *   `.fa-site-mark` at 2rem, plus a matching right gutter"*.
 *
 * Neither number was arbitrary, so neither could simply be overwritten. What
 * settles it is that **only one side is constrained by something outside this
 * repository**: just-the-docs' `layout.scss` carries
 * `.side-bar { min-width: 16.5rem }` inside its own `mq(lg)`, and
 * `docs-ui.css` records what happened when a session tried to cross that floor
 * — the sidebar sat 264px wide over content that began at 56px and painted its
 * border across the page. The rail is free-standing and has no such floor.
 *
 * So the constrained side sets the numbers and the free side adopts them. The
 * rail's mark grows 20px -> 32px, which also moves it the right way against
 * this layer's declared low-dexterity interaction profile: a 32px target is
 * the accommodation, and 20px was under it.
 *
 * ## The gutter is DERIVED, not re-picked
 *
 * `NAV_PAD_PX` is `(NAV_COLLAPSED_PX - NAV_MARK_PX) / 2`, which is 12px — and
 * 12px is `0.75rem`, exactly the "matching right gutter" the stylesheet's own
 * comment describes. The two derivations were the same arithmetic in different
 * units all along; this module is where that stops being a coincidence.
 *
 * @module scripts/lib/navbar-geometry
 */

/** The browser default this file converts against. Every rem here is authored against it. */
export const REM_PX = 16;

/**
 * The mark column — the avatar or glyph, and the only thing in the strip.
 *
 * `2rem`, and the size is a MEASUREMENT rather than a preference:
 * `docs-ui.css` records that the mark's ears cross the `@` ring with only a
 * 3-unit halo against a 120-unit viewBox, which is 0.6px at `1.5rem` and
 * fuses the two shapes into a disc. At `2rem` it is 0.8px and legible.
 */
export const NAV_MARK_PX = 2 * REM_PX;

/**
 * Width at rest.
 *
 * **Closed is not gone.** Asked to "have it start hidden" a session once
 * removed the strip entirely, and the owner's correction — *"clicking it away
 * completelt disappeared … i expected … that it slides to the far left, icon
 * width thick"* — is why this is a width and never a `visibility: hidden`.
 */
export const NAV_COLLAPSED_PX = 3.5 * REM_PX;

/**
 * Gutter either side of the mark. DERIVED, so the strip is exactly the mark
 * and its padding and cannot drift from either.
 */
export const NAV_PAD_PX = (NAV_COLLAPSED_PX - NAV_MARK_PX) / 2;

/** Width while open. The theme's width at its `mq(md)`. */
export const NAV_OPEN_PX = 15.5 * REM_PX;

/**
 * Width while open on a wide viewport.
 *
 * This is the `min-width` floor in just-the-docs' own `layout.scss`, not a
 * choice. Below it the sidebar is sized by `width`; at and above
 * `NAV_WIDE_MQ_PX` a `min-width` floor takes over, and a floor is not
 * something a later `width` can cross.
 */
export const NAV_OPEN_WIDE_PX = 16.5 * REM_PX;

/** Where the theme widens itself — its `mq(lg)`. */
export const NAV_WIDE_MQ_PX = 66.5 * REM_PX;

/**
 * Below this the theme is not `position: fixed` and has its own hamburger, so
 * none of the strip behaviour applies. Applying it there breaks the phone.
 */
export const NAV_STRIP_MQ_PX = 50 * REM_PX;

/** Every value above, for a generator that must not re-list them by hand. */
export const NAV_GEOMETRY = {
  markPx: NAV_MARK_PX,
  padPx: NAV_PAD_PX,
  collapsedPx: NAV_COLLAPSED_PX,
  openPx: NAV_OPEN_PX,
  openWidePx: NAV_OPEN_WIDE_PX,
  wideMqPx: NAV_WIDE_MQ_PX,
  stripMqPx: NAV_STRIP_MQ_PX,
} as const;

/** A px value as the rem the stylesheet is authored in. */
export const rem = (px: number): string => `${px / REM_PX}rem`;

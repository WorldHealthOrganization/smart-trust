---
name: theme-declaration
description: >
  What a theme IS as data — the palette, the three required layouts, and the
  per-image regions (`textRegion`, `avatarRegion`). The PRODUCER stage: this is
  where a number is written down, and the rule is that geometry over art is
  declared rather than derived, because no amount of arithmetic on an aspect
  ratio can see where a picture is quiet.
---

# Declaring a theme

**Producer stage.** Intake decides whether art may enter; this decides what is
written down about it.

## A theme is a palette AND a geometry

`schemas/ui/theme.ts` — `ThemeSchema`. Four palette roles, never colour names:
`surface`, `ink`, `edge`, `accent`, plus an optional gradient pair. A rule reads
as what it does and a theme swap touches one file.

**A theme sets the priority stripe's HUE and never its width.** The stripe is a
width as well as a colour because colour alone carrying a signal fails WCAG SC
1.4.1 and a monochrome reader cannot see it at all. `ThemeSchema` has no field
with which to try. A theme is a palette and a geometry, **not a licence to
remove a non-colour channel**.

**A gradated theme supplies both stops or neither** — the schema refuses one,
because a gradient with a single stop is a flat fill claiming otherwise.

**Surfaces must be OPAQUE.** `ThemePaletteSchema.surface` is `z.string()`, so
`rgba(…, 0.4)` parses — and `themes.test.ts` refuses it anyway, because the
floating-sticky rule depends on it (see `theme-artefacts`).
A premise a schema cannot hold is a premise that needs a test.

## All three layouts, or the theme is invalid

`laptop`, `mobile`, `card` — the set `<name>.json`'s `images[].layout` uses.

**Missing a layout is invalid, never degraded.** There is deliberately no
fallback to another layout's geometry: a theme that renders wrong on a phone
**ships**, while one that will not load is **noticed**.

## Nothing derives a theme

`ThemedTodoFields.theme` and the landing sticky's required `theme` are the
whole selection surface: an id, set by an author. **This is a rule, not a
gap.**

- **A role is a swimlane, not a property of a thing.** Nothing *is* a reviewer;
  somebody *acts as* one for a lane. A theme keyed on role would make a note's
  appearance depend on which process happened to be reading it.
- **It makes the choice unarguable and invisible.** With a table, "this one
  should look different" means editing something that governs everything else.
- **It is the conflation the layering already refuses.** Themes live in the
  harness layer while the todos referencing them stay in `todos/`.

Absent `theme` means **nobody has chosen** — a statement about an author, not a
lookup that failed.

## Geometry over art is DECLARED, never derived

Two regions, both on `KgImage`, both fractions of the image so the declaration
survives a re-export at another size.

| region | what it marks | the rule |
|---|---|---|
| `textRegion` | where the picture is **quiet** — where words may be drawn | per LAYOUT, because the same cloud sits elsewhere in a portrait crop. Absent means **do not overlay text**, never "anywhere is fine" |
| `avatarRegion` | where the **subject** is — the box a square frame clips to | per IMAGE and **square in pixels**. Absent means **no avatar can be cut from this image**, never "use the whole frame" |

**Both are judgements about a composition, and that is why they are authored**
— found by rendering candidate boxes and looking at them.

**`avatarRegion` is square in PIXELS, checked against `width` and `height`.**
Equal fractions are square only on a square image: on a 1671x941 landscape crop
the same numbers are a box 1.78x wider than tall, and a fraction-only check
passes it. A square frame scales width and height by `1/w` and `1/h`
independently, so a non-square box stretches the subject by `w/h`.

**An image declaring no dimensions may not declare an `avatarRegion` at all.**
Refused rather than accepted unchecked: one unverifiable box among verified
ones reads as verified and is not.

## What the declaration cannot tell you, ever

**Whether the box is on the right thing.** Square, in bounds, and framing a
patch of sky are compatible. So:

> Whatever declares a region is **looked at**, not diffed.

`bun run cat theme:sheet` and `bun run cat avatar:crops` exist for that one job. See
`theme-artefacts` for which crops carry which region today.

## Related

- [`theme-art-intake`](../../../skills/ui/theming/theme-art-intake.md) — the stage before: what may enter at all
- [`theme-generation`](theme-generation.md) — the stage after: what is emitted from this
- [`theme-artefacts`](theme-artefacts.md) — the per-surface specialisation

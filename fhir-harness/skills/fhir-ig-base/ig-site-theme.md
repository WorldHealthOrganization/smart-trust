---
name: ig-site-theme
description: >
  How an IG rendered through just-the-docs wears the theme its instance
  ALREADY declares: the one `webpage` theme becomes the IG site's colour
  scheme. Says which of the three theme paths applies to which surface, what
  is refused, and how to verify on the built CSS rather than on a log line.
  Read before theming an IG site, adding a theme to an IG instance, or
  concluding that a staged IG is unthemed.
---

# ig-site-theme

> Skill id: `ig-site-theme` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`

An IG staged as its own just-the-docs site (`/<instance>/ig/`) wears the
palette of the **one `webpage` theme its layer declares**, or inherits
along its `needs`. Nothing new is authored for the IG: the theme already
exists as data, and this is how it reaches the site.

## The path, end to end

1. **Declared** — the layer's `themes/themes.ts` exports `INSTANCE_THEMES`,
   one of which has `kind: "webpage"` and a `palette` of four roles
   (`surface`, `ink`, `edge`, `accent`). Declaring a theme is
   `theme-declaration`'s (opt-in `cat-harness.platform-ui`)
   subject, not this skill's.
2. **Resolved** — `stage-ig-sites.ts` `webpagePalette(repoRoot, instance)`
   reads it through `instanceThemes` (`cat-harness/schemas/theme-by-ref.ts`),
   keyed on the layer's **declared name**. A layer that declares no
   `webpage` theme inherits the nearest one along its `needs` chain,
   breadth-first, and the stage log says which layer it came from.
3. **Rendered** — `build-ig-site.ts` `colourScheme(palette)` writes
   `_sass/color_schemes/ig.scss` and sets `color_scheme: ig`. just-the-docs'
   own colour-scheme mechanism does the rest, so the IG keeps the theme's
   machinery unchanged and only its colours move. The sidebar takes `accent`;
   its text colour is chosen by contrast, and a pairing under WCAG AA is
   reported (`CONTRAST:` in the stage log), never hidden.

## What is refused, and what is said

| case | outcome |
|---|---|
| no `webpage` theme, own or along `needs` | built on just-the-docs' default light scheme, and the stage log **says** `colour scheme: NONE`, with each layer's reason (`declares themes, none of kind webpage`) |
| **two or more** `webpage` themes in one layer, or at the same distance along `needs` | **refused** — nothing says which one dresses the IG |
| a palette pairing below AA | built, and reported under `CONTRAST:` |

## Three theme paths — do not conflate them

| path | surface | data | code |
|---|---|---|---|
| **IG site palette** (this skill) | the standalone IG site, `/<instance>/ig/` | the `webpage` theme's palette | `stage-ig-sites.ts` → `build-ig-site.ts` `colourScheme` |
| **docs-page theme** | the layer's composed docs pages, `/<instance>/…` | the same theme, as CSS variables | `gen-themes-css.ts` → `_data/instance-themes.json` → `head_custom.html` |
| **IG chrome** | "fixture" pages that mirror the Publisher's template | the template chain's tokens and rules (`chrome.json`) | `schemas/ig-chrome.ts`, `ingest-ig-chrome.ts` |

The first two read **one** declaration, so an IG's site and its docs pages
cannot disagree on colour. The chrome is a different model — the Publisher
template's own CSS, ingested with its conflicts — and is not a palette.

## Verify on the built CSS, not on a log line

A staged site's theme is checked by finding the palette's hex values (here
an `accent` of `<hex>`) in the built stylesheet:

```sh
git show <gh-pages>:branches/<slug>/<ig>/ig/assets/css/just-the-docs-default.css \
  | grep -c '<hex>'
```

**Calling `stageIgSite` directly with no `palette` option prints `colour
scheme: NONE`** — true for that call, not for the layer. Do not read it as
a missing theme. Stage through `stage-ig-sites.ts` (or pass
`webpagePalette(...).palette`), and judge the result by the built CSS.

## Do not

- Author a second palette for the IG. One declaration, read by both paths
  above; a copy would be a second answer free to drift.
- Touch the theme's machinery. just-the-docs' layout, nav and components stay
  as they are; only the colour scheme is the layer's.
- Put a logo on it. Colour carries identity; the wordmark is set in type.

---
# folio-assistant-u3cd
$schema: bean/1.0.0
title: 'IG SITE THEME: build-ig-site dresses each IG''s own just-the-docs site in the palette its instance declares'
status: completed
type: feature
priority: normal
created_at: 2026-09-30T21:48:48Z
updated_at: 2026-09-30T23:42:12Z
parent: folio-assistant-o3xy
---

Issue #1682, owner 2026-09-30: theme the per-IG site at /<instance>/ig/ (bamf, #1670) reusing the webpage theme #1683 declares, not a second copy.

## Approach
- stage-ig-sites resolves the instance's ONE declared webpage theme through instanceThemes (platform, generic: fhir-harness never names WHO).
- build-ig-site writes it as a just-the-docs colour scheme (_sass/color_schemes/<instance>.scss + color_scheme in _config.yml): surface->background, ink->text/headings, accent->links/buttons/sidebar, edge->borders.
- Sidebar text is CHOSEN by computed WCAG contrast among palette roles, never a literal; below 4.5:1 is reported.
- No webpage theme declared -> no scheme, reported (not a silent default).

## Why not pageThemeCssVars
It sets --sidebar-color/--link-color/--border-color, which only folio-assistant's docs-ui.css reads. The /ig/ site is plain just-the-docs, so those would be inert there.

## Done when
- [x] scheme written from a declared palette, with tests
- [x] contrast chosen and reported
- [x] staged smart-trust site rendered locally with #1683's palette and screenshotted
- [x] PR green — #1701 merged (c8514ea), owner: "merge 1701 when green"

## Round 1 (2026-09-30)

Rendered locally: the real smart-trust source at 26635f7, with the palette resolved by `webpagePalette` against a checkout of #1683 (`who-smart-ig`: surface #f6f7f9, ink #000000, edge #eeeeee, accent #00477d). Computed styles: sidebar rgb(0,71,125), nav text rgb(246,247,249), body rgb(246,247,249), links rgb(0,71,125). Sidebar text is `surface` at 8.92:1. No contrast findings.

Two defects the first render showed, which no test had caught:
- the active nav item was light text on a light-grey highlight: just-the-docs imports its light scheme BEFORE ours, so `$feedback-color` was already derived from the default sidebar. Now re-derived from the palette.
- the footer's "Just the Docs" link was accent on accent. Now takes the sidebar text colour.

Until #1683 merges, smart-trust declares no webpage theme on main, so the staging site builds with the default scheme and the stage log says so. Nothing here names WHO: fhir-harness takes a palette.

## Coordination (2026-09-30)

Only sibling in scope: #1683 (bean `7h3u`), which declares the palette this reads. No shared files. #1683 changes neither `instanceThemes` nor the palette roles. Intent, files and asks posted there: https://github.com/litlfred/folio-assistant/pull/1683#issuecomment-5920385735. Either merge order works; #1683's "theme applied" item now covers two surfaces, and this bean does not tick it.

## Summary of Changes

Merged in #1701 (`c8514ea`, 2026-09-30).

- `stage-ig-sites` resolves the instance's ONE declared `webpage` theme through `instanceThemes` (two declared is refused; none builds with the default scheme and says so).
- `build-ig-site` writes the palette as a just-the-docs colour scheme (`_sass/color_schemes/ig.scss`, `color_scheme: ig`): surface to background, ink to text and headings, accent to links, buttons and sidebar, edge to borders. `$feedback-color` is re-derived, because just-the-docs imports its light scheme first.
- Sidebar text is the palette role with the better WCAG contrast on accent; a pairing below AA, or one not computable, is reported.
- fhir-harness takes a palette and names no IG's branding.

Rendered locally with #1683's `who-smart-ig` palette: sidebar text 8.92:1 on #00477d. smart-trust's `/ig/` site wears it once #1683 merges.

---
# folio-assistant-rtuo
$schema: bean/1.0.0
title: State tags and badges fail colour contrast on the dark theme
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:13Z
updated_at: 2026-09-30T16:12:47Z
parent: folio-assistant-4ccr
---

Tag and badge colours are fixed hex values that measure about 2.0–2.7:1 on the dark ground, below the WCAG 4.5:1 minimum for small text. Move them onto theme tokens that are validated in both schemes.

Observed on: `external-schemas`, `fsh-guts`, `kg-viewer`, `methodologies`, `navbar`, `tools` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

_2026-09-30T11:11:43Z_ — Claimed by claude/charming-curie-n04agq — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 2 still present, 1 fixed, 3 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Tag colours fixed hex, ~2:1 on dark — tools: Dark scheme (emulated plus localStorage fa-color-scheme=dark, data-fa-scheme=dark), .tg-tag over the row background rgb(48,45,54) at 11.52px: tg-shell #0d6e5e 2.19:1, tg-inproc #1d5fa8 2.09, tg-mcp #6b5b95 2.29, tg-manual #a8430f 2.24. The light scheme passes (5.91–6.45). Inline <style> is unchanged. Screenshot rv/t…
- **STILL-PRESENT** — Tag colours fixed hex, ~2:1 on dark — methodologies: Dark scheme: .mv-tag.mv-ingested #0d6e5e 2.19:1 (16 tags), .mv-cited #8a6100 2.44:1 (10), at 11.52px. No .mv-dangling is rendered now. Light scheme is 5.54–6.16.
- **FIXED** — Tag colours fixed hex, ~2:1 on dark — external-schemas: The page was restructured (17 specifications, 'user|declared by' tables) and renders 0 elements with class xs-ok/xs-na/xs-missing. The fixed-hex .xs-* rules are still in the inline <style>, now dead. The tags went with the dependents/state column. — 1b2d10c7e
- **CANNOT-TELL** — Tag colours fixed hex, ~2:1 on dark — fsh-guts: /fsh-guts/ is publish: staging-only and is absent from this build (no fsh-guts/index.html). The source cat-harness/docs/fsh-guts/index.md still defines .fg-ok #0d6e5e, .fg-side #6b5b95, .fg-gap #a8430f, but that is code, not an observation. Side note: the 'Published graphs' page (/cat-harness/) links /fsh-guts/, whi…
- **CANNOT-TELL** — Tag colours fixed hex, ~2:1 on dark — kg-viewer: /cat-harness/ is now a just-the-docs 'Published graphs' page, and the standalone KG viewer (_kg/…) is not in this build. On /cat-harness/ no link, button or badge in the dark scheme is under 4.5:1. The kg-viewer intent itself says its colour difference 'is not a contrast failure'.
- **CANNOT-TELL** — Tag colours fixed hex, ~2:1 on dark — navbar: The navbar has no fixed-hex state tags. Measured in dark: .fa-nav-note 11.66:1, the counts (fa-doc-index/folders/pages) 8.1:1, fa-tile-count 8.33, fa-translation-badge 8.03, fa-qa-badge 10.07. The only low reading is .fa-node-badge on sticky avatars (white on translucent grey over an image, 2.8:1 dark / 3.03:1 light…

## Summary of Changes — 2026-09-30

The tag inks on the tools, methodologies and fsh-guts pages were chosen for a light page. On this site's default dark one (#27262b) they measured 2.06–2.71:1, under the 4.5:1 text floor. Each page now uses dark-scheme inks by default and keeps the original inks under `:root[data-fa-scheme="light"]`, where they already passed.

**Measured in a browser**, on a local build, as the minimum over every tag on the page:

| page | dark, before | dark, after | light, after |
|---|---|---|---|
| tools | 2.09–2.29 | **6.35–7.40** | 5.91–6.45 (unchanged) |
| methodologies | 2.19–2.71 | **7.40–7.57** | 5.54–6.16 (unchanged) |

fsh-guts is published only to staging, so the local build does not include it. Its inks are the same colours, and each is computed at ≥7.03:1 on #27262b. external-schemas no longer shows state tags at all (1b2d10c7e). The navbar was cannot-tell in the re-check (no fixed-colour tags).

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 0 still present, 5 fixed, 1 could not be determined. FIXED means observed on the built page, not read from code. fsh-guts was measured on a second build composed with `compose-docs --staging`. kg-viewer was measured on the standalone viewer generated with `kg-viewer.ts --out <site>/cat-harness/index.html`, as `docs-site.yml` does.

- **FIXED** — Tag colours fixed hex, ~2:1 on dark — tools: Changed since 2026-09-29. Dark (emulated plus saved fa-color-scheme=dark, data-fa-scheme=dark), .tg-tag over the row bg rgb(48,45,54): tg-shell rgb(92,211,189) 7.40:1, tg-inproc rgb(134,184,242) 6.53, tg-mcp rgb(185,168,236) 6.35, tg-manual rgb(245,160,112) 6.53, at 11.52px (10.08px at 390). Light is unchanged: 5.91–6.45. — #1592 (contrast.mjs, D/p_tools.js)
- **FIXED** — Tag colours fixed hex, ~2:1 on dark — methodologies: Changed since 2026-09-29. Dark: .mv-ingested 7.40:1 (22 tags), .mv-cited 7.57:1 (10) on the row bg, and 8.23/8.41 on the page bg, at 11.52px. Light is unchanged: 5.54–6.16. — #1592 (contrast.mjs, C_meth.mjs)
- **FIXED** — Tag colours fixed hex, ~2:1 on dark — external-schemas: Unchanged: the page renders 0 .xs-ok/.xs-na/.xs-missing elements. The fixed-hex rules are still dead in its inline <style>. — 1b2d10c7e (contrast.mjs, rv-xs2.mjs)
- **FIXED** — Tag colours fixed hex, ~2:1 on dark — fsh-guts: Changed since 2026-09-29 (was CANNOT-TELL). On the staging build: dark .fg-ok 7.40:1, .fg-side 6.35, .fg-gap 6.53 on rgb(48,45,54) at 12px (10.5px at 390). Light 6.16/5.91/6.04. — #1592 (rv-fg.mjs)
- **FIXED** — Tag colours fixed hex, ~2:1 on dark — kg-viewer: Changed since 2026-09-29 (was CANNOT-TELL, because the viewer was not in that build). On the generated standalone viewer, no link, button, badge, count or tag is under 4.5:1 in dark (bg rgb(23,24,26)) or light (bg rgb(251,251,250)), at 1280 or 390. This is 'not reproduced' rather than a fix observed at a known before-value. (kgv.mjs against the kg-viewer build)
- **CANNOT-TELL** — Tag colours fixed hex, ~2:1 on dark — navbar: Unchanged: the navbar has no fixed-hex state tags. The only readings under 4.5:1 are .fa-node-badge / .fa-node-badge-count on sticky avatars: 2.80:1 dark, 3.03:1 light, 11px, white/black on a translucent layer over an image. (contrast.mjs)

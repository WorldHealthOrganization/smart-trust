---
# folio-assistant-2r2n
$schema: bean/1.0.0
title: 'Mobile: pages scroll sideways at phone width'
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:13Z
updated_at: 2026-10-01T18:13:39Z
parent: folio-assistant-4ccr
---

A page wider than a 390 px viewport makes the reader pan sideways to reach columns or actions. Fix in the shared table/grid CSS: wrap, stack or collapse columns at narrow widths, and let only a table's own container scroll, with a visible cue.

Observed on: `catalogue`, `folio`, `fsh-guts`, `kg-viewer`, `library`, `navbar`, `processes`, `skills-index`, `tools`, `translation-status`, `uploads` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

## Done when

- [x] No page on the bean's list scrolls sideways at 390 px
- [x] A wide table scrolls inside its own box, with a visible cue
- [x] Measured before and after with the same script over the same pages

## Summary of Changes — 2026-09-24

**Measured**, at 390×844, over 249 built pages: every page except the 681
smart-trust pages, `api/` and the translations, plus ten each from `reference/` and `uml/`.
The measure is the `scrollWidth` of the document against the viewport, and it names the outermost element that
overflows with no clipping ancestor.

| | pages that scroll sideways |
|---|---|
| first measure | 105 of 249 |
| …with the local preview fixed (see below) | 40 of 249 |
| after this change | **1 of 249** |

**Four causes, one file.** A new `assets/css/narrow-viewport.css`, applied below
the theme's 800 px breakpoint:
- A raw HTML `<table>` the theme did not wrap scrolls in its own box. That covers
  translation status, voices, the docs-auto indexes, the uploads and catalogue
  viewers, and the folio viewer's runtime table. **The cue** is a fade on the edge
  that has more content past it, done as a mask driven by the table's own scroll
  position. The first version painted `Canvas`-coloured covers. A screenshot
  showed a white band over the first column on a page that is dark under a light
  scheme, so the fix moved to a mask, which does not depend on the background.
- `pre` scrolls in its own box, which covers Mermaid source.
- Inline `code` and glossary `dd` break anywhere rather than widen the page.

Themed pages link the file from `head_custom.html`. The standalone viewers load
no theme stylesheet, so `withViewerNav` (`viewer-page.ts`) inlines the same file.
There is one set of rules, not a copy per surface.

**A right-to-left defect, found by the same measure.** `guides/ar/agent-onboarding`
was 10,389 px wide. The sidebar checkbox was parked at `left: -9999px`, and on a
right-to-left page that is the scrollable side. It is now clipped in place, in
`docs-ui.css` and `lib/navbar.ts`. The theme's skip link gets the mirrored offset
under `[dir="rtl"]`. `sidebar-strip.test.ts` now forbids parking off an edge.

**The local preview misrepresented 60 pages.** CI's `github-pages` gem always
enables `jekyll-default-layout`. Locally, a page naming no layout (all 75 process
pages among them) built as bare HTML, with no theme and no table wrapper.
`preview-site.sh` now adds the same default.

**Not fixed here: `docs/who-iris/kg-to-portal.html`** (566 px). It is a mounted
instance page, which gets neither path. Where its fix belongs is a decision, not
a defect in this change, so it is `xwrt`.

Also carried: `prov:qaqc` regenerated. It was stale on `main` itself (checked on
a clean worktree of `origin/main`), and CI would otherwise be red here for it.



## 2026-10-01 — the glass strip (ob3m finding 10), re-opened by the owner's ruling

The glass bottom strip no longer scrolls sideways at any width. It shows the declared pins that fit, then a "+N more" tile that counts everything else exactly. Measured on a local build: 1280×800 shows 6 pins plus "+12 more" (scrollWidth 1280 = clientWidth 1280), and 390×844 shows 4 pins plus "+14 more" (390 = 390). Branch `claude/quirky-hypatia-k3aoh4-strip-pinned`, stacked on #1762. Test: `cat-harness/test/glass-strip-fit.e2e.ts`.

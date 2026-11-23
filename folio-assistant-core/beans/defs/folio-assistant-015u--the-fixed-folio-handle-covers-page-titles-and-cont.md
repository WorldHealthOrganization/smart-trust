---
# folio-assistant-015u
$schema: bean/1.0.0
title: The fixed '▾ Folio' handle covers page titles and content
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:13Z
updated_at: 2026-09-24T17:45:58Z
parent: folio-assistant-4ccr
---

The Folio glass handle is fixed at the top and overlaps each page's heading, and at 390 px the glass's own first controls. Reserve space for it, or move it out of the reading flow.

Observed on: `external-schemas`, `folio`, `library`, `navbar`, `tools` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

## Done when

- [x] No page's first content sits under the handle, at 1280 or 390 px
- [x] A test fails if it comes back

## Summary of Changes — 2026-09-24

**Measured** on a local build, by the text under the handle (range rects, not
element boxes) and by controls whose centre it covers:

| page | before | after |
|---|---|---|
| themed pages (home, tools, external-schemas, a process page), both widths | clear: the handle sits in the header bar's empty middle | clear |
| folio / library viewers, 390 px | the page's `h1` | clear |
| who-iris replica | its **"INGESTED COPY — not WHO"** banner (390 px), and a link centred under the handle (1280 px) | **unchanged, on purpose**: see below |
| open glass, 390 px (the bean's second claim) | already clear, fixed by `c132`'s phone layout | clear |

**Fix:** `docs-ui.css` reserves the handle's band on the harness's own
standalone VIEWERS, selected by the mark the viewer fixture writes into each
viewer's head (`<style data-folio-narrow-viewport>`):
`html:has(style[data-folio-narrow-viewport]) body:has(> .fa-glass-handle)
{ padding-top: 3.5rem }`.

**The broader rule failed CI, and that is why it is scoped.** "Any page with
the handle and no theme header" was pushed first. `End-to-end + accessibility`
failed three tests. Each one was a rule already paid for:
- `folio-mount.e2e`: a REPLICA is unchanged while the glass is closed (bean
  `jpjt`, "who-iris exists to look like WHO"), and the band moved it 56 px;
- `sidebar-panels.e2e` and `translation-badges.e2e`: two fixtures with no
  theme header moved.

So the replica's banner is still under the handle. That conflicts with `jpjt`,
and it is recorded for the owner as its own bean rather than settled here.

**Test:** `glass.e2e.ts` checks that on a viewer (the fixture plus the viewer
mark) the handle is above the `h1` at 1280 and 390 px. Both checks failed with
the rule disabled and pass with it. The three tests above pass as well (59
across the four files).


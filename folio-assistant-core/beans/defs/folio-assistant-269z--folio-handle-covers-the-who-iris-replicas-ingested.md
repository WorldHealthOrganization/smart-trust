---
# folio-assistant-269z
$schema: bean/1.0.0
title: Folio handle covers the who-iris replica's INGESTED COPY banner — conflicts with jpjt 'replica unchanged'
status: completed
type: task
created_at: 2026-09-24T18:04:45Z
updated_at: 2026-09-24T18:04:45Z
parent: folio-assistant-4ccr
---

Found by bean 015u (2026-09-24). On the who-iris replica the fixed ▾ Folio handle covers the 'INGESTED COPY — not WHO' banner at 390 px, and at 1280 px a link sits centred under it, so a click there opens the glass instead.

The obvious fix, reserving the handle's band with top padding, is ruled out by an existing rule: `folio-mount.e2e` asserts a replica is UNCHANGED while the glass is closed (bean jpjt: who-iris exists to look like WHO). 015u tried it, and CI refused it.

It is the owner's decision. Options:
1. Accept the overlap on replicas (jpjt wins).
2. Let replicas reserve the band, and amend jpjt's rule to allow that one change.
3. Move or shrink the handle on replica pages only (e.g. a corner tab), leaving the page itself untouched.

## Done when
- [x] The owner has chosen: **bottom-right tab** (2026-09-24)
- [x] The chosen option is implemented

## Summary of Changes — 2026-09-24

**The first ruling rested on a wrong claim, and the measurement caught it.**
The owner first chose "corner tab", which I had recommended as "clear of the
banner". Measured before writing it, a TOP-right tab still covered banner
text at 1280 and 390 px, because the replica's banner runs the full width. I
went back to the owner with the measurements, and the owner chose
**bottom-right**.

**Measured** on the who-iris replica, by the text and controls under the handle:

| placement | 1280 px | 390 px |
|---|---|---|
| centred top (before) | banner text, and the `folio-assistant` link centred under it | the INGESTED COPY banner |
| top-right tab | banner text | banner text |
| **bottom-right tab (chosen)** | **clear** | floats over whichever body line scrolls past, like any floating button |
| inside the left rail | the rail's own home item | the rail's own home item |

**Fix:** `docs-ui.css` makes the handle a bottom-right tab on pages carrying the
folio mount (`<script data-fa-folio-mount>`). Harness viewers are excluded by
their own mark: the library viewer carries the mount too, and a bottom-right
tab there landed on a row's "Pull out to folio" button at 390 px. Only the
handle moves, so `jpjt`'s "replica unchanged" still holds, and
`folio-mount.e2e` passes.

**Tests:** `glass.e2e.ts` checks that on a mount-marked fixture the handle's
corner is the viewport's corner, the body has no band, and the `h1` is above
it, at 1280 and 390 px. Both checks fail with the rule disabled. 97 pass across
the six related e2e files.

## Superseded the same day — the handle moves INTO the left navbar

Owner, 2026-09-24, after the bottom-right tab was built: **"folio handle on LHS
on navbar"**. That replaces both placements: the replica tab above, and the
viewer band from `015u`. It does not add a third.

- `docs-ui.js` `placeHandle` puts the handle inside the harness rail (under the
  `☰` head) or the theme's sidebar (under the site header). Only a page with no
  navbar keeps the old top-centre place.
- The handle is now a mark (`▾`) plus a label (`Folio`). At rest a strip shows
  marks only, which is the owner's earlier *"only icons/avatars so compat"*, so the
  label shows when the strip opens, in both navbars.
- The bottom-right replica rule is removed. The viewer band rule stays only
  as the fallback for a handle at body level, which no navbar page has now.

Measured at 1280 and 390 px on home, the library viewer and the who-iris
replica: the handle sits inside the navbar on each, and covers no content.
`glass.e2e.ts` checks that, with a rail and with a theme sidebar, at both widths,
the handle is IN the navbar, covers no `h1`, and still opens and closes the glass.
137 pass across the related e2e files, and `bun run cat gates` passes 145.


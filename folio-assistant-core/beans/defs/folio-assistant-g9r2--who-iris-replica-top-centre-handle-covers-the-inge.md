---
# folio-assistant-g9r2
$schema: bean/1.0.0
title: 'who-iris replica: top-centre handle covers the INGESTED COPY banner and a link; 3 replica pages scroll sideways at 390'
status: completed
type: bug
priority: normal
created_at: 2026-09-29T23:07:47Z
updated_at: 2026-09-30T16:12:46Z
parent: folio-assistant-4ccr
---

Measured 2026-09-29 on a local build of main 35402147f.

1. **The handle is back over the replica's own banner.** 2vne (owner 2026-09-27) moved the ▾ Folio handle back to top-centre as a short pill. On `who-iris/collection-collection-hq-publications.html` at 390×844 it covers the "INGESTED COPY — not WHO" text, which is 269z's original defect. At 1280×800 its box contains the centre of the "folio-assistant" link, so a click there lands on the handle. The other five pages checked (home, tools, a process page, glossary/skills, the library index) are clear at both widths. 2vne does not mention the replica.
2. **Three replica pages scroll sideways at 390** (6 of 395 pages, each built twice under `library/who-iris/` and `who-iris/`): collection-collection-hq-publications (scrollWidth 537, a `span.none` 457 px wide), collection-collection-wpro-information-products (420, a `code` element), and community-list (537, a `code` element). 2r2n and xwrt had this at 0.

Constraint: jpjt, a replica is unchanged while the glass is closed. The fix may not alter the replica's content. It has to move or inset the handle, or scope the narrow-viewport rules.

## Landed
Merged in #1592 (e8bfa25b5) on 2026-09-30, CI green on head 0b795ca.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 0 still present, 2 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code. This bean had no 2026-09-29 re-verification section, so its two numbered findings from the bean body were measured.

- **FIXED** — 1. The handle is back over the replica's own banner: Changed since 2026-09-29. On who-iris/collection-collection-hq-publications.html, community-list.html and index.html, .fa-glass-handle is at x596–684 y0–28 (1280) and x151–239 y0–28 (390). The 'INGESTED COPY' banner text box is at x98–420 y49–66 (1280) and x80–337 y49–89 (390). At both widths, no text run or link is under the handle, and no element's centre is covered. — #1592 (g9r2.mjs)
- **FIXED** — 2. Three replica pages scroll sideways at 390: Changed since 2026-09-29. 0 of the 14 replica HTML pages under who-iris/ and library/who-iris/ have scrollWidth > 390 at 390×844 (was 537/420/537). New, outside this finding: at 1280 two replica pages scroll sideways (collection-collection-hq-publications 1366px, community-list 1503px), from the nowrap .dl download/metadata cells. See summary.md. — #1592 (g9r2.mjs, wide.mjs)

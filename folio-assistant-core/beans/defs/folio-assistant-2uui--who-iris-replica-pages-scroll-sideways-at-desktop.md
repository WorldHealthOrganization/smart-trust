---
# folio-assistant-2uui
$schema: bean/1.0.0
title: WHO IRIS replica pages scroll sideways at desktop width
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
created_at: 2026-09-30T16:12:48Z
updated_at: 2026-09-30T17:17:27Z
parent: folio-assistant-4ccr
---

Found 2026-09-30 by the wireframe QA re-run on main 3779d5d27 (1280×800 and 1024).

- who-iris/collection-collection-hq-publications.html: document 1366px wide at a 1280 viewport.
- who-iris/community-list.html: 1503px at 1280.
- A third page is too wide at 1024.

Cause: the download / 'Metadata record' cells do not wrap. #1592 (g9r2) made them wrap only below 640px, so phones are fixed and desktop is not. Not confirmable as a regression: the column predates the 09-29 build and nobody measured 1280 then.

## Done when
- [ ] No replica page's scrollWidth exceeds clientWidth at 1280, 1024 or 390, measured on a built page.

## Landed
gen-iris-pages: `.dl` wraps at every width (long file names break inside the link; the short format/size label stays whole). Measured on the regenerated pages with Playwright: no replica wider than its viewport at 1280, 1024 or 390 (before: community-list 1475/1405, hq-publications 1338/1268, wpro 1162 at 1024). folio-mount.e2e gains 1024 and 1280 cases, shown to FAIL against the old pages and pass on the new.

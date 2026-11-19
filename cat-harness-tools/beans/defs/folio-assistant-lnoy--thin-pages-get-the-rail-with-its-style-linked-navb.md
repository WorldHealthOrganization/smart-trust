---
# folio-assistant-lnoy
$schema: bean/1.0.0
title: 'Thin pages get the rail, with its style LINKED: navbar.css as a shared asset, folio-navbar: linked'
status: completed
type: task
priority: normal
created_at: 2026-10-05T13:30:03Z
updated_at: 2026-10-05T15:23:55Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: chose '1. Add the rail' for the 95 built pages with no navbar, then, told they decline on purpose (the rail is 7.9 KB, 4.3 KB of it CSS, on pages of 1.4-3 KB), '1. Shared rail style first'. thin-page.ts and gen-library-viz.ts decline 'until the rail is itself a shared asset'.

## Done when
- [ ] assets/css/navbar.css generated from navbarCss(), with a check that it matches
- [ ] a page declaring folio-navbar: linked is railed with the rail CSS and the row script linked, not inlined
- [ ] thin pages (library entries, openapi operations, todos) declare linked instead of none
- [ ] id-lookup: why it has no rail, and fixed
- [ ] gate: every committed page has a navbar, declares one, or is a redirect
- [ ] rendered: a library entry and an openapi operation page show the rail and the row


## Measured 2026-10-05, the falsifier in the opening brief
The rail's MARKUP, not its style, is the weight: on a real library entry (2,919 B), the build rail pass with style linked gives 26,209 B raw. The <nav> alone is 20,808 B: 25 links, each with an inline SVG glyph, a colour swatch and its description twice (title + sr text). gzip: 1,266 B before, 5,053 B after (+3.8 KB on the wire); nav alone 3,329 B gzipped. Linking navbar.css saved 4.3 KB of 30. Brought back to the owner.

Done: merged in #2185 (f409544). Rail drawn in the browser from shared data on every railed page (owner chose option 3 everywhere); 92 railed, 69 linked, 0 declined, 0 missing. id-lookup's missing rail split to its own bean.

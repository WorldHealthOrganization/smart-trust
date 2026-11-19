---
# folio-assistant-5ea6
$schema: bean/1.0.0
title: 'PDF INLINE VIEWER: pinned pdf.js generic viewer on the site, embed on who-iris item pages, as skill + Tool node'
status: completed
type: feature
priority: normal
created_at: 2026-10-04T18:40:22Z
updated_at: 2026-10-05T05:35:26Z
parent: folio-assistant-o3xy
---

Owner request 2026-10-04: lightweight inline PDF viewer (search, scroll, jump to page, print, download) for CDN-hosted PDFs, e.g. who-iris item pages. Owner chose option 2 (pdf.js generic viewer copied onto the site) and asked for it as a skill and a tool.

## Todo
- [x] vendor script: pinned pdf.js release, sha256-verified, pruned, installed into _site at build time (not committed)
- [x] cross-origin open shim with an allowlist (pdf.js generic viewer refuses cross-origin ?file=)
- [x] embed fragment module (generic, platform side)
- [x] who-iris item pages embed it only when the PDF is published (never for withheld)
- [x] Tool node + MCP tool
- [x] skill
- [x] wire into docs-site.yml and feature-staging.yml
- [x] tests, gates, rendered verification, staging deep link

## Progress 2026-10-04

All eight items are done on PR #2120 (head `2e2d7a6`, CI green). Staging deep link:
https://litlfred.github.io/folio-assistant/STAGING/claude-vibrant-darwin-r6im60/who-iris/item-item-18892cf3-5a4f-42a4-923c-a93f4a594dec.html

The bean stays in-progress until the owner signs off and the PR merges. An agent does not close issue #2119.


## Summary of Changes

Merged in #2120 (merge 24b5c12, 2026-10-05; owner: "land it now with option a"). Changes:
- cat-harness/scripts/pdf-viewer.ts: pinned and hash-checked pdf.js 6.4.299 (legacy build), installed into _site by docs-site.yml and feature-staging.yml.
- An allowlisted ?src= shim; the embed derives the site root, loads lazily, and is version-tagged.
- who-iris item pages embed the viewer only when the PDF's publication gates permit.
- Skill ui-core/pdf-inline-viewer; Tools pdf-viewer-install and pdf-viewer-embed.
- The site rail and the staging banner skip the vendored viewer.
- The staging banner is now fixed and full width.
Issue #2119 is left open for the owner.

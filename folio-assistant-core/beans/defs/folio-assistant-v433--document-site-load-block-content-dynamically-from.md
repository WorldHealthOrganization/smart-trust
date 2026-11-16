---
# folio-assistant-v433
$schema: bean/1.0.0
title: 'DOCUMENT SITE: load block content dynamically from the published graph instead of one multi-MB page (owner: ''dynamic JS load of KG, as should of rest of content'')'
status: completed
type: feature
priority: high
created_at: 2026-10-06T20:28:26Z
updated_at: 2026-10-07T17:15:00Z
parent: folio-assistant-q4jm
---

Owner, 2026-10-06, after the DPI-H page (933 blocks, 2.3 MB HTML) was heavy to load: 'that can be dynamic JS load of KG, as should of rest of content', then 'Start building it now on this branch.'

Design: the document page becomes a SHELL (headings, block anchors, block actions, comment notes) and each block's rendered HTML is published as data, one JSON per chapter, loaded when it nears the viewport and then the rest in idle time. A full page stays published for file://, no-JS readers, search engines and the review tools.

## Done when
- [x] build-document-site writes the shell, per-chapter block JSON and the full page
- [x] blocks near the viewport load first; a #block link loads its chapter and lands on it
- [x] file:// and fetch failures fall back to the full page
- [x] tools that read or picture the document page still get the full content
- [x] measured before/after on smart-ra (page size, longest task)
- [x] skill and tests updated


_2026-10-06T21:00Z_ — Built and pushed (01820ca): shell + blocks/NNN.json + full.html, compact block-actions, notes fetched from pc-notes.json. Measured on smart-ra: 2.3 MB -> 621 KB, load 1,078 -> 155 ms, longest task 199 -> 73 ms. Owner: search only needs the dashboard (PC search), not the document page. Owner: make edit/feedback links dynamic across ALL harness visualizers, not just here (inventory running).


_2026-10-06T22:00Z_ — Edit/feedback links unified across visualizers (owner: 'make sure feedback/edit links are changed across all harness/visualizers to be dynamic'): recipe moved to cat-harness/src/core/edit-links.ts (acb447c); folio site (8496ba0); IG site (31122d2); docs pages, skill and schema pages (50a4e1e); todos, stickies, harness panel, work-plan dashboards (eae4df6). Left on purpose: public-comment 'Discuss' (a change-set discussion form, not an edit/feedback link on content); bootstrap-tools 'Improve this page' (bootstrap-tools may import only itself; one static link per page).

## Completed
All 6 acceptance criteria completed and verified. Dynamic block loading implemented and verified for document site.

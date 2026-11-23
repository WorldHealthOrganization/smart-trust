---
# folio-assistant-tbdl
$schema: bean/1.0.0
title: Jekyll pages' navbar shows no open-document index — only the injected rail supplies documentIndex
status: scrapped
type: task
priority: normal
created_at: 2026-09-30T11:23:09Z
updated_at: 2026-10-01T05:31:25Z
parent: folio-assistant-yj32
---

Found closing `sjic`, 2026-09-29/30, session https://claude.ai/code/session_014nDNCRPYSuF4DiJUP7wMDq.

The owner's spec (in `sjic`): *"when a document or other indexed object is opened, the document index/idices are shown in a navbar tab/menu."*

## Measured

- `NavbarModel.documentIndex` has ONE supplier: `harness-rail.ts:118`, which calls `documentIndexOf(html)` on a finished page. So mounted and generated pages get it.
- `gen-navbar-include.ts` builds the Jekyll sidebar's model with no `documentIndex`. It cannot: the include is committed and shared by every page, and the index is per page.
- Published `gh-pages` (built from `f2d58d67b`): `index.html` and `getting-started.html` carry the renderer's `fa-nav-top` and no index group.

So on the ~1,300 Jekyll-laid-out pages the fixed top shows the instance and nothing about the open document.

## Two shapes, neither chosen

1. A post-build pass, like `rail-standalone-pages.ts`, that runs `documentIndexOf` on each finished Jekyll page and inserts the group into `.fa-nav-top`. It uses the same function, so the result matches the rail.
2. Liquid over `page.content` headings. This is a second implementation of `documentIndexOf`, which is the drift `sjic` exists to stop.

Option 1 looks right. It is recorded here, not decided.

## Done when

- [ ] a Jekyll page with addressable headings shows its index in the navbar's fixed top, from `documentIndexOf`
- [ ] a page without headings shows no empty group
- [ ] verified on a built page, before and after
- [ ] `bun run cat gates` green

_2026-09-30_ — Filed under `yj32`, not `p5wm`: on this date `main` re-parented its siblings `sjic` and `oi1y` there by subject (bean `ansc`, todo-manager §"WHICH parent"), and this bean is the same subject.

## SCRAPPED 2026-10-01 — the premise was wrong; the gap was already closed

**The finding this bean was opened on was a static read of a client-rendered
page** — exactly the trap `rendered-verification` §"A STATIC read of a
client-rendered page is not verification" names. Measured on 2026-09-30 by
counting `fa-nav-top` contents in the gh-pages HTML; nothing there, so "no
supplier". But the index is built in the BROWSER:

- `cat-harness/docs/assets/js/docs-ui.js` `mountDocumentIndex()` mounts an
  **"On this page"** disclosure (`.fa-doc-index`) as a fixed-top child of
  `.side-bar` on every theme page, from `.main-content h2[id], h3[id]`, with
  `navbar.ts`'s selection rule restated (id required, nested by level, absent
  below two rows). It has been there since ~2026-09-22/23.
- Rendered in Chromium off gh-pages (`guides/agent-onboarding.html`, 1280×900,
  served at the correct `/folio-assistant/` base, 0 failed requests, 11
  stylesheets): the sidebar shows **"ON THIS PAGE 11"** before any change.

**The fix this bean proposed is the one that code already rejected, in its own
comment:** *"A build step that re-parsed our own output to learn what kramdown
had just done would be a second renderer."* A post-build `withDocumentIndex`
was built and tested on this branch (91/91, idempotent on real pages) and then
**withdrawn unshipped**: on a real page it produced a SECOND index under the
existing one, and rendered badly (each row's glyph on its own line).

The bean's own "Two shapes" section missed the third, already-built shape —
client-side — so neither of its options was needed.

Nothing remains here. If the two implementations of the selection rule
(`documentIndexOf` server-side, `mountDocumentIndex` client-side) are ever
seen to disagree, that is a new, narrower bean about a shared fixture, not
this one.

_2026-10-01T05:31:21Z_ — Claimed by claude/tbdl-jekyll-doc-index — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
